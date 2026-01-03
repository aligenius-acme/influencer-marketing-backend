/**
 * API Key Routes
 *
 * API key management endpoints
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as apiKeyController from '../controllers/apiKey.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get available scopes
router.get('/scopes', apiKeyController.getScopes);

// API Key CRUD
router.post('/', apiKeyController.createApiKey);
router.get('/', apiKeyController.getApiKeys);
router.get('/:id', apiKeyController.getApiKey);
router.patch('/:id', apiKeyController.updateApiKey);
router.delete('/:id', apiKeyController.revokeApiKey);

// Regenerate and usage
router.post('/:id/regenerate', apiKeyController.regenerateApiKey);
router.get('/:id/usage', apiKeyController.getUsageStats);

export default router;
