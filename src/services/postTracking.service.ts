/**
 * Post Tracking Service
 *
 * Handles:
 * - Tracking posts for campaigns
 * - Syncing post metrics from platforms
 * - Post performance analytics
 */

import { config } from '../config/index.js';
import { PostPerformance, IPostPerformance, IMetricSnapshot } from '../models/PostPerformance.js';
import { socialMediaService } from './socialMedia.service.js';
import { Types } from 'mongoose';

// ==================== Types ====================

export interface TrackPostInput {
  userId: string;
  campaignId?: string;
  campaignInfluencerId?: string;
  savedInfluencerId?: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  postUrl: string;
  isSponsored?: boolean;
}

export interface PostAnalytics {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalViews: number;
  avgEngagementRate: number;
  topPerformingPost?: {
    id: string;
    engagementRate: number;
    likes: number;
    postUrl: string;
  };
  metricsOverTime: {
    date: string;
    likes: number;
    comments: number;
    views: number;
  }[];
}

// ==================== Service ====================

class PostTrackingService {
  private useMockData: boolean;

  constructor() {
    this.useMockData = !config.instagram.clientId &&
                       !config.tiktok.clientKey &&
                       !config.youtube.clientId;
  }

  // ==================== Post Tracking ====================

  /**
   * Track a new post
   */
  async trackPost(input: TrackPostInput): Promise<IPostPerformance> {
    const { userId, campaignId, campaignInfluencerId, savedInfluencerId, platform, postUrl, isSponsored } = input;

    // Extract post ID from URL
    const platformPostId = this.extractPostId(platform, postUrl);

    // Check if already tracking
    const existing = await PostPerformance.findOne({
      userId,
      platform,
      platformPostId,
    });

    if (existing) {
      return existing;
    }

    // Fetch initial metrics
    const postData = await this.fetchPostData(platform, postUrl, platformPostId);

    // Create tracked post
    const post = new PostPerformance({
      userId,
      campaignId,
      campaignInfluencerId,
      savedInfluencerId: savedInfluencerId ? new Types.ObjectId(savedInfluencerId) : undefined,
      platform,
      platformPostId,
      postUrl,
      content: postData.content,
      currentMetrics: postData.metrics,
      metricsHistory: [{
        timestamp: new Date(),
        ...postData.metrics,
      }],
      isSponsored: isSponsored ?? this.detectSponsorship(postData.content.caption),
      disclosurePresent: this.hasDisclosure(postData.content.caption),
      brandMentions: this.extractBrandMentions(postData.content.caption),
      postedAt: postData.postedAt,
      lastSyncedAt: new Date(),
    });

    await post.save();
    return post;
  }

