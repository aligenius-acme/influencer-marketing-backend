/**
 * BrandMention Model (MongoDB)
 *
 * Stores brand mentions found through social listening.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Interface for mention metadata
export interface IMentionMetadata {
  postId?: string;
  authorId?: string;
  authorUsername?: string;
  authorFollowers?: number;
  isInfluencer?: boolean;
  hashtags?: string[];
  mentions?: string[];
}

// Main interface
export interface IBrandMention extends Document {
  _id: Types.ObjectId;
  userId: string;
  ruleId: Types.ObjectId; // Reference to MonitoringRule

  // Source info
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  sourceUrl: string;
  sourceType: 'post' | 'comment' | 'story' | 'video' | 'tweet';

  // Content
  content: string;
  contentPreview: string;
  mediaUrls: string[];

  // Author
  authorUsername: string;
  authorProfileUrl?: string;
  authorFollowers?: number;
  isVerified: boolean;

  // Detection
  matchedKeywords: string[];
  matchedHashtags: string[];

  // Analysis
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -1 to 1
  relevanceScore: number; // 0-100

  // Engagement
  likes: number;
  comments: number;
  shares: number;
  views?: number;

  // Status
  isReviewed: boolean;
  isActionRequired: boolean;
  notes?: string;

  // Timestamps
  mentionedAt: Date;
  detectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BrandMentionSchema = new Schema<IBrandMention>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    ruleId: {
      type: Schema.Types.ObjectId,
      ref: 'MonitoringRule',
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['instagram', 'tiktok', 'youtube', 'twitter'],
      required: true,
    },
    sourceUrl: {
      type: String,
      required: true,
    },
    sourceType: {
      type: String,
      enum: ['post', 'comment', 'story', 'video', 'tweet'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    contentPreview: {
      type: String,
      required: true,
      maxlength: 280,
    },
    mediaUrls: [{ type: String }],
    authorUsername: {
      type: String,
      required: true,
    },
    authorProfileUrl: { type: String },
    authorFollowers: { type: Number },
    isVerified: {
      type: Boolean,
      default: false,
    },
    matchedKeywords: [{ type: String }],
    matchedHashtags: [{ type: String }],
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral',
    },
    sentimentScore: {
      type: Number,
      default: 0,
      min: -1,
      max: 1,
    },
    relevanceScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    views: { type: Number },
    isReviewed: {
      type: Boolean,
      default: false,
    },
    isActionRequired: {
      type: Boolean,
      default: false,
    },
    notes: { type: String },
    mentionedAt: {
      type: Date,
      required: true,
    },
    detectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
BrandMentionSchema.index({ userId: 1, mentionedAt: -1 });
BrandMentionSchema.index({ userId: 1, sentiment: 1 });
BrandMentionSchema.index({ userId: 1, platform: 1 });
BrandMentionSchema.index({ ruleId: 1, mentionedAt: -1 });
BrandMentionSchema.index({ userId: 1, isReviewed: 1, isActionRequired: 1 });

export const BrandMention = mongoose.model<IBrandMention>(
  'BrandMention',
  BrandMentionSchema
);
