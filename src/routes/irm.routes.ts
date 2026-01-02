import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
  reorderFieldsSchema,
  createCommunicationLogSchema,
  updateCommunicationLogSchema,
  createInfluencerReviewSchema,
  updateInfluencerReviewSchema,
  createTagGroupSchema,
  updateTagGroupSchema,
} from '../utils/irm-validation.js';
import * as irmController from '../controllers/irm.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== Custom Fields ====================

/**
 * @route   GET /api/v1/irm/custom-fields
 * @desc    Get all custom field definitions
 */
router.get('/custom-fields', irmController.getCustomFields);

/**
 * @route   GET /api/v1/irm/custom-fields/:id
 * @desc    Get a custom field definition
 */
router.get('/custom-fields/:id', irmController.getCustomField);

/**
 * @route   POST /api/v1/irm/custom-fields
 * @desc    Create a new custom field
 */
router.post(
  '/custom-fields',
  validate(createCustomFieldSchema),
  irmController.createCustomField
);

/**
 * @route   PATCH /api/v1/irm/custom-fields/:id
 * @desc    Update a custom field
 */
router.patch(
  '/custom-fields/:id',
  validate(updateCustomFieldSchema),
  irmController.updateCustomField
);

/**
 * @route   DELETE /api/v1/irm/custom-fields/:id
 * @desc    Delete a custom field
 */
router.delete('/custom-fields/:id', irmController.deleteCustomField);

/**
 * @route   POST /api/v1/irm/custom-fields/reorder
 * @desc    Reorder custom fields
 */
router.post(
  '/custom-fields/reorder',
  validate(reorderFieldsSchema),
  irmController.reorderCustomFields
);

// ==================== Communication Logs ====================

/**
 * @route   GET /api/v1/irm/communications
 * @desc    Get communication logs
 */
router.get('/communications', irmController.getCommunicationLogs);

/**
 * @route   GET /api/v1/irm/communications/:id
 * @desc    Get a communication log
 */
router.get('/communications/:id', irmController.getCommunicationLog);

/**
 * @route   POST /api/v1/irm/communications
 * @desc    Create a communication log
 */
router.post(
  '/communications',
  validate(createCommunicationLogSchema),
  irmController.createCommunicationLog
);

/**
 * @route   PATCH /api/v1/irm/communications/:id
 * @desc    Update a communication log
 */
router.patch(
  '/communications/:id',
  validate(updateCommunicationLogSchema),
  irmController.updateCommunicationLog
);

/**
 * @route   DELETE /api/v1/irm/communications/:id
 * @desc    Delete a communication log
 */
router.delete('/communications/:id', irmController.deleteCommunicationLog);

// ==================== Influencer Reviews ====================

/**
 * @route   GET /api/v1/irm/reviews
 * @desc    Get influencer reviews
 */
router.get('/reviews', irmController.getInfluencerReviews);

/**
 * @route   GET /api/v1/irm/reviews/:id
 * @desc    Get an influencer review
 */
router.get('/reviews/:id', irmController.getInfluencerReview);

/**
 * @route   POST /api/v1/irm/reviews
 * @desc    Create an influencer review
 */
router.post(
  '/reviews',
  validate(createInfluencerReviewSchema),
  irmController.createInfluencerReview
);

/**
 * @route   PATCH /api/v1/irm/reviews/:id
 * @desc    Update an influencer review
 */
router.patch(
  '/reviews/:id',
  validate(updateInfluencerReviewSchema),
  irmController.updateInfluencerReview
);

/**
 * @route   DELETE /api/v1/irm/reviews/:id
 * @desc    Delete an influencer review
 */
router.delete('/reviews/:id', irmController.deleteInfluencerReview);

/**
 * @route   GET /api/v1/irm/influencers/:influencerId/rating-summary
 * @desc    Get influencer rating summary
 */
router.get(
  '/influencers/:influencerId/rating-summary',
  irmController.getInfluencerRatingSummary
);

// ==================== Tag Groups ====================

/**
 * @route   GET /api/v1/irm/tag-groups
 * @desc    Get all tag groups
 */
router.get('/tag-groups', irmController.getTagGroups);

/**
 * @route   POST /api/v1/irm/tag-groups
 * @desc    Create a tag group
 */
router.post(
  '/tag-groups',
  validate(createTagGroupSchema),
  irmController.createTagGroup
);

/**
 * @route   PATCH /api/v1/irm/tag-groups/:id
 * @desc    Update a tag group
 */
router.patch(
  '/tag-groups/:id',
  validate(updateTagGroupSchema),
  irmController.updateTagGroup
);

/**
 * @route   DELETE /api/v1/irm/tag-groups/:id
 * @desc    Delete a tag group
 */
router.delete('/tag-groups/:id', irmController.deleteTagGroup);

/**
 * @route   POST /api/v1/irm/tag-groups/initialize
 * @desc    Initialize default tag groups for user
 */
router.post('/tag-groups/initialize', irmController.initializeTagGroups);

export default router;
