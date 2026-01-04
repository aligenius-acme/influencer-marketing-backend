/**
 * Scheduled Report Routes
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as controller from '../controllers/scheduledReport.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== CRUD ====================
router.post('/', controller.createReport);
router.get('/', controller.getReports);
router.get('/templates', controller.getTemplates);
router.post('/from-template', controller.createFromTemplate);
router.get('/:id', controller.getReport);
router.patch('/:id', controller.updateReport);
router.delete('/:id', controller.deleteReport);
router.post('/:id/toggle', controller.toggleReport);

// ==================== Report Actions ====================
router.post('/:id/run', controller.runReport);
router.get('/:id/preview', controller.previewReport);
router.get('/:id/history', controller.getReportHistory);

export default router;
