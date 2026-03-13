/**
 * Feature Flag Controller
 *
 * Handles feature flag management endpoints
 */

import { Request, Response } from 'express';
import { featureFlagService } from '../services/featureFlag.service.js';
import {
  createFeatureFlagSchema,
  updateFeatureFlagSchema,
  toggleFeatureFlagSchema,
  checkFeatureFlagsSchema,
} from '../utils/featureFlag-validation.js';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Create a new feature flag
 * POST /api/v1/feature-flags
 */
export const createFeatureFlag = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only admins can create feature flags
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const validation = createFeatureFlagSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const flag = await featureFlagService.create(validation.data, userId);

    res.status(201).json({
      message: 'Feature flag created successfully',
      flag,
    });
  } catch (error: any) {
    console.error('[FeatureFlagController] Create error:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Feature flag key already exists' });
    }

    res.status(500).json({ error: 'Failed to create feature flag' });
  }
};

/**
 * Get all feature flags
 * GET /api/v1/feature-flags
 */
export const getFeatureFlags = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only admins can list all feature flags
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const flags = await featureFlagService.getAll();

    res.json({ flags });
  } catch (error) {
    console.error('[FeatureFlagController] Get all error:', error);
    res.status(500).json({ error: 'Failed to get feature flags' });
  }
};

/**
 * Get a single feature flag by ID
 * GET /api/v1/feature-flags/:id
 */
export const getFeatureFlagById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const flag = await featureFlagService.getById(id);

    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    res.json({ flag });
  } catch (error) {
    console.error('[FeatureFlagController] Get by ID error:', error);
    res.status(500).json({ error: 'Failed to get feature flag' });
  }
};

/**
 * Update a feature flag
 * PATCH /api/v1/feature-flags/:id
 */
export const updateFeatureFlag = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const validation = updateFeatureFlagSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { id } = req.params;
    const flag = await featureFlagService.update(id, validation.data, userId);

    res.json({
      message: 'Feature flag updated successfully',
      flag,
    });
  } catch (error: any) {
    console.error('[FeatureFlagController] Update error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    res.status(500).json({ error: 'Failed to update feature flag' });
  }
};

/**
 * Toggle a feature flag on/off by key
 * POST /api/v1/feature-flags/:key/toggle
 */
export const toggleFeatureFlag = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const validation = toggleFeatureFlagSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { key } = req.params;
    const flag = await featureFlagService.toggle(key, validation.data.enabled, userId);

    res.json({
      message: `Feature flag ${flag.enabled ? 'enabled' : 'disabled'} successfully`,
      flag,
    });
  } catch (error: any) {
    console.error('[FeatureFlagController] Toggle error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    res.status(500).json({ error: 'Failed to toggle feature flag' });
  }
};

/**
 * Delete a feature flag
 * DELETE /api/v1/feature-flags/:id
 */
export const deleteFeatureFlag = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    await featureFlagService.delete(id);

    res.json({ message: 'Feature flag deleted successfully' });
  } catch (error: any) {
    console.error('[FeatureFlagController] Delete error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    res.status(500).json({ error: 'Failed to delete feature flag' });
  }
};

/**
 * Check if a single feature is enabled
 * GET /api/v1/feature-flags/check/:key
 */
export const checkFeatureFlag = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { key } = req.params;
    const { tenantId } = req.query;

    const isEnabled = await featureFlagService.isEnabled(key, {
      userId,
      tenantId: tenantId as string | undefined,
    });

    res.json({ key, enabled: isEnabled });
  } catch (error) {
    console.error('[FeatureFlagController] Check error:', error);
    res.status(500).json({ error: 'Failed to check feature flag' });
  }
};

/**
 * Check multiple features at once
 * POST /api/v1/feature-flags/check
 */
export const checkFeatureFlags = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    const validation = checkFeatureFlagsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { keys, context } = validation.data;

    const results = await featureFlagService.checkMultiple(keys, {
      userId: context?.userId || userId,
      tenantId: context?.tenantId,
    });

    res.json({ features: results });
  } catch (error) {
    console.error('[FeatureFlagController] Check multiple error:', error);
    res.status(500).json({ error: 'Failed to check feature flags' });
  }
};

/**
 * Get all enabled features for current user
 * GET /api/v1/feature-flags/enabled
 */
export const getEnabledFeatures = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { tenantId } = req.query;

    const features = await featureFlagService.getEnabledFeatures({
      userId,
      tenantId: tenantId as string | undefined,
    });

    res.json({ features });
  } catch (error) {
    console.error('[FeatureFlagController] Get enabled error:', error);
    res.status(500).json({ error: 'Failed to get enabled features' });
  }
};

/**
 * Seed default feature flags (admin only)
 * POST /api/v1/feature-flags/seed
 */
export const seedFeatureFlags = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await featureFlagService.seedDefaults();
    const flags = await featureFlagService.getAll();

    res.json({
      message: 'Default feature flags seeded successfully',
      flags,
    });
  } catch (error) {
    console.error('[FeatureFlagController] Seed error:', error);
    res.status(500).json({ error: 'Failed to seed feature flags' });
  }
};
