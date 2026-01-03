/**
 * CampaignPrediction Model (MongoDB)
 *
 * Stores AI-generated campaign performance predictions.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Interface for range values
export interface IRange {
  min: number;
  expected: number;
  max: number;
}

// Interface for influencer breakdown
export interface IInfluencerBreakdown {
  savedInfluencerId: string;
  influencerName: string;
  platform: string;
  reach: number;
  impressions: number;
  engagements: number;
  clicks: number;
  cpe: number;
  cpm: number;
}

// Main interface
export interface ICampaignPrediction extends Document {
  _id: Types.ObjectId;
  userId: string;
  campaignId: string;

  predictions: {
    totalReach: IRange;
    totalImpressions: IRange;
    totalEngagements: IRange;
    estimatedClicks: IRange;
    estimatedConversions: IRange;
    estimatedROI: IRange;
  };

  breakdown: IInfluencerBreakdown[];
  confidence: number;
  methodology: string;

  // Input parameters used
  inputBudget?: number;
  inputConversionRate?: number;
  inputProductPrice?: number;

  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RangeSchema = new Schema<IRange>(
  {
    min: { type: Number, required: true },
    expected: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  { _id: false }
);

const InfluencerBreakdownSchema = new Schema<IInfluencerBreakdown>(
  {
    savedInfluencerId: { type: String, required: true },
    influencerName: { type: String, required: true },
    platform: { type: String, required: true },
    reach: { type: Number, required: true },
    impressions: { type: Number, required: true },
    engagements: { type: Number, required: true },
    clicks: { type: Number, required: true },
    cpe: { type: Number, required: true },
    cpm: { type: Number, required: true },
  },
  { _id: false }
);

const CampaignPredictionSchema = new Schema<ICampaignPrediction>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    campaignId: {
      type: String,
      required: true,
      index: true,
    },
    predictions: {
      totalReach: { type: RangeSchema, required: true },
      totalImpressions: { type: RangeSchema, required: true },
      totalEngagements: { type: RangeSchema, required: true },
      estimatedClicks: { type: RangeSchema, required: true },
      estimatedConversions: { type: RangeSchema, required: true },
      estimatedROI: { type: RangeSchema, required: true },
    },
    breakdown: [InfluencerBreakdownSchema],
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    methodology: {
      type: String,
      required: true,
    },
    inputBudget: { type: Number },
    inputConversionRate: { type: Number },
    inputProductPrice: { type: Number },
    calculatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
CampaignPredictionSchema.index({ userId: 1, campaignId: 1 });
CampaignPredictionSchema.index({ campaignId: 1, calculatedAt: -1 });

export const CampaignPrediction = mongoose.model<ICampaignPrediction>(
  'CampaignPrediction',
  CampaignPredictionSchema
);
