/**
 * Custom Dashboard Routes
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as controller from '../controllers/customDashboard.controller.js';

const router = Router();

// Public routes (for shared dashboards)
router.get('/public/:token', controller.getDashboardByToken);

// Protected routes
router.use(authenticate);

// ==================== Dashboard CRUD ====================
router.post('/', controller.createDashboard);
router.get('/', controller.getDashboards);
router.get('/templates', controller.getTemplates);
router.post('/from-template', controller.createFromTemplate);
router.get('/:id', controller.getDashboard);
router.patch('/:id', controller.updateDashboard);
router.delete('/:id', controller.deleteDashboard);
router.post('/:id/duplicate', controller.duplicateDashboard);

// ==================== Widget Management ====================
router.post('/:id/widgets', controller.addWidget);
router.patch('/:dashboardId/widgets/:widgetId', controller.updateWidget);
router.delete('/:dashboardId/widgets/:widgetId', controller.removeWidget);
router.put('/:id/widgets/positions', controller.updateWidgetPositions);

// ==================== Widget Data ====================
router.get('/:id/data', controller.getDashboardData);

// ==================== Sharing ====================
router.post('/:id/public-link', controller.generatePublicLink);
router.delete('/:id/public-link', controller.revokePublicLink);
router.post('/:id/share', controller.shareDashboard);
router.delete('/:id/share/:shareUserId', controller.unshareDashboard);

export default router;
