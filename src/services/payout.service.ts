import Stripe from 'stripe';
import { config } from '../config/index.js';
import { prisma } from '../config/postgres.js';
import { BadRequestError, NotFoundError } from '../middlewares/errorHandler.js';
import { Decimal } from '@prisma/client/runtime/library';
import { emailService } from './email.service.js';
import { SavedInfluencer } from '../models/SavedInfluencer.js';

// Initialize Stripe
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StripeConstructor = Stripe as any;
const stripe: Stripe | null = config.stripe.secretKey
  ? (new StripeConstructor(config.stripe.secretKey) as Stripe)
  : null;

const MOCK_MODE = !stripe;

if (MOCK_MODE) {
  console.log('Stripe Connect not configured - using mock mode for payouts');
}

// Platform fee percentage (2.5% default)
const PLATFORM_FEE_PERCENT = 2.5;

// Mock data for testing without Stripe
function generateMockAccountId(): string {
  return `acct_mock_${Date.now().toString(36)}`;
}

function generateMockTransferId(): string {
  return `tr_mock_${Date.now().toString(36)}`;
}

export interface CreateConnectedAccountParams {
  savedInfluencerId: string;
  email: string;
  country?: string;
}

export interface CreatePayoutParams {
  userId: string;
  connectedAccountId: string;
  amount: number;
  currency?: string;
  description?: string;
  campaignId?: string;
  campaignInfluencerId?: string;
  invoiceId?: string;
  metadata?: Record<string, string>;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface CreateInvoiceParams {
  userId: string;
  savedInfluencerId: string;
  campaignId?: string;
  campaignInfluencerId?: string;
  contractId?: string;
  lineItems: LineItem[];
  notes?: string;
  paymentTerms?: string;
  dueDate: Date;
  taxRate?: number;
  discountAmount?: number;
}

class PayoutService {
  /**
   * Create a connected account for an influencer (Stripe Express)
   */
  async createConnectedAccount(params: CreateConnectedAccountParams) {
    const { savedInfluencerId, email, country = 'US' } = params;

    // Check if account already exists
    const existing = await prisma.connectedAccount.findUnique({
      where: { savedInfluencerId },
    });

    if (existing) {
      throw BadRequestError('Connected account already exists for this influencer');
    }

    let stripeAccountId: string;
    let onboardingUrl: string | null = null;

    if (MOCK_MODE) {
      stripeAccountId = generateMockAccountId();
      onboardingUrl = `http://localhost:3000/mock-onboarding?account=${stripeAccountId}`;
    } else {
      // Create Stripe Express account
      const account = await stripe!.accounts.create({
        type: 'express',
        country,
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          savedInfluencerId,
        },
      });

      stripeAccountId = account.id;

      // Create onboarding link
      const accountLink = await stripe!.accountLinks.create({
        account: account.id,
        refresh_url: `${config.frontendUrl}/settings/payouts?refresh=true`,
        return_url: `${config.frontendUrl}/settings/payouts?success=true`,
        type: 'account_onboarding',
      });

      onboardingUrl = accountLink.url;
    }

    // Save to database
    const connectedAccount = await prisma.connectedAccount.create({
      data: {
        savedInfluencerId,
        stripeAccountId,
        email,
        country,
        status: 'ONBOARDING',
      },
    });

    return {
      connectedAccount,
      onboardingUrl,
    };
  }

  /**
   * Get onboarding link for an existing account
   */
  async getOnboardingLink(connectedAccountId: string): Promise<string> {
    const account = await prisma.connectedAccount.findUnique({
      where: { id: connectedAccountId },
    });

    if (!account) {
      throw NotFoundError('Connected account not found');
    }

    if (MOCK_MODE) {
      return `http://localhost:3000/mock-onboarding?account=${account.stripeAccountId}`;
    }

    const accountLink = await stripe!.accountLinks.create({
      account: account.stripeAccountId,
      refresh_url: `${config.frontendUrl}/settings/payouts?refresh=true`,
      return_url: `${config.frontendUrl}/settings/payouts?success=true`,
      type: 'account_onboarding',
    });

    return accountLink.url;
  }

