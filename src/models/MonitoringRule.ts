/**
 * MonitoringRule Model (MongoDB)
 *
 * User-defined rules for social listening.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Interface for notification settings
export interface INotificationSettings {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  slackEnabled: boolean;
  slackWebhookUrl?: string;
  minimumRelevanceScore: number;
  sentimentFilter: ('positive' | 'neutral' | 'negative')[];
}

// Main interface
export interface IMonitoringRule extends Document {
  _id: Types.ObjectId;
  userId: string;

  // Rule details
  name: string;
  description?: string;

  // Keywords and patterns
  keywords: string[];
  hashtags: string[];
  mentions: string[]; // @usernames to track
  excludeKeywords: string[];

  // Platforms to monitor
  platforms: ('instagram' | 'tiktok' | 'youtube' | 'twitter')[];

  // Filters
  minFollowers?: number;
  maxFollowers?: number;
  languages?: string[];
  locations?: string[];
  verifiedOnly: boolean;

  // Notification settings
  notifications: INotificationSettings;

  // Status
  isActive: boolean;
  isPaused: boolean;

  // Stats
  totalMentions: number;
  lastMentionAt?: Date;
  lastScanAt?: Date;

  // Scheduling
  scanFrequency: 'realtime' | 'hourly' | 'daily';

  createdAt: Date;
  updatedAt: Date;
}

const NotificationSettingsSchema = new Schema<INotificationSettings>(
  {
    emailEnabled: { type: Boolean, default: true },
    inAppEnabled: { type: Boolean, default: true },
    slackEnabled: { type: Boolean, default: false },
    slackWebhookUrl: { type: String },
    minimumRelevanceScore: { type: Number, default: 50 },
    sentimentFilter: [{
      type: String,
      enum: ['positive', 'neutral', 'negative'],
    }],
  },
  { _id: false }
);

const MonitoringRuleSchema = new Schema<IMonitoringRule>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: { type: String },
    keywords: [{ type: String }],
    hashtags: [{ type: String }],
    mentions: [{ type: String }],
    excludeKeywords: [{ type: String }],
    platforms: [{
      type: String,
      enum: ['instagram', 'tiktok', 'youtube', 'twitter'],
    }],
    minFollowers: { type: Number },
    maxFollowers: { type: Number },
    languages: [{ type: String }],
    locations: [{ type: String }],
    verifiedOnly: {
      type: Boolean,
      default: false,
    },
    notifications: {
      type: NotificationSettingsSchema,
      default: () => ({
        emailEnabled: true,
        inAppEnabled: true,
        slackEnabled: false,
        minimumRelevanceScore: 50,
        sentimentFilter: ['positive', 'neutral', 'negative'],
      }),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPaused: {
      type: Boolean,
      default: false,
    },
    totalMentions: {
      type: Number,
      default: 0,
    },
    lastMentionAt: { type: Date },
    lastScanAt: { type: Date },
    scanFrequency: {
      type: String,
      enum: ['realtime', 'hourly', 'daily'],
      default: 'hourly',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
MonitoringRuleSchema.index({ userId: 1, isActive: 1 });
MonitoringRuleSchema.index({ userId: 1, name: 1 });

export const MonitoringRule = mongoose.model<IMonitoringRule>(
  'MonitoringRule',
  MonitoringRuleSchema
);
