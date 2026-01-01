import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  saveInfluencerSchema,
  updateSavedInfluencerSchema,
  createListSchema,
  updateListSchema,
} from '../utils/validation.js';
import * as savedInfluencerController from '../controllers/savedInfluencer.controller.js';

const router = Router();

// ==================== Saved Influencers ====================

// GET /api/v1/saved-influencers - Get all saved influencers
router.get('/', authenticate, savedInfluencerController.getSavedInfluencers);

// GET /api/v1/saved-influencers/stats - Get saved influencers stats
router.get('/stats', authenticate, savedInfluencerController.getStats);

// GET /api/v1/saved-influencers/check - Check if influencer is saved
router.get('/check', authenticate, savedInfluencerController.checkIfSaved);

// POST /api/v1/saved-influencers/bulk-check - Bulk check if influencers are saved
router.post('/bulk-check', authenticate, savedInfluencerController.bulkCheckIfSaved);

// GET /api/v1/saved-influencers/favorites - Get favorite influencers
router.get('/favorites', authenticate, savedInfluencerController.getFavorites);

// POST /api/v1/saved-influencers - Save an influencer
router.post('/', authenticate, validate(saveInfluencerSchema), savedInfluencerController.saveInfluencer);

// GET /api/v1/saved-influencers/:id - Get a saved influencer
router.get('/:id', authenticate, savedInfluencerController.getSavedInfluencer);

// PATCH /api/v1/saved-influencers/:id - Update a saved influencer
router.patch('/:id', authenticate, validate(updateSavedInfluencerSchema), savedInfluencerController.updateSavedInfluencer);

// DELETE /api/v1/saved-influencers/:id - Remove a saved influencer
router.delete('/:id', authenticate, savedInfluencerController.removeSavedInfluencer);

// POST /api/v1/saved-influencers/:id/favorite - Toggle favorite
router.post('/:id/favorite', authenticate, savedInfluencerController.toggleFavorite);

// ==================== Lists ====================

// GET /api/v1/saved-influencers/lists - Get all lists
router.get('/lists/all', authenticate, savedInfluencerController.getLists);

// POST /api/v1/saved-influencers/lists - Create a list
router.post('/lists', authenticate, validate(createListSchema), savedInfluencerController.createList);

// GET /api/v1/saved-influencers/lists/:id - Get a list
router.get('/lists/:id', authenticate, savedInfluencerController.getList);

// PATCH /api/v1/saved-influencers/lists/:id - Update a list
router.patch('/lists/:id', authenticate, validate(updateListSchema), savedInfluencerController.updateList);

// DELETE /api/v1/saved-influencers/lists/:id - Delete a list
router.delete('/lists/:id', authenticate, savedInfluencerController.deleteList);

// GET /api/v1/saved-influencers/lists/:id/influencers - Get influencers in a list
router.get('/lists/:id/influencers', authenticate, savedInfluencerController.getInfluencersInList);

// POST /api/v1/saved-influencers/lists/:id/influencers - Add influencer to list
router.post('/lists/:id/influencers', authenticate, savedInfluencerController.addInfluencerToList);

// DELETE /api/v1/saved-influencers/lists/:id/influencers/:influencerId - Remove influencer from list
router.delete('/lists/:id/influencers/:influencerId', authenticate, savedInfluencerController.removeInfluencerFromList);

export default router;
