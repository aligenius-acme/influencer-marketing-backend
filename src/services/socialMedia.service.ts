/**
 * Social Media Service - OAuth & Metrics Integration
 *
 * Handles:
 * - OAuth flows for Instagram, TikTok, YouTube
 * - Platform metrics syncing
 * - Token refresh management
 * - Mock data for development
 */

import { config } from '../config/index.js';
import { prisma } from '../config/postgres.js';
import { SocialPlatform } from '@prisma/client';
import { queueService } from './jobs/queue.service.js';

// ==================== Types ====================

export interface OAuthConfig {
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}

export interface PlatformMetrics {
  followers: number;
  following: number;
  posts: number;
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  avgViews?: number;
  recentPosts: RecentPost[];
}

export interface RecentPost {
  id: string;
  type: 'image' | 'video' | 'carousel' | 'reel' | 'story';
  caption?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  likes: number;
  comments: number;
  views?: number;
  shares?: number;
  saves?: number;
  engagementRate: number;
  postedAt: Date;
}

export interface ConnectionStatus {
  isConnected: boolean;
  platform: SocialPlatform;
  username?: string;
  lastSyncAt?: Date;
  tokenExpired?: boolean;
}

// ==================== Service ====================

class SocialMediaService {
  private useMockData: boolean;

  constructor() {
    // Use mock data if no platform credentials are configured
    this.useMockData = !config.instagram.clientId &&
                       !config.tiktok.clientKey &&
                       !config.youtube.clientId;

    if (this.useMockData) {
      console.log('[SocialMediaService] Running in mock mode - no API credentials configured');
    }
  }

  // ==================== OAuth Configuration ====================

