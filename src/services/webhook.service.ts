/**
 * Webhook Service
 *
 * Handles webhook management and delivery:
 * - Webhook CRUD operations
 * - Event dispatch
 * - Delivery tracking
 * - Retry logic
 */

import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Supported webhook events
export const WEBHOOK_EVENTS = {
  // Campaign events
  'campaign.created': 'When a new campaign is created',
  'campaign.updated': 'When a campaign is updated',
  'campaign.deleted': 'When a campaign is deleted',
  'campaign.status_changed': 'When a campaign status changes',

  // Influencer events
  'influencer.added': 'When an influencer is added to campaign',
  'influencer.status_changed': 'When influencer status changes in campaign',
  'influencer.removed': 'When an influencer is removed from campaign',

  // Contract events
  'contract.created': 'When a new contract is created',
  'contract.signed': 'When a contract is signed',
  'contract.expired': 'When a contract expires',

  // Content events
  'content.submitted': 'When content is submitted for review',
  'content.approved': 'When content is approved',
  'content.rejected': 'When content is rejected',

  // Payment events
  'payment.completed': 'When a payment is completed',
  'payment.failed': 'When a payment fails',

  // Team events
  'member.joined': 'When a new member joins workspace',
  'member.removed': 'When a member is removed from workspace',
};

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

class WebhookService {
  /**
   * Create a webhook subscription
   */
  async createWebhook(
    userId: string,
    data: {
      name: string;
      url: string;
      events: string[];
      workspaceId?: string;
    }
  ) {
    // Validate events
    const invalidEvents = data.events.filter((e) => !WEBHOOK_EVENTS[e as keyof typeof WEBHOOK_EVENTS]);
    if (invalidEvents.length > 0) {
      throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
    }

    // Validate URL
    try {
      new URL(data.url);
    } catch {
      throw new Error('Invalid webhook URL');
    }

    // Generate signing secret
    const secret = crypto.randomBytes(32).toString('hex');

    return prisma.webhook.create({
      data: {
        userId,
        workspaceId: data.workspaceId,
        name: data.name,
        url: data.url,
        events: data.events,
        secret,
      },
    });
  }

  /**
   * Get webhooks for user/workspace
   */
  async getWebhooks(params: { userId?: string; workspaceId?: string }) {
    const where: { userId?: string; workspaceId?: string | null } = {};

    if (params.workspaceId) {
      where.workspaceId = params.workspaceId;
    } else if (params.userId) {
      where.userId = params.userId;
      where.workspaceId = null;
    }

    return prisma.webhook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        lastDeliveredAt: true,
        lastStatus: true,
        failureCount: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(webhookId: string) {
    return prisma.webhook.findUnique({
      where: { id: webhookId },
      include: {
        deliveries: {
          orderBy: { deliveredAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    webhookId: string,
    data: {
      name?: string;
      url?: string;
      events?: string[];
      isActive?: boolean;
    }
  ) {
    if (data.events) {
      const invalidEvents = data.events.filter((e) => !WEBHOOK_EVENTS[e as keyof typeof WEBHOOK_EVENTS]);
      if (invalidEvents.length > 0) {
        throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
      }
    }

    if (data.url) {
      try {
        new URL(data.url);
      } catch {
        throw new Error('Invalid webhook URL');
      }
    }

    return prisma.webhook.update({
      where: { id: webhookId },
      data,
    });
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string) {
    return prisma.webhook.delete({
      where: { id: webhookId },
    });
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(webhookId: string) {
    const secret = crypto.randomBytes(32).toString('hex');

    return prisma.webhook.update({
      where: { id: webhookId },
      data: { secret },
      select: {
        id: true,
        secret: true,
      },
    });
  }

  /**
   * Dispatch an event to all subscribed webhooks
   */
  async dispatch(
    event: string,
    data: Record<string, unknown>,
    options?: {
      userId?: string;
      workspaceId?: string;
    }
  ) {
    // Find all active webhooks subscribed to this event
    const where: {
      isActive: boolean;
      events: { has: string };
      userId?: string;
      workspaceId?: string | null;
    } = {
      isActive: true,
      events: { has: event },
    };

    if (options?.workspaceId) {
      where.workspaceId = options.workspaceId;
    } else if (options?.userId) {
      where.userId = options.userId;
    }

    const webhooks = await prisma.webhook.findMany({ where });

    // Dispatch to all webhooks
    const results = await Promise.allSettled(
      webhooks.map((webhook) => this.deliver(webhook, event, data))
    );

    return {
      dispatched: webhooks.length,
      successful: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    };
  }

  /**
   * Deliver a webhook payload
   */
  private async deliver(
    webhook: { id: string; url: string; secret: string },
    event: string,
    data: Record<string, unknown>,
    attempt: number = 1
  ): Promise<{ success: boolean; statusCode: number }> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const body = JSON.stringify(payload);

    // Generate HMAC signature
    const signature = this.sign(body, webhook.secret);

    const startTime = Date.now();
    let statusCode: number | null = null;
    let response: string | null = null;

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'X-Webhook-Timestamp': payload.timestamp,
        },
        body,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      statusCode = res.status;
      response = await res.text().catch(() => null);

      // Record delivery
      await this.recordDelivery(webhook.id, event, payload, {
        statusCode,
        response,
        duration: Date.now() - startTime,
        attempt,
      });

      // Update webhook stats
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastDeliveredAt: new Date(),
          lastStatus: statusCode,
          failureCount: statusCode >= 200 && statusCode < 300 ? 0 : { increment: 1 },
        },
      });

      // Check if successful
      if (statusCode >= 200 && statusCode < 300) {
        return { success: true, statusCode };
      } else {
        throw new Error(`Webhook returned status ${statusCode}`);
      }
    } catch (error) {
      // Record failed delivery
      await this.recordDelivery(webhook.id, event, payload, {
        statusCode: statusCode || 0,
        response: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        attempt,
      });

      // Update failure count
      await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          lastDeliveredAt: new Date(),
          lastStatus: statusCode || 0,
          failureCount: { increment: 1 },
        },
      });

