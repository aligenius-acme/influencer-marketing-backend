import { prisma } from '../config/postgres.js';
import { CampaignStatus, CampaignInfluencerStatus } from '@prisma/client';

export interface CampaignAnalytics {
  overview: {
    totalInfluencers: number;
    activeInfluencers: number;
    completedInfluencers: number;
    totalBudget: number;
    spentBudget: number;
    totalReach: number;
    avgEngagementRate: number;
  };
  influencerBreakdown: {
    byStatus: Record<string, number>;
    byPlatform: Record<string, number>;
  };
  timeline: Array<{
    date: string;
    influencersAdded: number;
    statusChanges: number;
  }>;
  performance: {
    completionRate: number;
    acceptanceRate: number;
    avgDaysToComplete: number | null;
  };
}

export interface OverviewAnalytics {
  summary: {
    totalCampaigns: number;
    activeCampaigns: number;
    completedCampaigns: number;
    totalInfluencersWorkedWith: number;
    totalBudgetAllocated: number;
    totalBudgetSpent: number;
    totalReach: number;
    avgEngagementRate: number;
  };
  trendsOverTime: Array<{
    month: string;
    campaigns: number;
    influencers: number;
    budget: number;
  }>;
  topPerformingCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    influencerCount: number;
    completionRate: number;
    budget: number | null;
  }>;
  platformDistribution: Record<string, { count: number; percentage: number }>;
  budgetByStatus: Record<string, number>;
}

class AnalyticsService {
  // ==================== Campaign Analytics ====================

