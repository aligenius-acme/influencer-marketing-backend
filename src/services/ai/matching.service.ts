/**
 * AI Matching Service
 *
 * Calculates match scores between influencers and brands/campaigns.
 * Uses multiple factors to determine compatibility:
 * - Audience demographics alignment
 * - Engagement rate quality
 * - Niche/content relevance
 * - Authenticity score
 * - Budget fit
 */

import { config } from '../../config/index.js';
import { prisma } from '../../config/postgres.js';
import { SavedInfluencer, ISavedInfluencer } from '../../models/SavedInfluencer.js';
import { Types } from 'mongoose';

// ==================== Types ====================

export interface MatchScoreResult {
  id: string;
  savedInfluencerId: string;
  influencerName: string;
  platform: string;
  overallScore: number;
  audienceScore: number;
  engagementScore: number;
  nicheScore: number;
  authenticityScore: number;
  budgetFitScore: number;
  scores: {
    audience: number;
    engagement: number;
    niche: number;
    authenticity: number;
    budgetFit: number;
  };
  explanation: {
    strengths: string[];
    weaknesses: string[];
    recommendation: string;
  };
  calculatedAt: string;
}

export interface MatchCriteria {
  targetAudience?: {
    ageRange?: { min: number; max: number };
    gender?: 'male' | 'female' | 'any';
    locations?: string[];
    interests?: string[];
  };
  minEngagementRate?: number;
  niches?: string[];
  budget?: {
    min: number;
    max: number;
    currency?: string;
  };
  minFollowers?: number;
  maxFollowers?: number;
  platforms?: string[];
}

// ==================== Service ====================

class MatchingService {
  private useAI: boolean;

  constructor() {
    this.useAI = !!config.openai.apiKey;
    if (!this.useAI) {
      console.log('[MatchingService] OpenAI not configured - using algorithmic matching');
    }
  }

  // ==================== Main Methods ====================