  private getOAuthConfig(platform: SocialPlatform): OAuthConfig {
    switch (platform) {
      case 'INSTAGRAM':
        return {
          authUrl: 'https://api.instagram.com/oauth/authorize',
          tokenUrl: 'https://api.instagram.com/oauth/access_token',
          clientId: config.instagram.clientId,
          clientSecret: config.instagram.clientSecret,
          redirectUri: config.instagram.callbackUrl,
          scopes: ['user_profile', 'user_media'],
        };

      case 'TIKTOK':
        return {
          authUrl: 'https://www.tiktok.com/v2/auth/authorize',
          tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
          clientId: config.tiktok.clientKey,
          clientSecret: config.tiktok.clientSecret,
          redirectUri: config.tiktok.callbackUrl,
          scopes: ['user.info.basic', 'user.info.stats', 'video.list'],
        };

      case 'YOUTUBE':
        return {
          authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenUrl: 'https://oauth2.googleapis.com/token',
          clientId: config.youtube.clientId,
          clientSecret: config.youtube.clientSecret,
          redirectUri: config.youtube.callbackUrl,
          scopes: [
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/yt-analytics.readonly',
          ],
        };

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  // ==================== OAuth Flow ====================

  /**
   * Generate OAuth authorization URL for a platform
   */
  getAuthorizationUrl(platform: SocialPlatform, state: string): string {
    const oauthConfig = this.getOAuthConfig(platform);

    const params = new URLSearchParams({
      client_id: oauthConfig.clientId,
      redirect_uri: oauthConfig.redirectUri,
      response_type: 'code',
      scope: oauthConfig.scopes.join(' '),
      state,
    });

    // Platform-specific parameters
    if (platform === 'YOUTUBE') {
      params.append('access_type', 'offline');
      params.append('prompt', 'consent');
    }

    return `${oauthConfig.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    platform: SocialPlatform,
    code: string
  ): Promise<OAuthTokens> {
    if (this.useMockData) {
      return this.getMockTokens();
    }

    const oauthConfig = this.getOAuthConfig(platform);

    try {
      const response = await fetch(oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: oauthConfig.clientId,
          client_secret: oauthConfig.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: oauthConfig.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
      };
    } catch (error) {
      console.error(`[SocialMediaService] Token exchange error for ${platform}:`, error);
      throw error;
    }
  }

  /**
   * Refresh expired access token
   */
  async refreshAccessToken(
    platform: SocialPlatform,
    refreshToken: string
  ): Promise<OAuthTokens> {
    if (this.useMockData) {
      return this.getMockTokens();
    }

    const oauthConfig = this.getOAuthConfig(platform);

    try {
      const response = await fetch(oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: oauthConfig.clientId,
          client_secret: oauthConfig.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      const data = await response.json();

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
      };
    } catch (error) {
      console.error(`[SocialMediaService] Token refresh error for ${platform}:`, error);
      throw error;
    }
  }

  // ==================== Connection Management ====================

  /**
   * Save new social media connection
   */
  async createConnection(
    userId: string,
    platform: SocialPlatform,
    tokens: OAuthTokens,
    platformUserId: string,
    username?: string
  ): Promise<void> {
    const tokenExpiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    await prisma.socialMediaConnection.upsert({
      where: {
        userId_platform_platformUserId: {
          userId,
          platform,
          platformUserId,
        },
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt,
        scope: tokens.scope,
        username,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        platform,
        platformUserId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt,
        scope: tokens.scope,
        username,
        isActive: true,
      },
    });
  }

  /**
   * Get user's social media connections
   */
  async getConnections(userId: string): Promise<ConnectionStatus[]> {
    const connections = await prisma.socialMediaConnection.findMany({
      where: { userId, isActive: true },
      select: {
        platform: true,
        username: true,
        lastSyncAt: true,
        tokenExpiresAt: true,
      },
    });

    // Return status for all platforms
    const platforms: SocialPlatform[] = ['INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TWITTER'];

    return platforms.map(platform => {
      const connection = connections.find(c => c.platform === platform);

      return {
        isConnected: !!connection,
        platform,
        username: connection?.username,
        lastSyncAt: connection?.lastSyncAt ?? undefined,
        tokenExpired: connection?.tokenExpiresAt
          ? connection.tokenExpiresAt < new Date()
          : undefined,
      };
    });
  }

  /**
   * Get specific connection
   */
  async getConnection(userId: string, platform: SocialPlatform) {
    return prisma.socialMediaConnection.findFirst({
      where: { userId, platform, isActive: true },
    });
  }

  /**
   * Disconnect platform
   */
  async disconnect(userId: string, platform: SocialPlatform): Promise<void> {
    await prisma.socialMediaConnection.updateMany({
      where: { userId, platform },
      data: { isActive: false },
    });
  }

  // ==================== Platform Metrics ====================

  /**
   * Fetch metrics from connected platform
   */
  async fetchPlatformMetrics(
    userId: string,
    platform: SocialPlatform
  ): Promise<PlatformMetrics> {
    if (this.useMockData) {
      return this.getMockMetrics(platform);
    }

    const connection = await this.getConnection(userId, platform);
    if (!connection) {
      throw new Error(`No active connection for ${platform}`);
    }

    // Check if token needs refresh
    if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
      if (connection.refreshToken) {
        const newTokens = await this.refreshAccessToken(platform, connection.refreshToken);
        await this.updateConnectionTokens(connection.id, newTokens);
      } else {
        throw new Error(`Token expired for ${platform} and no refresh token available`);
      }
    }

    // Fetch metrics based on platform
    switch (platform) {
      case 'INSTAGRAM':
        return this.fetchInstagramMetrics(connection.accessToken);
      case 'TIKTOK':
        return this.fetchTikTokMetrics(connection.accessToken);
      case 'YOUTUBE':
        return this.fetchYouTubeMetrics(connection.accessToken);
      default:
        throw new Error(`Metrics not supported for ${platform}`);
    }
  }

  /**
   * Sync metrics for a connection (queue job)
   */
  async queueMetricsSync(
    userId: string,
    connectionId: string,
    platform?: string
  ): Promise<string> {
    return queueService.queueSync({
      userId,
      connectionId,
      platform,
    });
  }

  // ==================== Platform-Specific API Calls ====================

  private async fetchInstagramMetrics(accessToken: string): Promise<PlatformMetrics> {
    try {
      // Get user profile
      const profileResponse = await fetch(
        `https://graph.instagram.com/me?fields=id,username,media_count,account_type&access_token=${accessToken}`
      );
      const profile = await profileResponse.json();

      // Get recent media
      const mediaResponse = await fetch(
        `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count&limit=25&access_token=${accessToken}`
      );
      const media = await mediaResponse.json();

      const recentPosts: RecentPost[] = (media.data || []).map((post: any) => ({
        id: post.id,
        type: post.media_type.toLowerCase(),
        caption: post.caption,
        mediaUrl: post.media_url,
        thumbnailUrl: post.thumbnail_url,
        likes: post.like_count || 0,
        comments: post.comments_count || 0,
        engagementRate: 0, // Calculated below
        postedAt: new Date(post.timestamp),
      }));

      // Calculate averages
      const totalLikes = recentPosts.reduce((sum, p) => sum + p.likes, 0);
      const totalComments = recentPosts.reduce((sum, p) => sum + p.comments, 0);
      const avgLikes = recentPosts.length > 0 ? totalLikes / recentPosts.length : 0;
      const avgComments = recentPosts.length > 0 ? totalComments / recentPosts.length : 0;

      return {
        followers: 0, // Requires Instagram Graph API for business accounts
        following: 0,
        posts: profile.media_count || 0,
        engagementRate: 0,
        avgLikes,
        avgComments,
        recentPosts,
      };
    } catch (error) {
      console.error('[SocialMediaService] Instagram API error:', error);
      throw error;
    }
  }

