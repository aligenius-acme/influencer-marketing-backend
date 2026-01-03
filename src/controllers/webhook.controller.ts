/**
 * Webhook Controller
 *
 * Handles webhook subscription and management endpoints
 */

import { Request, Response } from 'express';
import { webhookService, WEBHOOK_EVENTS } from '../services/webhook.service.js';
import { auditService, AUDIT_ACTIONS, RESOURCE_TYPES } from '../services/audit.service.js';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Create a webhook
 */
export const createWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, url, events, workspaceId } = req.body;

    if (!name || !url || !events || events.length === 0) {
      return res.status(400).json({
        error: 'Name, URL, and at least one event are required',
      });
    }

    const webhook = await webhookService.createWebhook(userId, {
      name,
      url,
      events,
      workspaceId,
    });

    // Log audit event
    await auditService.logCreate(
      RESOURCE_TYPES.WEBHOOK,
      webhook.id,
      webhook.name,
      { name, url, events },
      { workspaceId, userId }
    );

    res.status(201).json({
      message: 'Webhook created successfully',
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        secret: webhook.secret, // Only shown once
        isActive: webhook.isActive,
        createdAt: webhook.createdAt,
      },
      warning: 'Save the webhook secret securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('[WebhookController] Create error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create webhook';
    res.status(400).json({ error: message });
  }
};

/**
 * Get all webhooks
 */
export const getWebhooks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { workspaceId } = req.query;

    const webhooks = await webhookService.getWebhooks({
      userId,
      workspaceId: workspaceId as string,
    });

    res.json({ webhooks });
  } catch (error) {
    console.error('[WebhookController] Get webhooks error:', error);
    res.status(500).json({ error: 'Failed to get webhooks' });
  }
};

/**
 * Get webhook by ID
 */
export const getWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const webhook = await webhookService.getWebhook(id);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Don't expose secret
    const { secret, ...webhookData } = webhook;

    res.json({ webhook: webhookData });
  } catch (error) {
    console.error('[WebhookController] Get webhook error:', error);
    res.status(500).json({ error: 'Failed to get webhook' });
  }
};

/**
 * Update webhook
 */
export const updateWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { name, url, events, isActive } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const webhook = await webhookService.updateWebhook(id, {
      name,
      url,
      events,
      isActive,
    });

    // Log audit event
    await auditService.logUpdate(
      RESOURCE_TYPES.WEBHOOK,
      id,
      webhook.name,
      {},
      { name, url, events, isActive },
      { userId }
    );

    res.json({
      message: 'Webhook updated successfully',
      webhook,
    });
  } catch (error) {
    console.error('[WebhookController] Update error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update webhook';
    res.status(400).json({ error: message });
  }
};

/**
 * Delete webhook
 */
export const deleteWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const webhook = await webhookService.getWebhook(id);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    await webhookService.deleteWebhook(id);

    // Log audit event
    await auditService.logDelete(
      RESOURCE_TYPES.WEBHOOK,
      id,
      webhook.name,
      { name: webhook.name, url: webhook.url },
      { userId }
    );

    res.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('[WebhookController] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
};

/**
 * Regenerate webhook secret
 */
export const regenerateSecret = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await webhookService.regenerateSecret(id);

    res.json({
      message: 'Secret regenerated successfully',
      id: result.id,
      secret: result.secret,
      warning: 'Save the new secret securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('[WebhookController] Regenerate secret error:', error);
    res.status(500).json({ error: 'Failed to regenerate secret' });
  }
};

/**
 * Test webhook
 */
export const testWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await webhookService.testWebhook(id);

    res.json(result);
  } catch (error) {
    console.error('[WebhookController] Test error:', error);
    const message = error instanceof Error ? error.message : 'Failed to test webhook';
    res.status(400).json({ error: message });
  }
};

/**
 * Get webhook deliveries
 */
export const getDeliveries = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit } = req.query;

    const deliveries = await webhookService.getDeliveries(
      id,
      limit ? parseInt(limit as string, 10) : 50
    );

    res.json({ deliveries });
  } catch (error) {
    console.error('[WebhookController] Get deliveries error:', error);
    res.status(500).json({ error: 'Failed to get deliveries' });
  }
};

/**
 * Get available webhook events
 */
export const getEvents = async (_req: Request, res: Response) => {
  try {
    res.json({ events: WEBHOOK_EVENTS });
  } catch (error) {
    console.error('[WebhookController] Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
};
