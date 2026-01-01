import crypto from 'crypto';
import { config } from '../config/index.js';
import { cacheGet, cacheSet } from '../config/redis.js';

// Types
export interface InfluencerSearchFilters {
  platform?: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  query?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
  maxEngagement?: number;
  location?: string;
  language?: string;
  niche?: string[];
  verified?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'followers' | 'engagement' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export interface InfluencerProfile {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  bio: string;
  profileImage: string;
  profileUrl: string;
  followers: number;
  following: number;
  postsCount: number;
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  verified: boolean;
  location?: string;
  language?: string;
  niches: string[];
  recentPosts?: RecentPost[];
}

export interface RecentPost {
  id: string;
  type: 'image' | 'video' | 'carousel' | 'reel' | 'story';
  thumbnail: string;
  caption: string;
  likes: number;
  comments: number;
  engagement: number;
  postedAt: string;
}

export interface AudienceAnalytics {
  demographics: {
    age: Record<string, number>;
    gender: { male: number; female: number; other: number };
  };
  topLocations: { country: string; city?: string; percentage: number }[];
  topInterests: { interest: string; percentage: number }[];
  authenticityScore: number;
  reachability: number;
}

export interface SearchResult {
  influencers: InfluencerProfile[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

class ScrapCreatorsService {
  private baseUrl: string;
  private apiKey: string;
  private useMockData: boolean;

  constructor() {
    this.baseUrl = config.scrapCreators.apiUrl;
    this.apiKey = config.scrapCreators.apiKey;
    // Use mock data if no API key is configured
    this.useMockData = !this.apiKey || this.apiKey === '';
  }

  private generateCacheKey(prefix: string, data: unknown): string {
    const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    return `${prefix}:${hash}`;
  }

  async searchInfluencers(filters: InfluencerSearchFilters): Promise<SearchResult> {
    const cacheKey = this.generateCacheKey('search', filters);

    // Check cache first (15 min TTL)
    const cached = await cacheGet<SearchResult>(cacheKey);
    if (cached) {
      console.log('Returning cached search results');
      return cached;
    }

    let result: SearchResult;

    if (this.useMockData) {
      result = await this.getMockSearchResults(filters);
    } else {
      result = await this.fetchSearchResults(filters);
    }

    // Cache the results
    await cacheSet(cacheKey, result, 900); // 15 minutes

    return result;
  }

  async getInfluencerProfile(platform: string, platformId: string): Promise<InfluencerProfile | null> {
    const cacheKey = `profile:${platform}:${platformId}`;

    // Check cache first (1 hour TTL for profiles)
    const cached = await cacheGet<InfluencerProfile>(cacheKey);
    if (cached) {
      console.log('Returning cached profile');
      return cached;
    }

    let profile: InfluencerProfile | null;

    if (this.useMockData) {
      profile = await this.getMockProfile(platform, platformId);
    } else {
      profile = await this.fetchProfile(platform, platformId);
    }

    if (profile) {
      // Cache the profile
      await cacheSet(cacheKey, profile, 3600); // 1 hour
    }

    return profile;
  }

  async getAudienceAnalytics(platform: string, platformId: string): Promise<AudienceAnalytics | null> {
    const cacheKey = `analytics:${platform}:${platformId}`;

    // Check cache first (6 hour TTL for analytics)
    const cached = await cacheGet<AudienceAnalytics>(cacheKey);
    if (cached) {
      console.log('Returning cached analytics');
      return cached;
    }

    let analytics: AudienceAnalytics | null;

    if (this.useMockData) {
      analytics = await this.getMockAnalytics(platform, platformId);
    } else {
      analytics = await this.fetchAnalytics(platform, platformId);
    }

    if (analytics) {
      // Cache the analytics
      await cacheSet(cacheKey, analytics, 21600); // 6 hours
    }

    return analytics;
  }

  // Real API calls (to be implemented when API key is available)
  private async fetchSearchResults(filters: InfluencerSearchFilters): Promise<SearchResult> {
    const response = await fetch(`${this.baseUrl}/influencers/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    });

    if (!response.ok) {
      throw new Error(`ScrapCreators API error: ${response.status}`);
    }

    return response.json() as Promise<SearchResult>;
  }

  private async fetchProfile(platform: string, platformId: string): Promise<InfluencerProfile | null> {
    const response = await fetch(`${this.baseUrl}/influencers/${platform}/${platformId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`ScrapCreators API error: ${response.status}`);
    }

    return response.json() as Promise<InfluencerProfile>;
  }

  private async fetchAnalytics(platform: string, platformId: string): Promise<AudienceAnalytics | null> {
    const response = await fetch(`${this.baseUrl}/influencers/${platform}/${platformId}/analytics`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`ScrapCreators API error: ${response.status}`);
    }

    return response.json() as Promise<AudienceAnalytics>;
  }

  // Mock data for development
  private async getMockSearchResults(filters: InfluencerSearchFilters): Promise<SearchResult> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;

    // Generate mock influencers based on filters
    const mockInfluencers = this.generateMockInfluencers(50, filters);

    // Apply filters and pagination
    let filtered = mockInfluencers;

    if (filters.query) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(inf =>
        inf.username.toLowerCase().includes(query) ||
        inf.displayName.toLowerCase().includes(query) ||
        inf.bio.toLowerCase().includes(query)
      );
    }

