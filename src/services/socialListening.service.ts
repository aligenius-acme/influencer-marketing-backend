/**
 * Social Listening Service
 *
 * Handles:
 * - Monitoring rule management
 * - Brand mention tracking
 * - Sentiment analysis
 * - Trend reporting
 */

import { config } from '../config/index.js';
import { BrandMention, IBrandMention } from '../models/BrandMention.js';
import { MonitoringRule, IMonitoringRule, INotificationSettings } from '../models/MonitoringRule.js';
import { TrendReport, ITrendReport, ISentimentBreakdown } from '../models/TrendReport.js';
import { Types } from 'mongoose';
import { queueService } from './jobs/queue.service.js';
import { emailService } from './email.service.js';
import { prisma } from '../config/postgres.js';

// ==================== Types ====================

export interface CreateRuleInput {
  name: string;
  description?: string;
  keywords: string[];
  hashtags?: string[];
  mentions?: string[];
  excludeKeywords?: string[];
  platforms: string[];
  minFollowers?: number;
  maxFollowers?: number;
  verifiedOnly?: boolean;
  scanFrequency?: 'realtime' | 'hourly' | 'daily';
  notifications?: Partial<INotificationSettings>;
}

export interface MentionFilters {
  ruleId?: string;
  platform?: string;
  sentiment?: string;
  isReviewed?: boolean;
  isActionRequired?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface MentionStats {
  totalMentions: number;
  byPlatform: Record<string, number>;
  bySentiment: ISentimentBreakdown;
  byDay: { date: string; count: number }[];
  topAuthors: { username: string; count: number }[];
  reachEstimate: number;
}

// ==================== Service ====================

class SocialListeningService {
  private useMockData: boolean;

  constructor() {
    // In production, would check for social listening API credentials
    this.useMockData = true;
    console.log('[SocialListeningService] Running in mock mode');
  }

  // ==================== Rule Management ====================

  /**
   * Create a new monitoring rule
   */
  async createRule(userId: string, input: CreateRuleInput): Promise<IMonitoringRule> {
    const rule = new MonitoringRule({
      userId,
      name: input.name,
      description: input.description,
      keywords: input.keywords,
      hashtags: input.hashtags || [],
      mentions: input.mentions || [],
      excludeKeywords: input.excludeKeywords || [],
      platforms: input.platforms,
      minFollowers: input.minFollowers,
      maxFollowers: input.maxFollowers,
      verifiedOnly: input.verifiedOnly || false,
      scanFrequency: input.scanFrequency || 'hourly',
      isActive: true,
      isPaused: false,
      notifications: input.notifications ? {
        emailEnabled: input.notifications.emailEnabled ?? true,
        inAppEnabled: input.notifications.inAppEnabled ?? true,
        slackEnabled: input.notifications.slackEnabled ?? false,
        slackWebhookUrl: input.notifications.slackWebhookUrl,
        minimumRelevanceScore: input.notifications.minimumRelevanceScore ?? 50,
        sentimentFilter: input.notifications.sentimentFilter ?? ['positive', 'neutral', 'negative'],
      } : undefined,
    });

    await rule.save();
    return rule;
  }

  /**
   * Get all rules for user
   */
  async getRules(
    userId: string,
    options: { activeOnly?: boolean } = {}
  ): Promise<IMonitoringRule[]> {
    const query: Record<string, unknown> = { userId };
    if (options.activeOnly) {
      query.isActive = true;
      query.isPaused = false;
    }

    return MonitoringRule.find(query).sort({ createdAt: -1 });
  }

  /**
   * Get single rule
   */
  async getRule(userId: string, ruleId: string): Promise<IMonitoringRule | null> {
    return MonitoringRule.findOne({
      _id: new Types.ObjectId(ruleId),
      userId,
    });
  }

