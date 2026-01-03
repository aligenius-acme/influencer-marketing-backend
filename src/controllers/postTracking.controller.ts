/**
 * Post Tracking Controller
 *
 * Handles API endpoints for post performance tracking:
 * - Track new posts
 * - Get post metrics
 * - Sync post data
 * - Post analytics
 */

import { Request, Response, NextFunction } from 'express';
import { postTrackingService } from '../services/postTracking.service.js';

/**
 * Track a new post
 * POST /api/v1/posts
 */
export const trackPost = async (
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

    const { campaignId, campaignInfluencerId, savedInfluencerId, platform, postUrl, isSponsored } = req.body;

    if (!platform || !postUrl) {
      res.status(400).json({ error: 'Platform and postUrl are required' });
      return;
    }

    const post = await postTrackingService.trackPost({
      userId,
      campaignId,
      campaignInfluencerId,
      savedInfluencerId,
      platform,
      postUrl,
      isSponsored,
    });

    res.status(201).json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get tracked posts
 * GET /api/v1/posts
 */
export const getPosts = async (
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

    const { campaignId, savedInfluencerId, platform, limit, offset } = req.query;

    const result = await postTrackingService.getPosts(userId, {
      campaignId: campaignId as string,
      savedInfluencerId: savedInfluencerId as string,
      platform: platform as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result.posts,
      meta: {
        total: result.total,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single post
 * GET /api/v1/posts/:id
 */
export const getPost = async (
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

    const { id } = req.params;

    const post = await postTrackingService.getPost(userId, id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete tracked post
 * DELETE /api/v1/posts/:id
 */
export const deletePost = async (
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

    const { id } = req.params;

    const deleted = await postTrackingService.deletePost(userId, id);

    if (!deleted) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync post metrics
 * POST /api/v1/posts/:id/sync
 */
export const syncPost = async (
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

    const { id } = req.params;

    // Verify ownership first
    const existingPost = await postTrackingService.getPost(userId, id);
    if (!existingPost) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const post = await postTrackingService.syncPostMetrics(id);

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get campaign posts
 * GET /api/v1/posts/campaign/:campaignId
 */
export const getCampaignPosts = async (
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

    const { campaignId } = req.params;
    const { limit, offset } = req.query;

    const result = await postTrackingService.getPosts(userId, {
      campaignId,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result.posts,
      meta: {
        total: result.total,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync all posts for a campaign
 * POST /api/v1/posts/campaign/:campaignId/sync
 */
export const syncCampaignPosts = async (
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

    const { campaignId } = req.params;

    const result = await postTrackingService.syncCampaignPosts(campaignId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get campaign analytics
 * GET /api/v1/posts/campaign/:campaignId/analytics
 */
export const getCampaignAnalytics = async (
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

    const { campaignId } = req.params;

    const analytics = await postTrackingService.getCampaignAnalytics(campaignId);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get influencer post analytics
 * GET /api/v1/posts/influencer/:influencerId/analytics
 */
export const getInfluencerAnalytics = async (
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

    const { influencerId } = req.params;

    const analytics = await postTrackingService.getInfluencerAnalytics(influencerId);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};
