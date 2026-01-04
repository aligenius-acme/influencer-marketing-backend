/**
 * Notification Controller
 *
 * Handles notification API endpoints
 */

import { Request, Response } from 'express';
import { notificationService } from '../services/notification.service.js';
import { NotificationType, NotificationPriority } from '../models/Notification.js';

// ==================== Get Notifications ====================

/**
 * Get notifications for the current user
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { type, read, archived, priority, resourceType, page, limit } = req.query;

    const result = await notificationService.getNotifications(userId, {
      filters: {
        type: type as NotificationType | undefined,
        read: read === 'true' ? true : read === 'false' ? false : undefined,
        archived: archived === 'true',
        priority: priority as NotificationPriority | undefined,
        resourceType: resourceType as string | undefined,
      },
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({
      success: true,
      data: result.notifications,
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
      },
    });
  } catch (error) {
    console.error('[Notification] Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
    });
  }
};

/**
 * Get a single notification
 */
export const getNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const notification = await notificationService.getNotification(userId, id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('[Notification] Get notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification',
    });
  }
};

/**
 * Get notification statistics
 */
export const getStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const stats = await notificationService.getStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[Notification] Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification statistics',
    });
  }
};

/**
 * Get unread count
 */
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('[Notification] Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
    });
  }
};

// ==================== Update Status ====================

/**
 * Mark notification as read
 */
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const notification = await notificationService.markAsRead(userId, id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or already read',
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { id: notification._id },
    });
  } catch (error) {
    console.error('[Notification] Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const count = await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: `${count} notifications marked as read`,
      data: { count },
    });
  } catch (error) {
    console.error('[Notification] Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
    });
  }
};

/**
 * Archive a notification
 */
export const archiveNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const notification = await notificationService.archive(userId, id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification archived',
      data: { id: notification._id },
    });
  } catch (error) {
    console.error('[Notification] Archive error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive notification',
    });
  }
};

/**
 * Archive all read notifications
 */
export const archiveAllRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const count = await notificationService.archiveAllRead(userId);

    res.json({
      success: true,
      message: `${count} notifications archived`,
      data: { count },
    });
  } catch (error) {
    console.error('[Notification] Archive all read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive notifications',
    });
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const deleted = await notificationService.delete(userId, id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('[Notification] Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
    });
  }
};

/**
 * Delete all archived notifications
 */
export const deleteAllArchived = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const count = await notificationService.deleteAllArchived(userId);

    res.json({
      success: true,
      message: `${count} notifications deleted`,
      data: { count },
    });
  } catch (error) {
    console.error('[Notification] Delete all archived error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete archived notifications',
    });
  }
};

// ==================== Create (For Testing/Admin) ====================

/**
 * Create a notification (admin/testing)
 */
export const createNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { title, message, type, priority, actionUrl, actionLabel, resourceType, resourceId, metadata } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required',
      });
    }

    const notification = await notificationService.create({
      userId,
      title,
      message,
      type: type || 'info',
      priority: priority || 'normal',
      actionUrl,
      actionLabel,
      resourceType,
      resourceId,
      metadata,
    });

    res.status(201).json({
      success: true,
      message: 'Notification created',
      data: notification,
    });
  } catch (error) {
    console.error('[Notification] Create error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
    });
  }
};
