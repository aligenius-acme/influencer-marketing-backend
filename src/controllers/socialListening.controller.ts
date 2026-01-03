/**
 * Social Listening Controller
 *
 * Handles API endpoints for social listening:
 * - Monitoring rules
 * - Brand mentions
 * - Trend reports
 */

import { Request, Response, NextFunction } from 'express';
import { socialListeningService } from '../services/socialListening.service.js';

// ==================== Rules ====================

/**
 * Create monitoring rule
 * POST /api/v1/listening/rules
 */
export const createRule = async (
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

    const { name, description, keywords, hashtags, mentions, excludeKeywords, platforms, minFollowers, maxFollowers, verifiedOnly, scanFrequency } = req.body;

    if (!name || !keywords || !platforms) {
      res.status(400).json({ error: 'Name, keywords, and platforms are required' });
      return;
    }

    const rule = await socialListeningService.createRule(userId, {
      name,
      description,
      keywords,
      hashtags,
      mentions,
      excludeKeywords,
      platforms,
      minFollowers,
      maxFollowers,
      verifiedOnly,
      scanFrequency,
    });

    res.status(201).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all rules
 * GET /api/v1/listening/rules
 */
export const getRules = async (
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

    const { activeOnly } = req.query;

    const rules = await socialListeningService.getRules(userId, {
      activeOnly: activeOnly === 'true',
    });

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single rule
 * GET /api/v1/listening/rules/:id
 */
export const getRule = async (
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

    const rule = await socialListeningService.getRule(userId, id);

    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update rule
 * PATCH /api/v1/listening/rules/:id
 */
export const updateRule = async (
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

    const rule = await socialListeningService.updateRule(userId, id, req.body);

    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete rule
 * DELETE /api/v1/listening/rules/:id
 */
export const deleteRule = async (
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

    const deleted = await socialListeningService.deleteRule(userId, id);

    if (!deleted) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle rule pause
 * POST /api/v1/listening/rules/:id/toggle
 */
export const toggleRule = async (
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

    const rule = await socialListeningService.toggleRulePause(userId, id);

    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Mentions ====================

/**
 * Get mentions
 * GET /api/v1/listening/mentions
 */
export const getMentions = async (
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

    const { ruleId, platform, sentiment, isReviewed, isActionRequired, startDate, endDate, limit, offset } = req.query;

    const result = await socialListeningService.getMentions(userId, {
      ruleId: ruleId as string,
      platform: platform as string,
      sentiment: sentiment as string,
      isReviewed: isReviewed !== undefined ? isReviewed === 'true' : undefined,
      isActionRequired: isActionRequired !== undefined ? isActionRequired === 'true' : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result.mentions,
      meta: {
        total: result.total,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single mention
 * GET /api/v1/listening/mentions/:id
 */
export const getMention = async (
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

    const mention = await socialListeningService.getMention(userId, id);

    if (!mention) {
      res.status(404).json({ error: 'Mention not found' });
      return;
    }

    res.json({
      success: true,
      data: mention,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark mention as reviewed
 * POST /api/v1/listening/mentions/:id/review
 */
export const reviewMention = async (
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
    const { notes } = req.body;

    const mention = await socialListeningService.markAsReviewed(userId, id, notes);

    if (!mention) {
      res.status(404).json({ error: 'Mention not found' });
      return;
    }

    res.json({
      success: true,
      data: mention,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Flag mention for action
 * POST /api/v1/listening/mentions/:id/flag
 */
export const flagMention = async (
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
    const { notes } = req.body;

    const mention = await socialListeningService.flagForAction(userId, id, notes);

    if (!mention) {
      res.status(404).json({ error: 'Mention not found' });
      return;
    }

    res.json({
      success: true,
      data: mention,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Statistics ====================

/**
 * Get mention statistics
 * GET /api/v1/listening/mentions/stats
 */
export const getStats = async (
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

    const { ruleId, days } = req.query;

    const stats = await socialListeningService.getStats(userId, {
      ruleId: ruleId as string,
      days: days ? parseInt(days as string) : undefined,
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Trends ====================

/**
 * Generate trend report
 * POST /api/v1/listening/trends
 */
export const generateTrendReport = async (
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

    const { periodType } = req.body;

    if (!periodType || !['daily', 'weekly', 'monthly'].includes(periodType)) {
      res.status(400).json({ error: 'Valid periodType required (daily, weekly, monthly)' });
      return;
    }

    const report = await socialListeningService.generateTrendReport(userId, periodType);

    res.status(201).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get trend reports
 * GET /api/v1/listening/trends
 */
export const getTrendReports = async (
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

    const { periodType, limit } = req.query;

    const reports = await socialListeningService.getTrendReports(userId, {
      periodType: periodType as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single trend report
 * GET /api/v1/listening/trends/:id
 */
export const getTrendReport = async (
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

    const report = await socialListeningService.getTrendReport(userId, id);

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Mock Data ====================

/**
 * Add mock mention (development only)
 * POST /api/v1/listening/mock-mention
 */
export const addMockMention = async (
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

    const { ruleId } = req.body;

    if (!ruleId) {
      res.status(400).json({ error: 'ruleId required' });
      return;
    }

    const mention = await socialListeningService.addMockMention(userId, ruleId);

    res.status(201).json({
      success: true,
      data: mention,
    });
  } catch (error) {
    next(error);
  }
};
