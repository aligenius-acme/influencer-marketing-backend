/**
 * Workflow Controller
 *
 * Handles workflow automation API endpoints
 */

import { Request, Response } from 'express';
import { workflowService, emitWorkflowTrigger } from '../services/workflow.service.js';
import { WorkflowTrigger } from '@prisma/client';

// ==================== Rule Management ====================

/**
 * Create a new workflow rule
 */
export const createRule = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, description, triggerType, triggerConfig, conditions, actions, delay, schedule, priority } = req.body;

    if (!name || !triggerType || !actions || !Array.isArray(actions)) {
      return res.status(400).json({
        success: false,
        message: 'Name, trigger type, and actions are required',
      });
    }

    if (actions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one action is required',
      });
    }

    const rule = await workflowService.createRule(userId, {
      name,
      description,
      triggerType,
      triggerConfig,
      conditions,
      actions,
      delay,
      schedule,
      priority,
    });

    res.status(201).json({
      success: true,
      message: 'Workflow rule created',
      data: rule,
    });
  } catch (error) {
    console.error('[Workflow] Create rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create workflow rule',
    });
  }
};

/**
 * Get all workflow rules
 */
export const getRules = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { active, trigger } = req.query;

    const rules = await workflowService.getRules(userId, {
      isActive: active === 'true' ? true : active === 'false' ? false : undefined,
      triggerType: trigger as WorkflowTrigger | undefined,
    });

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error('[Workflow] Get rules error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get workflow rules',
    });
  }
};

/**
 * Get a single workflow rule
 */
export const getRule = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const rule = await workflowService.getRule(userId, id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Workflow rule not found',
      });
    }

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error('[Workflow] Get rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get workflow rule',
    });
  }
};

/**
 * Update a workflow rule
 */
export const updateRule = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const updates = req.body;

    const result = await workflowService.updateRule(userId, id, updates);

    if (result.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Workflow rule not found',
      });
    }

    res.json({
      success: true,
      message: 'Workflow rule updated',
    });
  } catch (error) {
    console.error('[Workflow] Update rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update workflow rule',
    });
  }
};

/**
 * Delete a workflow rule
 */
export const deleteRule = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await workflowService.deleteRule(userId, id);

    if (result.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Workflow rule not found',
      });
    }

    res.json({
      success: true,
      message: 'Workflow rule deleted',
    });
  } catch (error) {
    console.error('[Workflow] Delete rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete workflow rule',
    });
  }
};

/**
 * Toggle workflow rule active status
 */
export const toggleRule = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const rule = await workflowService.toggleRule(userId, id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Workflow rule not found',
      });
    }

    res.json({
      success: true,
      message: `Workflow rule ${rule.isActive ? 'activated' : 'deactivated'}`,
      data: { isActive: rule.isActive },
    });
  } catch (error) {
    console.error('[Workflow] Toggle rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle workflow rule',
    });
  }
};

// ==================== Manual Trigger ====================

/**
 * Manually trigger a workflow
 */
export const triggerManually = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { data } = req.body;

    // Get the rule to verify ownership and get trigger type
    const rule = await workflowService.getRule(userId, id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Workflow rule not found',
      });
    }

    if (!rule.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Workflow rule is not active',
      });
    }

    // Execute the workflow
    await workflowService.executeWorkflow(id, rule.triggerType, data || {});

    res.json({
      success: true,
      message: 'Workflow triggered manually',
    });
  } catch (error) {
    console.error('[Workflow] Manual trigger error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger workflow',
    });
  }
};

/**
 * Test a workflow rule without saving execution
 */
export const testRule = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { testData } = req.body;

    const rule = await workflowService.getRule(userId, id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Workflow rule not found',
      });
    }

    // Return what would be executed
    res.json({
      success: true,
      message: 'Workflow test simulation',
      data: {
        rule: {
          id: rule.id,
          name: rule.name,
          triggerType: rule.triggerType,
        },
        testData: testData || {},
        actions: rule.actions,
        wouldExecute: rule.isActive,
      },
    });
  } catch (error) {
    console.error('[Workflow] Test rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test workflow rule',
    });
  }
};

// ==================== Execution History ====================

/**
 * Get workflow execution history
 */
export const getExecutions = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { ruleId, status, limit } = req.query;

    const executions = await workflowService.getExecutions(userId, {
      ruleId: ruleId as string | undefined,
      status: status as any,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
      success: true,
      data: executions,
    });
  } catch (error) {
    console.error('[Workflow] Get executions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get execution history',
    });
  }
};

/**
 * Get execution details
 */
export const getExecution = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const execution = await workflowService.getExecution(userId, id);

    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Execution not found',
      });
    }

    res.json({
      success: true,
      data: execution,
    });
  } catch (error) {
    console.error('[Workflow] Get execution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get execution details',
    });
  }
};

/**
 * Retry a failed execution
 */
export const retryExecution = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    await workflowService.retryExecution(userId, id);

    res.json({
      success: true,
      message: 'Execution retry initiated',
    });
  } catch (error) {
    console.error('[Workflow] Retry execution error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to retry execution',
    });
  }
};

