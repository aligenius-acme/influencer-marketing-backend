import { prisma } from '../config/postgres.js';
import { CampaignStatus, CampaignInfluencerStatus } from '@prisma/client';
import { savedInfluencerService } from './savedInfluencer.service.js';

export interface DashboardStats {
  campaigns: {
    total: number;
    active: number;
    draft: number;
    completed: number;
    paused: number;
  };
  influencers: {
    totalSaved: number;
    totalFavorites: number;
    totalLists: number;
    inCampaigns: number;
    byPlatform: Record<string, number>;
  };
  budget: {
    totalAllocated: number;
    totalSpent: number;
    currency: string;
  };
  reach: {
    totalFollowers: number;
    avgEngagementRate: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    campaignId?: string;
    campaignName?: string;
    createdAt: Date;
  }>;
  topCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    influencerCount: number;
    budget: number | null;
  }>;
}

class DashboardService {
  async getDashboardStats(userId: string): Promise<DashboardStats> {
    // Fetch all data in parallel
    const [
      campaignStats,
      savedInfluencerStats,
      campaignInfluencerStats,
      budgetStats,
      reachStats,
      recentActivity,
      topCampaigns,
    ] = await Promise.all([
      this.getCampaignStats(userId),
      savedInfluencerService.getStats(userId),
      this.getCampaignInfluencerStats(userId),
      this.getBudgetStats(userId),
      this.getReachStats(userId),
      this.getRecentActivity(userId),
      this.getTopCampaigns(userId),
    ]);

    return {
      campaigns: campaignStats,
      influencers: {
        ...savedInfluencerStats,
        inCampaigns: campaignInfluencerStats.uniqueInfluencers,
      },
      budget: budgetStats,
      reach: reachStats,
      recentActivity,
      topCampaigns,
    };
  }

  private async getCampaignStats(userId: string) {
    const statusCounts = await prisma.campaign.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true },
    });

    const stats = {
      total: 0,
      active: 0,
      draft: 0,
      completed: 0,
      paused: 0,
    };

    statusCounts.forEach(({ status, _count }) => {
      stats.total += _count.id;
      switch (status) {
        case CampaignStatus.ACTIVE:
          stats.active = _count.id;
          break;
        case CampaignStatus.DRAFT:
          stats.draft = _count.id;
          break;
        case CampaignStatus.COMPLETED:
          stats.completed = _count.id;
          break;
        case CampaignStatus.PAUSED:
          stats.paused = _count.id;
          break;
      }
    });

    return stats;
  }

  private async getCampaignInfluencerStats(userId: string) {
    // Get count of unique influencers across all campaigns
    const result = await prisma.campaignInfluencer.findMany({
      where: {
        campaign: { userId },
      },
      select: {
        savedInfluencerId: true,
      },
      distinct: ['savedInfluencerId'],
    });

    return {
      uniqueInfluencers: result.length,
    };
  }

  private async getBudgetStats(userId: string) {
    // Get total allocated budget from all campaigns
    const budgetResult = await prisma.campaign.aggregate({
      where: { userId },
      _sum: {
        budget: true,
      },
    });

    // Get total spent (sum of agreed rates for accepted/approved influencers)
    const spentResult = await prisma.campaignInfluencer.aggregate({
      where: {
        campaign: { userId },
        status: {
          in: [CampaignInfluencerStatus.ACCEPTED, CampaignInfluencerStatus.APPROVED, CampaignInfluencerStatus.COMPLETED],
        },
      },
      _sum: {
        agreedRate: true,
      },
    });

    return {
      totalAllocated: budgetResult._sum.budget?.toNumber() || 0,
      totalSpent: spentResult._sum.agreedRate?.toNumber() || 0,
      currency: 'USD', // Default currency
    };
  }

  private async getReachStats(userId: string) {
    // Get all campaign influencers with their saved influencer data
    const campaignInfluencers = await prisma.campaignInfluencer.findMany({
      where: {
        campaign: { userId },
        status: {
          in: [
            CampaignInfluencerStatus.ACCEPTED,
            CampaignInfluencerStatus.APPROVED,
            CampaignInfluencerStatus.CONTENT_SUBMITTED,
            CampaignInfluencerStatus.COMPLETED,
          ],
        },
      },
      select: {
        savedInfluencerId: true,
      },
    });

    // If no campaign influencers, return zeros
    if (campaignInfluencers.length === 0) {
      return {
        totalFollowers: 0,
        avgEngagementRate: 0,
      };
    }

    // Get saved influencer data from MongoDB to calculate reach
    const savedInfluencerIds = campaignInfluencers.map(ci => ci.savedInfluencerId);
    const { SavedInfluencer } = await import('../models/SavedInfluencer.js');

    const savedInfluencers = await SavedInfluencer.find({
      _id: { $in: savedInfluencerIds },
    }).select('profile.followers profile.engagementRate');

    let totalFollowers = 0;
    let totalEngagement = 0;
    let count = 0;

    savedInfluencers.forEach((inf) => {
      if (inf.profile?.followers) {
        totalFollowers += inf.profile.followers;
      }
      if (inf.profile?.engagementRate) {
        totalEngagement += inf.profile.engagementRate;
        count++;
      }
    });

    return {
      totalFollowers,
      avgEngagementRate: count > 0 ? Math.round((totalEngagement / count) * 100) / 100 : 0,
    };
  }

  private async getRecentActivity(userId: string, limit = 10) {
    const activities = await prisma.campaignActivity.findMany({
      where: {
        campaign: { userId },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return activities.map((activity) => ({
      id: activity.id,
      type: activity.activityType,
      description: activity.description || '',
      campaignId: activity.campaign.id,
      campaignName: activity.campaign.name,
      createdAt: activity.createdAt,
    }));
  }

  private async getTopCampaigns(userId: string, limit = 5) {
    const campaigns = await prisma.campaign.findMany({
      where: {
        userId,
        status: { in: [CampaignStatus.ACTIVE, CampaignStatus.DRAFT] },
      },
      orderBy: [
        { status: 'asc' }, // Active first
        { updatedAt: 'desc' },
      ],
      take: limit,
      include: {
        _count: {
          select: { influencers: true },
        },
      },
    });

    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      influencerCount: campaign._count.influencers,
      budget: campaign.budget?.toNumber() || null,
    }));
  }
}

export const dashboardService = new DashboardService();
