/**
 * PostPerformance Model (MongoDB)
 *
 * Tracks individual post metrics from social media platforms.
 * Used for campaign performance tracking and analytics.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Interface for metric history (track changes over time)
export interface IMetricSnapshot {
  timestamp: Date;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views?: number;
  impressions?: number;
  reach?: number;
  engagementRate: number;
}

// Interface for post content
export interface IPostContent {
  caption?: string;
  mediaType: 'image' | 'video' | 'carousel' | 'reel' | 'story' | 'short';
  mediaUrls: string[];
  thumbnailUrl?: string;
  hashtags: string[];
  mentions: string[];
  duration?: number; // For video content, in seconds
}

// Main PostPerformance interface
export interface IPostPerformance extends Document {
  _id: Types.ObjectId;
  userId: string; // PostgreSQL user UUID

  // Campaign/Influencer references
  campaignId?: string; // PostgreSQL campaign UUID
  campaignInfluencerId?: string; // PostgreSQL campaign_influencer UUID
  savedInfluencerId?: Types.ObjectId; // MongoDB SavedInfluencer reference

  // Platform data
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  platformPostId: string; // External post ID from platform
  postUrl: string;

  // Content
  content: IPostContent;

  // Current metrics
  currentMetrics: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    views?: number;
    impressions?: number;
    reach?: number;
    engagementRate: number;
    clickThroughRate?: number;
    linkClicks?: number;
  };

  // Historical metrics (snapshots over time)
  metricsHistory: IMetricSnapshot[];

  // Tracking info
  isSponsored: boolean;
  disclosurePresent: boolean; // #ad, #sponsored, etc.
  brandMentions: string[];
  productTags?: string[];

  // Analysis
  sentimentScore?: number; // -1 to 1
  topCommentSentiment?: 'positive' | 'neutral' | 'negative';
  audienceQuality?: number; // 0-100

  // Timestamps
  postedAt: Date;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MetricSnapshotSchema = new Schema<IMetricSnapshot>(
  {
    timestamp: { type: Date, required: true },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    views: { type: Number },
    impressions: { type: Number },
    reach: { type: Number },
    engagementRate: { type: Number, default: 0 },
  },
  { _id: false }
);

const PostContentSchema = new Schema<IPostContent>(
  {
    caption: { type: String },
    mediaType: {
      type: String,
      enum: ['image', 'video', 'carousel', 'reel', 'story', 'short'],
      required: true,
    },
    mediaUrls: [{ type: String }],
    thumbnailUrl: { type: String },
    hashtags: [{ type: String }],
    mentions: [{ type: String }],
    duration: { type: Number },
  },
  { _id: false }
);

const PostPerformanceSchema = new Schema<IPostPerformance>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    campaignId: {
      type: String,
      index: true,
    },
    campaignInfluencerId: {
      type: String,
      index: true,
    },
    savedInfluencerId: {
      type: Schema.Types.ObjectId,
      ref: 'SavedInfluencer',
      index: true,
    },
    platform: {
      type: String,
      enum: ['instagram', 'tiktok', 'youtube', 'twitter'],
      required: true,
    },
    platformPostId: {
      type: String,
      required: true,
    },
    postUrl: {
      type: String,
      required: true,
    },
    content: {
      type: PostContentSchema,
      required: true,
    },
    currentMetrics: {
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      saves: { type: Number, default: 0 },
      views: { type: Number },
      impressions: { type: Number },
      reach: { type: Number },
      engagementRate: { type: Number, default: 0 },
      clickThroughRate: { type: Number },
      linkClicks: { type: Number },
    },
    metricsHistory: [MetricSnapshotSchema],
    isSponsored: {
      type: Boolean,
      default: false,
    },
    disclosurePresent: {
      type: Boolean,
      default: false,
    },
    brandMentions: [{ type: String }],
    productTags: [{ type: String }],
    sentimentScore: { type: Number },
    topCommentSentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
    },
    audienceQuality: { type: Number },
    postedAt: {
      type: Date,
      required: true,
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
PostPerformanceSchema.index({ userId: 1, campaignId: 1 });
PostPerformanceSchema.index({ userId: 1, platform: 1, platformPostId: 1 }, { unique: true });
PostPerformanceSchema.index({ campaignId: 1, postedAt: -1 });
PostPerformanceSchema.index({ savedInfluencerId: 1, postedAt: -1 });

export const PostPerformance = mongoose.model<IPostPerformance>(
  'PostPerformance',
  PostPerformanceSchema
);