  /**
   * Update rule
   */
  async updateRule(
    userId: string,
    ruleId: string,
    updates: Partial<CreateRuleInput>
  ): Promise<IMonitoringRule | null> {
    return MonitoringRule.findOneAndUpdate(
      { _id: new Types.ObjectId(ruleId), userId },
      { $set: updates },
      { new: true }
    );
  }

  /**
   * Delete rule
   */
  async deleteRule(userId: string, ruleId: string): Promise<boolean> {
    const result = await MonitoringRule.deleteOne({
      _id: new Types.ObjectId(ruleId),
      userId,
    });
    return result.deletedCount > 0;
  }

  /**
   * Pause/resume rule
   */
  async toggleRulePause(userId: string, ruleId: string): Promise<IMonitoringRule | null> {
    const rule = await MonitoringRule.findOne({
      _id: new Types.ObjectId(ruleId),
      userId,
    });

    if (!rule) return null;

    rule.isPaused = !rule.isPaused;
    await rule.save();
    return rule;
  }

  // ==================== Mention Management ====================

  /**
   * Get mentions with filters
   */
  async getMentions(
    userId: string,
    filters: MentionFilters = {}
  ): Promise<{ mentions: IBrandMention[]; total: number }> {
    const query: Record<string, unknown> = { userId };

    if (filters.ruleId) query.ruleId = new Types.ObjectId(filters.ruleId);
    if (filters.platform) query.platform = filters.platform;
    if (filters.sentiment) query.sentiment = filters.sentiment;
    if (filters.isReviewed !== undefined) query.isReviewed = filters.isReviewed;
    if (filters.isActionRequired !== undefined) query.isActionRequired = filters.isActionRequired;

    if (filters.startDate || filters.endDate) {
      query.mentionedAt = {};
      if (filters.startDate) (query.mentionedAt as Record<string, unknown>).$gte = filters.startDate;
      if (filters.endDate) (query.mentionedAt as Record<string, unknown>).$lte = filters.endDate;
    }

    const [mentions, total] = await Promise.all([
      BrandMention.find(query)
        .sort({ mentionedAt: -1 })
        .skip(filters.offset || 0)
        .limit(filters.limit || 50)
        .lean(),
      BrandMention.countDocuments(query),
    ]);

    return { mentions: mentions as IBrandMention[], total };
  }

  /**
   * Get mention by ID
   */
  async getMention(userId: string, mentionId: string): Promise<IBrandMention | null> {
    return BrandMention.findOne({
      _id: new Types.ObjectId(mentionId),
      userId,
    });
  }

  /**
   * Mark mention as reviewed
   */
  async markAsReviewed(
    userId: string,
    mentionId: string,
    notes?: string
  ): Promise<IBrandMention | null> {
    return BrandMention.findOneAndUpdate(
      { _id: new Types.ObjectId(mentionId), userId },
      {
        $set: {
          isReviewed: true,
          isActionRequired: false,
          notes,
        },
      },
      { new: true }
    );
  }

  /**
   * Flag mention for action
   */
  async flagForAction(
    userId: string,
    mentionId: string,
    notes?: string
  ): Promise<IBrandMention | null> {
    return BrandMention.findOneAndUpdate(
      { _id: new Types.ObjectId(mentionId), userId },
      {
        $set: {
          isActionRequired: true,
          notes,
        },
      },
      { new: true }
    );
  }

  // ==================== Statistics ====================

