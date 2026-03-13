/**
 * CRM Integration Routes
 *
 * Endpoints for Salesforce and HubSpot CRM integrations
 * Supports both stored connections and legacy credential-passing
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as crmController from '../controllers/crm.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// Connection Management Routes
// ============================================

// GET /api/v1/crm/connections - List user's CRM connections
router.get('/connections', crmController.getConnections);

// GET /api/v1/crm/connections/:id - Get a single connection
router.get('/connections/:id', crmController.getConnection);

// PATCH /api/v1/crm/connections/:id - Update connection settings
router.patch('/connections/:id', crmController.updateConnection);

// GET /api/v1/crm/connections/:id/history - Get sync history
router.get('/connections/:id/history', crmController.getSyncHistory);

// GET /api/v1/crm/connections/:id/mappings - Get entity mappings
router.get('/connections/:id/mappings', crmController.getEntityMappings);

// POST /api/v1/crm/connections/:id/sync - Trigger full sync
router.post('/connections/:id/sync', crmController.triggerFullSync);

// ============================================
// Integration Discovery Routes
// ============================================

// GET /api/v1/crm/integrations - Get available CRM integrations
router.get('/integrations', crmController.getIntegrations);

// ============================================
// OAuth & Connection Routes
// ============================================

// GET /api/v1/crm/:crm/auth-url - Get OAuth URL for a CRM
router.get('/:crm/auth-url', crmController.getAuthUrl);

// POST /api/v1/crm/:crm/exchange - Exchange auth code for tokens (legacy)
router.post('/:crm/exchange', crmController.exchangeCode);

// POST /api/v1/crm/:crm/connect - Connect to CRM (stores credentials)
router.post('/:crm/connect', crmController.connect);

// DELETE /api/v1/crm/:crm/disconnect - Disconnect from a CRM
router.delete('/:crm/disconnect', crmController.disconnect);

// ============================================
// Sync Routes (support both stored and legacy credentials)
// ============================================

// POST /api/v1/crm/:crm/sync/influencer - Sync a single influencer
router.post('/:crm/sync/influencer', crmController.syncInfluencer);

// POST /api/v1/crm/:crm/sync/campaign - Sync a single campaign
router.post('/:crm/sync/campaign', crmController.syncCampaign);

// POST /api/v1/crm/:crm/sync/influencers/bulk - Bulk sync all influencers
router.post('/:crm/sync/influencers/bulk', crmController.bulkSyncInfluencers);

// POST /api/v1/crm/:crm/sync/campaigns/bulk - Bulk sync all campaigns
router.post('/:crm/sync/campaigns/bulk', crmController.bulkSyncCampaigns);

export default router;