  /**
   * Get tracked posts for user/campaign
   */
  async getPosts(
    userId: string,
    filters: {
      campaignId?: string;
      savedInfluencerId?: string;
      platform?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ posts: IPostPerformance[]; total: number }> {
    const query: Record<string, unknown> = { userId };

    if (filters.campaignId) query.campaignId = filters.campaignId;
    if (filters.savedInfluencerId) query.savedInfluencerId = new Types.ObjectId(filters.savedInfluencerId);
    if (filters.platform) query.platform = filters.platform;

    const [posts, total] = await Promise.all([
      PostPerformance.find(query)
        .sort({ postedAt: -1 })
        .skip(filters.offset || 0)
        .limit(filters.limit || 50)
        .lean(),
      PostPerformance.countDocuments(query),
    ]);

    return { posts: posts as IPostPerformance[], total };
  }

  /**
   * Get single post by ID
   */
  async getPost(userId: string, postId: string): Promise<IPostPerformance | null> {
    return PostPerformance.findOne({
      _id: new Types.ObjectId(postId),
      userId,
    });
  }

  /**
   * Delete tracked post
   */
  async deletePost(userId: string, postId: string): Promise<boolean> {
    const result = await PostPerformance.deleteOne({
      _id: new Types.ObjectId(postId),
      userId,
    });
    return result.deletedCount > 0;
  }

  // ==================== Metrics Syncing ====================

  /**
   * Sync metrics for a single post
   */
  async syncPostMetrics(postId: string): Promise<IPostPerformance | null> {
    const post = await PostPerformance.findById(postId);
    if (!post) return null;

    const postData = await this.fetchPostData(post.platform, post.postUrl, post.platformPostId);

    // Add to history if metrics changed significantly
    const shouldAddSnapshot = this.hasSignificantChange(post.currentMetrics, postData.metrics);

    if (shouldAddSnapshot) {
      post.metricsHistory.push({
        timestamp: new Date(),
        ...postData.metrics,
      });
    }

    // Update current metrics
    post.currentMetrics = postData.metrics;
    post.lastSyncedAt = new Date();

    await post.save();
    return post;
  }

  /**
   * Sync all posts for a campaign
   */
  async syncCampaignPosts(campaignId: string): Promise<{ synced: number; failed: number }> {
    const posts = await PostPerformance.find({ campaignId });

    let synced = 0;
    let failed = 0;

    for (const post of posts) {
      try {
        await this.syncPostMetrics(post._id.toString());
        synced++;
      } catch (error) {
        console.error(`[PostTracking] Failed to sync post ${post._id}:`, error);
        failed++;
      }
    }

    return { synced, failed };
  }

  // ==================== Analytics ====================

  /**
   * Get campaign post analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<PostAnalytics> {
    const posts = await PostPerformance.find({ campaignId }).lean();

    if (posts.length === 0) {
      return {
        totalPosts: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalViews: 0,
        avgEngagementRate: 0,
        metricsOverTime: [],
      };
    }

    const totalLikes = posts.reduce((sum, p) => sum + p.currentMetrics.likes, 0);
    const totalComments = posts.reduce((sum, p) => sum + p.currentMetrics.comments, 0);
    const totalShares = posts.reduce((sum, p) => sum + p.currentMetrics.shares, 0);
    const totalViews = posts.reduce((sum, p) => sum + (p.currentMetrics.views || 0), 0);
    const avgEngagementRate = posts.reduce((sum, p) => sum + p.currentMetrics.engagementRate, 0) / posts.length;

    // Find top performing post
    const topPost = posts.reduce((top, p) =>
      p.currentMetrics.engagementRate > (top?.currentMetrics.engagementRate || 0) ? p : top
    , posts[0]);

    // Aggregate metrics by day
    const metricsByDay = new Map<string, { likes: number; comments: number; views: number }>();

    for (const post of posts) {
      for (const snapshot of post.metricsHistory) {
        const dateKey = snapshot.timestamp.toISOString().split('T')[0];
        const existing = metricsByDay.get(dateKey) || { likes: 0, comments: 0, views: 0 };
        metricsByDay.set(dateKey, {
          likes: existing.likes + snapshot.likes,
          comments: existing.comments + snapshot.comments,
          views: existing.views + (snapshot.views || 0),
        });
      }
    }

    const metricsOverTime = Array.from(metricsByDay.entries())
      .map(([date, metrics]) => ({ date, ...metrics }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalPosts: posts.length,
      totalLikes,
      totalComments,
      totalShares,
      totalViews,
      avgEngagementRate,
      topPerformingPost: {
        id: topPost._id.toString(),
        engagementRate: topPost.currentMetrics.engagementRate,
        likes: topPost.currentMetrics.likes,
        postUrl: topPost.postUrl,
      },
      metricsOverTime,
    };
  }

  /**
   * Get influencer post analytics
   */
  async getInfluencerAnalytics(savedInfluencerId: string): Promise<PostAnalytics> {
    const posts = await PostPerformance.find({
      savedInfluencerId: new Types.ObjectId(savedInfluencerId),
    }).lean();

    if (posts.length === 0) {
      return {
        totalPosts: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalViews: 0,
        avgEngagementRate: 0,
        metricsOverTime: [],
      };
    }

    // Same calculation as campaign analytics
    const totalLikes = posts.reduce((sum, p) => sum + p.currentMetrics.likes, 0);
    const totalComments = posts.reduce((sum, p) => sum + p.currentMetrics.comments, 0);
    const totalShares = posts.reduce((sum, p) => sum + p.currentMetrics.shares, 0);
    const totalViews = posts.reduce((sum, p) => sum + (p.currentMetrics.views || 0), 0);
    const avgEngagementRate = posts.reduce((sum, p) => sum + p.currentMetrics.engagementRate, 0) / posts.length;

    const topPost = posts.reduce((top, p) =>
      p.currentMetrics.engagementRate > (top?.currentMetrics.engagementRate || 0) ? p : top
    , posts[0]);

    return {
      totalPosts: posts.length,
      totalLikes,
      totalComments,
      totalShares,
      totalViews,
      avgEngagementRate,
      topPerformingPost: {
        id: topPost._id.toString(),
        engagementRate: topPost.currentMetrics.engagementRate,
        likes: topPost.currentMetrics.likes,
        postUrl: topPost.postUrl,
      },
      metricsOverTime: [],
    };
  }

  // ==================== Helper Methods ====================

  private extractPostId(platform: string, postUrl: string): string {
    try {
      const url = new URL(postUrl);

      switch (platform) {
        case 'instagram': {
          // https://www.instagram.com/p/ABC123/ or /reel/ABC123/
          const match = url.pathname.match(/\/(p|reel)\/([^/]+)/);
          return match?.[2] || url.pathname;
        }

        case 'tiktok': {
          // https://www.tiktok.com/@user/video/1234567890
          const match = url.pathname.match(/\/video\/(\d+)/);
          return match?.[1] || url.pathname;
        }

        case 'youtube': {
          // https://www.youtube.com/watch?v=ABC123 or /shorts/ABC123
          const videoId = url.searchParams.get('v');
          if (videoId) return videoId;
          const shortsMatch = url.pathname.match(/\/shorts\/([^/]+)/);
          return shortsMatch?.[1] || url.pathname;
        }

        default:
          return url.pathname;
      }
    } catch {
      return postUrl;
    }
  }

  private async fetchPostData(
    platform: string,
    postUrl: string,
    platformPostId: string
  ): Promise<{
    content: {
      caption?: string;
      mediaType: 'image' | 'video' | 'carousel' | 'reel' | 'story' | 'short';
      mediaUrls: string[];
      thumbnailUrl?: string;
      hashtags: string[];
      mentions: string[];
    };
    metrics: {
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      views?: number;
      engagementRate: number;
    };
    postedAt: Date;
  }> {
    // In production, this would call platform APIs
    // For now, return mock data
    if (this.useMockData) {
      return this.getMockPostData(platform);
    }

    // TODO: Implement real API calls for each platform
    return this.getMockPostData(platform);
  }

  private getMockPostData(platform: string) {
    const likes = Math.floor(Math.random() * 50000) + 1000;
    const comments = Math.floor(Math.random() * 2000) + 50;
    const views = platform !== 'instagram' ? Math.floor(Math.random() * 500000) + 10000 : undefined;
    const shares = Math.floor(Math.random() * 500) + 10;
    const saves = Math.floor(Math.random() * 1000) + 50;

    const engagementRate = views
      ? ((likes + comments + shares) / views) * 100
      : ((likes + comments) / (likes * 10)) * 100;

    return {
      content: {
        caption: 'Amazing collaboration! So excited to share this with you all. #sponsored #ad #collaboration',
        mediaType: 'video' as const,
        mediaUrls: [`https://example.com/${platform}/media.mp4`],
        thumbnailUrl: `https://picsum.photos/seed/${Date.now()}/400/400`,
        hashtags: ['sponsored', 'ad', 'collaboration', 'brand'],
        mentions: ['@brandname'],
      },
      metrics: {
        likes,
        comments,
        shares,
        saves,
        views,
        engagementRate,
      },
      postedAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
    };
  }

  private detectSponsorship(caption?: string): boolean {
    if (!caption) return false;
    const sponsorKeywords = ['#ad', '#sponsored', '#partner', '#collab', 'paid partnership', '#gifted'];
    const lowerCaption = caption.toLowerCase();
    return sponsorKeywords.some(keyword => lowerCaption.includes(keyword));
  }

  private hasDisclosure(caption?: string): boolean {
    if (!caption) return false;
    const disclosurePatterns = ['#ad', '#sponsored', 'paid partnership', 'ad:', 'sponsored by'];
    const lowerCaption = caption.toLowerCase();
    return disclosurePatterns.some(pattern => lowerCaption.includes(pattern));
  }

  private extractBrandMentions(caption?: string): string[] {
    if (!caption) return [];
    const mentionPattern = /@([a-zA-Z0-9_]+)/g;
    const matches = caption.match(mentionPattern) || [];
    return matches.map(m => m.substring(1)); // Remove @ symbol
  }

  private hasSignificantChange(
    current: { likes: number; comments: number; views?: number },
    newMetrics: { likes: number; comments: number; views?: number }
  ): boolean {
    const likesChange = Math.abs(newMetrics.likes - current.likes) / (current.likes || 1);
    const commentsChange = Math.abs(newMetrics.comments - current.comments) / (current.comments || 1);
    const viewsChange = current.views && newMetrics.views
      ? Math.abs(newMetrics.views - current.views) / (current.views || 1)
      : 0;

    // Significant if any metric changed by more than 5%
    return likesChange > 0.05 || commentsChange > 0.05 || viewsChange > 0.05;
  }
}

// Export singleton instance
export const postTrackingService = new PostTrackingService();
