import Stripe from 'stripe';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../middlewares/errorHandler.js';

// Initialize Stripe
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-12-18.acacia',
});

// Plan details with features
export const PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      'Up to 50 saved influencers',
      'Basic search filters',
      '1 campaign',
      'Email support',
    ],
    limits: {
      savedInfluencers: 50,
      campaigns: 1,
      searches: 100,
      exports: 1,
    },
  },
  STARTER: {
    name: 'Starter',
    price: 29,
    priceId: config.stripe.prices.starter,
    features: [
      'Up to 500 saved influencers',
      'Advanced search filters',
      '5 campaigns',
      'CSV import/export',
      'Email templates',
      'Priority support',
    ],
    limits: {
      savedInfluencers: 500,
      campaigns: 5,
      searches: 1000,
      exports: 10,
    },
  },
  PROFESSIONAL: {
    name: 'Professional',
    price: 79,
    priceId: config.stripe.prices.professional,
    features: [
      'Unlimited saved influencers',
      'All search filters',
      'Unlimited campaigns',
      'Advanced analytics',
      'Team collaboration (up to 5)',
      'API access',
      'Dedicated support',
    ],
    limits: {
      savedInfluencers: -1, // unlimited
      campaigns: -1,
      searches: -1,
      exports: -1,
    },
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 199,
    priceId: config.stripe.prices.enterprise,
    features: [
      'Everything in Professional',
      'Unlimited team members',
      'Custom integrations',
      'White-label options',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    limits: {
      savedInfluencers: -1,
      campaigns: -1,
      searches: -1,
      exports: -1,
    },
  },
} as const;

export type PlanType = keyof typeof PLANS;

class StripeService {
  /**
   * Get or create a Stripe customer for a user
   */
  async getOrCreateCustomer(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { brandProfile: true },
    });

    if (!user) {
      throw NotFoundError('User not found');
    }

    // Return existing customer ID if available
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.brandProfile?.companyName || user.email,
      metadata: {
        userId: user.id,
      },
    });

    // Save customer ID to database
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(
    userId: string,
    plan: PlanType,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string }> {
    if (plan === 'FREE') {
      throw BadRequestError('Cannot create checkout for free plan');
    }

    const planDetails = PLANS[plan];
    if (!planDetails.priceId) {
      throw BadRequestError('Price not configured for this plan');
    }

    const customerId = await this.getOrCreateCustomer(userId);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: planDetails.priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        plan,
      },
      subscription_data: {
        metadata: {
          userId,
          plan,
        },
      },
    });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Create a billing portal session for managing subscription
   */
  async createPortalSession(userId: string, returnUrl: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.stripeCustomerId) {
      throw BadRequestError('No billing account found. Please subscribe first.');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  /**
   * Get user's current subscription
   */
  async getSubscription(userId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return {
        plan: 'FREE' as PlanType,
        status: 'ACTIVE',
        ...PLANS.FREE,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };
    }

    const planDetails = PLANS[subscription.plan as PlanType];

    return {
      ...subscription,
      ...planDetails,
    };
  }

  /**
   * Get all available plans
   */
  getPlans() {
    return Object.entries(PLANS).map(([key, plan]) => ({
      id: key,
      ...plan,
    }));
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(userId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw BadRequestError('No active subscription found');
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      },
    });
  }

  /**
   * Resume a canceled subscription
   */
  async resumeSubscription(userId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw BadRequestError('No subscription found');
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw BadRequestError('Subscription is not set to cancel');
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
    });
  }

  /**
   * Get payment history for user
   */
  async getPaymentHistory(userId: string, limit = 10) {
    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return payments;
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        config.stripe.webhookSecret
      );
    } catch (err: any) {
      throw BadRequestError(`Webhook signature verification failed: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  // ==================== Webhook Handlers ====================

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan as PlanType;

    if (!userId || !plan) {
      console.error('Missing metadata in checkout session');
      return;
    }

    // Subscription will be created/updated via subscription webhooks
    console.log(`Checkout completed for user ${userId}, plan ${plan}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;
    const plan = (subscription.metadata?.plan || 'STARTER') as PlanType;

    if (!userId) {
      // Try to find user by customer ID
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });
      if (!user) {
        console.error('Could not find user for subscription');
        return;
      }
    }

    const actualUserId = userId || (await prisma.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    }))?.id;

    if (!actualUserId) return;

    // Map Stripe status to our status
    const statusMap: Record<string, string> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      incomplete: 'INCOMPLETE',
      trialing: 'TRIALING',
    };

    await prisma.subscription.upsert({
      where: { userId: actualUserId },
      create: {
        userId: actualUserId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id || '',
        plan: plan,
        status: (statusMap[subscription.status] || 'ACTIVE') as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      update: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id || '',
        status: (statusMap[subscription.status] || 'ACTIVE') as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });

    if (!user) return;

    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      },
    });
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: invoice.customer as string },
    });

    if (!user) return;

    await prisma.payment.create({
      data: {
        userId: user.id,
        stripePaymentId: invoice.payment_intent as string || invoice.id,
        amount: invoice.amount_paid / 100, // Convert cents to dollars
        currency: invoice.currency.toUpperCase(),
        status: 'SUCCEEDED',
        description: invoice.description || `Subscription payment`,
        invoiceUrl: invoice.hosted_invoice_url,
        receiptUrl: invoice.invoice_pdf,
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
        },
      },
    });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: invoice.customer as string },
    });

    if (!user) return;

    await prisma.payment.create({
      data: {
        userId: user.id,
        stripePaymentId: invoice.payment_intent as string || invoice.id,
        amount: invoice.amount_due / 100,
        currency: invoice.currency.toUpperCase(),
        status: 'FAILED',
        description: `Failed payment for subscription`,
        metadata: {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
        },
      },
    });

    // Update subscription status
    if (user.id) {
      await prisma.subscription.update({
        where: { userId: user.id },
        data: { status: 'PAST_DUE' },
      });
    }
  }

  /**
   * Check if user has access to a feature based on their plan
   */
  async checkPlanLimit(
    userId: string,
    feature: 'savedInfluencers' | 'campaigns' | 'searches' | 'exports',
    currentCount: number
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    const subscription = await this.getSubscription(userId);
    const limits = subscription.limits;
    const limit = limits[feature];

    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, limit: -1, current: currentCount };
    }

    return {
      allowed: currentCount < limit,
      limit,
      current: currentCount,
    };
  }
}

export const stripeService = new StripeService();