  /**
   * Get mention statistics
   */
  async getStats(
    userId: string,
    options: { ruleId?: string; days?: number } = {}
  ): Promise<MentionStats> {
    const days = options.days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query: Record<string, unknown> = {
      userId,
      mentionedAt: { $gte: startDate },
    };

    if (options.ruleId) {
      query.ruleId = new Types.ObjectId(options.ruleId);
    }

    const mentions = await BrandMention.find(query).lean();

    // Calculate stats
    const byPlatform: Record<string, number> = {};
    const bySentimentCount = { positive: 0, neutral: 0, negative: 0 };
    const byDay = new Map<string, number>();
    const authorCounts = new Map<string, number>();
    let totalReach = 0;
    let totalSentimentScore = 0;

    for (const mention of mentions) {
      // Platform
      byPlatform[mention.platform] = (byPlatform[mention.platform] || 0) + 1;

      // Sentiment
      bySentimentCount[mention.sentiment]++;
      totalSentimentScore += mention.sentimentScore;

      // By day
      const dateKey = mention.mentionedAt.toISOString().split('T')[0];
      byDay.set(dateKey, (byDay.get(dateKey) || 0) + 1);

      // Authors
      authorCounts.set(mention.authorUsername, (authorCounts.get(mention.authorUsername) || 0) + 1);

      // Reach
      if (mention.authorFollowers) {
        totalReach += mention.authorFollowers;
      }
    }

    // Sort authors by count
    const topAuthors = Array.from(authorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([username, count]) => ({ username, count }));

    // Sort days
    const byDayArray = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    return {
      totalMentions: mentions.length,
      byPlatform,
      bySentiment: {
        positive: bySentimentCount.positive,
        neutral: bySentimentCount.neutral,
        negative: bySentimentCount.negative,
        averageScore: mentions.length > 0 ? totalSentimentScore / mentions.length : 0,
      },
      byDay: byDayArray,
      topAuthors,
      reachEstimate: totalReach,
    };
  }

  // ==================== Trend Reports ====================

  /**
   * Generate trend report
   */
  async generateTrendReport(
    userId: string,
    periodType: 'daily' | 'weekly' | 'monthly'
  ): Promise<ITrendReport> {
    const now = new Date();
    let periodStart: Date;

    switch (periodType) {
      case 'daily':
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - 1);
        break;
      case 'weekly':
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        periodStart = new Date(now);
        periodStart.setMonth(now.getMonth() - 1);
        break;
    }

    // Get mentions for period
    const mentions = await BrandMention.find({
      userId,
      mentionedAt: { $gte: periodStart, $lte: now },
    }).lean();

    // Get rules
    const rules = await MonitoringRule.find({ userId, isActive: true }).lean();

    // Calculate stats
    const stats = await this.getStats(userId, {
      days: periodType === 'daily' ? 1 : periodType === 'weekly' ? 7 : 30,
    });

    // Generate keyword trends
    const keywordCounts = new Map<string, number>();
    const hashtagCounts = new Map<string, number>();

    for (const mention of mentions) {
      for (const keyword of mention.matchedKeywords) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      }
      for (const hashtag of mention.matchedHashtags) {
        hashtagCounts.set(hashtag, (hashtagCounts.get(hashtag) || 0) + 1);
      }
    }

