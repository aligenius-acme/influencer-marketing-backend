/**
 * Fake Follower Analysis Service
 *
 * Analyzes influencer accounts for:
 * - Fake/bot followers
 * - Engagement authenticity
 * - Growth patterns
 * - Suspicious activity
 */

import { config } from '../../config/index.js';
import { SavedInfluencer, ISavedInfluencer } from '../../models/SavedInfluencer.js';
import {
  FakeFollowerAnalysis,
  IFakeFollowerAnalysis,
  ISuspiciousPattern,
} from '../../models/FakeFollowerAnalysis.js';
import { Types } from 'mongoose';

// ==================== Types ====================

export interface AnalysisResult {
  savedInfluencerId: string;
  influencerName: string;
  platform: string;
  authenticityScore: number;
  fakeFollowerPercentage: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  details: {
    followerQuality: {
      realFollowers: number;
      suspiciousFollowers: number;
      massFollowers: number;
      inactiveFollowers: number;
    };
    engagementAnalysis: {
      avgEngagementRate: number;
      engagementTrend: 'increasing' | 'stable' | 'decreasing';
      commentQuality: number;
      likeToCommentRatio: number;
      suspiciousSpikes: boolean;
    };
    growthAnalysis: {
      followerGrowthRate: number;
      unusualGrowthSpikes: boolean;
      growthPattern: 'organic' | 'suspicious' | 'paid';
    };
  };
  suspiciousPatterns: ISuspiciousPattern[];
  recommendations: string[];
  confidence: number;
  analyzedAt: Date;
}

// ==================== Service ====================

class FakeFollowerService {
  private useAI: boolean;

  constructor() {
    this.useAI = !!config.openai.apiKey;
    if (!this.useAI) {
      console.log('[FakeFollowerService] OpenAI not configured - using heuristic analysis');
    }
  }

  // ==================== Main Methods ====================

  /**
   * Analyze an influencer for fake followers
   */
  async analyzeInfluencer(
    userId: string,
    savedInfluencerId: string
  ): Promise<AnalysisResult> {
    // Get influencer data
    const influencer = await SavedInfluencer.findOne({
      _id: new Types.ObjectId(savedInfluencerId),
      userId,
    }).lean();

    if (!influencer) {
      throw new Error('Influencer not found');
    }

    // Perform analysis
    const followerQuality = this.analyzeFollowerQuality(influencer);
    const engagementAnalysis = this.analyzeEngagement(influencer);
    const growthAnalysis = this.analyzeGrowth(influencer);
    const suspiciousPatterns = this.detectSuspiciousPatterns(
      influencer,
      followerQuality,
      engagementAnalysis,
      growthAnalysis
    );

    // Calculate scores
    const fakeFollowerPercentage = this.calculateFakePercentage(followerQuality, influencer);
    const authenticityScore = this.calculateAuthenticityScore(
      fakeFollowerPercentage,
      engagementAnalysis,
      suspiciousPatterns
    );
    const riskLevel = this.determineRiskLevel(authenticityScore, suspiciousPatterns);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      riskLevel,
      suspiciousPatterns,
      fakeFollowerPercentage
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(influencer);

    const result: AnalysisResult = {
      savedInfluencerId,
      influencerName: influencer.profile.displayName,
      platform: influencer.platform,
      authenticityScore,
      fakeFollowerPercentage,
      riskLevel,
      summary: this.generateSummary(authenticityScore, riskLevel, fakeFollowerPercentage),
      details: {
        followerQuality,
        engagementAnalysis,
        growthAnalysis,
      },
      suspiciousPatterns,
      recommendations,
      confidence,
      analyzedAt: new Date(),
    };

    // Store result
    await this.storeAnalysis(userId, savedInfluencerId, influencer.platform, result);

    return result;
  }

  /**
   * Get previous analysis for an influencer
   */
  async getAnalysis(
    userId: string,
    savedInfluencerId: string
  ): Promise<IFakeFollowerAnalysis | null> {
    return FakeFollowerAnalysis.findOne({
      userId,
      savedInfluencerId: new Types.ObjectId(savedInfluencerId),
    }).sort({ analyzedAt: -1 });
  }

