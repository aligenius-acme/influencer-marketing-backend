/**
 * Social Media Controller
 *
 * Handles API endpoints for social media integrations:
 * - OAuth connection flows
 * - Platform metrics
 * - Connection management
 */

import { Request, Response, NextFunction } from 'express';
import { socialMediaService } from '../services/socialMedia.service.js';
import { SocialPlatform } from '@prisma/client';
import { config } from '../config/index.js';
import crypto from 'crypto';

// Store OAuth states temporarily (in production, use Redis)
const oauthStates = new Map<string, { userId: string; platform: SocialPlatform; expiresAt: Date }>();

// Clean up expired states periodically
setInterval(() => {
  const now = new Date();
  for (const [state, data] of oauthStates.entries()) {
    if (data.expiresAt < now) {
      oauthStates.delete(state);
    }
  }
}, 60000); // Every minute

/**
 * Get all social media connections for user
 * GET /api/v1/social/connections
 */
export const getConnections = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const connections = await socialMediaService.getConnections(userId);

    res.json({
      success: true,
      data: connections,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initiate OAuth connection for a platform
 * POST /api/v1/social/connect/:platform
 */
export const initiateConnection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const platform = req.params.platform?.toUpperCase() as SocialPlatform;
    const validPlatforms: SocialPlatform[] = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE'];

    if (!validPlatforms.includes(platform)) {
      res.status(400).json({
        error: 'Invalid platform',
        validPlatforms: validPlatforms.map(p => p.toLowerCase()),
      });
      return;
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    oauthStates.set(state, {
      userId,
      platform,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    const authUrl = socialMediaService.getAuthorizationUrl(platform, state);

    res.json({
      success: true,
      data: {
        authorizationUrl: authUrl,
        state,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * OAuth callback handler
 * GET /api/v1/social/callback/:platform
 */
export const handleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const platform = req.params.platform?.toUpperCase() as SocialPlatform;
    const { code, state, error: oauthError } = req.query;

    // Handle OAuth errors
    if (oauthError) {
      const redirectUrl = `${config.frontendUrl}/settings/connections?error=${encodeURIComponent(String(oauthError))}`;
      res.redirect(redirectUrl);
      return;
    }

    // Validate state
    const stateData = oauthStates.get(String(state));
    if (!stateData) {
      const redirectUrl = `${config.frontendUrl}/settings/connections?error=invalid_state`;
      res.redirect(redirectUrl);
      return;
    }

    if (stateData.platform !== platform) {
      const redirectUrl = `${config.frontendUrl}/settings/connections?error=platform_mismatch`;
      res.redirect(redirectUrl);
      return;
    }

    // Clean up used state
    oauthStates.delete(String(state));

    // Exchange code for tokens
    const tokens = await socialMediaService.exchangeCodeForTokens(platform, String(code));

    // Get platform user info
    const userInfo = await socialMediaService.getPlatformUserInfo(platform, tokens.accessToken);

    // Save connection
    await socialMediaService.createConnection(
      stateData.userId,
      platform,
      tokens,
      userInfo.userId,
      userInfo.username
    );

    // Redirect to frontend with success
    const redirectUrl = `${config.frontendUrl}/settings/connections?success=true&platform=${platform.toLowerCase()}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('[SocialMedia] OAuth callback error:', error);
    const redirectUrl = `${config.frontendUrl}/settings/connections?error=connection_failed`;
    res.redirect(redirectUrl);
  }
};

/**
 * Disconnect a platform
 * DELETE /api/v1/social/disconnect/:platform
 */
export const disconnectPlatform = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const platform = req.params.platform?.toUpperCase() as SocialPlatform;

    await socialMediaService.disconnect(userId, platform);

    res.json({
      success: true,
      message: `Disconnected from ${platform}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get metrics for a connection
 * GET /api/v1/social/metrics/:platform
 */
export const getMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const platform = req.params.platform?.toUpperCase() as SocialPlatform;

    const metrics = await socialMediaService.fetchPlatformMetrics(userId, platform);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger manual sync for a connection
 * POST /api/v1/social/sync/:connectionId
 */
export const triggerSync = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { connectionId } = req.params;

    const jobId = await socialMediaService.queueMetricsSync(userId, connectionId);

    res.json({
      success: true,
      data: {
        jobId,
        message: 'Sync job queued successfully',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get connection details
 * GET /api/v1/social/connection/:platform
 */
export const getConnection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const platform = req.params.platform?.toUpperCase() as SocialPlatform;

    const connection = await socialMediaService.getConnection(userId, platform);

    if (!connection) {
      res.status(404).json({
        error: 'Connection not found',
        platform,
      });
      return;
    }

    // Don't expose tokens
    res.json({
      success: true,
      data: {
        id: connection.id,
        platform: connection.platform,
        username: connection.username,
        isActive: connection.isActive,
        lastSyncAt: connection.lastSyncAt,
        tokenExpired: connection.tokenExpiresAt
          ? connection.tokenExpiresAt < new Date()
          : false,
        createdAt: connection.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
