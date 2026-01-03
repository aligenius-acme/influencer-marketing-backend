/**
 * AI Prediction Service
 *
 * Predicts campaign performance metrics:
 * - Reach estimates
 * - Engagement predictions
 * - ROI calculations
 * - Conversion forecasts
 */

import { config } from '../../config/index.js';
import { prisma } from '../../config/postgres.js';
import { SavedInfluencer } from '../../models/SavedInfluencer.js';
import { CampaignPrediction, ICampaignPrediction } from '../../models/CampaignPrediction.js';
import { Types } from 'mongoose';

// ==================== Types ====================

export interface PredictionResult {
  campaignId: string;
  predictions: {
    totalReach: { min: number; expected: number; max: number };
    totalImpressions: { min: number; expected: number; max: number };
    totalEngagements: { min: number; expected: number; max: number };
    estimatedClicks: { min: number; expected: number; max: number };
    estimatedConversions: { min: number; expected: number; max: number };
    estimatedROI: { min: number; expected: number; max: number };
  };
  breakdown: InfluencerPrediction[];
  confidence: number;
  methodology: string;
  calculatedAt: Date;
}

export interface InfluencerPrediction {
  savedInfluencerId: string;
  influencerName: string;
  platform: string;
  reach: number;
  impressions: number;
  engagements: number;
  clicks: number;
  cpe: number; // Cost per engagement
  cpm: number; // Cost per thousand impressions
}

export interface PredictionInput {
  campaignId: string;
  budget: number;
  conversionRate?: number; // Expected conversion rate (%)
  productPrice?: number; // For ROI calculation
}

// ==================== Service ====================

class PredictionService {
  private useAI: boolean;

  constructor() {
    this.useAI = !!config.openai.apiKey;
    if (!this.useAI) {
      console.log('[PredictionService] OpenAI not configured - using algorithmic predictions');
    }
  }

  // ==================== Main Methods ====================

