import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { getOverviewAnalytics, getCampaignAnalytics } from '../controllers/analytics.controller.js';

const router = Router();

// GET /api/v1/analytics/overview - Get overview analytics
router.get('/overview', authenticate, getOverviewAnalytics);

// GET /api/v1/analytics/campaigns/:id - Get campaign-specific analytics
router.get('/campaigns/:id', authenticate, getCampaignAnalytics);

export default router;
