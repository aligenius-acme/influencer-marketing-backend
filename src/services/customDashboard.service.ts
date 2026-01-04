/**
 * Custom Dashboard Service
 *
 * Manages custom dashboards and widget data for Advanced BI
 */

import { CustomDashboard, ICustomDashboard, IDashboardWidget, WidgetType, MetricType } from '../models/CustomDashboard.js';
import { prisma } from '../config/postgres.js';
import { SavedInfluencer } from '../models/SavedInfluencer.js';
import { BrandMention } from '../models/BrandMention.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ==================== Types ====================

export interface CreateDashboardInput {
  name: string;
  description?: string;
  icon?: string;
  gridColumns?: number;
  rowHeight?: number;
  isPublic?: boolean;
}

export interface UpdateDashboardInput extends Partial<CreateDashboardInput> {
  autoRefresh?: boolean;
  refreshInterval?: number;
  defaultFilters?: {
    dateRange?: string;
    campaignIds?: string[];
    platforms?: string[];
  };
}

export interface CreateWidgetInput {
  type: WidgetType;
  title: string;
  description?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  metric?: MetricType;
  metrics?: MetricType[];
  filters?: {
    campaignIds?: string[];
    influencerIds?: string[];
    platforms?: string[];
    dateRange?: string;
  };
  options?: Record<string, unknown>;
  content?: string;
}

export interface WidgetData {
  widgetId: string;
  data: unknown;
  generatedAt: Date;
}

// ==================== Service ====================

class CustomDashboardService {
  // ==================== Dashboard CRUD ====================

  /**
   * Create a new dashboard
   */
  async createDashboard(userId: string, input: CreateDashboardInput): Promise<ICustomDashboard> {
    const dashboard = new CustomDashboard({
      userId,
      ...input,
      widgets: [],
      isDefault: false,
      isFavorite: false,
      viewCount: 0,
    });

    await dashboard.save();
    return dashboard;
  }

  /**
   * Get all dashboards for user
   */
  async getDashboards(userId: string): Promise<ICustomDashboard[]> {
    return CustomDashboard.find({ userId }).sort({ isFavorite: -1, lastViewedAt: -1 });
  }

  /**
   * Get dashboard by ID
   */
  async getDashboard(userId: string, dashboardId: string): Promise<ICustomDashboard | null> {
    const dashboard = await CustomDashboard.findOne({
      $or: [
        { _id: dashboardId, userId },
        { _id: dashboardId, 'sharedWith.userId': userId },
        { _id: dashboardId, isPublic: true },
      ],
    });

    if (dashboard) {
      // Update view count and last viewed
      await CustomDashboard.updateOne(
        { _id: dashboardId },
        { $inc: { viewCount: 1 }, $set: { lastViewedAt: new Date() } }
      );
    }

    return dashboard;
  }

  /**
   * Get dashboard by public token
   */
  async getDashboardByToken(token: string): Promise<ICustomDashboard | null> {
    return CustomDashboard.findOne({ publicToken: token, isPublic: true });
  }

  /**
   * Update dashboard
   */
  async updateDashboard(
    userId: string,
    dashboardId: string,
    input: UpdateDashboardInput
  ): Promise<ICustomDashboard | null> {
    return CustomDashboard.findOneAndUpdate(
      { _id: dashboardId, userId },
      { $set: input },
      { new: true }
    );
  }

  /**
   * Delete dashboard
   */
  async deleteDashboard(userId: string, dashboardId: string): Promise<boolean> {
    const result = await CustomDashboard.deleteOne({ _id: dashboardId, userId });
    return result.deletedCount > 0;
  }

  /**
   * Duplicate dashboard
   */
  async duplicateDashboard(
    userId: string,
    dashboardId: string,
    newName: string
  ): Promise<ICustomDashboard | null> {
    const original = await this.getDashboard(userId, dashboardId);
    if (!original) return null;

    // Create a clean copy without MongoDB internal fields
    const originalData = original.toObject();
    const duplicate = new CustomDashboard({
      userId: originalData.userId,
      name: newName || `${originalData.name} (Copy)`,
      description: originalData.description,
      widgets: originalData.widgets || [],
      layout: originalData.layout,
      gridColumns: originalData.gridColumns,
      theme: originalData.theme,
      autoRefresh: originalData.autoRefresh,
      refreshInterval: originalData.refreshInterval,
      dateRange: originalData.dateRange,
      tags: originalData.tags,
      isDefault: false,
      isFavorite: false,
      isPublic: false,
      publicToken: undefined,
      sharedWith: [],
      viewCount: 0,
    });

    await duplicate.save();
    return duplicate;
  }

