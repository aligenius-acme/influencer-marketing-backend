/**
 * FakeFollowerAnalysis Model (MongoDB)
 *
 * Stores AI analysis results for fake follower detection.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Interface for suspicious patterns detected
export interface ISuspiciousPattern {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence?: string;
}

// Interface for follower quality metrics
export interface IFollowerQuality {
  realFollowers: number;
  suspiciousFollowers: number;
  massFollowers: number; // Accounts following many but low engagement
  inactiveFollowers: number;
}

// Interface for engagement analysis
export interface IEngagementAnalysis {
  avgEngagementRate: number;
  engagementTrend: 'increasing' | 'stable' | 'decreasing';
  commentQuality: number; // 0-100
  likeToCommentRatio: number;
  suspiciousSpikes: boolean;
}

// Main interface
export interface IFakeFollowerAnalysis extends Document {
  _id: Types.ObjectId;
  userId: string;
  savedInfluencerId: Types.ObjectId;
  platform: string;

  // Overall scores
  authenticityScore: number; // 0-100
  fakeFollowerPercentage: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // Detailed analysis
  followerQuality: IFollowerQuality;
  engagementAnalysis: IEngagementAnalysis;
  suspiciousPatterns: ISuspiciousPattern[];

  // Growth analysis
  growthAnalysis: {
    followerGrowthRate: number; // Monthly %
    unusualGrowthSpikes: boolean;
    growthPattern: 'organic' | 'suspicious' | 'paid';
  };

  // Recommendations
  recommendations: string[];
  verificationStatus: 'pending' | 'verified' | 'flagged';

  // Metadata
  dataPoints: number; // Number of data points analyzed
  confidence: number; // 0-100
  methodology: string;

  analyzedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SuspiciousPatternSchema = new Schema<ISuspiciousPattern>(
  {
    type: { type: String, required: true },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    description: { type: String, required: true },
    evidence: { type: String },
  },
  { _id: false }
);

const FollowerQualitySchema = new Schema<IFollowerQuality>(
  {
    realFollowers: { type: Number, required: true },
    suspiciousFollowers: { type: Number, required: true },
    massFollowers: { type: Number, required: true },
    inactiveFollowers: { type: Number, required: true },
  },
  { _id: false }
);

const EngagementAnalysisSchema = new Schema<IEngagementAnalysis>(
  {
    avgEngagementRate: { type: Number, required: true },
    engagementTrend: {
      type: String,
      enum: ['increasing', 'stable', 'decreasing'],
      required: true,
    },
    commentQuality: { type: Number, required: true },
    likeToCommentRatio: { type: Number, required: true },
    suspiciousSpikes: { type: Boolean, required: true },
  },
  { _id: false }
);

const FakeFollowerAnalysisSchema = new Schema<IFakeFollowerAnalysis>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    savedInfluencerId: {
      type: Schema.Types.ObjectId,
      ref: 'SavedInfluencer',
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
    },
    authenticityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    fakeFollowerPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    followerQuality: {
      type: FollowerQualitySchema,
      required: true,
    },
    engagementAnalysis: {
      type: EngagementAnalysisSchema,
      required: true,
    },
    suspiciousPatterns: [SuspiciousPatternSchema],
    growthAnalysis: {
      followerGrowthRate: { type: Number, required: true },
      unusualGrowthSpikes: { type: Boolean, required: true },
      growthPattern: {
        type: String,
        enum: ['organic', 'suspicious', 'paid'],
        required: true,
      },
    },
    recommendations: [{ type: String }],
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'flagged'],
      default: 'pending',
    },
    dataPoints: { type: Number, required: true },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    methodology: { type: String, required: true },
    analyzedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
FakeFollowerAnalysisSchema.index({ userId: 1, savedInfluencerId: 1 });
FakeFollowerAnalysisSchema.index({ savedInfluencerId: 1, analyzedAt: -1 });
FakeFollowerAnalysisSchema.index({ userId: 1, riskLevel: 1 });

export const FakeFollowerAnalysis = mongoose.model<IFakeFollowerAnalysis>(
  'FakeFollowerAnalysis',
  FakeFollowerAnalysisSchema
);
