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