  // ==================== Widget Management ====================

  /**
   * Add widget to dashboard
   */
  async addWidget(
    userId: string,
    dashboardId: string,
    widget: CreateWidgetInput
  ): Promise<ICustomDashboard | null> {
    // Transform position object to flat properties if needed
    const { position, ...rest } = widget as CreateWidgetInput & { position?: { x: number; y: number; width: number; height: number } };

    const widgetData: IDashboardWidget = {
      id: uuidv4(),
      ...rest,
      x: position?.x ?? (widget as unknown as IDashboardWidget).x ?? 0,
      y: position?.y ?? (widget as unknown as IDashboardWidget).y ?? 0,
      width: position?.width ?? (widget as unknown as IDashboardWidget).width ?? 1,
      height: position?.height ?? (widget as unknown as IDashboardWidget).height ?? 1,
    } as IDashboardWidget;

    return CustomDashboard.findOneAndUpdate(
      { _id: dashboardId, userId },
      { $push: { widgets: widgetData } },
      { new: true }
    );
  }

  /**
   * Update widget
   */
  async updateWidget(
    userId: string,
    dashboardId: string,
    widgetId: string,
    updates: Partial<CreateWidgetInput>
  ): Promise<ICustomDashboard | null> {
    const updateFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      updateFields[`widgets.$.${key}`] = value;
    }