// ==================== Trigger Types ====================

/**
 * Get available trigger types
 */
export const getTriggerTypes = async (_req: Request, res: Response) => {
  const triggers = [
    { value: 'CAMPAIGN_CREATED', label: 'Campaign Created', category: 'Campaign' },
    { value: 'CAMPAIGN_STATUS_CHANGED', label: 'Campaign Status Changed', category: 'Campaign' },
    { value: 'CAMPAIGN_STARTED', label: 'Campaign Started', category: 'Campaign' },
    { value: 'CAMPAIGN_ENDED', label: 'Campaign Ended', category: 'Campaign' },
    { value: 'INFLUENCER_ADDED_TO_CAMPAIGN', label: 'Influencer Added to Campaign', category: 'Influencer' },
    { value: 'INFLUENCER_STATUS_CHANGED', label: 'Influencer Status Changed', category: 'Influencer' },
    { value: 'INFLUENCER_REMOVED_FROM_CAMPAIGN', label: 'Influencer Removed from Campaign', category: 'Influencer' },
    { value: 'CONTRACT_CREATED', label: 'Contract Created', category: 'Contract' },
    { value: 'CONTRACT_SENT', label: 'Contract Sent for Signature', category: 'Contract' },
    { value: 'CONTRACT_SIGNED', label: 'Contract Signed', category: 'Contract' },
    { value: 'CONTRACT_EXPIRED', label: 'Contract Expired', category: 'Contract' },
    { value: 'INVOICE_CREATED', label: 'Invoice Created', category: 'Payment' },
    { value: 'INVOICE_SENT', label: 'Invoice Sent', category: 'Payment' },
    { value: 'INVOICE_PAID', label: 'Invoice Paid', category: 'Payment' },
    { value: 'INVOICE_OVERDUE', label: 'Invoice Overdue', category: 'Payment' },
    { value: 'CONTENT_SUBMITTED', label: 'Content Submitted', category: 'Content' },
    { value: 'CONTENT_APPROVED', label: 'Content Approved', category: 'Content' },
    { value: 'CONTENT_REJECTED', label: 'Content Rejected', category: 'Content' },
    { value: 'SCHEDULED', label: 'Scheduled (One-time)', category: 'Scheduled' },
    { value: 'RECURRING', label: 'Recurring Schedule', category: 'Scheduled' },
    { value: 'MANUAL', label: 'Manual Trigger', category: 'Manual' },
  ];

  res.json({
    success: true,
    data: triggers,
  });
};

/**
 * Get available action types
 */
export const getActionTypes = async (_req: Request, res: Response) => {
  const actions = [
    {
      value: 'send_email',
      label: 'Send Email',
      description: 'Send an email using a template or custom content',
      configFields: [
        { name: 'templateId', type: 'select', label: 'Email Template', optional: true },
        { name: 'recipientField', type: 'string', label: 'Recipient Field', default: 'email' },
        { name: 'customSubject', type: 'string', label: 'Custom Subject', optional: true },
        { name: 'customBody', type: 'textarea', label: 'Custom Body (HTML)', optional: true },
      ],
    },
    {
      value: 'send_notification',
      label: 'Send Notification',
      description: 'Send an in-app notification',
      configFields: [
        { name: 'title', type: 'string', label: 'Title', required: true },
        { name: 'message', type: 'textarea', label: 'Message', required: true },
        { name: 'type', type: 'select', label: 'Type', options: ['info', 'success', 'warning', 'error'] },
        { name: 'link', type: 'string', label: 'Link URL', optional: true },
      ],
    },
    {
      value: 'update_status',
      label: 'Update Status',
      description: 'Update the status of a campaign, influencer, or contract',
      configFields: [
        { name: 'resourceType', type: 'select', label: 'Resource Type', options: ['campaign', 'campaign_influencer', 'contract'] },
        { name: 'resourceIdField', type: 'string', label: 'Resource ID Field', required: true },
        { name: 'newStatus', type: 'string', label: 'New Status', required: true },
      ],
    },
    {
      value: 'add_tag',
      label: 'Add Tag',
      description: 'Add a tag to an influencer',
      configFields: [
        { name: 'savedInfluencerIdField', type: 'string', label: 'Influencer ID Field' },
        { name: 'tagId', type: 'select', label: 'Tag', required: true },
      ],
    },
    {
      value: 'assign_to_list',
      label: 'Assign to List',
      description: 'Add an influencer to a list',
      configFields: [
        { name: 'savedInfluencerIdField', type: 'string', label: 'Influencer ID Field' },
        { name: 'listId', type: 'select', label: 'List', required: true },
      ],
    },
    {
      value: 'webhook',
      label: 'Call Webhook',
      description: 'Send data to an external URL',
      configFields: [
        { name: 'url', type: 'string', label: 'Webhook URL', required: true },
        { name: 'method', type: 'select', label: 'HTTP Method', options: ['POST', 'PUT', 'PATCH'], default: 'POST' },
        { name: 'headers', type: 'json', label: 'Custom Headers', optional: true },
      ],
    },
  ];

  res.json({
    success: true,
    data: actions,
  });
};
