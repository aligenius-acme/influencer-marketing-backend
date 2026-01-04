/**
 * Scheduled Post Model (MongoDB)
 *
 * Tracks scheduled content for publishing across platforms
 */

import mongoose, { Schema, Document } from 'mongoose';

export type PostPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'facebook' | 'linkedin';
export type PostType = 'image' | 'video' | 'carousel' | 'story' | 'reel' | 'short';
export type PostStatus = 'draft' | 'scheduled' | 'pending_approval' | 'approved' | 'published' | 'failed';

export interface IScheduledPost extends Document {
  userId: string;
  campaignId?: string;
  influencerId?: string;

  // Content
  title: string;
  caption: string;
  mediaUrls: string[];
  hashtags: string[];
  mentions: string[];

  // Platform & Type
  platform: PostPlatform;
  postType: PostType;

  // Scheduling
  scheduledAt: Date;
  timezone: string;
  publishedAt?: Date;

  // Status & Approval
  status: PostStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;

  // Compliance
  hasDisclosure: boolean;
  disclosureType?: 'ad' | 'sponsored' | 'paid_partnership' | 'gifted';
  brandGuidelinesChecked: boolean;
  complianceNotes?: string;

  // Preview
  previewUrl?: string;
  thumbnailUrl?: string;

  // Metrics (after publishing)
  metrics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
    reach?: number;
    engagement?: number;
  };

  // Metadata
  notes?: string;
  tags?: string[];

  createdAt: Date;
  updatedAt: Date;
}

const ScheduledPostSchema = new Schema<IScheduledPost>(
  {
    userId: { type: String, required: true, index: true },
    campaignId: { type: String, index: true },
    influencerId: { type: String, index: true },

    title: { type: String, required: true },
    caption: { type: String, default: '' },
    mediaUrls: [{ type: String }],
    hashtags: [{ type: String }],
    mentions: [{ type: String }],

    platform: {
      type: String,
      enum: ['instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin'],
      required: true,
    },
    postType: {
      type: String,
      enum: ['image', 'video', 'carousel', 'story', 'reel', 'short'],
      required: true,
    },

    scheduledAt: { type: Date, required: true, index: true },
    timezone: { type: String, default: 'UTC' },
    publishedAt: { type: Date },

    status: {
      type: String,
      enum: ['draft', 'scheduled', 'pending_approval', 'approved', 'published', 'failed'],
      default: 'draft',
    },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    rejectionReason: { type: String },

    hasDisclosure: { type: Boolean, default: false },
    disclosureType: {
      type: String,
      enum: ['ad', 'sponsored', 'paid_partnership', 'gifted'],
    },
    brandGuidelinesChecked: { type: Boolean, default: false },
    complianceNotes: { type: String },

    previewUrl: { type: String },
    thumbnailUrl: { type: String },

    metrics: {
      likes: { type: Number },
      comments: { type: Number },
      shares: { type: Number },
      views: { type: Number },
      reach: { type: Number },
      engagement: { type: Number },
    },

    notes: { type: String },
    tags: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

// Compound indexes
ScheduledPostSchema.index({ userId: 1, scheduledAt: 1 });
ScheduledPostSchema.index({ userId: 1, status: 1 });
ScheduledPostSchema.index({ campaignId: 1, scheduledAt: 1 });

export const ScheduledPost = mongoose.model<IScheduledPost>('ScheduledPost', ScheduledPostSchema);