  /**
   * Generate campaign predictions
   */
  async predictCampaignPerformance(
    userId: string,
    input: PredictionInput
  ): Promise<PredictionResult> {
    // Get campaign data
    const campaign = await prisma.campaign.findFirst({
      where: { id: input.campaignId, userId },
      include: {
        influencers: {
          include: {
            // Note: campaignInfluencer includes savedInfluencerId reference
          },
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get influencer data from MongoDB
    const influencerPredictions: InfluencerPrediction[] = [];
    const savedInfluencerIds = campaign.influencers
      .map(ci => ci.savedInfluencerId)
      .filter(Boolean);

    for (const savedInfluencerId of savedInfluencerIds) {
      if (!savedInfluencerId) continue;

      const influencer = await SavedInfluencer.findById(savedInfluencerId).lean();
      if (!influencer) continue;

      const prediction = this.predictInfluencerPerformance(
        influencer,
        input.budget / savedInfluencerIds.length // Simple budget split
      );

      influencerPredictions.push({
        savedInfluencerId: savedInfluencerId,
        influencerName: influencer.profile.displayName,
        platform: influencer.platform,
        ...prediction,
      });
    }

    // Aggregate predictions
    const totals = this.aggregatePredictions(influencerPredictions);

    // Calculate ROI
    const roi = this.calculateROI(
      totals,
      input.budget,
      input.conversionRate || 2,
      input.productPrice || 50
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(influencerPredictions);

    const result: PredictionResult = {
      campaignId: input.campaignId,
      predictions: {
        totalReach: this.createRange(totals.reach, 0.2),
        totalImpressions: this.createRange(totals.impressions, 0.25),
        totalEngagements: this.createRange(totals.engagements, 0.3),
        estimatedClicks: this.createRange(totals.clicks, 0.35),
        estimatedConversions: this.createRange(
          Math.round(totals.clicks * (input.conversionRate || 2) / 100),
          0.4
        ),
        estimatedROI: {
          min: Math.round(roi * 0.6),
          expected: Math.round(roi),
          max: Math.round(roi * 1.5),
        },
      },
      breakdown: influencerPredictions,
      confidence,
      methodology: 'Historical performance analysis with engagement-based forecasting',
      calculatedAt: new Date(),
    };

    // Store prediction
    await this.storePrediction(userId, result);

    return result;
  }

  /**
   * Get stored predictions for a campaign
   */
  async getPredictions(
    userId: string,
    campaignId: string
  ): Promise<ICampaignPrediction | null> {
    return CampaignPrediction.findOne({
      userId,
      campaignId,
    }).sort({ calculatedAt: -1 });
  }

  /**
   * Quick estimate without full campaign data
   */
  async quickEstimate(
    followers: number,
    engagementRate: number,
    budget: number,
    platform: string = 'instagram'
  ): Promise<{
    reach: { min: number; expected: number; max: number };
    engagements: { min: number; expected: number; max: number };
    cpe: number;
    cpm: number;
  }> {
    // Platform-specific multipliers
    const platformMultipliers: Record<string, number> = {
      instagram: 1.0,
      tiktok: 1.2, // Higher viral potential
      youtube: 0.8, // More targeted
      twitter: 0.7,
    };

    const multiplier = platformMultipliers[platform.toLowerCase()] || 1.0;

    // Base calculations
    const reachRate = 0.3; // 30% of followers typically reached
    const expectedReach = Math.round(followers * reachRate * multiplier);
    const impressions = Math.round(expectedReach * 1.5);
    const engagements = Math.round(impressions * (engagementRate / 100));

    // Cost metrics
    const cpm = budget / (impressions / 1000);
    const cpe = budget / engagements;

    return {
      reach: this.createRange(expectedReach, 0.2),
      engagements: this.createRange(engagements, 0.3),
      cpe: Math.round(cpe * 100) / 100,
      cpm: Math.round(cpm * 100) / 100,
    };
  }

  // ==================== Helper Methods ====================

  private predictInfluencerPerformance(
    influencer: any,
    allocatedBudget: number
  ): Omit<InfluencerPrediction, 'savedInfluencerId' | 'influencerName' | 'platform'> {
    const profile = influencer.profile;
    const followers = profile.followers;
    const engagementRate = profile.engagementRate;

    // Platform-specific factors
    const platformFactors: Record<string, { reachRate: number; clickRate: number }> = {
      instagram: { reachRate: 0.25, clickRate: 0.015 },
      tiktok: { reachRate: 0.40, clickRate: 0.02 },
      youtube: { reachRate: 0.20, clickRate: 0.025 },
      twitter: { reachRate: 0.15, clickRate: 0.01 },
    };

    const factors = platformFactors[influencer.platform] || platformFactors.instagram;

    // Calculate metrics
    const reach = Math.round(followers * factors.reachRate);
    const impressions = Math.round(reach * 1.8);
    const engagements = Math.round(impressions * (engagementRate / 100));
    const clicks = Math.round(impressions * factors.clickRate);

    // Cost metrics
    const cpe = engagements > 0 ? allocatedBudget / engagements : 0;
    const cpm = impressions > 0 ? allocatedBudget / (impressions / 1000) : 0;

    return {
      reach,
      impressions,
      engagements,
      clicks,
      cpe: Math.round(cpe * 100) / 100,
      cpm: Math.round(cpm * 100) / 100,
    };
  }

  private aggregatePredictions(predictions: InfluencerPrediction[]): {
    reach: number;
    impressions: number;
    engagements: number;
    clicks: number;
  } {
    return predictions.reduce(
      (acc, p) => ({
        reach: acc.reach + p.reach,
        impressions: acc.impressions + p.impressions,
        engagements: acc.engagements + p.engagements,
        clicks: acc.clicks + p.clicks,
      }),
      { reach: 0, impressions: 0, engagements: 0, clicks: 0 }
    );
  }

  private calculateROI(
    totals: { clicks: number },
    budget: number,
    conversionRate: number,
    productPrice: number
  ): number {
    const conversions = totals.clicks * (conversionRate / 100);
    const revenue = conversions * productPrice;
    const roi = ((revenue - budget) / budget) * 100;
    return roi;
  }

  private calculateConfidence(predictions: InfluencerPrediction[]): number {
    if (predictions.length === 0) return 0;

    // Base confidence
    let confidence = 60;

    // More influencers = more reliable
    if (predictions.length >= 5) confidence += 15;
    else if (predictions.length >= 3) confidence += 10;
    else if (predictions.length >= 2) confidence += 5;

    // Consistent CPE across influencers = more reliable
    const cpes = predictions.map(p => p.cpe).filter(c => c > 0);
    if (cpes.length > 1) {
      const avgCpe = cpes.reduce((a, b) => a + b, 0) / cpes.length;
      const variance = cpes.reduce((sum, cpe) => sum + Math.pow(cpe - avgCpe, 2), 0) / cpes.length;
      const cv = Math.sqrt(variance) / avgCpe; // Coefficient of variation

      if (cv < 0.3) confidence += 15;
      else if (cv < 0.5) confidence += 10;
    }

    return Math.min(95, confidence);
  }

  private createRange(
    expected: number,
    variance: number
  ): { min: number; expected: number; max: number } {
    return {
      min: Math.round(expected * (1 - variance)),
      expected: Math.round(expected),
      max: Math.round(expected * (1 + variance)),
    };
  }

  private async storePrediction(
    userId: string,
    result: PredictionResult
  ): Promise<void> {
    try {
      await CampaignPrediction.findOneAndUpdate(
        { userId, campaignId: result.campaignId },
        {
          userId,
          campaignId: result.campaignId,
          predictions: result.predictions,
          breakdown: result.breakdown,
          confidence: result.confidence,
          methodology: result.methodology,
          calculatedAt: result.calculatedAt,
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error('[PredictionService] Failed to store prediction:', error);
    }
  }
}

// Export singleton instance
export const predictionService = new PredictionService();
