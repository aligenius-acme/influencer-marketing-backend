import { Request, Response, NextFunction } from 'express';
import { campaignService } from '../services/campaign.service.js';
import { CampaignStatus, CampaignInfluencerStatus } from '@prisma/client';

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

// ==================== Campaign CRUD Endpoints ====================

// Create a campaign
export const createCampaign = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      name,
      description,
      brief,
      platform,
      campaignType,
      budget,
      currency,
      startDate,
      endDate,
      goals,
      hashtags,
    } = req.body;

    const campaign = await campaignService.createCampaign({
      userId,
      name,
      description,
      brief,
      platform,
      campaignType,
      budget,
      currency,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      goals,
      hashtags,
    });

    res.status(201).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

// Get a single campaign
export const getCampaign = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const campaign = await campaignService.getCampaign(userId, id);

    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

// Get all campaigns with filters
export const getCampaigns = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      status,
      platform,
      search,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await campaignService.getCampaigns(userId, {
      status: status as CampaignStatus | undefined,
      platform: platform as string | undefined,
      search: search as string | undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as 'createdAt' | 'startDate' | 'name' | 'budget',
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Update a campaign
export const updateCampaign = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const {
      name,
      description,
      brief,
      platform,
      campaignType,
      budget,
      currency,
      startDate,
      endDate,
      goals,
      status,
      hashtags,
    } = req.body;

    const campaign = await campaignService.updateCampaign(userId, id, {
      name,
      description,
      brief,
      platform,
      campaignType,
      budget,
      currency,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      goals,
      status: status as CampaignStatus | undefined,
      hashtags,
    });

    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

// Delete a campaign
export const deleteCampaign = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const deleted = await campaignService.deleteCampaign(userId, id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Campaign deleted',
    });
  } catch (error) {
    next(error);
  }
};

// Duplicate a campaign
export const duplicateCampaign = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { name } = req.body;

    const campaign = await campaignService.duplicateCampaign(userId, id, name);

    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    res.status(201).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

// Get campaign stats
export const getCampaignStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const stats = await campaignService.getCampaignStats(userId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Campaign Influencer Endpoints ====================

// Add influencer to campaign
export const addInfluencerToCampaign = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { savedInfluencerId, agreedRate, currency, deliverables, notes } = req.body;

    const campaignInfluencer = await campaignService.addInfluencerToCampaign(userId, id, {
      savedInfluencerId,
      agreedRate,
      currency,
      deliverables,
      notes,
    });

    if (!campaignInfluencer) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    res.status(201).json({
      success: true,
      data: campaignInfluencer,
    });
  } catch (error: any) {
    if (error.message === 'Influencer already added to this campaign') {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

// Get campaign influencers
export const getCampaignInfluencers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const influencers = await campaignService.getCampaignInfluencers(userId, id);

    if (influencers === null) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: influencers,
    });
  } catch (error) {
    next(error);
  }
};

// Update campaign influencer
export const updateCampaignInfluencer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id, influencerId } = req.params;
    const { status, agreedRate, currency, deliverables, contentUrls, notes } = req.body;

    const updated = await campaignService.updateCampaignInfluencer(userId, id, influencerId, {
      status: status as CampaignInfluencerStatus | undefined,
      agreedRate,
      currency,
      deliverables,
      contentUrls,
      notes,
    });

    if (!updated) {
      res.status(404).json({ success: false, message: 'Campaign or influencer not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Remove influencer from campaign
export const removeInfluencerFromCampaign = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id, influencerId } = req.params;
    const removed = await campaignService.removeInfluencerFromCampaign(userId, id, influencerId);

    if (!removed) {
      res.status(404).json({ success: false, message: 'Campaign or influencer not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Influencer removed from campaign',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Campaign Activities Endpoints ====================

// Get campaign activities
export const getCampaignActivities = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { page = '1', limit = '50' } = req.query;

    const result = await campaignService.getCampaignActivities(
      userId,
      id,
      parseInt(page as string),
      parseInt(limit as string)
    );

    if (result === null) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
