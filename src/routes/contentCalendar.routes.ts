/**
 * Content Calendar Routes
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as controller from '../controllers/contentCalendar.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== Scheduled Posts ====================
router.post('/posts', controller.createPost);
router.get('/posts', controller.getCalendarPosts);
router.get('/posts/upcoming', controller.getUpcomingPosts);
router.get('/posts/pending', controller.getPendingApproval);
router.get('/posts/by-date', controller.getPostsByDate);
router.get('/posts/:id', controller.getPost);
router.patch('/posts/:id', controller.updatePost);
router.delete('/posts/:id', controller.deletePost);

// Scheduling
router.post('/posts/:id/reschedule', controller.reschedulePost);
router.post('/posts/bulk-reschedule', controller.bulkReschedule);

// Status Management
router.post('/posts/:id/submit', controller.submitForApproval);
router.post('/posts/:id/approve', controller.approvePost);
router.post('/posts/:id/reject', controller.rejectPost);
router.post('/posts/:id/schedule', controller.schedulePost);
router.post('/posts/:id/publish', controller.markAsPublished);

// Compliance
router.get('/posts/:id/compliance', controller.checkCompliance);

// Statistics
router.get('/stats', controller.getCalendarStats);

// ==================== Brand Guidelines ====================
router.get('/guidelines', controller.getGuidelines);
router.post('/guidelines', controller.createGuidelines);
router.patch('/guidelines/:id', controller.updateGuidelines);
router.get('/guidelines/templates', controller.getGuidelinesTemplates);

export default router;
