/**
 * Notification Service
 *
 * Handles in-app notifications, real-time delivery, and notification preferences
 */

import { Notification, INotification, NotificationType, NotificationPriority } from '../models/Notification.js';
import { prisma } from '../config/postgres.js';
import { getRedisClient } from '../config/redis.js';
import { Server as SocketServer } from 'socket.io';

// ==================== Types ====================

export interface CreateNotificationData {
  userId: string;
  workspaceId?: string;
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  icon?: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface NotificationFilters {
  type?: NotificationType;
  read?: boolean;
  archived?: boolean;
  priority?: NotificationPriority;
  resourceType?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

// ==================== Service ====================

class NotificationService {
  private io: SocketServer | null = null;

  /**
   * Set Socket.IO instance for real-time notifications
   */
  setSocketIO(io: SocketServer) {
    this.io = io;
  }

  // ==================== Create & Send ====================

  /**
   * Create a new notification
   */
  async create(data: CreateNotificationData): Promise<INotification> {
    const notification = await Notification.create({
      userId: data.userId,
      workspaceId: data.workspaceId,
      title: data.title,
      message: data.message,
      type: data.type || 'info',
      priority: data.priority || 'normal',
      icon: data.icon,
      imageUrl: data.imageUrl,
      actionUrl: data.actionUrl,
      actionLabel: data.actionLabel,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      metadata: data.metadata || {},
      expiresAt: data.expiresAt,
    });

    // Send real-time notification
    await this.sendRealTime(data.userId, notification);

    // Update unread count in Redis
    await this.incrementUnreadCount(data.userId);

    return notification;
  }

  /**
   * Create notification for multiple users
   */
  async createBulk(userIds: string[], data: Omit<CreateNotificationData, 'userId'>): Promise<number> {
    const notifications = userIds.map(userId => ({
      userId,
      workspaceId: data.workspaceId,
      title: data.title,
      message: data.message,
      type: data.type || 'info',
      priority: data.priority || 'normal',
      icon: data.icon,
      imageUrl: data.imageUrl,
      actionUrl: data.actionUrl,
      actionLabel: data.actionLabel,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      metadata: data.metadata || {},
      expiresAt: data.expiresAt,
    }));

    const result = await Notification.insertMany(notifications);

    // Send real-time notifications
    for (const notification of result) {
      await this.sendRealTime(notification.userId, notification);
      await this.incrementUnreadCount(notification.userId);
    }

    return result.length;
  }

  /**
   * Send real-time notification via Socket.IO
   */
  private async sendRealTime(userId: string, notification: INotification): Promise<void> {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('notification', {
        id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        icon: notification.icon,
        actionUrl: notification.actionUrl,
        createdAt: notification.createdAt,
      });
    }
  }

  // ==================== Read & Query ====================

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    options?: {
      filters?: NotificationFilters;
      page?: number;
      limit?: number;
    }
  ): Promise<{ notifications: INotification[]; total: number; page: number; totalPages: number }> {
    const { filters = {}, page = 1, limit = 20 } = options || {};

    const query: Record<string, unknown> = {
      userId,
      archived: filters.archived ?? false,
    };

    if (filters.type) query.type = filters.type;
    if (filters.read !== undefined) query.read = filters.read;
    if (filters.priority) query.priority = filters.priority;
    if (filters.resourceType) query.resourceType = filters.resourceType;

    const total = await Notification.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      notifications: notifications as INotification[],
      total,
      page,
      totalPages,
    };
  }

  /**
   * Get a single notification
   */
  async getNotification(userId: string, notificationId: string): Promise<INotification | null> {
    return Notification.findOne({ _id: notificationId, userId }).lean();
  }

  /**
   * Get notification statistics
   */
  async getStats(userId: string): Promise<NotificationStats> {
    const [total, unread, byType] = await Promise.all([
      Notification.countDocuments({ userId, archived: false }),
      Notification.countDocuments({ userId, read: false, archived: false }),
      Notification.aggregate([
        { $match: { userId, archived: false } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    const typeStats: Record<string, number> = {};
    for (const item of byType) {
      typeStats[item._id] = item.count;
    }

    return {
      total,
      unread,
      byType: typeStats,
    };
  }

  /**
   * Get unread count (cached in Redis)
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const redis = getRedisClient();
      // Try cache first
      const cached = await redis.get(`notifications:unread:${userId}`);
      if (cached !== null) {
        return parseInt(cached, 10);
      }

      // Calculate and cache
      const count = await Notification.countDocuments({ userId, read: false, archived: false });
      await redis.setex(`notifications:unread:${userId}`, 300, count.toString()); // Cache for 5 minutes

      return count;
    } catch {
      // If Redis not available, just query DB
      return Notification.countDocuments({ userId, read: false, archived: false });
    }
  }

  // ==================== Update Status ====================

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<INotification | null> {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId, read: false },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (notification) {
      await this.decrementUnreadCount(userId);
    }

    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      { userId, read: false, archived: false },
      { read: true, readAt: new Date() }
    );

    // Reset unread count
    try {
      const redis = getRedisClient();
      await redis.set(`notifications:unread:${userId}`, '0');
    } catch {
      // Redis not available, skip cache update
    }

    // Emit event
    if (this.io) {
      this.io.to(`user:${userId}`).emit('notifications:all-read');
    }

    return result.modifiedCount;
  }

  /**
   * Archive a notification
   */
  async archive(userId: string, notificationId: string): Promise<INotification | null> {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { archived: true, archivedAt: new Date() },
      { new: true }
    );

    if (notification && !notification.read) {
      await this.decrementUnreadCount(userId);
    }

    return notification;
  }

  /**
   * Archive all read notifications
   */
  async archiveAllRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
      { userId, read: true, archived: false },
      { archived: true, archivedAt: new Date() }
    );

    return result.modifiedCount;
  }

  /**
   * Delete a notification
   */
  async delete(userId: string, notificationId: string): Promise<boolean> {
    const notification = await Notification.findOne({ _id: notificationId, userId });

    if (!notification) return false;

    await Notification.deleteOne({ _id: notificationId });

    if (!notification.read) {
      await this.decrementUnreadCount(userId);
    }

    return true;
  }

  /**
   * Delete all archived notifications
   */
  async deleteAllArchived(userId: string): Promise<number> {
    const result = await Notification.deleteMany({ userId, archived: true });
    return result.deletedCount;
  }

  // ==================== Helpers ====================

  /**
   * Increment unread count in Redis
   */
  private async incrementUnreadCount(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.incr(`notifications:unread:${userId}`);
    } catch {
      // Redis not available, skip cache update
    }
  }

  /**
   * Decrement unread count in Redis
   */
  private async decrementUnreadCount(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const current = await redis.get(`notifications:unread:${userId}`);
      if (current && parseInt(current, 10) > 0) {
        await redis.decr(`notifications:unread:${userId}`);
      }
    } catch {
      // Redis not available, skip cache update
    }
  }

  // ==================== System Notifications ====================

  /**
   * Send campaign notification
   */
  async notifyCampaignEvent(
    userId: string,
    event: 'created' | 'started' | 'ended' | 'influencer_joined',
    campaignData: { id: string; name: string; influencerName?: string }
  ): Promise<void> {
    const messages: Record<string, { title: string; message: string }> = {
      created: {
        title: 'Campaign Created',
        message: `Your campaign "${campaignData.name}" has been created.`,
      },
      started: {
        title: 'Campaign Started',
        message: `Your campaign "${campaignData.name}" is now active.`,
      },
      ended: {
        title: 'Campaign Ended',
        message: `Your campaign "${campaignData.name}" has ended.`,
      },
      influencer_joined: {
        title: 'Influencer Joined Campaign',
        message: `${campaignData.influencerName} has joined "${campaignData.name}".`,
      },
    };

    const { title, message } = messages[event];

    await this.create({
      userId,
      title,
      message,
      type: 'campaign',
      priority: event === 'started' ? 'high' : 'normal',
      actionUrl: `/campaigns/${campaignData.id}`,
      actionLabel: 'View Campaign',
      resourceType: 'campaign',
      resourceId: campaignData.id,
    });
  }

  /**
   * Send contract notification
   */
  async notifyContractEvent(
    userId: string,
    event: 'sent' | 'signed' | 'expired',
    contractData: { id: string; title: string; signerName?: string }
  ): Promise<void> {
    const messages: Record<string, { title: string; message: string; priority: NotificationPriority }> = {
      sent: {
        title: 'Contract Sent',
        message: `Contract "${contractData.title}" has been sent for signature.`,
        priority: 'normal',
      },
      signed: {
        title: 'Contract Signed',
        message: `${contractData.signerName || 'A party'} has signed "${contractData.title}".`,
        priority: 'high',
      },
      expired: {
        title: 'Contract Expired',
        message: `Contract "${contractData.title}" has expired.`,
        priority: 'high',
      },
    };

    const { title, message, priority } = messages[event];

    await this.create({
      userId,
      title,
      message,
      type: 'contract',
      priority,
      actionUrl: `/contracts/${contractData.id}`,
      actionLabel: 'View Contract',
      resourceType: 'contract',
      resourceId: contractData.id,
    });
  }

  /**
   * Send payment notification
   */
  async notifyPaymentEvent(
    userId: string,
    event: 'invoice_sent' | 'invoice_paid' | 'invoice_overdue',
    paymentData: { id: string; amount: number; currency: string; influencerName?: string }
  ): Promise<void> {
    const formatAmount = (amount: number, currency: string) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

    const messages: Record<string, { title: string; message: string; priority: NotificationPriority }> = {
      invoice_sent: {
        title: 'Invoice Sent',
        message: `Invoice for ${formatAmount(paymentData.amount, paymentData.currency)} sent to ${paymentData.influencerName || 'influencer'}.`,
        priority: 'normal',
      },
      invoice_paid: {
        title: 'Payment Received',
        message: `Invoice of ${formatAmount(paymentData.amount, paymentData.currency)} has been paid.`,
        priority: 'high',
      },
      invoice_overdue: {
        title: 'Invoice Overdue',
        message: `Invoice for ${formatAmount(paymentData.amount, paymentData.currency)} is overdue.`,
        priority: 'urgent',
      },
    };

    const { title, message, priority } = messages[event];

    await this.create({
      userId,
      title,
      message,
      type: 'payment',
      priority,
      actionUrl: `/invoices/${paymentData.id}`,
      actionLabel: 'View Invoice',
      resourceType: 'invoice',
      resourceId: paymentData.id,
    });
  }

  /**
   * Send content notification
   */
  async notifyContentEvent(
    userId: string,
    event: 'submitted' | 'approved' | 'rejected' | 'revision_requested',
    contentData: { id: string; campaignName: string; influencerName: string }
  ): Promise<void> {
    const messages: Record<string, { title: string; message: string }> = {
      submitted: {
        title: 'Content Submitted',
        message: `${contentData.influencerName} submitted content for "${contentData.campaignName}".`,
      },
      approved: {
        title: 'Content Approved',
        message: `Content for "${contentData.campaignName}" has been approved.`,
      },
      rejected: {
        title: 'Content Rejected',
        message: `Content for "${contentData.campaignName}" needs revision.`,
      },
      revision_requested: {
        title: 'Revision Requested',
        message: `Revisions requested for content in "${contentData.campaignName}".`,
      },
    };

    const { title, message } = messages[event];

    await this.create({
      userId,
      title,
      message,
      type: 'content',
      priority: event === 'submitted' ? 'high' : 'normal',
      actionUrl: `/content/${contentData.id}`,
      actionLabel: 'View Content',
      resourceType: 'content',
      resourceId: contentData.id,
    });
  }
}

// Export singleton
export const notificationService = new NotificationService();