  async getCampaignAnalytics(userId: string, campaignId: string): Promise<CampaignAnalytics | null> {
    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        influencers: true,
        _count: { select: { influencers: true, activities: true } },
      },
    });

    if (!campaign) return null;

    // Get influencer details from MongoDB
    const { SavedInfluencer } = await import('../models/SavedInfluencer.js');
    const savedInfluencerIds = campaign.influencers.map(i => i.savedInfluencerId);
    const savedInfluencers = await SavedInfluencer.find({
      _id: { $in: savedInfluencerIds },
    });

    // Calculate reach and engagement
    let totalReach = 0;
    let totalEngagement = 0;
    let engagementCount = 0;
    const platformCounts: Record<string, number> = {};

    savedInfluencers.forEach((inf) => {
      if (inf.profile?.followers) totalReach += inf.profile.followers;
      if (inf.profile?.engagementRate) {
        totalEngagement += inf.profile.engagementRate;
        engagementCount++;
      }
      const platform = inf.platform || 'unknown';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    let completedCount = 0;
    let acceptedCount = 0;

    campaign.influencers.forEach((inf) => {
      statusCounts[inf.status] = (statusCounts[inf.status] || 0) + 1;
      if (inf.status === CampaignInfluencerStatus.COMPLETED) completedCount++;
      const acceptedStatuses: CampaignInfluencerStatus[] = [
        CampaignInfluencerStatus.ACCEPTED,
        CampaignInfluencerStatus.APPROVED,
        CampaignInfluencerStatus.COMPLETED,
        CampaignInfluencerStatus.CONTENT_SUBMITTED,
      ];
      if (acceptedStatuses.includes(inf.status)) {
        acceptedCount++;
      }
    });

    // Calculate spent budget
    const spentResult = await prisma.campaignInfluencer.aggregate({
      where: {
        campaignId,
        status: {
          in: [CampaignInfluencerStatus.ACCEPTED, CampaignInfluencerStatus.APPROVED, CampaignInfluencerStatus.COMPLETED],
        },
      },
      _sum: { agreedRate: true },
    });

    // Calculate avg days to complete
    const completedInfluencers = campaign.influencers.filter(
      i => i.status === CampaignInfluencerStatus.COMPLETED && i.completedAt && i.invitedAt
    );
    let avgDaysToComplete: number | null = null;
    if (completedInfluencers.length > 0) {
      const totalDays = completedInfluencers.reduce((acc, inf) => {
        const days = Math.ceil(
          (new Date(inf.completedAt!).getTime() - new Date(inf.invitedAt!).getTime()) / (1000 * 60 * 60 * 24)
        );
        return acc + days;
      }, 0);
      avgDaysToComplete = Math.round(totalDays / completedInfluencers.length);
    }

    // Get activity timeline (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activities = await prisma.campaignActivity.findMany({
      where: {
        campaignId,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group activities by date
    const timelineMap: Map<string, { influencersAdded: number; statusChanges: number }> = new Map();
    activities.forEach((activity) => {
      const dateKey = activity.createdAt.toISOString().split('T')[0];
      const existing = timelineMap.get(dateKey) || { influencersAdded: 0, statusChanges: 0 };
      if (activity.activityType === 'INFLUENCER_ADDED') existing.influencersAdded++;
      if (activity.activityType === 'INFLUENCER_STATUS_CHANGED') existing.statusChanges++;
      timelineMap.set(dateKey, existing);
    });

    const timeline = Array.from(timelineMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    const totalInfluencers = campaign.influencers.length;

    return {
      overview: {
        totalInfluencers,
        activeInfluencers: acceptedCount,
        completedInfluencers: completedCount,
        totalBudget: campaign.budget?.toNumber() || 0,
        spentBudget: spentResult._sum.agreedRate?.toNumber() || 0,
        totalReach,
        avgEngagementRate: engagementCount > 0 ? Math.round((totalEngagement / engagementCount) * 100) / 100 : 0,
      },
      influencerBreakdown: {
        byStatus: statusCounts,
        byPlatform: platformCounts,
      },
      timeline,
      performance: {
        completionRate: totalInfluencers > 0 ? Math.round((completedCount / totalInfluencers) * 100) : 0,
        acceptanceRate: totalInfluencers > 0 ? Math.round((acceptedCount / totalInfluencers) * 100) : 0,
        avgDaysToComplete,
      },
    };
  }

  // ==================== Overview Analytics ====================

  async getOverviewAnalytics(userId: string): Promise<OverviewAnalytics> {
    // Get all campaigns with influencer counts
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        influencers: {
          select: {
            savedInfluencerId: true,
            status: true,
            agreedRate: true,
          },
        },
        _count: { select: { influencers: true } },
      },
    });

    // Summary calculations
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === CampaignStatus.ACTIVE).length;
    const completedCampaigns = campaigns.filter(c => c.status === CampaignStatus.COMPLETED).length;

    // Unique influencers worked with
    const uniqueInfluencerIds = new Set<string>();
    campaigns.forEach(c => c.influencers.forEach(i => uniqueInfluencerIds.add(i.savedInfluencerId)));
    const totalInfluencersWorkedWith = uniqueInfluencerIds.size;

    // Budget calculations
    let totalBudgetAllocated = 0;
    let totalBudgetSpent = 0;
    const budgetByStatus: Record<string, number> = {};

    campaigns.forEach((campaign) => {
      const budget = campaign.budget?.toNumber() || 0;
      totalBudgetAllocated += budget;
      budgetByStatus[campaign.status] = (budgetByStatus[campaign.status] || 0) + budget;

      const spentStatuses: CampaignInfluencerStatus[] = [
        CampaignInfluencerStatus.ACCEPTED,
        CampaignInfluencerStatus.APPROVED,
        CampaignInfluencerStatus.COMPLETED,
      ];
      campaign.influencers.forEach((inf) => {
        if (spentStatuses.includes(inf.status)) {
          totalBudgetSpent += inf.agreedRate?.toNumber() || 0;
        }
      });
    });

    // Get saved influencer data for reach calculations
    const { SavedInfluencer } = await import('../models/SavedInfluencer.js');
    const savedInfluencers = await SavedInfluencer.find({
      _id: { $in: Array.from(uniqueInfluencerIds) },
    });

    let totalReach = 0;
    let totalEngagement = 0;
    let engagementCount = 0;
    const platformCounts: Record<string, number> = {};

    savedInfluencers.forEach((inf) => {
      if (inf.profile?.followers) totalReach += inf.profile.followers;
      if (inf.profile?.engagementRate) {
        totalEngagement += inf.profile.engagementRate;
        engagementCount++;
      }
      const platform = inf.platform || 'unknown';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });

    // Platform distribution with percentages
    const totalPlatformCount = Object.values(platformCounts).reduce((a, b) => a + b, 0) || 1;
    const platformDistribution: Record<string, { count: number; percentage: number }> = {};
    Object.entries(platformCounts).forEach(([platform, count]) => {
      platformDistribution[platform] = {
        count,
        percentage: Math.round((count / totalPlatformCount) * 100),
      };
    });

    // Trends over time (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const trendsOverTime: Array<{ month: string; campaigns: number; influencers: number; budget: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const monthCampaigns = campaigns.filter(
        c => new Date(c.createdAt) >= monthStart && new Date(c.createdAt) < monthEnd
      );

      const monthInfluencers = new Set<string>();
      let monthBudget = 0;

      monthCampaigns.forEach((c) => {
        c.influencers.forEach(i => monthInfluencers.add(i.savedInfluencerId));
        monthBudget += c.budget?.toNumber() || 0;
      });

      trendsOverTime.push({
        month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        campaigns: monthCampaigns.length,
        influencers: monthInfluencers.size,
        budget: monthBudget,
      });
    }

    // Top performing campaigns (by completion rate)
    const topPerformingCampaigns = campaigns
      .map((campaign) => {
        const total = campaign.influencers.length;
        const completed = campaign.influencers.filter(
          i => i.status === CampaignInfluencerStatus.COMPLETED
        ).length;
        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          influencerCount: total,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
          budget: campaign.budget?.toNumber() || null,
        };
      })
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5);

    return {
      summary: {
        totalCampaigns,
        activeCampaigns,
        completedCampaigns,
        totalInfluencersWorkedWith,
        totalBudgetAllocated,
        totalBudgetSpent,
        totalReach,
        avgEngagementRate: engagementCount > 0 ? Math.round((totalEngagement / engagementCount) * 100) / 100 : 0,
      },
      trendsOverTime,
      topPerformingCampaigns,
      platformDistribution,
      budgetByStatus,
    };
  }
}

export const analyticsService = new AnalyticsService();
