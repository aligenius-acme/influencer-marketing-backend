import { prisma } from '../config/postgres.js';
import { CampaignStatus, CampaignInfluencerStatus, Prisma } from '@prisma/client';

// Types
export interface CreateCampaignInput {
  userId: string;
  name: string;
  description?: string;
  brief?: string;
  platform?: string;
  campaignType?: string;
  budget?: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  goals?: Record<string, unknown>;
  hashtags?: string[];
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  brief?: string;
  platform?: string;
  campaignType?: string;
  budget?: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  goals?: Record<string, unknown>;
  status?: CampaignStatus;
  hashtags?: string[];
}

export interface CampaignFilters {
  status?: CampaignStatus;
  platform?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'startDate' | 'name' | 'budget';
  sortOrder?: 'asc' | 'desc';
}

export interface AddInfluencerInput {
  savedInfluencerId: string;
  agreedRate?: number;
  currency?: string;
  deliverables?: Array<{ type: string; quantity: number; status: string }>;
  notes?: string;
}

export interface UpdateInfluencerInput {
  status?: CampaignInfluencerStatus;
  agreedRate?: number;
  currency?: string;
  deliverables?: Array<{ type: string; quantity: number; status: string }>;
  contentUrls?: string[];
  notes?: string;
}

class CampaignService {
  // ==================== Campaign CRUD ====================