    const topTrends = Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term, count]) => ({
        term,
        type: 'keyword' as const,
        count,
        changePercent: Math.random() * 50 - 10, // Mock change %
        sentiment: 'neutral' as const,
      }));

    // Get top mentions
    const topMentions = mentions
      .sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares))
      .slice(0, 5)
      .map(m => ({
        mentionId: m._id,
        content: m.contentPreview,
        authorUsername: m.authorUsername,
        engagement: m.likes + m.comments + m.shares,
        sentiment: m.sentiment,
      }));

    // Generate insights
    const insights: string[] = [];
    const recommendations: string[] = [];

    if (stats.bySentiment.positive > stats.bySentiment.negative * 2) {
      insights.push('Overall sentiment is highly positive');
    } else if (stats.bySentiment.negative > stats.bySentiment.positive) {
      insights.push('Negative mentions are outpacing positive ones');
      recommendations.push('Consider addressing negative feedback patterns');
    }

    if (stats.topAuthors.length > 0 && stats.topAuthors[0].count > 5) {
      insights.push(`${stats.topAuthors[0].username} is your most active mentioner`);
      recommendations.push('Consider reaching out for collaboration');
    }

    // Create report
    const report = new TrendReport({
      userId,
      periodType,
      periodStart,
      periodEnd: now,
      totalMentions: stats.totalMentions,
      totalReach: stats.reachEstimate,
      totalEngagement: mentions.reduce((sum, m) => sum + m.likes + m.comments + m.shares, 0),
      mentionChange: Math.random() * 40 - 10, // Mock change
      overallSentiment: stats.bySentiment,
      platformBreakdown: Object.entries(stats.byPlatform).map(([platform, count]) => ({
        platform,
        mentionCount: count,
        engagementTotal: 0,
        sentiment: stats.bySentiment,
      })),
      topTrends,
      emergingTrends: [],
      decliningTrends: [],
      topMentions,
      topInfluencers: stats.topAuthors.slice(0, 5).map(a => ({
        username: a.username,
        platform: 'instagram',
        mentionCount: a.count,
        totalReach: 0,
        sentiment: 'neutral',
      })),
      insights,
      recommendations,
      rulesIncluded: rules.map(r => r._id),
      generatedAt: new Date(),
    });

    await report.save();
    return report;
  }

  /**
   * Get trend reports
   */
  async getTrendReports(
    userId: string,
    options: { periodType?: string; limit?: number } = {}
  ): Promise<ITrendReport[]> {
    const query: Record<string, unknown> = { userId };
    if (options.periodType) query.periodType = options.periodType;

    return TrendReport.find(query)
      .sort({ generatedAt: -1 })
      .limit(options.limit || 10)
      .lean() as Promise<ITrendReport[]>;
  }

  /**
   * Get specific trend report
   */
  async getTrendReport(userId: string, reportId: string): Promise<ITrendReport | null> {
    return TrendReport.findOne({
      _id: new Types.ObjectId(reportId),
      userId,
    });
  }

  // ==================== Scanning ====================

  /**
   * Queue mention scan for a rule
   */
  async queueScan(userId: string, ruleId: string): Promise<string> {
    return queueService.queueMentionScan(userId, ruleId);
  }

  /**
   * Add mock mention (for development/testing)
   */
  async addMockMention(
    userId: string,
    ruleId: string,
    overrides: Partial<IBrandMention> = {}
  ): Promise<IBrandMention> {
    const mockContent = [
      'Amazing product! Highly recommend this to everyone.',
      'Not sure about this one, needs some improvement.',
      'Just tried this and it exceeded all expectations!',
      'Disappointed with the quality, expected better.',
      'Great value for money, will definitely buy again.',
    ];

    const randomContent = mockContent[Math.floor(Math.random() * mockContent.length)];
    const sentiment = randomContent.includes('Amazing') || randomContent.includes('Great')
      ? 'positive'
      : randomContent.includes('Disappointed') || randomContent.includes('Not sure')
        ? 'negative'
        : 'neutral';

    const mention = new BrandMention({
      userId,
      ruleId: new Types.ObjectId(ruleId),
      platform: ['instagram', 'tiktok', 'twitter'][Math.floor(Math.random() * 3)],
      sourceUrl: `https://example.com/post/${Date.now()}`,
      sourceType: 'post',
      content: randomContent,
      contentPreview: randomContent.substring(0, 100),
      mediaUrls: [],
      authorUsername: `user_${Math.floor(Math.random() * 10000)}`,
      authorFollowers: Math.floor(Math.random() * 100000),
      isVerified: Math.random() > 0.8,
      matchedKeywords: ['product', 'brand'],
      matchedHashtags: ['#review'],
      sentiment,
      sentimentScore: sentiment === 'positive' ? 0.7 : sentiment === 'negative' ? -0.6 : 0.1,
      relevanceScore: Math.floor(Math.random() * 40) + 60,
      likes: Math.floor(Math.random() * 1000),
      comments: Math.floor(Math.random() * 100),
      shares: Math.floor(Math.random() * 50),
      mentionedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      ...overrides,
    });

    await mention.save();

    // Update rule stats
    const rule = await MonitoringRule.findByIdAndUpdate(ruleId, {
      $inc: { totalMentions: 1 },
      $set: { lastMentionAt: mention.mentionedAt },
    }, { new: true });

    // Send email alert if enabled
    if (rule) {
      await this.sendMentionAlert(userId, rule, mention);
    }

    return mention;
  }

  // ==================== Email Alerts ====================

  /**
   * Send email alert for a brand mention
   */
  private async sendMentionAlert(
    userId: string,
    rule: IMonitoringRule,
    mention: IBrandMention
  ): Promise<void> {
    try {
      // Check if email notifications are enabled
      if (!rule.notifications?.emailEnabled) {
        console.log(`[SocialListening] Email alerts disabled for rule: ${rule.name}`);
        return;
      }

      // Check minimum relevance score
      if (mention.relevanceScore < (rule.notifications.minimumRelevanceScore || 50)) {
        console.log(`[SocialListening] Mention relevance ${mention.relevanceScore} below threshold ${rule.notifications.minimumRelevanceScore}`);
        return;
      }

      // Check sentiment filter
      const sentimentFilter = rule.notifications.sentimentFilter || ['positive', 'neutral', 'negative'];
      if (!sentimentFilter.includes(mention.sentiment)) {
        console.log(`[SocialListening] Mention sentiment ${mention.sentiment} not in filter: ${sentimentFilter.join(', ')}`);
        return;
      }

      // Get user email from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user?.email) {
        console.log(`[SocialListening] No email found for user: ${userId}`);
        return;
      }

      // Send the alert email
      console.log(`[SocialListening] Sending mention alert to ${user.email} for rule: ${rule.name}`);

      await emailService.sendBrandMentionAlert(user.email, {
        ruleName: rule.name,
        platform: mention.platform,
        content: mention.content,
        contentPreview: mention.contentPreview,
        authorUsername: mention.authorUsername,
        authorFollowers: mention.authorFollowers,
        isVerified: mention.isVerified,
        sentiment: mention.sentiment,
        relevanceScore: mention.relevanceScore / 100, // Convert to 0-1 scale for template
        sourceUrl: mention.sourceUrl,
        matchedKeywords: mention.matchedKeywords,
        matchedHashtags: mention.matchedHashtags,
        detectedAt: mention.mentionedAt,
        likes: mention.likes,
        comments: mention.comments,
        shares: mention.shares,
      });

      console.log(`[SocialListening] Alert email sent successfully`);
    } catch (error) {
      console.error('[SocialListening] Failed to send mention alert:', error);
      // Don't throw - email failure shouldn't break mention creation
    }
  }

  /**
   * Update notification settings for a rule
   */
  async updateRuleNotifications(
    userId: string,
    ruleId: string,
    notifications: Partial<INotificationSettings>
  ): Promise<IMonitoringRule | null> {
    const updateFields: Record<string, unknown> = {};

    if (notifications.emailEnabled !== undefined) {
      updateFields['notifications.emailEnabled'] = notifications.emailEnabled;
    }
    if (notifications.inAppEnabled !== undefined) {
      updateFields['notifications.inAppEnabled'] = notifications.inAppEnabled;
    }
    if (notifications.slackEnabled !== undefined) {
      updateFields['notifications.slackEnabled'] = notifications.slackEnabled;
    }
    if (notifications.slackWebhookUrl !== undefined) {
      updateFields['notifications.slackWebhookUrl'] = notifications.slackWebhookUrl;
    }
    if (notifications.minimumRelevanceScore !== undefined) {
      updateFields['notifications.minimumRelevanceScore'] = notifications.minimumRelevanceScore;
    }
    if (notifications.sentimentFilter !== undefined) {
      updateFields['notifications.sentimentFilter'] = notifications.sentimentFilter;
    }

    return MonitoringRule.findOneAndUpdate(
      { _id: new Types.ObjectId(ruleId), userId },
      { $set: updateFields },
      { new: true }
    );
  }
}

// Export singleton instance
export const socialListeningService = new SocialListeningService();
