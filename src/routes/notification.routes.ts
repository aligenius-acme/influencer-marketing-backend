/**
 * Notification Routes
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== Get Notifications ====================

// Get all notifications with pagination and filters
router.get('/', notificationController.getNotifications);

// Get notification statistics
router.get('/stats', notificationController.getStats);

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount);

// Get a single notification
router.get('/:id', notificationController.getNotification);

// ==================== Actions ====================

// Create a notification (for testing/admin)
router.post('/', notificationController.createNotification);

// Mark notification as read
router.patch('/:id/read', notificationController.markAsRead);

// Mark all as read
router.post('/read-all', notificationController.markAllAsRead);

// Archive a notification
router.patch('/:id/archive', notificationController.archiveNotification);

// Archive all read notifications
router.post('/archive-read', notificationController.archiveAllRead);

// Delete a notification
router.delete('/:id', notificationController.deleteNotification);

// Delete all archived notifications
router.delete('/archived/all', notificationController.deleteAllArchived);

export default router;