  /**
   * Get connected account status from Stripe
   */
  async syncAccountStatus(connectedAccountId: string) {
    const account = await prisma.connectedAccount.findUnique({
      where: { id: connectedAccountId },
    });

    if (!account) {
      throw NotFoundError('Connected account not found');
    }

    if (MOCK_MODE) {
      // Mock: Mark as active after "onboarding"
      return prisma.connectedAccount.update({
        where: { id: connectedAccountId },
        data: {
          status: 'ACTIVE',
          chargesEnabled: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
          onboardingCompletedAt: new Date(),
        },
      });
    }

    // Get account from Stripe
    const stripeAccount = await stripe!.accounts.retrieve(account.stripeAccountId);

    // Determine status
    let status: 'PENDING' | 'ONBOARDING' | 'ACTIVE' | 'RESTRICTED' | 'DISABLED' = 'PENDING';
    if (stripeAccount.details_submitted && stripeAccount.payouts_enabled) {
      status = 'ACTIVE';
    } else if (stripeAccount.details_submitted) {
      status = 'RESTRICTED';
    } else if (stripeAccount.requirements?.currently_due?.length) {
      status = 'ONBOARDING';
    }

    // Update database
    return prisma.connectedAccount.update({
      where: { id: connectedAccountId },
      data: {
        status,
        chargesEnabled: stripeAccount.charges_enabled,
        payoutsEnabled: stripeAccount.payouts_enabled,
        detailsSubmitted: stripeAccount.details_submitted,
        requirementsDue: stripeAccount.requirements?.currently_due || [],
        requirementsDisabled: stripeAccount.requirements?.disabled_reason || null,
        onboardingCompletedAt: stripeAccount.details_submitted ? new Date() : null,
      },
    });
  }

