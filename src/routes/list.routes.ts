import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  createListSchema,
  updateListSchema,
  addInfluencerToListSchema,
} from '../utils/validation.js';
import {
  createList,
  getLists,
  getList,
  updateList,
  deleteList,
  addInfluencerToList,
  removeInfluencerFromList,
  getInfluencersInList,
} from '../controllers/savedInfluencer.controller.js';

const router = Router();

// GET /api/v1/lists - Get all lists
router.get('/', authenticate, getLists);

// POST /api/v1/lists - Create a new list
router.post('/', authenticate, validate(createListSchema), createList);

// GET /api/v1/lists/:id - Get a single list
router.get('/:id', authenticate, getList);

// PATCH /api/v1/lists/:id - Update a list
router.patch('/:id', authenticate, validate(updateListSchema), updateList);

// DELETE /api/v1/lists/:id - Delete a list
router.delete('/:id', authenticate, deleteList);

// GET /api/v1/lists/:id/influencers - Get influencers in a list
router.get('/:id/influencers', authenticate, getInfluencersInList);

// POST /api/v1/lists/:id/influencers - Add influencer to list
router.post('/:id/influencers', authenticate, validate(addInfluencerToListSchema), addInfluencerToList);

// DELETE /api/v1/lists/:id/influencers/:influencerId - Remove influencer from list
router.delete('/:id/influencers/:influencerId', authenticate, removeInfluencerFromList);

export default router;
