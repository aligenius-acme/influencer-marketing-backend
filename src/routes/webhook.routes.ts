/**
 * Webhook Routes
 *
 * Webhook subscription and management endpoints
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as webhookController from '../controllers/webhook.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get available events
router.get('/events', webhookController.getEvents);

// ==================== Zapier Integration ====================
// These endpoints support Zapier's REST Hook and Polling patterns

// Get available events with sample data (for Zapier trigger setup)
router.get('/zapier/events', webhookController.getZapierEvents);

// Get sample data for a specific event (for Zapier field mapping)
router.get('/zapier/sample/:event', webhookController.getZapierSample);

// Subscribe to webhook (Zapier REST Hook - creates subscription)
router.post('/zapier/subscribe', webhookController.zapierSubscribe);

// Unsubscribe from webhook (Zapier REST Hook - removes subscription)
router.delete('/zapier/subscribe/:subscriptionId', webhookController.zapierUnsubscribe);

// Polling trigger (returns recent data for Zapier polling triggers)
router.get('/zapier/polling/:event', webhookController.zapierPolling);

// ==================== End Zapier Integration ====================

// Webhook CRUD
router.post('/', webhookController.createWebhook);
router.get('/', webhookController.getWebhooks);
router.get('/:id', webhookController.getWebhook);
router.patch('/:id', webhookController.updateWebhook);
router.delete('/:id', webhookController.deleteWebhook);

// Webhook actions
router.post('/:id/regenerate-secret', webhookController.regenerateSecret);
router.post('/:id/test', webhookController.testWebhook);
router.get('/:id/deliveries', webhookController.getDeliveries);

export default router;
