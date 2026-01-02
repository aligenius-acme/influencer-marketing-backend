import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service.js';

export const getOverviewAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
      return;
    }

    const analytics = await analyticsService.getOverviewAnalytics(userId);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};

export const getCampaignAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
      return;
    }

    if (!id) {
      res.status(400).json({
        success: false,
        error: { message: 'Campaign ID is required', code: 'INVALID_INPUT' },
      });
      return;
    }

    const analytics = await analyticsService.getCampaignAnalytics(userId, id);

    if (!analytics) {
      res.status(404).json({
        success: false,
        error: { message: 'Campaign not found', code: 'NOT_FOUND' },
      });
      return;
    }

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};
