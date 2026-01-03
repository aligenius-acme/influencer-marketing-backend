/**
 * TrendReport Model (MongoDB)
 *
 * Generated trend reports from social listening data.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Interface for trend data
export interface ITrendData {
  term: string;
  type: 'keyword' | 'hashtag' | 'mention';
  count: number;
  changePercent: number; // vs previous period
  sentiment: 'positive' | 'neutral' | 'negative';
  peakTime?: Date;
}

// Interface for sentiment breakdown
export interface ISentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
  averageScore: number;
}

// Interface for platform breakdown
export interface IPlatformBreakdown {
  platform: string;
  mentionCount: number;
  engagementTotal: number;
  sentiment: ISentimentBreakdown;
}

// Main interface
export interface ITrendReport extends Document {
  _id: Types.ObjectId;
  userId: string;

  // Report period
  periodType: 'daily' | 'weekly' | 'monthly';
  periodStart: Date;
  periodEnd: Date;

  // Summary
  totalMentions: number;
  totalReach: number;
  totalEngagement: number;
  mentionChange: number; // % change vs previous period

  // Sentiment
  overallSentiment: ISentimentBreakdown;

  // Platform breakdown
  platformBreakdown: IPlatformBreakdown[];

  // Trends
  topTrends: ITrendData[];
  emergingTrends: ITrendData[];
  decliningTrends: ITrendData[];

  // Top mentions
  topMentions: {
    mentionId: Types.ObjectId;
    content: string;
    authorUsername: string;
    engagement: number;
    sentiment: string;
  }[];

  // Influencer activity
  topInfluencers: {
    username: string;
    platform: string;
    mentionCount: number;
    totalReach: number;
    sentiment: string;
  }[];

  // Competitive insights (if tracking competitors)
  competitorMentions?: {
    competitor: string;
    mentionCount: number;
    sentiment: ISentimentBreakdown;
  }[];

  // Recommendations
  insights: string[];
  recommendations: string[];

  // Metadata
  rulesIncluded: Types.ObjectId[];
  generatedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const SentimentBreakdownSchema = new Schema<ISentimentBreakdown>(
  {
    positive: { type: Number, required: true },
    neutral: { type: Number, required: true },
    negative: { type: Number, required: true },
    averageScore: { type: Number, required: true },
  },
  { _id: false }
);

const TrendDataSchema = new Schema<ITrendData>(
  {
    term: { type: String, required: true },
    type: {
      type: String,
      enum: ['keyword', 'hashtag', 'mention'],
      required: true,
    },
    count: { type: Number, required: true },
    changePercent: { type: Number, required: true },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      required: true,
    },
    peakTime: { type: Date },
  },
  { _id: false }
);

const PlatformBreakdownSchema = new Schema<IPlatformBreakdown>(
  {
    platform: { type: String, required: true },
    mentionCount: { type: Number, required: true },
    engagementTotal: { type: Number, required: true },
    sentiment: { type: SentimentBreakdownSchema, required: true },
  },
  { _id: false }
);

const TrendReportSchema = new Schema<ITrendReport>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    periodType: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    totalMentions: {
      type: Number,
      required: true,
    },
    totalReach: {
      type: Number,
      required: true,
    },
    totalEngagement: {
      type: Number,
      required: true,
    },
    mentionChange: {
      type: Number,
      default: 0,
    },
    overallSentiment: {
      type: SentimentBreakdownSchema,
      required: true,
    },
    platformBreakdown: [PlatformBreakdownSchema],
    topTrends: [TrendDataSchema],
    emergingTrends: [TrendDataSchema],
    decliningTrends: [TrendDataSchema],
    topMentions: [{
      mentionId: { type: Schema.Types.ObjectId, ref: 'BrandMention' },
      content: { type: String },
      authorUsername: { type: String },
      engagement: { type: Number },
      sentiment: { type: String },
    }],
    topInfluencers: [{
      username: { type: String },
      platform: { type: String },
      mentionCount: { type: Number },
      totalReach: { type: Number },
      sentiment: { type: String },
    }],
    competitorMentions: [{
      competitor: { type: String },
      mentionCount: { type: Number },
      sentiment: { type: SentimentBreakdownSchema },
    }],
    insights: [{ type: String }],
    recommendations: [{ type: String }],
    rulesIncluded: [{ type: Schema.Types.ObjectId, ref: 'MonitoringRule' }],
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
TrendReportSchema.index({ userId: 1, periodStart: -1 });
TrendReportSchema.index({ userId: 1, periodType: 1, periodStart: -1 });

export const TrendReport = mongoose.model<ITrendReport>(
  'TrendReport',
  TrendReportSchema
);
