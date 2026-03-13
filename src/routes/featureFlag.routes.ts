/**
 * Feature Flag Routes
 *
 * Feature flag management and checking endpoints
 */

import { Router } from 'express';
import { authenticate, optionalAuth } from '../middlewares/auth.js';
import * as featureFlagController from '../controllers/featureFlag.controller.js';

const router = Router();

// ============ Public/Optional Auth Routes ============
// Check if feature is enabled (optional auth for public pages)
router.get('/check/:key', optionalAuth, featureFlagController.checkFeatureFlag);

// Get all enabled features for current context
router.get('/enabled', optionalAuth, featureFlagController.getEnabledFeatures);

// Batch check multiple features
router.post('/check', optionalAuth, featureFlagController.checkFeatureFlags);

// ============ Admin Routes (require auth) ============
router.use(authenticate);

// CRUD operations (admin only)
router.get('/', featureFlagController.getFeatureFlags);
router.post('/', featureFlagController.createFeatureFlag);
router.get('/:id', featureFlagController.getFeatureFlagById);
router.patch('/:id', featureFlagController.updateFeatureFlag);
router.delete('/:id', featureFlagController.deleteFeatureFlag);

// Toggle feature by key
router.post('/:key/toggle', featureFlagController.toggleFeatureFlag);

// Seed default flags
router.post('/seed', featureFlagController.seedFeatureFlags);

export default router;
