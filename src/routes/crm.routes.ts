/**
 * CRM Integration Routes
 *
 * Endpoints for Salesforce and HubSpot CRM integrations
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as crmController from '../controllers/crm.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/crm/integrations - Get available CRM integrations
router.get('/integrations', crmController.getIntegrations);

// GET /api/v1/crm/:crm/auth-url - Get OAuth URL for a CRM
router.get('/:crm/auth-url', crmController.getAuthUrl);

// POST /api/v1/crm/:crm/exchange - Exchange auth code for tokens
router.post('/:crm/exchange', crmController.exchangeCode);

// POST /api/v1/crm/:crm/sync/influencer - Sync a single influencer
router.post('/:crm/sync/influencer', crmController.syncInfluencer);

// POST /api/v1/crm/:crm/sync/campaign - Sync a single campaign
router.post('/:crm/sync/campaign', crmController.syncCampaign);

// POST /api/v1/crm/:crm/sync/influencers/bulk - Bulk sync all influencers
router.post('/:crm/sync/influencers/bulk', crmController.bulkSyncInfluencers);

// POST /api/v1/crm/:crm/sync/campaigns/bulk - Bulk sync all campaigns
router.post('/:crm/sync/campaigns/bulk', crmController.bulkSyncCampaigns);

export default router;
