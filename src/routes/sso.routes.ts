/**
 * SSO (Single Sign-On) Routes
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as ssoController from '../controllers/sso.controller.js';

const router = Router();

// ==================== Public Routes (Callbacks) ====================

// SAML callback (POST from IdP)
router.post('/saml/callback', ssoController.handleSamlCallback);

// OIDC callback (GET from IdP)
router.get('/oidc/callback', ssoController.handleOidcCallback);

// Google Workspace callback
router.get('/google/callback', ssoController.handleGoogleCallback);

// SP metadata for SAML (public)
router.get('/metadata/:workspaceId', ssoController.getSpMetadata);

// ==================== Login Initiation ====================

// Get SSO login URL for a workspace (public - before auth)
router.get('/login/:workspaceId', ssoController.initiateLogin);

// Get available SSO providers
router.get('/providers', ssoController.getProviders);

// ==================== Configuration (Protected) ====================

// Get SSO configuration for a workspace
router.get('/config/:workspaceId', authenticate, ssoController.getConfiguration);

// Configure SSO for a workspace
router.post('/config/:workspaceId', authenticate, ssoController.configureSSO);

// Delete SSO configuration
router.delete('/config/:workspaceId', authenticate, ssoController.deleteConfiguration);

// Toggle SSO active status
router.post('/config/:workspaceId/toggle', authenticate, ssoController.toggleConfiguration);

export default router;