    if (filters.minFollowers) {
      filtered = filtered.filter(inf => inf.followers >= filters.minFollowers!);
    }

    if (filters.maxFollowers) {
      filtered = filtered.filter(inf => inf.followers <= filters.maxFollowers!);
    }

    if (filters.minEngagement) {
      filtered = filtered.filter(inf => inf.engagementRate >= filters.minEngagement!);
    }

    if (filters.verified !== undefined) {
      filtered = filtered.filter(inf => inf.verified === filters.verified);
    }

    // Sort
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        const aVal = a[filters.sortBy as keyof InfluencerProfile] as number;
        const bVal = b[filters.sortBy as keyof InfluencerProfile] as number;
        return filters.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    return {
      influencers: paginated,
      total,
      page,
      limit,
      hasMore: start + limit < total,
    };
  }

  private generateMockInfluencers(count: number, filters: InfluencerSearchFilters): InfluencerProfile[] {
    const platforms = filters.platform ? [filters.platform] : ['instagram', 'tiktok', 'youtube', 'twitter'];
    const niches = [
      'Fashion', 'Beauty', 'Fitness', 'Travel', 'Food', 'Tech', 'Gaming',
      'Lifestyle', 'Photography', 'Music', 'Art', 'Business', 'Health',
      'Parenting', 'Pets', 'Sports', 'Education', 'Comedy', 'DIY'
    ];

    const firstNames = [
      'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Isabella', 'Sophia', 'Mia',
      'Charlotte', 'Amelia', 'James', 'Benjamin', 'Lucas', 'Henry', 'Alexander',
      'Michael', 'Daniel', 'Matthew', 'Jackson', 'Sebastian'
    ];

    const lastNames = [
      'Style', 'Vibes', 'Life', 'World', 'Daily', 'Official', 'Creative',
      'Studio', 'Hub', 'Zone', 'Space', 'Corner', 'Place', 'Journey', 'Story'
    ];

    const locations = [
      'Los Angeles, USA', 'New York, USA', 'London, UK', 'Paris, France',
      'Miami, USA', 'Dubai, UAE', 'Sydney, Australia', 'Toronto, Canada',
      'Berlin, Germany', 'Tokyo, Japan', 'Seoul, South Korea', 'Mumbai, India'
    ];

    return Array.from({ length: count }, (_, i) => {
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${Math.floor(Math.random() * 99)}`;
      const followers = Math.floor(Math.random() * 5000000) + 1000;
      const engagementRate = Math.round((Math.random() * 10 + 0.5) * 100) / 100;
      const influencerNiches = Array.from(
        { length: Math.floor(Math.random() * 3) + 1 },
        () => niches[Math.floor(Math.random() * niches.length)]
      ).filter((v, i, a) => a.indexOf(v) === i);

      return {
        id: `sc_${platform}_${i}_${Date.now()}`,
        platform,
        username: `@${username}`,
        displayName: `${firstName} ${lastName}`,
        bio: `${influencerNiches[0]} enthusiast | Content Creator | DM for collabs 📧`,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        profileUrl: this.getProfileUrl(platform, username),
        followers,
        following: Math.floor(Math.random() * 5000) + 100,
        postsCount: Math.floor(Math.random() * 2000) + 50,
        engagementRate,
        avgLikes: Math.floor(followers * (engagementRate / 100) * 0.8),
        avgComments: Math.floor(followers * (engagementRate / 100) * 0.05),
        verified: Math.random() > 0.85,
        location: locations[Math.floor(Math.random() * locations.length)],
        language: 'en',
        niches: influencerNiches,
      };
    });
  }

  private getProfileUrl(platform: string, username: string): string {
    const urls: Record<string, string> = {
      instagram: `https://instagram.com/${username}`,
      tiktok: `https://tiktok.com/@${username}`,
      youtube: `https://youtube.com/@${username}`,
      twitter: `https://twitter.com/${username}`,
    };
    return urls[platform] || '';
  }

  private async getMockProfile(platform: string, platformId: string): Promise<InfluencerProfile | null> {
    // Generate a consistent mock profile based on the ID
    const seed = platformId.replace(/\D/g, '');
    const mockInfluencers = this.generateMockInfluencers(1, { platform: platform as any });

    if (mockInfluencers.length === 0) return null;

    const profile = mockInfluencers[0];
    profile.id = platformId;
    profile.recentPosts = this.generateMockPosts(9, profile.followers, profile.engagementRate);

    return profile;
  }

  private generateMockPosts(count: number, followers: number, engagementRate: number): RecentPost[] {
    const types: RecentPost['type'][] = ['image', 'video', 'carousel', 'reel'];
    const captions = [
      'Loving this moment ✨ #lifestyle',
      'New content alert! Link in bio 🔗',
      'Behind the scenes 📸',
      'Thank you for 1M! 🎉',
      'Collab with @brand coming soon 👀',
      'Daily vibes ☀️',
      'What do you think? 💭',
      'Just dropped! 🔥',
      'Swipe for more ➡️',
    ];

    return Array.from({ length: count }, (_, i) => {
      const type = types[Math.floor(Math.random() * types.length)];
      const baseEngagement = followers * (engagementRate / 100);
      const variance = 0.5 + Math.random();

      return {
        id: `post_${i}_${Date.now()}`,
        type,
        thumbnail: `https://picsum.photos/seed/${i}${Date.now()}/400/400`,
        caption: captions[Math.floor(Math.random() * captions.length)],
        likes: Math.floor(baseEngagement * variance * 0.9),
        comments: Math.floor(baseEngagement * variance * 0.1),
        engagement: Math.round((engagementRate * variance) * 100) / 100,
        postedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    });
  }

  private async getMockAnalytics(platform: string, platformId: string): Promise<AudienceAnalytics | null> {
    return {
      demographics: {
        age: {
          '13-17': Math.floor(Math.random() * 10),
          '18-24': Math.floor(Math.random() * 30) + 20,
          '25-34': Math.floor(Math.random() * 30) + 20,
          '35-44': Math.floor(Math.random() * 15) + 5,
          '45-54': Math.floor(Math.random() * 10),
          '55+': Math.floor(Math.random() * 5),
        },
        gender: {
          male: Math.floor(Math.random() * 40) + 20,
          female: Math.floor(Math.random() * 40) + 30,
          other: Math.floor(Math.random() * 5),
        },
      },
      topLocations: [
        { country: 'United States', city: 'Los Angeles', percentage: Math.floor(Math.random() * 20) + 20 },
        { country: 'United Kingdom', city: 'London', percentage: Math.floor(Math.random() * 15) + 10 },
        { country: 'Canada', city: 'Toronto', percentage: Math.floor(Math.random() * 10) + 5 },
        { country: 'Australia', city: 'Sydney', percentage: Math.floor(Math.random() * 10) + 5 },
        { country: 'Germany', city: 'Berlin', percentage: Math.floor(Math.random() * 5) + 3 },
      ],
      topInterests: [
        { interest: 'Fashion & Style', percentage: Math.floor(Math.random() * 20) + 15 },
        { interest: 'Travel', percentage: Math.floor(Math.random() * 15) + 10 },
        { interest: 'Health & Fitness', percentage: Math.floor(Math.random() * 15) + 8 },
        { interest: 'Beauty', percentage: Math.floor(Math.random() * 15) + 8 },
        { interest: 'Food & Dining', percentage: Math.floor(Math.random() * 10) + 5 },
      ],
      authenticityScore: Math.floor(Math.random() * 20) + 75,
      reachability: Math.floor(Math.random() * 30) + 60,
    };
  }
}

export const scrapCreatorsService = new ScrapCreatorsService();