  /**
   * Calculate match score for a single influencer against criteria
   */
  async calculateMatchScore(
    userId: string,
    savedInfluencerId: string,
    criteria: MatchCriteria,
    campaignId?: string
  ): Promise<MatchScoreResult> {
    // Get influencer data
    const influencer = await SavedInfluencer.findOne({
      _id: new Types.ObjectId(savedInfluencerId),
      userId,
    }).lean();

    if (!influencer) {
      throw new Error('Influencer not found');
    }

    // Calculate individual scores
    const audienceScore = this.calculateAudienceScore(influencer, criteria);
    const engagementScore = this.calculateEngagementScore(influencer, criteria);
    const nicheScore = this.calculateNicheScore(influencer, criteria);
    const authenticityScore = this.calculateAuthenticityScore(influencer);
    const budgetFitScore = this.calculateBudgetFitScore(influencer, criteria);

    // Calculate weighted overall score
    const overallScore = this.calculateWeightedScore({
      audience: audienceScore,
      engagement: engagementScore,
      niche: nicheScore,
      authenticity: authenticityScore,
      budgetFit: budgetFitScore,
    });

    // Generate explanation
    const explanation = this.generateExplanation({
      audience: audienceScore,
      engagement: engagementScore,
      niche: nicheScore,
      authenticity: authenticityScore,
      budgetFit: budgetFitScore,
    }, influencer);

    // Store result in database
    await this.storeMatchScore(
      userId,
      savedInfluencerId,
      campaignId,
      overallScore,
      { audience: audienceScore, engagement: engagementScore, niche: nicheScore, authenticity: authenticityScore, budgetFit: budgetFitScore },
      explanation
    );

    return {
      id: `${savedInfluencerId}-${Date.now()}`,
      savedInfluencerId,
      influencerName: influencer.profile.displayName,
      platform: influencer.platform,
      overallScore,
      audienceScore,
      engagementScore,
      nicheScore,
      authenticityScore,
      budgetFitScore,
      scores: {
        audience: audienceScore,
        engagement: engagementScore,
        niche: nicheScore,
        authenticity: authenticityScore,
        budgetFit: budgetFitScore,
      },
      explanation,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate match scores for multiple influencers
   */
  async calculateBulkMatchScores(
    userId: string,
    savedInfluencerIds: string[],
    criteria: MatchCriteria,
    campaignId?: string
  ): Promise<MatchScoreResult[]> {
    const results: MatchScoreResult[] = [];

    for (const id of savedInfluencerIds) {
      try {
        const result = await this.calculateMatchScore(userId, id, criteria, campaignId);
        results.push(result);
      } catch (error) {
        console.error(`[MatchingService] Failed to calculate score for ${id}:`, error);
      }
    }

    // Sort by overall score descending
    return results.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Get recommendations based on criteria
   */
  async getRecommendations(
    userId: string,
    criteria: MatchCriteria,
    limit: number = 10
  ): Promise<MatchScoreResult[]> {
    // Get all saved influencers for user
    const query: Record<string, unknown> = { userId };

    if (criteria.platforms && criteria.platforms.length > 0) {
      query.platform = { $in: criteria.platforms };
    }

    if (criteria.minFollowers || criteria.maxFollowers) {
      query['profile.followers'] = {};
      if (criteria.minFollowers) {
        (query['profile.followers'] as Record<string, number>).$gte = criteria.minFollowers;
      }
      if (criteria.maxFollowers) {
        (query['profile.followers'] as Record<string, number>).$lte = criteria.maxFollowers;
      }
    }

    const influencers = await SavedInfluencer.find(query)
      .limit(100) // Process max 100 at a time
      .lean();

    const ids = influencers.map(i => i._id.toString());
    const results = await this.calculateBulkMatchScores(userId, ids, criteria);

    return results.slice(0, limit);
  }

  /**
   * Find similar influencers
   */
  async findSimilarInfluencers(
    userId: string,
    savedInfluencerId: string,
    limit: number = 5
  ): Promise<MatchScoreResult[]> {
    const sourceInfluencer = await SavedInfluencer.findOne({
      _id: new Types.ObjectId(savedInfluencerId),
      userId,
    }).lean();

    if (!sourceInfluencer) {
      throw new Error('Influencer not found');
    }

    // Build criteria from source influencer
    const criteria: MatchCriteria = {
      niches: sourceInfluencer.profile.niches,
      minEngagementRate: Math.max(0, sourceInfluencer.profile.engagementRate - 2),
      minFollowers: Math.floor(sourceInfluencer.profile.followers * 0.5),
      maxFollowers: Math.floor(sourceInfluencer.profile.followers * 2),
      platforms: [sourceInfluencer.platform],
    };

    // Get other influencers
    const otherInfluencers = await SavedInfluencer.find({
      userId,
      _id: { $ne: new Types.ObjectId(savedInfluencerId) },
      platform: sourceInfluencer.platform,
    }).limit(50).lean();

    const ids = otherInfluencers.map(i => i._id.toString());
    const results = await this.calculateBulkMatchScores(userId, ids, criteria);

    return results.slice(0, limit);
  }

  /**
   * Get stored match scores
   */
  async getMatchScores(
    userId: string,
    options: {
      campaignId?: string;
      minScore?: number;
      limit?: number;
    } = {}
  ): Promise<MatchScoreResult[]> {
    const where: Record<string, unknown> = { userId };
    if (options.campaignId) where.campaignId = options.campaignId;
    if (options.minScore) where.overallScore = { gte: options.minScore };

    const storedScores = await prisma.influencerMatchScore.findMany({
      where,
      orderBy: { overallScore: 'desc' },
      take: options.limit || 50,
    });

    // Enhance with influencer data
    const results: MatchScoreResult[] = [];

    for (const score of storedScores) {
      const influencer = await SavedInfluencer.findById(score.savedInfluencerId).lean();

      if (influencer) {
        results.push({
          id: score.id,
          savedInfluencerId: score.savedInfluencerId,
          influencerName: influencer.profile.displayName,
          platform: influencer.platform,
          overallScore: score.overallScore,
          audienceScore: score.audienceScore,
          engagementScore: score.engagementScore,
          nicheScore: score.nicheScore,
          authenticityScore: score.authenticityScore,
          budgetFitScore: score.budgetFitScore,
          scores: {
            audience: score.audienceScore,
            engagement: score.engagementScore,
            niche: score.nicheScore,
            authenticity: score.authenticityScore,
            budgetFit: score.budgetFitScore,
          },
          explanation: score.explanation as MatchScoreResult['explanation'],
          calculatedAt: score.calculatedAt.toISOString(),
        });
      }
    }

    return results;
  }

  // ==================== Score Calculations ====================

  private calculateAudienceScore(influencer: ISavedInfluencer, criteria: MatchCriteria): number {
    if (!criteria.targetAudience) return 70; // Default neutral score

    let score = 50;
    const audience = influencer.audience;

    if (!audience) return 50;

    // Location match
    if (criteria.targetAudience.locations && audience.topLocations) {
      const targetLocations = criteria.targetAudience.locations.map(l => l.toLowerCase());
      const matchingLocations = audience.topLocations.filter(loc =>
        targetLocations.includes(loc.country.toLowerCase())
      );
      const locationScore = matchingLocations.reduce((sum, loc) => sum + loc.percentage, 0);
      score += Math.min(locationScore, 30);
    }

    // Gender match
    if (criteria.targetAudience.gender && audience.demographics?.gender) {
      const gender = audience.demographics.gender;
      if (criteria.targetAudience.gender === 'male' && gender.male > 50) {
        score += 10;
      } else if (criteria.targetAudience.gender === 'female' && gender.female > 50) {
        score += 10;
      } else if (criteria.targetAudience.gender === 'any') {
        score += 10;
      }
    }

    // Interest match
    if (criteria.targetAudience.interests && audience.topInterests) {
      const targetInterests = criteria.targetAudience.interests.map(i => i.toLowerCase());
      const matchingInterests = audience.topInterests.filter(int =>
        targetInterests.some(t => int.interest.toLowerCase().includes(t))
      );
      score += Math.min(matchingInterests.length * 5, 20);
    }

    return Math.min(100, Math.max(0, score));
  }

  private calculateEngagementScore(influencer: ISavedInfluencer, criteria: MatchCriteria): number {
    const engagementRate = influencer.profile.engagementRate;

    // Base score from engagement rate
    let score = 0;

    if (engagementRate >= 6) score = 95;
    else if (engagementRate >= 4) score = 85;
    else if (engagementRate >= 3) score = 75;
    else if (engagementRate >= 2) score = 65;
    else if (engagementRate >= 1) score = 50;
    else score = 30;

    // Bonus if above minimum requirement
    if (criteria.minEngagementRate && engagementRate >= criteria.minEngagementRate) {
      score += 5;
    }

    return Math.min(100, score);
  }

  private calculateNicheScore(influencer: ISavedInfluencer, criteria: MatchCriteria): number {
    if (!criteria.niches || criteria.niches.length === 0) return 70;

    const influencerNiches = influencer.profile.niches.map(n => n.toLowerCase());
    const targetNiches = criteria.niches.map(n => n.toLowerCase());

    // Count matching niches
    let matches = 0;
    for (const target of targetNiches) {
      if (influencerNiches.some(n => n.includes(target) || target.includes(n))) {
        matches++;
      }
    }

    const matchPercentage = matches / targetNiches.length;

    if (matchPercentage >= 0.8) return 95;
    if (matchPercentage >= 0.6) return 80;
    if (matchPercentage >= 0.4) return 65;
    if (matchPercentage >= 0.2) return 50;
    return 30;
  }

  private calculateAuthenticityScore(influencer: ISavedInfluencer): number {
    // Use cached authenticity score if available
    if (influencer.audience?.authenticityScore) {
      return influencer.audience.authenticityScore;
    }

    // Estimate based on engagement patterns
    const engagementRate = influencer.profile.engagementRate;
    const followers = influencer.profile.followers;

    // Suspicious patterns
    if (followers > 100000 && engagementRate < 1) return 40;
    if (followers > 50000 && engagementRate > 10) return 50; // Too good to be true

    // Normal range
    if (engagementRate >= 2 && engagementRate <= 8) return 80;

    return 65;
  }

  private calculateBudgetFitScore(influencer: ISavedInfluencer, criteria: MatchCriteria): number {
    if (!criteria.budget) return 70;

    const ratePerPost = influencer.customFields?.ratePerPost as number | undefined;

    if (!ratePerPost) {
      // Estimate based on follower count
      const estimatedRate = this.estimateRate(influencer.profile.followers);
      const midBudget = (criteria.budget.min + criteria.budget.max) / 2;

      if (estimatedRate <= criteria.budget.max && estimatedRate >= criteria.budget.min) {
        return 90;
      }
      if (estimatedRate <= criteria.budget.max * 1.2) {
        return 70;
      }
      return 40;
    }

    // Check against budget range
    if (ratePerPost >= criteria.budget.min && ratePerPost <= criteria.budget.max) {
      return 95;
    }
    if (ratePerPost < criteria.budget.min) {
      return 80; // Under budget is good
    }
    if (ratePerPost <= criteria.budget.max * 1.2) {
      return 60; // Slightly over
    }
    return 30; // Way over budget
  }

  // ==================== Helper Methods ====================

  private calculateWeightedScore(scores: Record<string, number>): number {
    const weights = {
      audience: 0.25,
      engagement: 0.25,
      niche: 0.20,
      authenticity: 0.15,
      budgetFit: 0.15,
    };

    let weightedSum = 0;
    for (const [key, weight] of Object.entries(weights)) {
      weightedSum += (scores[key] || 0) * weight;
    }

    return Math.round(weightedSum * 10) / 10;
  }

  private generateExplanation(
    scores: Record<string, number>,
    influencer: ISavedInfluencer
  ): MatchScoreResult['explanation'] {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (scores.audience >= 80) {
      strengths.push('Strong audience alignment with target demographics');
    } else if (scores.audience < 50) {
      weaknesses.push('Audience demographics may not align well');
    }

    if (scores.engagement >= 80) {
      strengths.push(`Excellent engagement rate of ${influencer.profile.engagementRate.toFixed(1)}%`);
    } else if (scores.engagement < 50) {
      weaknesses.push('Below average engagement rate');
    }

    if (scores.niche >= 80) {
      strengths.push('Content niche matches campaign requirements');
    } else if (scores.niche < 50) {
      weaknesses.push('Content niche may not be relevant');
    }

    if (scores.authenticity >= 80) {
      strengths.push('High authenticity indicators');
    } else if (scores.authenticity < 50) {
      weaknesses.push('Potential authenticity concerns');
    }

    if (scores.budgetFit >= 80) {
      strengths.push('Fits within budget range');
    } else if (scores.budgetFit < 50) {
      weaknesses.push('May exceed budget');
    }

    // Generate recommendation
    const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / 5;
    let recommendation: string;

    if (avgScore >= 80) {
      recommendation = 'Highly recommended for this campaign';
    } else if (avgScore >= 65) {
      recommendation = 'Good fit with some considerations';
    } else if (avgScore >= 50) {
      recommendation = 'May work but review carefully';
    } else {
      recommendation = 'Not recommended for this campaign';
    }

    return { strengths, weaknesses, recommendation };
  }

  private estimateRate(followers: number): number {
    // Simple CPM-based estimation
    const cpm = 10; // $10 per 1000 followers as baseline
    return Math.round((followers / 1000) * cpm);
  }

  private async storeMatchScore(
    userId: string,
    savedInfluencerId: string,
    campaignId: string | undefined,
    overallScore: number,
    scores: Record<string, number>,
    explanation: MatchScoreResult['explanation']
  ): Promise<void> {
    try {
      await prisma.influencerMatchScore.upsert({
        where: {
          userId_savedInfluencerId_campaignId: {
            userId,
            savedInfluencerId,
            campaignId: campaignId || '',
          },
        },
        update: {
          overallScore,
          audienceScore: scores.audience,
          engagementScore: scores.engagement,
          nicheScore: scores.niche,
          authenticityScore: scores.authenticity,
          budgetFitScore: scores.budgetFit,
          explanation: explanation as object,
          calculatedAt: new Date(),
        },
        create: {
          userId,
          savedInfluencerId,
          campaignId: campaignId || null,
          overallScore,
          audienceScore: scores.audience,
          engagementScore: scores.engagement,
          nicheScore: scores.niche,
          authenticityScore: scores.authenticity,
          budgetFitScore: scores.budgetFit,
          explanation: explanation as object,
        },
      });
    } catch (error) {
      console.error('[MatchingService] Failed to store match score:', error);
    }
  }
}

// Export singleton instance
export const matchingService = new MatchingService();