  /**
   * Get connected account by savedInfluencerId
   */
  async getConnectedAccountByInfluencer(savedInfluencerId: string) {
    return prisma.connectedAccount.findUnique({
      where: { savedInfluencerId },
      include: {
        payouts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  /**
   * Create a payout to an influencer
   */
  async createPayout(params: CreatePayoutParams) {
    const {
      userId,
      connectedAccountId,
      amount,
      currency = 'USD',
      description,
      campaignId,
      campaignInfluencerId,
      invoiceId,
      metadata = {},
    } = params;

    // Get connected account
    const account = await prisma.connectedAccount.findUnique({
      where: { id: connectedAccountId },
    });

    if (!account) {
      throw NotFoundError('Connected account not found');
    }

    if (account.status !== 'ACTIVE') {
      throw BadRequestError('Connected account is not active. Payouts are not enabled.');
    }

    // Calculate platform fee
    const fee = (amount * PLATFORM_FEE_PERCENT) / 100;
    const netAmount = amount - fee;

    let stripeTransferId: string | null = null;

    if (!MOCK_MODE) {
      // Create transfer to connected account
      const transfer = await stripe!.transfers.create({
        amount: Math.round(netAmount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        destination: account.stripeAccountId,
        description,
        metadata: {
          userId,
          campaignId: campaignId || '',
          ...metadata,
        },
      });

      stripeTransferId = transfer.id;
    } else {
      stripeTransferId = generateMockTransferId();
    }

    // Create payout record
    const payout = await prisma.payout.create({
      data: {
        connectedAccountId,
        userId,
        campaignId,
        campaignInfluencerId,
        invoiceId,
        stripeTransferId,
        amount: new Decimal(amount),
        currency,
        fee: new Decimal(fee),
        netAmount: new Decimal(netAmount),
        status: MOCK_MODE ? 'PAID' : 'PROCESSING',
        description,
        metadata,
        processedAt: MOCK_MODE ? new Date() : null,
        arrivedAt: MOCK_MODE ? new Date() : null,
      },
      include: {
        connectedAccount: true,
      },
    });

    return payout;
  }

  /**
   * Get payouts for a user (brand)
   */
  async getPayoutsByUser(userId: string, options: { status?: string; limit?: number; offset?: number } = {}) {
    const { status, limit = 20, offset = 0 } = options;

    const where: Record<string, unknown> = { userId };
    if (status) {
      where.status = status;
    }

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        include: {
          connectedAccount: true,
          invoice: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.payout.count({ where }),
    ]);

    return { payouts, total };
  }

  /**
   * Get payouts for a connected account (influencer)
   */
  async getPayoutsByAccount(connectedAccountId: string, options: { limit?: number; offset?: number } = {}) {
    const { limit = 20, offset = 0 } = options;

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where: { connectedAccountId },
        include: {
          invoice: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.payout.count({ where: { connectedAccountId } }),
    ]);

    return { payouts, total };
  }

  /**
   * Get payout statistics for a user
   */
  async getPayoutStats(userId: string) {
    const [totalPaid, pending, thisMonth] = await Promise.all([
      prisma.payout.aggregate({
        where: { userId, status: 'PAID' },
        _sum: { netAmount: true },
        _count: true,
      }),
      prisma.payout.aggregate({
        where: { userId, status: { in: ['PENDING', 'PROCESSING', 'IN_TRANSIT'] } },
        _sum: { netAmount: true },
        _count: true,
      }),
      prisma.payout.aggregate({
        where: {
          userId,
          status: 'PAID',
          createdAt: { gte: new Date(new Date().setDate(1)) },
        },
        _sum: { netAmount: true },
        _count: true,
      }),
    ]);

    return {
      totalPaid: Number(totalPaid._sum.netAmount || 0),
      totalPaidCount: totalPaid._count,
      pendingAmount: Number(pending._sum.netAmount || 0),
      pendingCount: pending._count,
      thisMonthAmount: Number(thisMonth._sum.netAmount || 0),
      thisMonthCount: thisMonth._count,
    };
  }

  // ==================== Invoice Management ====================

  /**
   * Generate invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: { startsWith: `INV-${year}${month}` },
      },
      orderBy: { invoiceNumber: 'desc' },
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-')[2] || '0');
      sequence = lastSeq + 1;
    }

    return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Create an invoice
   */
  async createInvoice(params: CreateInvoiceParams) {
    const {
      userId,
      savedInfluencerId,
      campaignId,
      campaignInfluencerId,
      contractId,
      lineItems,
      notes,
      paymentTerms,
      dueDate,
      taxRate = 0,
      discountAmount = 0,
    } = params;

    const invoiceNumber = await this.generateInvoiceNumber();

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount - discountAmount;

    const invoice = await prisma.invoice.create({
      data: {
        userId,
        savedInfluencerId,
        campaignId,
        campaignInfluencerId,
        contractId,
        invoiceNumber,
        subtotal: new Decimal(subtotal),
        taxAmount: new Decimal(taxAmount),
        taxRate: new Decimal(taxRate),
        discountAmount: new Decimal(discountAmount),
        total: new Decimal(total),
        lineItems: lineItems as unknown as Prisma.JsonArray,
        notes,
        paymentTerms,
        dueDate,
        status: 'DRAFT',
      },
    });

    return invoice;
  }

  /**
   * Get invoices for a user
   */
  async getInvoices(userId: string, options: { status?: string; limit?: number; offset?: number } = {}) {
    const { status, limit = 20, offset = 0 } = options;

    const where: Record<string, unknown> = { userId };
    if (status) {
      where.status = status;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.invoice.count({ where }),
    ]);

    return { invoices, total };
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        payouts: true,
      },
    });

    if (!invoice) {
      throw NotFoundError('Invoice not found');
    }

    return invoice;
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(invoiceId: string, status: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw NotFoundError('Invoice not found');
    }

    const updateData: Record<string, unknown> = { status };

