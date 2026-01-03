/**
 * Audit Routes
 *
 * Audit log viewing endpoints
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as auditController from '../controllers/audit.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Metadata
router.get('/metadata', auditController.getMetadata);

// Logs
router.get('/', auditController.getLogs);
router.get('/export', auditController.exportLogs);
router.get('/:id', auditController.getLog);

// Resource and user history
router.get('/resource/:resourceType/:resourceId', auditController.getResourceHistory);
router.get('/user/:userId', auditController.getUserActivity);
router.get('/workspace/:workspaceId/summary', auditController.getWorkspaceSummary);

export default router;
