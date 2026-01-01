import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  createCampaignSchema,
  updateCampaignSchema,
  addCampaignInfluencerSchema,
  updateCampaignInfluencerSchema,
  duplicateCampaignSchema,
} from '../utils/validation.js';
import * as campaignController from '../controllers/campaign.controller.js';

const router = Router();

// ==================== Campaign CRUD ====================

// GET /api/v1/campaigns - List all campaigns
router.get('/', authenticate, campaignController.getCampaigns);

// GET /api/v1/campaigns/stats - Get campaign stats
router.get('/stats', authenticate, campaignController.getCampaignStats);

// POST /api/v1/campaigns - Create a campaign
router.post('/', authenticate, validate(createCampaignSchema), campaignController.createCampaign);

// GET /api/v1/campaigns/:id - Get a single campaign
router.get('/:id', authenticate, campaignController.getCampaign);

// PATCH /api/v1/campaigns/:id - Update a campaign
router.patch('/:id', authenticate, validate(updateCampaignSchema), campaignController.updateCampaign);

// DELETE /api/v1/campaigns/:id - Delete a campaign
router.delete('/:id', authenticate, campaignController.deleteCampaign);

// POST /api/v1/campaigns/:id/duplicate - Duplicate a campaign
router.post('/:id/duplicate', authenticate, validate(duplicateCampaignSchema), campaignController.duplicateCampaign);

// ==================== Campaign Influencers ====================

// GET /api/v1/campaigns/:id/influencers - Get campaign influencers
router.get('/:id/influencers', authenticate, campaignController.getCampaignInfluencers);

// POST /api/v1/campaigns/:id/influencers - Add influencer to campaign
router.post(
  '/:id/influencers',
  authenticate,
  validate(addCampaignInfluencerSchema),
  campaignController.addInfluencerToCampaign
);

// PATCH /api/v1/campaigns/:id/influencers/:influencerId - Update campaign influencer
router.patch(
  '/:id/influencers/:influencerId',
  authenticate,
  validate(updateCampaignInfluencerSchema),
  campaignController.updateCampaignInfluencer
);

// DELETE /api/v1/campaigns/:id/influencers/:influencerId - Remove influencer from campaign
router.delete(
  '/:id/influencers/:influencerId',
  authenticate,
  campaignController.removeInfluencerFromCampaign
);

// ==================== Campaign Activities ====================

// GET /api/v1/campaigns/:id/activities - Get campaign activities
router.get('/:id/activities', authenticate, campaignController.getCampaignActivities);

export default router;
