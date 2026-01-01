import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  influencerSearchSchema,
  saveInfluencerSchema,
  updateSavedInfluencerSchema,
  bulkCheckSavedSchema,
} from '../utils/validation.js';
import {
  searchInfluencers,
  getInfluencerProfile,
  getInfluencerAnalytics,
} from '../controllers/influencer.controller.js';
import {
  saveInfluencer,
  getSavedInfluencers,
  getSavedInfluencer,
  updateSavedInfluencer,
  removeSavedInfluencer,
  getFavorites,
  toggleFavorite,
  checkIfSaved,
  bulkCheckIfSaved,
  getStats,
} from '../controllers/savedInfluencer.controller.js';

const router = Router();

// ==================== ScrapCreators Search ====================

// POST /api/v1/influencers/search - Search influencers via ScrapCreators
router.post('/search', authenticate, validate(influencerSearchSchema), searchInfluencers);

// ==================== Saved Influencers ====================
// NOTE: These routes MUST come before /:platform/:id to avoid being matched as platform params

// GET /api/v1/influencers/saved/stats - Get saved influencer stats
router.get('/saved/stats', authenticate, getStats);

// GET /api/v1/influencers/saved/check - Check if an influencer is saved
router.get('/saved/check', authenticate, checkIfSaved);

// POST /api/v1/influencers/saved/check-bulk - Bulk check if influencers are saved
router.post('/saved/check-bulk', authenticate, validate(bulkCheckSavedSchema), bulkCheckIfSaved);

// GET /api/v1/influencers/saved - Get all saved influencers with filters
router.get('/saved', authenticate, getSavedInfluencers);

// POST /api/v1/influencers/saved - Save an influencer
router.post('/saved', authenticate, validate(saveInfluencerSchema), saveInfluencer);

// GET /api/v1/influencers/saved/:id - Get a single saved influencer
router.get('/saved/:id', authenticate, getSavedInfluencer);

// PATCH /api/v1/influencers/saved/:id - Update a saved influencer
router.patch('/saved/:id', authenticate, validate(updateSavedInfluencerSchema), updateSavedInfluencer);

// DELETE /api/v1/influencers/saved/:id - Remove a saved influencer
router.delete('/saved/:id', authenticate, removeSavedInfluencer);

// ==================== Favorites ====================

// GET /api/v1/influencers/favorites - Get all favorites
router.get('/favorites', authenticate, getFavorites);

// POST /api/v1/influencers/favorites/:id/toggle - Toggle favorite status
router.post('/favorites/:id/toggle', authenticate, toggleFavorite);

// ==================== ScrapCreators Profile (must be LAST due to :platform/:id params) ====================

// GET /api/v1/influencers/:platform/:id - Get influencer profile
router.get('/:platform/:id', authenticate, getInfluencerProfile);

// GET /api/v1/influencers/:platform/:id/analytics - Get influencer audience analytics
router.get('/:platform/:id/analytics', authenticate, getInfluencerAnalytics);

export default router;