      // Retry logic (up to 3 attempts)
      if (attempt < 3) {
        // Schedule retry with exponential backoff
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.deliver(webhook, event, data, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Sign a payload with HMAC-SHA256
   */
  sign(payload: string, secret: string): string {
    return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  }

  /**
   * Verify a webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = this.sign(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  /**
   * Record a delivery attempt
   */
  private async recordDelivery(
    webhookId: string,
    event: string,
    payload: WebhookPayload,
    result: {
      statusCode: number | null;
      response: string | null;
      duration: number;
      attempt: number;
    }
  ) {
    return prisma.webhookDelivery.create({
      data: {
        webhookId,
        event,
        payload: payload as unknown as Prisma.InputJsonValue,
        statusCode: result.statusCode,
        response: result.response,
        duration: result.duration,
        attempt: result.attempt,
      },
    });
  }

  /**
   * Get delivery history for a webhook
   */
  async getDeliveries(webhookId: string, limit: number = 50) {
    return prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { deliveredAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Test a webhook by sending a test payload
   */
  async testWebhook(webhookId: string) {
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testData = {
      test: true,
      message: 'This is a test webhook delivery',
    };

    try {
      await this.deliver(webhook, 'webhook.test', testData);
      return { success: true, message: 'Test webhook delivered successfully' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Delivery failed',
      };
    }
  }

  /**
   * Disable webhooks with too many failures
   */
  async disableFailingWebhooks(maxFailures: number = 10) {
    const result = await prisma.webhook.updateMany({
      where: {
        failureCount: { gte: maxFailures },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return { disabled: result.count };
  }

  // ==================== Zapier Integration ====================

  /**
   * Get sample data for an event type (used by Zapier for field mapping)
   */
  getSampleData(event: string): Record<string, unknown> {
    const samples: Record<string, Record<string, unknown>> = {
      'campaign.created': {
        id: 'sample-campaign-id',
        name: 'Summer Fashion Campaign',
        description: 'A seasonal fashion promotion campaign',
        status: 'DRAFT',
        platform: 'instagram',
        budget: 10000,
        currency: 'USD',
        startDate: '2024-06-01',
        endDate: '2024-08-31',
        createdAt: new Date().toISOString(),
      },
      'campaign.updated': {
        id: 'sample-campaign-id',
        name: 'Summer Fashion Campaign',
        status: 'ACTIVE',
        changes: ['status', 'budget'],
        previousValues: { status: 'DRAFT', budget: 10000 },
        newValues: { status: 'ACTIVE', budget: 15000 },
        updatedAt: new Date().toISOString(),
      },
      'campaign.status_changed': {
        id: 'sample-campaign-id',
        name: 'Summer Fashion Campaign',
        previousStatus: 'DRAFT',
        newStatus: 'ACTIVE',
        changedAt: new Date().toISOString(),
      },
      'influencer.added': {
        campaignId: 'sample-campaign-id',
        campaignName: 'Summer Fashion Campaign',
        influencer: {
          id: 'sample-influencer-id',
          username: '@fashionista',
          displayName: 'Sarah Fashion',
          platform: 'instagram',
          followers: 150000,
          engagementRate: 3.5,
        },
        addedAt: new Date().toISOString(),
      },
      'influencer.status_changed': {
        campaignId: 'sample-campaign-id',
        influencerId: 'sample-influencer-id',
        influencerUsername: '@fashionista',
        previousStatus: 'INVITED',
        newStatus: 'ACCEPTED',
        changedAt: new Date().toISOString(),
      },
      'contract.created': {
        id: 'sample-contract-id',
        title: 'Influencer Partnership Agreement',
        status: 'DRAFT',
        campaignId: 'sample-campaign-id',
        influencerId: 'sample-influencer-id',
        paymentAmount: 2500,
        currency: 'USD',
        createdAt: new Date().toISOString(),
      },
      'contract.signed': {
        id: 'sample-contract-id',
        title: 'Influencer Partnership Agreement',
        status: 'SIGNED',
        signedAt: new Date().toISOString(),
        signers: [
          { name: 'Brand Manager', email: 'manager@brand.com', signedAt: new Date().toISOString() },
          { name: 'Sarah Fashion', email: 'sarah@email.com', signedAt: new Date().toISOString() },
        ],
      },
      'content.submitted': {
        id: 'sample-content-id',
        campaignId: 'sample-campaign-id',
        influencerId: 'sample-influencer-id',
        influencerUsername: '@fashionista',
        contentType: 'image',
        caption: 'Loving this new summer collection! #sponsored',
        submittedAt: new Date().toISOString(),
      },
      'content.approved': {
        id: 'sample-content-id',
        campaignId: 'sample-campaign-id',
        influencerId: 'sample-influencer-id',
        approvedBy: 'Brand Manager',
        approvedAt: new Date().toISOString(),
      },
      'content.rejected': {
        id: 'sample-content-id',
        campaignId: 'sample-campaign-id',
        influencerId: 'sample-influencer-id',
        reason: 'Caption needs revision - please add disclosure',
        rejectedBy: 'Brand Manager',
        rejectedAt: new Date().toISOString(),
      },
      'payment.completed': {
        id: 'sample-payment-id',
        campaignId: 'sample-campaign-id',
        influencerId: 'sample-influencer-id',
        influencerName: 'Sarah Fashion',
        amount: 2500,
        currency: 'USD',
        method: 'stripe',
        completedAt: new Date().toISOString(),
      },
      'payment.failed': {
        id: 'sample-payment-id',
        campaignId: 'sample-campaign-id',
        influencerId: 'sample-influencer-id',
        amount: 2500,
        currency: 'USD',
        error: 'Insufficient funds',
        failedAt: new Date().toISOString(),
      },
      'member.joined': {
        workspaceId: 'sample-workspace-id',
        workspaceName: 'Acme Brand',
        member: {
          id: 'sample-user-id',
          email: 'newmember@email.com',
          name: 'New Member',
          role: 'MEMBER',
        },
        joinedAt: new Date().toISOString(),
      },
      'member.removed': {
        workspaceId: 'sample-workspace-id',
        workspaceName: 'Acme Brand',
        member: {
          id: 'sample-user-id',
          email: 'former@email.com',
          name: 'Former Member',
        },
        removedAt: new Date().toISOString(),
      },
    };

    return samples[event] || {
      event,
      message: 'Sample data for this event',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all available events with descriptions (for Zapier trigger selection)
   */
  getAvailableEvents() {
    return Object.entries(WEBHOOK_EVENTS).map(([event, description]) => ({
      event,
      description,
      sample: this.getSampleData(event),
    }));
  }

  /**
   * Subscribe to a webhook (Zapier REST Hook style)
   * Returns the subscription ID
   */
  async zapierSubscribe(
    userId: string,
    hookUrl: string,
    event: string
  ): Promise<{ subscriptionId: string }> {
    if (!WEBHOOK_EVENTS[event as keyof typeof WEBHOOK_EVENTS]) {
      throw new Error(`Invalid event: ${event}`);
    }

    const webhook = await this.createWebhook(userId, {
      name: `Zapier - ${event}`,
      url: hookUrl,
      events: [event],
    });

    return { subscriptionId: webhook.id };
  }

  /**
   * Unsubscribe from a webhook (Zapier REST Hook style)
   */
  async zapierUnsubscribe(subscriptionId: string): Promise<void> {
    await this.deleteWebhook(subscriptionId);
  }

  /**
   * Perform list for Zapier polling triggers
   * Returns recent events for polling-based triggers
   */
  async zapierPollingList(
    userId: string,
    event: string,
    limit: number = 50
  ): Promise<Record<string, unknown>[]> {
    // Query the appropriate data based on event type
    switch (event) {
      case 'campaign.created':
      case 'campaign.updated':
      case 'campaign.status_changed': {
        const campaigns = await prisma.campaign.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        });
        return campaigns.map(c => ({
          id: c.id,
          name: c.name,
          status: c.status,
          platform: c.platform,
          budget: c.budget?.toString(),
          startDate: c.startDate?.toISOString(),
          endDate: c.endDate?.toISOString(),
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }));
      }

      case 'contract.created':
      case 'contract.signed': {
        const contracts = await prisma.contract.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        });
        return contracts.map(c => ({
          id: c.id,
          title: c.title,
          status: c.status,
          paymentAmount: c.paymentAmount?.toString(),
          signedAt: c.signedAt?.toISOString(),
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }));
      }

      case 'payment.completed':
      case 'payment.failed': {
        const payouts = await prisma.payout.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        return payouts.map(p => ({
          id: p.id,
          amount: p.amount.toString(),
          currency: p.currency,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        }));
      }

      default:
        return [this.getSampleData(event)];
    }
  }
}

export const webhookService = new WebhookService();
export default webhookService;