  /**
   * Get all analyses for a user
   */
  async getAllAnalyses(
    userId: string,
    options: {
      riskLevel?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ analyses: IFakeFollowerAnalysis[]; total: number }> {
    const query: Record<string, unknown> = { userId };
    if (options.riskLevel) {
      query.riskLevel = options.riskLevel;
    }

    const [analyses, total] = await Promise.all([
      FakeFollowerAnalysis.find(query)
        .sort({ analyzedAt: -1 })
        .skip(options.offset || 0)
        .limit(options.limit || 50)
        .lean(),
      FakeFollowerAnalysis.countDocuments(query),
    ]);

    return { analyses: analyses as IFakeFollowerAnalysis[], total };
  }

  /**
   * Quick check for basic red flags
   */
  async quickCheck(
    followers: number,
    engagementRate: number,
    avgLikes: number,
    avgComments: number
  ): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    redFlags: string[];
    estimatedAuthenticityScore: number;
  }> {
    const redFlags: string[] = [];

    // Check engagement anomalies
    if (followers > 100000 && engagementRate < 1) {
      redFlags.push('Very low engagement for follower count');
    }

    if (followers > 50000 && engagementRate > 15) {
      redFlags.push('Unusually high engagement rate');
    }

    // Check like/comment ratio
    const likeToCommentRatio = avgComments > 0 ? avgLikes / avgComments : 0;
    if (likeToCommentRatio > 100) {
      redFlags.push('Abnormal like-to-comment ratio');
    }

    // Check absolute numbers
    const expectedLikes = followers * (engagementRate / 100) * 0.8;
    if (avgLikes > expectedLikes * 2) {
      redFlags.push('Likes significantly exceed expected range');
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (redFlags.length >= 3) riskLevel = 'high';
    else if (redFlags.length >= 1) riskLevel = 'medium';

    // Estimate authenticity
    let estimatedAuthenticityScore = 85;
    estimatedAuthenticityScore -= redFlags.length * 15;
    estimatedAuthenticityScore = Math.max(20, Math.min(95, estimatedAuthenticityScore));

    return {
      riskLevel,
      redFlags,
      estimatedAuthenticityScore,
    };
  }

  // ==================== Analysis Methods ====================

  private analyzeFollowerQuality(influencer: ISavedInfluencer): AnalysisResult['details']['followerQuality'] {
    const followers = influencer.profile.followers;
    const engagementRate = influencer.profile.engagementRate;

    // Estimate follower quality based on engagement
    // In production, this would use actual follower analysis APIs
    let suspiciousPercentage: number;

    if (engagementRate < 0.5 && followers > 50000) {
      suspiciousPercentage = 40;
    } else if (engagementRate < 1 && followers > 100000) {
      suspiciousPercentage = 30;
    } else if (engagementRate < 2) {
      suspiciousPercentage = 20;
    } else if (engagementRate > 15) {
      suspiciousPercentage = 25; // Suspicious high engagement
    } else {
      suspiciousPercentage = 10;
    }

    const suspiciousFollowers = Math.round(followers * (suspiciousPercentage / 100));
    const massFollowers = Math.round(followers * 0.05); // Estimate 5% are mass followers
    const inactiveFollowers = Math.round(followers * 0.15); // Estimate 15% inactive
    const realFollowers = followers - suspiciousFollowers - massFollowers - inactiveFollowers;

    return {
      realFollowers: Math.max(0, realFollowers),
      suspiciousFollowers,
      massFollowers,
      inactiveFollowers,
    };
  }

  private analyzeEngagement(influencer: ISavedInfluencer): AnalysisResult['details']['engagementAnalysis'] {
    const profile = influencer.profile;

    // Calculate like-to-comment ratio
    const likeToCommentRatio = profile.avgComments > 0
      ? profile.avgLikes / profile.avgComments
      : 0;

    // Determine if ratio is suspicious
    // Normal range is typically 10-50 likes per comment
    const suspiciousSpikes = likeToCommentRatio > 100 || likeToCommentRatio < 5;

    // Estimate comment quality (would use NLP in production)
    let commentQuality = 70;
    if (likeToCommentRatio > 80) commentQuality -= 20;
    if (profile.engagementRate < 1) commentQuality -= 15;
    commentQuality = Math.max(20, Math.min(95, commentQuality));

    // Determine trend (would use historical data in production)
    let engagementTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';

    return {
      avgEngagementRate: profile.engagementRate,
      engagementTrend,
      commentQuality,
      likeToCommentRatio: Math.round(likeToCommentRatio * 10) / 10,
      suspiciousSpikes,
    };
  }

  private analyzeGrowth(influencer: ISavedInfluencer): AnalysisResult['details']['growthAnalysis'] {
    // In production, this would use historical follower data
    // For now, estimate based on current metrics

    const followers = influencer.profile.followers;
    const engagementRate = influencer.profile.engagementRate;

    // Estimate growth rate (would be calculated from historical data)
    const followerGrowthRate = 2 + Math.random() * 3; // Simulated 2-5% monthly

    // Detect unusual patterns
    let unusualGrowthSpikes = false;
    let growthPattern: 'organic' | 'suspicious' | 'paid' = 'organic';

    // High followers with low engagement suggests purchased followers
    if (followers > 100000 && engagementRate < 1.5) {
      growthPattern = 'suspicious';
      unusualGrowthSpikes = true;
    } else if (followers > 50000 && engagementRate < 2) {
      growthPattern = 'paid';
    }

    return {
      followerGrowthRate: Math.round(followerGrowthRate * 10) / 10,
      unusualGrowthSpikes,
      growthPattern,
    };
  }

  private detectSuspiciousPatterns(
    influencer: ISavedInfluencer,
    followerQuality: AnalysisResult['details']['followerQuality'],
    engagementAnalysis: AnalysisResult['details']['engagementAnalysis'],
    growthAnalysis: AnalysisResult['details']['growthAnalysis']
  ): ISuspiciousPattern[] {
    const patterns: ISuspiciousPattern[] = [];
    const profile = influencer.profile;

    // Check for low engagement with high followers
    if (profile.followers > 100000 && profile.engagementRate < 1) {
      patterns.push({
        type: 'low_engagement',
        severity: 'high',
        description: 'Engagement rate is unusually low for follower count',
        evidence: `${profile.engagementRate.toFixed(2)}% engagement with ${profile.followers.toLocaleString()} followers`,
      });
    }

    // Check for suspicious like-to-comment ratio
    if (engagementAnalysis.likeToCommentRatio > 100) {
      patterns.push({
        type: 'abnormal_ratio',
        severity: 'medium',
        description: 'Like-to-comment ratio is abnormally high',
        evidence: `Ratio of ${engagementAnalysis.likeToCommentRatio}:1 (normal is 10-50:1)`,
      });
    }

    // Check for suspicious growth
    if (growthAnalysis.growthPattern === 'suspicious') {
      patterns.push({
        type: 'suspicious_growth',
        severity: 'high',
        description: 'Growth pattern suggests artificial follower acquisition',
      });
    }

    // Check follower quality
    const suspiciousPercentage = (followerQuality.suspiciousFollowers / profile.followers) * 100;
    if (suspiciousPercentage > 30) {
      patterns.push({
        type: 'high_fake_followers',
        severity: 'high',
        description: 'High percentage of potentially fake followers detected',
        evidence: `Estimated ${suspiciousPercentage.toFixed(1)}% suspicious followers`,
      });
    } else if (suspiciousPercentage > 20) {
      patterns.push({
        type: 'moderate_fake_followers',
        severity: 'medium',
        description: 'Moderate percentage of potentially fake followers',
        evidence: `Estimated ${suspiciousPercentage.toFixed(1)}% suspicious followers`,
      });
    }

    // Check for engagement spikes
    if (engagementAnalysis.suspiciousSpikes) {
      patterns.push({
        type: 'engagement_anomaly',
        severity: 'medium',
        description: 'Unusual engagement patterns detected',
      });
    }

    return patterns;
  }

  // ==================== Score Calculations ====================

  private calculateFakePercentage(
    followerQuality: AnalysisResult['details']['followerQuality'],
    influencer: ISavedInfluencer
  ): number {
    const total = influencer.profile.followers;
    const fake = followerQuality.suspiciousFollowers + followerQuality.massFollowers;
    return Math.round((fake / total) * 100);
  }

  private calculateAuthenticityScore(
    fakePercentage: number,
    engagementAnalysis: AnalysisResult['details']['engagementAnalysis'],
    patterns: ISuspiciousPattern[]
  ): number {
    let score = 100;

    // Deduct for fake followers
    score -= fakePercentage * 0.8;

    // Deduct for suspicious patterns
    for (const pattern of patterns) {
      if (pattern.severity === 'high') score -= 15;
      else if (pattern.severity === 'medium') score -= 8;
      else score -= 3;
    }

    // Deduct for low comment quality
    if (engagementAnalysis.commentQuality < 50) {
      score -= 10;
    }

    // Deduct for engagement spikes
    if (engagementAnalysis.suspiciousSpikes) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private determineRiskLevel(
    authenticityScore: number,
    patterns: ISuspiciousPattern[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    const highSeverityCount = patterns.filter(p => p.severity === 'high').length;

    if (authenticityScore < 40 || highSeverityCount >= 3) return 'critical';
    if (authenticityScore < 60 || highSeverityCount >= 2) return 'high';
    if (authenticityScore < 75 || highSeverityCount >= 1) return 'medium';
    return 'low';
  }

  private generateRecommendations(
    riskLevel: string,
    patterns: ISuspiciousPattern[],
    fakePercentage: number
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical') {
      recommendations.push('Consider removing this influencer from campaigns');
      recommendations.push('Request detailed audience analytics before proceeding');
    }

    if (riskLevel === 'high') {
      recommendations.push('Negotiate performance-based payment terms');
      recommendations.push('Monitor campaign performance closely');
    }

    if (fakePercentage > 25) {
      recommendations.push('Request third-party audience audit');
      recommendations.push('Consider smaller test campaign first');
    }

    if (patterns.some(p => p.type === 'low_engagement')) {
      recommendations.push('Evaluate content quality and audience fit');
    }

    if (patterns.some(p => p.type === 'suspicious_growth')) {
      recommendations.push('Review historical follower data');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue with standard verification process');
    }

    return recommendations;
  }

  private generateSummary(
    authenticityScore: number,
    riskLevel: string,
    fakePercentage: number
  ): string {
    if (riskLevel === 'critical') {
      return `Critical risk: Only ${authenticityScore}% authenticity score with ${fakePercentage}% suspected fake followers.`;
    }
    if (riskLevel === 'high') {
      return `High risk: ${authenticityScore}% authenticity score. Significant concerns about follower quality.`;
    }
    if (riskLevel === 'medium') {
      return `Medium risk: ${authenticityScore}% authenticity score. Some follower quality concerns detected.`;
    }
    return `Low risk: ${authenticityScore}% authenticity score. Follower base appears genuine.`;
  }

  private calculateConfidence(influencer: ISavedInfluencer): number {
    let confidence = 60;

    // More data = higher confidence
    if (influencer.audience) confidence += 15;
    if (influencer.profile.postsCount > 100) confidence += 10;
    if (influencer.lastSynced && Date.now() - influencer.lastSynced.getTime() < 7 * 24 * 60 * 60 * 1000) {
      confidence += 10; // Recent sync
    }

    return Math.min(90, confidence);
  }

  // ==================== Storage ====================

  private async storeAnalysis(
    userId: string,
    savedInfluencerId: string,
    platform: string,
    result: AnalysisResult
  ): Promise<void> {
    try {
      await FakeFollowerAnalysis.findOneAndUpdate(
        {
          userId,
          savedInfluencerId: new Types.ObjectId(savedInfluencerId),
        },
        {
          userId,
          savedInfluencerId: new Types.ObjectId(savedInfluencerId),
          platform,
          authenticityScore: result.authenticityScore,
          fakeFollowerPercentage: result.fakeFollowerPercentage,
          riskLevel: result.riskLevel,
          followerQuality: result.details.followerQuality,
          engagementAnalysis: result.details.engagementAnalysis,
          growthAnalysis: result.details.growthAnalysis,
          suspiciousPatterns: result.suspiciousPatterns,
          recommendations: result.recommendations,
          verificationStatus: result.riskLevel === 'critical' ? 'flagged' : 'pending',
          dataPoints: 10, // Would be calculated from actual data points
          confidence: result.confidence,
          methodology: 'Heuristic analysis with engagement pattern detection',
          analyzedAt: result.analyzedAt,
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error('[FakeFollowerService] Failed to store analysis:', error);
    }
  }
}

// Export singleton instance
export const fakeFollowerService = new FakeFollowerService();
