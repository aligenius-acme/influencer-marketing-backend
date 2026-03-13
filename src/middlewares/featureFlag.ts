/**
 * Feature Flag Middleware
 *
 * Middleware to protect routes based on feature flags
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { featureFlagService } from '../services/featureFlag.service.js';

interface FeatureGuardOptions {
  /**
   * HTTP status code to return when feature is disabled
   * @default 404
   */
  statusCode?: number;

  /**
   * Error message to return when feature is disabled
   */
  message?: string;

  /**
   * Whether to use tenant context from the request
   * @default true
   */
  useTenantContext?: boolean;
}

/**
 * Feature guard middleware factory
 *
 * Creates middleware that checks if a feature is enabled before allowing access.
 *
 * @example
 * // Basic usage
 * router.get('/ai/recommendations', featureGuard('ai_recommendations'), controller.getRecommendations);
 *
 * @example
 * // With options
 * router.get('/beta/feature', featureGuard('beta_features', {
 *   statusCode: 403,
 *   message: 'This feature is not available on your plan'
 * }), controller.getBetaFeature);
 */
export const featureGuard = (
  featureKey: string,
  options: FeatureGuardOptions = {}
): RequestHandler => {
  const {
    statusCode = 404,
    message = 'This feature is not available',
    useTenantContext = true,
  } = options;

  return (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;

      // Get tenant context if available (from workspace header or query)
      let tenantId: string | undefined;
      if (useTenantContext) {
        tenantId =
          (req.headers['x-workspace-id'] as string) ||
          (req.query.workspaceId as string);
      }

      const isEnabled = await featureFlagService.isEnabled(featureKey, {
        userId,
        tenantId,
      });

      if (!isEnabled) {
        return res.status(statusCode).json({
          error: message,
          feature: featureKey,
          enabled: false,
        });
      }

      next();
    } catch (error) {
      console.error(`[FeatureGuard] Error checking feature ${featureKey}:`, error);
      // On error, allow the request to proceed (fail open)
      // You can change this to fail closed by calling next(error) instead
      next();
    }
  }) as RequestHandler;
};

/**
 * Multiple feature guard middleware
 *
 * Requires ALL specified features to be enabled
 *
 * @example
 * router.get('/advanced', requireAllFeatures(['ai_recommendations', 'social_listening']), controller.getAdvanced);
 */
export const requireAllFeatures = (
  featureKeys: string[],
  options: FeatureGuardOptions = {}
): RequestHandler => {
  const {
    statusCode = 404,
    message = 'This feature is not available',
    useTenantContext = true,
  } = options;

  return (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;

      let tenantId: string | undefined;
      if (useTenantContext) {
        tenantId =
          (req.headers['x-workspace-id'] as string) ||
          (req.query.workspaceId as string);
      }

      const results = await featureFlagService.checkMultiple(featureKeys, {
        userId,
        tenantId,
      });

      const disabledFeatures = featureKeys.filter((key) => !results[key]);

      if (disabledFeatures.length > 0) {
        return res.status(statusCode).json({
          error: message,
          disabledFeatures,
        });
      }

      next();
    } catch (error) {
      console.error('[FeatureGuard] Error checking multiple features:', error);
      next();
    }
  }) as RequestHandler;
};

/**
 * Any feature guard middleware
 *
 * Requires ANY of the specified features to be enabled
 *
 * @example
 * router.get('/social', requireAnyFeature(['social_listening', 'social_media_integration']), controller.getSocial);
 */
export const requireAnyFeature = (
  featureKeys: string[],
  options: FeatureGuardOptions = {}
): RequestHandler => {
  const {
    statusCode = 404,
    message = 'This feature is not available',
    useTenantContext = true,
  } = options;

  return (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.userId;

      let tenantId: string | undefined;
      if (useTenantContext) {
        tenantId =
          (req.headers['x-workspace-id'] as string) ||
          (req.query.workspaceId as string);
      }

      const results = await featureFlagService.checkMultiple(featureKeys, {
        userId,
        tenantId,
      });

      const hasAnyEnabled = featureKeys.some((key) => results[key]);

      if (!hasAnyEnabled) {
        return res.status(statusCode).json({
          error: message,
          features: featureKeys,
          enabled: false,
        });
      }

      next();
    } catch (error) {
      console.error('[FeatureGuard] Error checking any features:', error);
      next();
    }
  }) as RequestHandler;
};

/**
 * Attach feature flags to request object
 *
 * Useful for conditionally showing UI elements based on features
 *
 * @example
 * router.use(attachFeatureFlags);
 * // Access via req.features
 */
export const attachFeatureFlags: RequestHandler = (async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?.userId;
    const tenantId =
      (req.headers['x-workspace-id'] as string) ||
      (req.query.workspaceId as string);

    const enabledFeatures = await featureFlagService.getEnabledFeatures({
      userId,
      tenantId,
    });

    // Attach to request
    (req as any).features = enabledFeatures;
    (req as any).hasFeature = (key: string) => enabledFeatures.includes(key);

    next();
  } catch (error) {
    console.error('[FeatureGuard] Error attaching features:', error);
    (req as any).features = [];
    (req as any).hasFeature = () => false;
    next();
  }
}) as RequestHandler;
