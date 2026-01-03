/**
 * AI Controller
 *
 * Handles API endpoints for AI-powered features:
 * - Influencer matching
 * - Campaign predictions
 * - Fake follower analysis
 */

import { Request, Response, NextFunction } from 'express';
import { matchingService } from '../services/ai/matching.service.js';
import { predictionService } from '../services/ai/prediction.service.js';
import { fakeFollowerService } from '../services/ai/fakeFollower.service.js';

// ==================== Match Scores ====================

/**
 * Calculate match score for an influencer
 * POST /api/v1/ai/match-score/:influencerId
 */
export const calculateMatchScore = async (
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
    const { criteria, campaignId } = req.body;

    if (!criteria) {
      res.status(400).json({ error: 'Match criteria required' });
      return;
    }

    const result = await matchingService.calculateMatchScore(
      userId,
      influencerId,
      criteria,
      campaignId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get stored match scores
 * GET /api/v1/ai/match-scores
 */
export const getMatchScores = async (
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

    const { campaignId, minScore, limit } = req.query;

    const results = await matchingService.getMatchScores(userId, {
      campaignId: campaignId as string,
      minScore: minScore ? parseFloat(minScore as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get influencer recommendations
 * POST /api/v1/ai/recommendations
 */
export const getRecommendations = async (
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

    const { criteria, limit } = req.body;

    if (!criteria) {
      res.status(400).json({ error: 'Match criteria required' });
      return;
    }

    const results = await matchingService.getRecommendations(
      userId,
      criteria,
      limit || 10
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Find similar influencers
 * GET /api/v1/ai/similar/:influencerId
 */
export const findSimilar = async (
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
    const { limit } = req.query;

    const results = await matchingService.findSimilarInfluencers(
      userId,
      influencerId,
      limit ? parseInt(limit as string) : 5
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Predictions ====================

/**
 * Generate campaign predictions
 * POST /api/v1/ai/predict/:campaignId
 */
export const predictCampaign = async (
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
    const { budget, conversionRate, productPrice } = req.body;

    if (!budget) {
      res.status(400).json({ error: 'Budget is required for predictions' });
      return;
    }

    const result = await predictionService.predictCampaignPerformance(userId, {
      campaignId,
      budget,
      conversionRate,
      productPrice,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get stored predictions
 * GET /api/v1/ai/predictions/:campaignId
 */
export const getPredictions = async (
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

    const prediction = await predictionService.getPredictions(userId, campaignId);

    if (!prediction) {
      res.status(404).json({ error: 'No predictions found for this campaign' });
      return;
    }

    res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Quick estimate without campaign
 * POST /api/v1/ai/quick-estimate
 */
export const quickEstimate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { followers, engagementRate, budget, platform } = req.body;

    if (!followers || !engagementRate || !budget) {
      res.status(400).json({
        error: 'followers, engagementRate, and budget are required',
      });
      return;
    }

    const estimate = await predictionService.quickEstimate(
      followers,
      engagementRate,
      budget,
      platform
    );

    res.json({
      success: true,
      data: estimate,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Fake Follower Analysis ====================

/**
 * Analyze influencer for fake followers
 * POST /api/v1/ai/fake-follower/:influencerId
 */
export const analyzeFakeFollowers = async (
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

    const result = await fakeFollowerService.analyzeInfluencer(userId, influencerId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get previous analysis
 * GET /api/v1/ai/fake-follower/:influencerId
 */
export const getFakeFollowerAnalysis = async (
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

    const analysis = await fakeFollowerService.getAnalysis(userId, influencerId);

    if (!analysis) {
      res.status(404).json({ error: 'No analysis found. Run analysis first.' });
      return;
    }

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all analyses
 * GET /api/v1/ai/fake-follower
 */
export const getAllFakeFollowerAnalyses = async (
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

    const { riskLevel, limit, offset } = req.query;

    const result = await fakeFollowerService.getAllAnalyses(userId, {
      riskLevel: riskLevel as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result.analyses,
      meta: {
        total: result.total,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Quick check for red flags
 * POST /api/v1/ai/quick-check
 */
export const quickCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { followers, engagementRate, avgLikes, avgComments } = req.body;

    if (!followers || engagementRate === undefined || !avgLikes || avgComments === undefined) {
      res.status(400).json({
        error: 'followers, engagementRate, avgLikes, and avgComments are required',
      });
      return;
    }

    const result = await fakeFollowerService.quickCheck(
      followers,
      engagementRate,
      avgLikes,
      avgComments
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