    return CustomDashboard.findOneAndUpdate(
      { _id: dashboardId, userId, 'widgets.id': widgetId },
      { $set: updateFields },
      { new: true }
    );
  }

  /**
   * Remove widget
   */
  async removeWidget(
    userId: string,
    dashboardId: string,
    widgetId: string
  ): Promise<ICustomDashboard | null> {
    return CustomDashboard.findOneAndUpdate(
      { _id: dashboardId, userId },
      { $pull: { widgets: { id: widgetId } } },
      { new: true }
    );
  }

  /**
   * Update widget positions (after drag-drop)
   */
  async updateWidgetPositions(
    userId: string,
    dashboardId: string,
    positions: { widgetId: string; x: number; y: number; width: number; height: number }[]
  ): Promise<ICustomDashboard | null> {
    const dashboard = await CustomDashboard.findOne({ _id: dashboardId, userId });
    if (!dashboard) return null;

    for (const pos of positions) {
      const widget = dashboard.widgets.find((w) => w.id === pos.widgetId);
      if (widget) {
        widget.x = pos.x;
        widget.y = pos.y;
        widget.width = pos.width;
        widget.height = pos.height;
      }
    }

    await dashboard.save();
    return dashboard;
  }

  // ==================== Sharing ====================

  /**
   * Generate public share link
   */
  async generatePublicLink(userId: string, dashboardId: string): Promise<string | null> {
    const token = crypto.randomBytes(32).toString('hex');

    const dashboard = await CustomDashboard.findOneAndUpdate(
      { _id: dashboardId, userId },
      { $set: { isPublic: true, publicToken: token } },
      { new: true }
    );

    return dashboard ? token : null;
  }

  /**
   * Revoke public link
   */
  async revokePublicLink(userId: string, dashboardId: string): Promise<boolean> {
    const result = await CustomDashboard.updateOne(
      { _id: dashboardId, userId },
      { $set: { isPublic: false }, $unset: { publicToken: 1 } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Share dashboard with user
   */
  async shareDashboard(
    userId: string,
    dashboardId: string,
    shareWithUserId: string,
    permission: 'view' | 'edit'
  ): Promise<ICustomDashboard | null> {
    // Remove existing share first
    await CustomDashboard.updateOne(
      { _id: dashboardId, userId },
      { $pull: { sharedWith: { userId: shareWithUserId } } }
    );

    return CustomDashboard.findOneAndUpdate(
      { _id: dashboardId, userId },
      { $push: { sharedWith: { userId: shareWithUserId, permission } } },
      { new: true }
    );
  }

  /**
   * Unshare dashboard
   */
  async unshareDashboard(
    userId: string,
    dashboardId: string,
    shareWithUserId: string
  ): Promise<ICustomDashboard | null> {
    return CustomDashboard.findOneAndUpdate(
      { _id: dashboardId, userId },
      { $pull: { sharedWith: { userId: shareWithUserId } } },
      { new: true }
    );
  }

  // ==================== Widget Data ====================

  /**
   * Get data for all widgets in dashboard
   */
  async getDashboardData(
    userId: string,
    dashboardId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<WidgetData[]> {
    const dashboard = await this.getDashboard(userId, dashboardId);
    if (!dashboard) return [];

    const widgetData: WidgetData[] = [];

    for (const widget of dashboard.widgets) {
      const data = await this.getWidgetData(userId, widget, dateRange);
      widgetData.push({
        widgetId: widget.id,
        data,
        generatedAt: new Date(),
      });
    }

    return widgetData;
  }

  /**
   * Get data for a single widget
   */
  async getWidgetData(
    userId: string,
    widget: IDashboardWidget,
    dateRange?: { start: Date; end: Date }
  ): Promise<unknown> {
    const range = dateRange || this.getDateRange(widget.filters?.dateRange || 'last_30_days');

    switch (widget.metric) {
      case 'campaigns_count':
        return this.getCampaignsCount(userId, range);
      case 'active_campaigns':
        return this.getActiveCampaigns(userId);
      case 'total_influencers':
        return this.getTotalInfluencers(userId);
      case 'total_reach':
        return this.getTotalReach(userId, range);
      case 'total_engagement':
        return this.getTotalEngagement(userId, range);
      case 'average_engagement_rate':
        return this.getAverageEngagementRate(userId);
      case 'total_spend':
        return this.getTotalSpend(userId, range);
      case 'roi':
        return this.getROI(userId, range);
      case 'mentions_count':
        return this.getMentionsCount(userId, range);
      case 'sentiment_score':
        return this.getSentimentScore(userId, range);
      default:
        return this.getGenericMetric(userId, widget, range);
    }
  }

  // ==================== Metric Calculations ====================

  private async getCampaignsCount(userId: string, range: { start: Date; end: Date }) {
    const count = await prisma.campaign.count({
      where: {
        userId,
        createdAt: { gte: range.start, lte: range.end },
      },
    });

    const previousRange = this.getPreviousPeriod(range);
    const previousCount = await prisma.campaign.count({
      where: {
        userId,
        createdAt: { gte: previousRange.start, lte: previousRange.end },
      },
    });

    return {
      value: count,
      previousValue: previousCount,
      change: previousCount > 0 ? ((count - previousCount) / previousCount) * 100 : 0,
    };
  }

  private async getActiveCampaigns(userId: string) {
    const count = await prisma.campaign.count({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });
    return { value: count };
  }

  private async getTotalInfluencers(userId: string) {
    const count = await SavedInfluencer.countDocuments({ userId });
    return { value: count };
  }

  private async getTotalReach(userId: string, range: { start: Date; end: Date }) {
    const campaigns = await prisma.campaign.findMany({
      where: {
        userId,
        createdAt: { gte: range.start, lte: range.end },
      },
      include: { influencers: true },
    });

    let totalReach = 0;
    for (const campaign of campaigns) {
      for (const ci of campaign.influencers) {
        const influencer = await SavedInfluencer.findById(ci.savedInfluencerId);
        if (influencer?.profile?.followers) {
          totalReach += influencer.profile.followers;
        }
      }
    }

    return { value: totalReach, formatted: this.formatNumber(totalReach) };
  }

  private async getTotalEngagement(userId: string, range: { start: Date; end: Date }) {
    // Mock data - would integrate with real post tracking
    const value = Math.floor(Math.random() * 100000) + 50000;
    return { value, formatted: this.formatNumber(value) };
  }

  private async getAverageEngagementRate(userId: string) {
    const influencers = await SavedInfluencer.find({ userId });
    if (influencers.length === 0) return { value: 0 };

    const totalRate = influencers.reduce(
      (sum, inf) => sum + (inf.profile?.engagementRate || 0),
      0
    );

    return {
      value: totalRate / influencers.length,
      formatted: `${(totalRate / influencers.length).toFixed(2)}%`,
    };
  }

  private async getTotalSpend(userId: string, range: { start: Date; end: Date }) {
    const result = await prisma.payment.aggregate({
      where: {
        campaignInfluencer: { campaign: { userId } },
        status: 'COMPLETED',
        paidAt: { gte: range.start, lte: range.end },
      },
      _sum: { amount: true },
    });

    const value = result._sum.amount?.toNumber() || 0;
    return { value, formatted: `$${value.toLocaleString()}` };
  }

  private async getROI(userId: string, range: { start: Date; end: Date }) {
    // Mock ROI calculation
    const value = Math.floor(Math.random() * 300) + 100;
    return { value, formatted: `${value}%` };
  }

  private async getMentionsCount(userId: string, range: { start: Date; end: Date }) {
    const count = await BrandMention.countDocuments({
      userId,
      detectedAt: { $gte: range.start, $lte: range.end },
    });
    return { value: count };
  }

  private async getSentimentScore(userId: string, range: { start: Date; end: Date }) {
    const mentions = await BrandMention.find({
      userId,
      detectedAt: { $gte: range.start, $lte: range.end },
    });

    if (mentions.length === 0) return { value: 0, label: 'Neutral' };

    const scores = { positive: 1, neutral: 0, negative: -1 };
    const total = mentions.reduce(
      (sum, m) => sum + (scores[m.sentiment as keyof typeof scores] || 0),
      0
    );

    const score = (total / mentions.length + 1) * 50; // Convert to 0-100
    const label = score > 60 ? 'Positive' : score < 40 ? 'Negative' : 'Neutral';

    return { value: score, label };
  }

  private async getGenericMetric(
    userId: string,
    widget: IDashboardWidget,
    range: { start: Date; end: Date }
  ) {
    // Return mock data for other metrics
    return {
      value: Math.floor(Math.random() * 1000),
      data: [],
    };
  }

  // ==================== Helpers ====================

  private getDateRange(preset: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (preset) {
      case 'last_7_days':
        start.setDate(end.getDate() - 7);
        break;
      case 'last_30_days':
        start.setDate(end.getDate() - 30);
        break;
      case 'last_90_days':
        start.setDate(end.getDate() - 90);
        break;
      case 'last_year':
        start.setFullYear(end.getFullYear() - 1);
        break;
      default:
        start.setDate(end.getDate() - 30);
    }

    return { start, end };
  }

  private getPreviousPeriod(range: { start: Date; end: Date }): { start: Date; end: Date } {
    const duration = range.end.getTime() - range.start.getTime();
    return {
      start: new Date(range.start.getTime() - duration),
      end: new Date(range.start.getTime()),
    };
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }

  // ==================== Templates ====================

  /**
   * Get default dashboard templates
   */
  getTemplates(): { name: string; description: string; widgets: CreateWidgetInput[] }[] {
    return [
      {
        name: 'Campaign Overview',
        description: 'Track campaign performance at a glance',
        widgets: [
          { type: 'stat_card', title: 'Active Campaigns', metric: 'active_campaigns', x: 0, y: 0, width: 3, height: 2 },
          { type: 'stat_card', title: 'Total Influencers', metric: 'total_influencers', x: 3, y: 0, width: 3, height: 2 },
          { type: 'stat_card', title: 'Total Reach', metric: 'total_reach', x: 6, y: 0, width: 3, height: 2 },
          { type: 'stat_card', title: 'Avg. Engagement', metric: 'average_engagement_rate', x: 9, y: 0, width: 3, height: 2 },
          { type: 'line_chart', title: 'Campaign Performance', metrics: ['total_engagement'], x: 0, y: 2, width: 8, height: 4, options: { showLegend: true } },
          { type: 'pie_chart', title: 'Platform Distribution', metric: 'campaigns_count', x: 8, y: 2, width: 4, height: 4, options: { groupBy: 'platform' } },
        ],
      },
      {
        name: 'ROI Dashboard',
        description: 'Financial performance and ROI tracking',
        widgets: [
          { type: 'stat_card', title: 'Total Spend', metric: 'total_spend', x: 0, y: 0, width: 4, height: 2, options: { format: 'currency' } },
          { type: 'stat_card', title: 'ROI', metric: 'roi', x: 4, y: 0, width: 4, height: 2, options: { format: 'percentage' } },
          { type: 'stat_card', title: 'Cost per Engagement', metric: 'cost_per_engagement', x: 8, y: 0, width: 4, height: 2, options: { format: 'currency' } },
          { type: 'bar_chart', title: 'Spend by Campaign', metric: 'total_spend', x: 0, y: 2, width: 12, height: 4, options: { groupBy: 'campaign' } },
        ],
      },
      {
        name: 'Social Listening',
        description: 'Monitor brand mentions and sentiment',
        widgets: [
          { type: 'stat_card', title: 'Total Mentions', metric: 'mentions_count', x: 0, y: 0, width: 4, height: 2 },
          { type: 'gauge', title: 'Sentiment Score', metric: 'sentiment_score', x: 4, y: 0, width: 4, height: 2 },
          { type: 'stat_card', title: 'Positive Mentions', metric: 'mentions_count', x: 8, y: 0, width: 4, height: 2, filters: { platforms: ['positive'] } },
          { type: 'line_chart', title: 'Mentions Over Time', metrics: ['mentions_count'], x: 0, y: 2, width: 8, height: 4, options: { groupBy: 'day' } },
          { type: 'donut_chart', title: 'Sentiment Breakdown', metric: 'sentiment_score', x: 8, y: 2, width: 4, height: 4 },
        ],
      },
    ];
  }
}

export const customDashboardService = new CustomDashboardService();
