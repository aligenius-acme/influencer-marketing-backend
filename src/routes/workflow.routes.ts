/**
 * Workflow Automation Routes
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as workflowController from '../controllers/workflow.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== Configuration ====================

// Get available trigger types
router.get('/triggers', workflowController.getTriggerTypes);

// Get available action types
router.get('/actions', workflowController.getActionTypes);

// ==================== Rule Management ====================

// Create a new workflow rule
router.post('/rules', workflowController.createRule);

// Get all workflow rules
router.get('/rules', workflowController.getRules);

// Get a single workflow rule
router.get('/rules/:id', workflowController.getRule);

// Update a workflow rule
router.patch('/rules/:id', workflowController.updateRule);

// Delete a workflow rule
router.delete('/rules/:id', workflowController.deleteRule);

// Toggle workflow rule active status
router.post('/rules/:id/toggle', workflowController.toggleRule);

// Manually trigger a workflow
router.post('/rules/:id/trigger', workflowController.triggerManually);

// Test a workflow rule
router.post('/rules/:id/test', workflowController.testRule);

// ==================== Execution History ====================

// Get execution history
router.get('/executions', workflowController.getExecutions);

// Get execution details
router.get('/executions/:id', workflowController.getExecution);

// Retry a failed execution
router.post('/executions/:id/retry', workflowController.retryExecution);

export default router;
