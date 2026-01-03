/**
 * Post Tracking Routes
 *
 * /api/v1/posts
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  trackPost,
  getPosts,
  getPost,
  deletePost,
  syncPost,
  getCampaignPosts,
  syncCampaignPosts,
  getCampaignAnalytics,
  getInfluencerAnalytics,
} from '../controllers/postTracking.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Basic post operations
router.post('/', trackPost);
router.get('/', getPosts);
router.get('/:id', getPost);
router.delete('/:id', deletePost);
router.post('/:id/sync', syncPost);

// Campaign-specific endpoints
router.get('/campaign/:campaignId', getCampaignPosts);
router.post('/campaign/:campaignId/sync', syncCampaignPosts);
router.get('/campaign/:campaignId/analytics', getCampaignAnalytics);

// Influencer-specific endpoints
router.get('/influencer/:influencerId/analytics', getInfluencerAnalytics);

export default router;