    if (status === 'PAID') {
      updateData.paidAt = new Date();
    } else if (status === 'VOIDED') {
      updateData.voidedAt = new Date();
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });
  }

  /**
   * Send invoice (mark as sent) and send email notification
   */
  async sendInvoice(invoiceId: string) {
    // Get invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw NotFoundError('Invoice not found');
    }

    // Get user with brand profile separately
    const user = await prisma.user.findUnique({
      where: { id: invoice.userId },
      include: {
        brandProfile: true,
      },
    });

    // Update invoice status
    const updatedInvoice = await this.updateInvoiceStatus(invoiceId, 'SENT');

    // Get influencer details from MongoDB
    const influencer = await SavedInfluencer.findById(invoice.savedInfluencerId);

    if (influencer) {
      // Get email from connected account or custom fields
      const connectedAccount = await prisma.connectedAccount.findUnique({
        where: { savedInfluencerId: invoice.savedInfluencerId },
      });

      // Handle both Map type and plain object for customFields
      const customFields = influencer.customFields;
      let contactEmail: string | undefined;
      if (customFields instanceof Map) {
        contactEmail = customFields.get('contactEmail') as string;
      } else if (customFields && typeof customFields === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contactEmail = (customFields as any).contactEmail;
      }
      const influencerEmail =
        connectedAccount?.email ||
        contactEmail ||
        null;

      if (influencerEmail) {
        // Parse line items from JSON
        const lineItems = (invoice.lineItems as Array<{
          description: string;
          quantity: number;
          unitPrice: number;
          amount: number;
        }>) || [];

        // Send invoice email
        await emailService.sendInvoiceEmail(influencerEmail, {
          invoiceNumber: invoice.invoiceNumber,
          influencerName: influencer.profile.displayName || influencer.profile.username,
          brandName: user?.brandProfile?.companyName || 'Brand',
          total: Number(invoice.total),
          currency: invoice.currency,
          dueDate: invoice.dueDate,
          lineItems,
          notes: invoice.notes || undefined,
          paymentTerms: invoice.paymentTerms || undefined,
        });

        console.log(`[PayoutService] Invoice email sent to ${influencerEmail} for invoice ${invoice.invoiceNumber}`);
      } else {
        console.log(`[PayoutService] No email found for influencer ${invoice.savedInfluencerId}, skipping email notification`);
      }
    }

    return updatedInvoice;
  }

  /**
   * Mark invoice as paid and optionally create payout
   */
  async markInvoiceAsPaid(invoiceId: string, createPayout = true) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw NotFoundError('Invoice not found');
    }

    // Get user with brand profile separately
    const user = await prisma.user.findUnique({
      where: { id: invoice.userId },
      include: {
        brandProfile: true,
      },
    });

    const paidAt = new Date();

    // Update invoice status
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt,
      },
    });

    // Create payout if requested and connected account exists
    if (createPayout) {
      const connectedAccount = await prisma.connectedAccount.findUnique({
        where: { savedInfluencerId: invoice.savedInfluencerId },
      });

      if (connectedAccount && connectedAccount.status === 'ACTIVE') {
        await this.createPayout({
          userId: invoice.userId,
          connectedAccountId: connectedAccount.id,
          amount: Number(invoice.total),
          currency: invoice.currency,
          description: `Payment for Invoice ${invoice.invoiceNumber}`,
          campaignId: invoice.campaignId || undefined,
          campaignInfluencerId: invoice.campaignInfluencerId || undefined,
          invoiceId: invoice.id,
        });
      }
    }

    // Send payment confirmation email
    const influencer = await SavedInfluencer.findById(invoice.savedInfluencerId);
    if (influencer) {
      const connectedAccount = await prisma.connectedAccount.findUnique({
        where: { savedInfluencerId: invoice.savedInfluencerId },
      });

      // Handle both Map type and plain object for customFields
      const customFields = influencer.customFields;
      let contactEmail: string | undefined;
      if (customFields instanceof Map) {
        contactEmail = customFields.get('contactEmail') as string;
      } else if (customFields && typeof customFields === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contactEmail = (customFields as any).contactEmail;
      }
      const influencerEmail =
        connectedAccount?.email ||
        contactEmail ||
        null;

      if (influencerEmail) {
        await emailService.sendInvoicePaidEmail(influencerEmail, {
          invoiceNumber: invoice.invoiceNumber,
          influencerName: influencer.profile.displayName || influencer.profile.username,
          brandName: user?.brandProfile?.companyName || 'Brand',
          total: Number(invoice.total),
          currency: invoice.currency,
          paidAt,
        });

        console.log(`[PayoutService] Payment confirmation email sent to ${influencerEmail} for invoice ${invoice.invoiceNumber}`);
      }
    }

    return updatedInvoice;
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(userId: string) {
    const [draft, sent, paid, overdue] = await Promise.all([
      prisma.invoice.aggregate({
        where: { userId, status: 'DRAFT' },
        _sum: { total: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: { userId, status: 'SENT' },
        _sum: { total: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: { userId, status: 'PAID' },
        _sum: { total: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: { userId, status: 'OVERDUE' },
        _sum: { total: true },
        _count: true,
      }),
    ]);

    return {
      draft: { amount: Number(draft._sum.total || 0), count: draft._count },
      sent: { amount: Number(sent._sum.total || 0), count: sent._count },
      paid: { amount: Number(paid._sum.total || 0), count: paid._count },
      overdue: { amount: Number(overdue._sum.total || 0), count: overdue._count },
    };
  }

  // ==================== Webhook Handlers ====================

  /**
   * Handle Stripe Connect webhook events
   */
  async handleConnectWebhook(payload: Buffer, signature: string): Promise<void> {
    if (MOCK_MODE) return;

    let event: Stripe.Event;

    try {
      event = stripe!.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.connectWebhookSecret || config.stripe.webhookSecret
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw BadRequestError(`Webhook signature verification failed: ${message}`);
    }

    switch (event.type) {
      case 'account.updated':
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case 'transfer.created':
      case 'transfer.updated':
        await this.handleTransferUpdated(event.data.object as Stripe.Transfer);
        break;

      case 'payout.paid':
        await this.handlePayoutPaid(event.data.object as Stripe.Payout);
        break;

      case 'payout.failed':
        await this.handlePayoutFailed(event.data.object as Stripe.Payout);
        break;

      default:
        console.log(`Unhandled Connect event type: ${event.type}`);
    }
  }

  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    const connectedAccount = await prisma.connectedAccount.findUnique({
      where: { stripeAccountId: account.id },
    });

    if (!connectedAccount) return;

    await this.syncAccountStatus(connectedAccount.id);
  }

  private async handleTransferUpdated(transfer: Stripe.Transfer): Promise<void> {
    const payout = await prisma.payout.findUnique({
      where: { stripeTransferId: transfer.id },
    });

    if (!payout) return;

    // Map Stripe transfer status to our status
    const statusMap: Record<string, string> = {
      pending: 'PROCESSING',
      paid: 'IN_TRANSIT',
      failed: 'FAILED',
      canceled: 'CANCELLED',
    };

    const transferAny = transfer as unknown as { status: string };
    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        status: (statusMap[transferAny.status] || 'PROCESSING') as 'PROCESSING' | 'IN_TRANSIT' | 'FAILED' | 'CANCELLED',
        processedAt: new Date(),
      },
    });
  }

  private async handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
    // Find payout by stripe payout ID
    const payoutRecord = await prisma.payout.findFirst({
      where: { stripePayoutId: payout.id },
    });

    if (!payoutRecord) return;

    await prisma.payout.update({
      where: { id: payoutRecord.id },
      data: {
        status: 'PAID',
        arrivedAt: new Date(),
      },
    });
  }

  private async handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
    const payoutRecord = await prisma.payout.findFirst({
      where: { stripePayoutId: payout.id },
    });

    if (!payoutRecord) return;

    await prisma.payout.update({
      where: { id: payoutRecord.id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: payout.failure_message || 'Unknown failure',
      },
    });
  }
}

// Import Prisma type for JSON
import { Prisma } from '@prisma/client';

export const payoutService = new PayoutService();
