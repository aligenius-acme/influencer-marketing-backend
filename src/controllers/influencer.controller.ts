import { Request, Response, NextFunction } from 'express';
import { scrapCreatorsService } from '../services/scrapCreators.service.js';
import type { InfluencerSearchInput } from '../utils/validation.js';

// Search influencers via ScrapCreators
export const searchInfluencers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filters = req.body as InfluencerSearchInput;

    const result = await scrapCreatorsService.searchInfluencers({
      platform: filters.platform,
      query: filters.query,
      minFollowers: filters.minFollowers,
      maxFollowers: filters.maxFollowers,
      minEngagement: filters.minEngagement,
      maxEngagement: filters.maxEngagement,
      location: filters.location,
      language: filters.language,
      niche: filters.niche as string[],
      verified: filters.verified,
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Get influencer profile
export const getInfluencerProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { platform, id } = req.params;

    const profile = await scrapCreatorsService.getInfluencerProfile(platform, id);

    if (!profile) {
      res.status(404).json({
        success: false,
        message: 'Influencer not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

// Get influencer audience analytics
export const getInfluencerAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { platform, id } = req.params;

    const analytics = await scrapCreatorsService.getAudienceAnalytics(platform, id);

    if (!analytics) {
      res.status(404).json({
        success: false,
        message: 'Analytics not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
};

// Format follower count for display (utility for frontend)
export const formatFollowerCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};
