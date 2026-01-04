/**
 * Notification Model (MongoDB)
 *
 * Stores in-app notifications for users
 */

import mongoose, { Schema, Document } from 'mongoose';

// ==================== Types ====================

export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'campaign'
  | 'influencer'
  | 'contract'
  | 'payment'
  | 'content'
  | 'mention'
  | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface INotification extends Document {
  userId: string;
  workspaceId?: string;

  // Content
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;

  // Optional rich content
  icon?: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;

  // Context
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;

  // Status
  read: boolean;
  readAt?: Date;
  archived: boolean;
  archivedAt?: Date;

  // Delivery
  emailSent: boolean;
  pushSent: boolean;

  // Timestamps
  createdAt: Date;
  expiresAt?: Date;
}

// ==================== Schema ====================

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    workspaceId: {
      type: String,
      index: true,
    },

    // Content
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'error', 'campaign', 'influencer', 'contract', 'payment', 'content', 'mention', 'system'],
      default: 'info',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },

    // Optional rich content
    icon: String,
    imageUrl: String,
    actionUrl: String,
    actionLabel: String,

    // Context
    resourceType: String,
    resourceId: String,
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // Status
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: Date,
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: Date,

    // Delivery
    emailSent: {
      type: Boolean,
      default: false,
    },
    pushSent: {
      type: Boolean,
      default: false,
    },

    // Expiration
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'notifications',
  }
);

// Indexes
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, archived: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// ==================== Model ====================

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