  async createCampaign(input: CreateCampaignInput) {
    const campaign = await prisma.campaign.create({
      data: {
        userId: input.userId,
        name: input.name,
        description: input.description,
        brief: input.brief,
        platform: input.platform,
        campaignType: input.campaignType,
        budget: input.budget ? new Prisma.Decimal(input.budget) : null,
        currency: input.currency || 'USD',
        startDate: input.startDate,
        endDate: input.endDate,
        goals: (input.goals || {}) as Prisma.InputJsonValue,
        hashtags: input.hashtags || [],
        status: CampaignStatus.DRAFT,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            brandProfile: {
              select: {
                companyName: true,
              },
            },
          },
        },
        _count: {
          select: {
            influencers: true,
          },
        },
      },
    });

    // Log activity
    await this.logActivity(campaign.id, input.userId, 'CAMPAIGN_CREATED', 'Campaign was created');

    return campaign;
  }

  async getCampaign(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            brandProfile: {
              select: {
                companyName: true,
              },
            },
          },
        },
        influencers: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            influencers: true,
            activities: true,
          },
        },
      },
    });

    return campaign;
  }

  async getCampaigns(userId: string, filters: CampaignFilters = {}) {
    const {
      status,
      platform,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Prisma.CampaignWhereInput = {
      userId,
    };

    if (status) where.status = status;
    if (platform) where.platform = platform;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              influencers: true,
            },
          },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    return {
      campaigns,
      total,
      page,
      limit,
      hasMore: skip + campaigns.length < total,
    };
  }

  async updateCampaign(userId: string, campaignId: string, input: UpdateCampaignInput) {
    // Verify ownership
    const existing = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!existing) return null;

    const updateData: Prisma.CampaignUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.brief !== undefined) updateData.brief = input.brief;
    if (input.platform !== undefined) updateData.platform = input.platform;
    if (input.campaignType !== undefined) updateData.campaignType = input.campaignType;
    if (input.budget !== undefined) updateData.budget = new Prisma.Decimal(input.budget);
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.startDate !== undefined) updateData.startDate = input.startDate;
    if (input.endDate !== undefined) updateData.endDate = input.endDate;
    if (input.goals !== undefined) updateData.goals = input.goals as Prisma.InputJsonValue;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.hashtags !== undefined) updateData.hashtags = input.hashtags;

    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
      include: {
        _count: {
          select: {
            influencers: true,
          },
        },
      },
    });

    // Log activity
    if (input.status && input.status !== existing.status) {
      await this.logActivity(
        campaignId,
        userId,
        'STATUS_CHANGED',
        `Status changed from ${existing.status} to ${input.status}`
      );
    } else {
      await this.logActivity(campaignId, userId, 'CAMPAIGN_UPDATED', 'Campaign was updated');
    }

    return campaign;
  }

  async deleteCampaign(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) return false;

    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    return true;
  }

  // ==================== Campaign Influencers ====================

  async addInfluencerToCampaign(
    userId: string,
    campaignId: string,
    input: AddInfluencerInput
  ) {
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) return null;

    // Check if influencer already in campaign
    const existing = await prisma.campaignInfluencer.findFirst({
      where: {
        campaignId,
        savedInfluencerId: input.savedInfluencerId,
      },
    });

    if (existing) {
      throw new Error('Influencer already added to this campaign');
    }

    const campaignInfluencer = await prisma.campaignInfluencer.create({
      data: {
        campaignId,
        savedInfluencerId: input.savedInfluencerId,
        agreedRate: input.agreedRate ? new Prisma.Decimal(input.agreedRate) : null,
        currency: input.currency || 'USD',
        deliverables: input.deliverables || [],
        notes: input.notes,
        invitedAt: new Date(),
        status: CampaignInfluencerStatus.INVITED,
      },
    });

    // Log activity
    await this.logActivity(
      campaignId,
      userId,
      'INFLUENCER_ADDED',
      `Influencer added to campaign`,
      { savedInfluencerId: input.savedInfluencerId }
    );

    return campaignInfluencer;
  }

  async getCampaignInfluencers(userId: string, campaignId: string) {
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) return null;

    const influencers = await prisma.campaignInfluencer.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
    });

    return influencers;
  }

  async updateCampaignInfluencer(
    userId: string,
    campaignId: string,
    influencerId: string,
    input: UpdateInfluencerInput
  ) {
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) return null;

    const existing = await prisma.campaignInfluencer.findFirst({
      where: { id: influencerId, campaignId },
    });

    if (!existing) return null;

    const updateData: Prisma.CampaignInfluencerUpdateInput = {};

    if (input.status !== undefined) {
      updateData.status = input.status;
      // Update timestamp based on status
      if (input.status === CampaignInfluencerStatus.ACCEPTED) {
        updateData.acceptedAt = new Date();
      } else if (input.status === CampaignInfluencerStatus.COMPLETED) {
        updateData.completedAt = new Date();
      }
    }
    if (input.agreedRate !== undefined) updateData.agreedRate = new Prisma.Decimal(input.agreedRate);
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.deliverables !== undefined) updateData.deliverables = input.deliverables;
    if (input.contentUrls !== undefined) updateData.contentUrls = input.contentUrls;
    if (input.notes !== undefined) updateData.notes = input.notes;

    const updated = await prisma.campaignInfluencer.update({
      where: { id: influencerId },
      data: updateData,
    });

    // Log activity
    if (input.status && input.status !== existing.status) {
      await this.logActivity(
        campaignId,
        userId,
        'INFLUENCER_STATUS_CHANGED',
        `Influencer status changed from ${existing.status} to ${input.status}`,
        { influencerId, savedInfluencerId: existing.savedInfluencerId }
      );
    }

    return updated;
  }

  async removeInfluencerFromCampaign(
    userId: string,
    campaignId: string,
    influencerId: string
  ) {
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) return false;

    const influencer = await prisma.campaignInfluencer.findFirst({
      where: { id: influencerId, campaignId },
    });

    if (!influencer) return false;

    await prisma.campaignInfluencer.delete({
      where: { id: influencerId },
    });

    // Log activity
    await this.logActivity(
      campaignId,
      userId,
      'INFLUENCER_REMOVED',
      'Influencer removed from campaign',
      { savedInfluencerId: influencer.savedInfluencerId }
    );

    return true;
  }

  // ==================== Campaign Activities ====================

  async getCampaignActivities(userId: string, campaignId: string, page = 1, limit = 50) {
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) return null;

    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      prisma.campaignActivity.findMany({
        where: { campaignId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              brandProfile: {
                select: {
                  companyName: true,
                },
              },
            },
          },
        },
      }),
      prisma.campaignActivity.count({ where: { campaignId } }),
    ]);

    return {
      activities,
      total,
      page,
      limit,
      hasMore: skip + activities.length < total,
    };
  }

  private async logActivity(
    campaignId: string,
    userId: string,
    activityType: string,
    description: string,
    metadata: Record<string, unknown> = {}
  ) {
    await prisma.campaignActivity.create({
      data: {
        campaignId,
        userId,
        activityType,
        description,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  // ==================== Stats ====================

  async getCampaignStats(userId: string) {
    const [
      totalCampaigns,
      activeCampaigns,
      draftCampaigns,
      completedCampaigns,
      totalInfluencers,
      totalBudget,
    ] = await Promise.all([
      prisma.campaign.count({ where: { userId } }),
      prisma.campaign.count({ where: { userId, status: CampaignStatus.ACTIVE } }),
      prisma.campaign.count({ where: { userId, status: CampaignStatus.DRAFT } }),
      prisma.campaign.count({ where: { userId, status: CampaignStatus.COMPLETED } }),
      prisma.campaignInfluencer.count({
        where: { campaign: { userId } },
      }),
      prisma.campaign.aggregate({
        where: { userId },
        _sum: { budget: true },
      }),
    ]);

    return {
      totalCampaigns,
      activeCampaigns,
      draftCampaigns,
      completedCampaigns,
      totalInfluencers,
      totalBudget: totalBudget._sum.budget?.toNumber() || 0,
    };
  }

  async duplicateCampaign(userId: string, campaignId: string, newName?: string) {
    const original = await this.getCampaign(userId, campaignId);
    if (!original) return null;

    const campaign = await prisma.campaign.create({
      data: {
        userId,
        name: newName || `${original.name} (Copy)`,
        description: original.description,
        brief: original.brief,
        platform: original.platform,
        campaignType: original.campaignType,
        budget: original.budget,
        currency: original.currency,
        goals: original.goals as Prisma.InputJsonValue,
        hashtags: original.hashtags,
        status: CampaignStatus.DRAFT,
      },
      include: {
        _count: {
          select: {
            influencers: true,
          },
        },
      },
    });

    await this.logActivity(campaign.id, userId, 'CAMPAIGN_CREATED', `Campaign duplicated from "${original.name}"`);

    return campaign;
  }
}

export const campaignService = new CampaignService();