  private async fetchTikTokMetrics(accessToken: string): Promise<PlatformMetrics> {
    try {
      // Get user info
      const userResponse = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      const userData = await userResponse.json();
      const user = userData.data?.user;

      // Get videos
      const videosResponse = await fetch(
        'https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,create_time,like_count,comment_count,share_count,view_count',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ max_count: 20 }),
        }
      );
      const videosData = await videosResponse.json();

      const recentPosts: RecentPost[] = (videosData.data?.videos || []).map((video: any) => ({
        id: video.id,
        type: 'video' as const,
        caption: video.title,
        thumbnailUrl: video.cover_image_url,
        likes: video.like_count || 0,
        comments: video.comment_count || 0,
        views: video.view_count || 0,
        shares: video.share_count || 0,
        engagementRate: video.view_count > 0
          ? ((video.like_count + video.comment_count + video.share_count) / video.view_count) * 100
          : 0,
        postedAt: new Date(video.create_time * 1000),
      }));

      const totalLikes = recentPosts.reduce((sum, p) => sum + p.likes, 0);
      const totalComments = recentPosts.reduce((sum, p) => sum + p.comments, 0);
      const totalViews = recentPosts.reduce((sum, p) => sum + (p.views || 0), 0);

      return {
        followers: user?.follower_count || 0,
        following: user?.following_count || 0,
        posts: user?.video_count || 0,
        engagementRate: totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0,
        avgLikes: recentPosts.length > 0 ? totalLikes / recentPosts.length : 0,
        avgComments: recentPosts.length > 0 ? totalComments / recentPosts.length : 0,
        avgViews: recentPosts.length > 0 ? totalViews / recentPosts.length : 0,
        recentPosts,
      };
    } catch (error) {
      console.error('[SocialMediaService] TikTok API error:', error);
      throw error;
    }
  }

  private async fetchYouTubeMetrics(accessToken: string): Promise<PlatformMetrics> {
    try {
      // Get channel stats
      const channelResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true&access_token=${accessToken}`
      );
      const channelData = await channelResponse.json();
      const channel = channelData.items?.[0];

      // Get recent videos
      const videosResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&maxResults=25&order=date&access_token=${accessToken}`
      );
      const videosData = await videosResponse.json();

      // Get video statistics
      const videoIds = videosData.items?.map((v: any) => v.id.videoId).join(',');
      let videoStats: any[] = [];

      if (videoIds) {
        const statsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&access_token=${accessToken}`
        );
        const statsData = await statsResponse.json();
        videoStats = statsData.items || [];
      }

      const recentPosts: RecentPost[] = (videosData.items || []).map((video: any, index: number) => {
        const stats = videoStats.find((s: any) => s.id === video.id.videoId)?.statistics || {};
        const views = parseInt(stats.viewCount) || 0;
        const likes = parseInt(stats.likeCount) || 0;
        const comments = parseInt(stats.commentCount) || 0;

        return {
          id: video.id.videoId,
          type: 'video' as const,
          caption: video.snippet.title,
          thumbnailUrl: video.snippet.thumbnails?.high?.url,
          likes,
          comments,
          views,
          engagementRate: views > 0 ? ((likes + comments) / views) * 100 : 0,
          postedAt: new Date(video.snippet.publishedAt),
        };
      });

      const stats = channel?.statistics || {};
      const totalLikes = recentPosts.reduce((sum, p) => sum + p.likes, 0);
      const totalComments = recentPosts.reduce((sum, p) => sum + p.comments, 0);
      const totalViews = recentPosts.reduce((sum, p) => sum + (p.views || 0), 0);

      return {
        followers: parseInt(stats.subscriberCount) || 0,
        following: 0, // YouTube doesn't have following
        posts: parseInt(stats.videoCount) || 0,
        engagementRate: totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0,
        avgLikes: recentPosts.length > 0 ? totalLikes / recentPosts.length : 0,
        avgComments: recentPosts.length > 0 ? totalComments / recentPosts.length : 0,
        avgViews: recentPosts.length > 0 ? totalViews / recentPosts.length : 0,
        recentPosts,
      };
    } catch (error) {
      console.error('[SocialMediaService] YouTube API error:', error);
      throw error;
    }
  }

  // ==================== Helper Methods ====================

  private async updateConnectionTokens(connectionId: string, tokens: OAuthTokens): Promise<void> {
    const tokenExpiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    await prisma.socialMediaConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt,
      },
    });
  }

  /**
   * Get platform user info from access token
   */
  async getPlatformUserInfo(
    platform: SocialPlatform,
    accessToken: string
  ): Promise<{ userId: string; username: string }> {
    if (this.useMockData) {
      return { userId: 'mock_user_123', username: 'mock_creator' };
    }

    switch (platform) {
      case 'INSTAGRAM': {
        const response = await fetch(
          `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
        );
        const data = await response.json();
        return { userId: data.id, username: data.username };
      }

      case 'TIKTOK': {
        const response = await fetch(
          'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const data = await response.json();
        return {
          userId: data.data?.user?.open_id,
          username: data.data?.user?.display_name
        };
      }

      case 'YOUTUBE': {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&access_token=${accessToken}`
        );
        const data = await response.json();
        const channel = data.items?.[0];
        return {
          userId: channel?.id,
          username: channel?.snippet?.title
        };
      }

      default:
        throw new Error(`Platform ${platform} not supported`);
    }
  }

  // ==================== Mock Data ====================

  private getMockTokens(): OAuthTokens {
    return {
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
      expiresIn: 3600,
      tokenType: 'Bearer',
      scope: 'user_profile,user_media',
    };
  }

  private getMockMetrics(platform: SocialPlatform): PlatformMetrics {
    const baseMetrics = {
      followers: Math.floor(Math.random() * 500000) + 10000,
      following: Math.floor(Math.random() * 1000) + 100,
      posts: Math.floor(Math.random() * 500) + 50,
      engagementRate: Math.random() * 8 + 2, // 2-10%
      avgLikes: Math.floor(Math.random() * 10000) + 500,
      avgComments: Math.floor(Math.random() * 500) + 20,
    };

    const recentPosts: RecentPost[] = Array.from({ length: 10 }, (_, i) => ({
      id: `mock_post_${i + 1}`,
      type: ['image', 'video', 'carousel', 'reel'][Math.floor(Math.random() * 4)] as RecentPost['type'],
      caption: `Amazing content from our latest shoot! #influencer #content #${platform.toLowerCase()}`,
      thumbnailUrl: `https://picsum.photos/seed/${i}/400/400`,
      likes: Math.floor(Math.random() * 15000) + 100,
      comments: Math.floor(Math.random() * 500) + 10,
      views: platform !== 'INSTAGRAM' ? Math.floor(Math.random() * 100000) + 1000 : undefined,
      shares: Math.floor(Math.random() * 200) + 5,
      saves: Math.floor(Math.random() * 500) + 20,
      engagementRate: Math.random() * 10 + 2,
      postedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // Each day back
    }));

    return {
      ...baseMetrics,
      avgViews: platform !== 'INSTAGRAM' ? Math.floor(Math.random() * 50000) + 5000 : undefined,
      recentPosts,
    };
  }
}

// Export singleton instance
export const socialMediaService = new SocialMediaService();
