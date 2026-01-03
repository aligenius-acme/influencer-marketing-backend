/**
 * Tenant/White-Label Routes
 *
 * Branding and custom domain endpoints
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as tenantController from '../controllers/tenant.controller.js';

const router = Router();

// Public endpoint - get branding by domain
router.get('/domain/:domain', tenantController.getBrandingByDomain);

// All other routes require authentication
router.use(authenticate);

// Branding
router.get('/:workspaceId/branding', tenantController.getBranding);
router.put('/:workspaceId/branding', tenantController.updateBranding);
router.delete('/:workspaceId/branding', tenantController.deleteBranding);

// Custom domain
router.post('/:workspaceId/domain', tenantController.setCustomDomain);
router.delete('/:workspaceId/domain', tenantController.removeCustomDomain);
router.get('/:workspaceId/domain/verification', tenantController.getDomainVerification);
router.post('/:workspaceId/domain/verify', tenantController.verifyDomain);

// Configuration
router.get('/:workspaceId/config', tenantController.getTenantConfig);
router.get('/:workspaceId/css', tenantController.getCssVariables);

export default router;
