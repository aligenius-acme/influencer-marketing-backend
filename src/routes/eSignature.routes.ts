/**
 * E-Signature Routes
 *
 * Routes for DocuSign integration and signature management
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as eSignatureController from '../controllers/eSignature.controller.js';

const router = Router();

// ==================== Configuration ====================

// Check e-signature configuration status
router.get('/config', authenticate, eSignatureController.getConfiguration);

// ==================== OAuth ====================

// Get DocuSign authorization URL
router.get('/auth/url', authenticate, eSignatureController.getAuthorizationUrl);

// OAuth callback (public - DocuSign redirects here)
router.get('/callback', eSignatureController.handleOAuthCallback);

// ==================== Signature Operations ====================

// Send contract for signature
router.post('/contracts/:contractId/send', authenticate, eSignatureController.sendForSignature);

// Get signature status for a contract
router.get('/contracts/:contractId/status', authenticate, eSignatureController.getSignatureStatus);

// Get signing URL for embedded signing
router.get('/contracts/:contractId/signing-url', eSignatureController.getSigningUrl);

// Void/cancel a signature request
router.post('/contracts/:contractId/void', authenticate, eSignatureController.voidSignatureRequest);

// Mock sign (for testing in mock mode)
router.post('/contracts/:contractId/mock-sign', eSignatureController.mockSign);

// ==================== Webhooks ====================

// DocuSign webhook endpoint
router.post('/webhook', eSignatureController.handleWebhook);

export default router;
