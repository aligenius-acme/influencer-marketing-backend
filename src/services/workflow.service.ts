/**
 * Workflow Automation Service
 *
 * Handles automated workflows triggered by events in the system
 */

import { prisma } from '../config/postgres.js';
import { emailService } from './email.service.js';
import { WorkflowTrigger, WorkflowExecutionStatus } from '@prisma/client';

// ==================== Types ====================

export interface WorkflowAction {
  type: WorkflowActionType;
  config: Record<string, unknown>;
}

export type WorkflowActionType =
  | 'send_email'
  | 'send_notification'
  | 'update_status'
  | 'add_tag'
  | 'remove_tag'
  | 'assign_to_list'
  | 'create_task'
  | 'webhook'
  | 'delay';

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: unknown;
}

export interface TriggerContext {
  userId: string;
  trigger: WorkflowTrigger;
  data: Record<string, unknown>;
}

export interface ActionResult {
  action: string;
  success: boolean;
  message?: string;
  data?: unknown;
}

// ==================== Service ====================

class WorkflowService {
  // ==================== Rule Management ====================

  /**
   * Create a new workflow rule
   */
  async createRule(
    userId: string,
    data: {
      name: string;
      description?: string;
      triggerType: WorkflowTrigger;
      triggerConfig?: Record<string, unknown>;
      conditions?: WorkflowCondition[];
      actions: WorkflowAction[];
      delay?: number;
      schedule?: string;
      priority?: number;
    }
  ) {
    return prisma.workflowRule.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig || {},
        conditions: data.conditions || [],
        actions: data.actions,
        delay: data.delay,
        schedule: data.schedule,
        priority: data.priority || 0,
      },
    });
  }

  /**
   * Get all workflow rules for a user
   */
  async getRules(userId: string, options?: { isActive?: boolean; triggerType?: WorkflowTrigger }) {
    return prisma.workflowRule.findMany({
      where: {
        userId,
        ...(options?.isActive !== undefined && { isActive: options.isActive }),
        ...(options?.triggerType && { triggerType: options.triggerType }),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get a single workflow rule
   */
  async getRule(userId: string, ruleId: string) {
    return prisma.workflowRule.findFirst({
      where: { id: ruleId, userId },
      include: {
        executions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Update a workflow rule
   */
  async updateRule(
    userId: string,
    ruleId: string,
    data: Partial<{
      name: string;
      description: string;
      triggerConfig: Record<string, unknown>;
      conditions: WorkflowCondition[];
      actions: WorkflowAction[];
      delay: number;
      schedule: string;
      priority: number;
      isActive: boolean;
    }>
  ) {
    return prisma.workflowRule.updateMany({
      where: { id: ruleId, userId },
      data,
    });
  }

  /**
   * Delete a workflow rule
   */
  async deleteRule(userId: string, ruleId: string) {
    return prisma.workflowRule.deleteMany({
      where: { id: ruleId, userId },
    });
  }

  /**
   * Toggle workflow rule active status
   */
  async toggleRule(userId: string, ruleId: string) {
    const rule = await prisma.workflowRule.findFirst({
      where: { id: ruleId, userId },
    });

    if (!rule) return null;

    return prisma.workflowRule.update({
      where: { id: ruleId },
      data: { isActive: !rule.isActive },
    });
  }

  // ==================== Trigger Processing ====================

  /**
   * Process a trigger event - find and execute matching workflows
   */
  async processTrigger(context: TriggerContext): Promise<void> {
    const { userId, trigger, data } = context;

    // Find all active rules matching this trigger
    const rules = await prisma.workflowRule.findMany({
      where: {
        userId,
        triggerType: trigger,
        isActive: true,
      },
      orderBy: { priority: 'desc' },
    });

    console.log(`[Workflow] Found ${rules.length} rules for trigger ${trigger}`);

    for (const rule of rules) {
      // Check conditions
      const conditions = rule.conditions as WorkflowCondition[] || [];
      if (!this.checkConditions(conditions, data)) {
        console.log(`[Workflow] Rule ${rule.id} conditions not met, skipping`);
        continue;
      }

      // Execute workflow (potentially with delay)
      if (rule.delay && rule.delay > 0) {
        // Schedule for later execution
        await this.scheduleExecution(rule.id, trigger, data, rule.delay);
      } else {
        // Execute immediately
        await this.executeWorkflow(rule.id, trigger, data);
      }
    }
  }

  /**
   * Execute a workflow rule
   */
  async executeWorkflow(
    ruleId: string,
    trigger: WorkflowTrigger,
    data: Record<string, unknown>
  ): Promise<void> {
    const rule = await prisma.workflowRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      console.error(`[Workflow] Rule ${ruleId} not found`);
      return;
    }

    // Create execution record
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowRuleId: ruleId,
        triggerType: trigger,
        triggerData: data,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    const results: ActionResult[] = [];
    let actionsExecuted = 0;
    let hasError = false;
    let errorMessage: string | undefined;

    try {
      const actions = rule.actions as WorkflowAction[];

      for (const action of actions) {
        try {
          const result = await this.executeAction(action, data, rule.userId);
          results.push(result);
          if (result.success) actionsExecuted++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            action: action.type,
            success: false,
            message,
          });
          hasError = true;
          errorMessage = message;
        }
      }
    } catch (error) {
      hasError = true;
      errorMessage = error instanceof Error ? error.message : 'Workflow execution failed';
    }

    // Update execution record
    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: hasError ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(),
        actionsExecuted,
        results,
        error: errorMessage,
      },
    });

    // Update rule stats
    await prisma.workflowRule.update({
      where: { id: ruleId },
      data: {
        executionCount: { increment: 1 },
        lastExecutedAt: new Date(),
      },
    });

    console.log(`[Workflow] Executed rule ${ruleId}: ${actionsExecuted} actions, ${hasError ? 'with errors' : 'success'}`);
  }

  /**
   * Schedule a workflow execution for later
   */
  private async scheduleExecution(
    ruleId: string,
    trigger: WorkflowTrigger,
    data: Record<string, unknown>,
    delayMinutes: number
  ): Promise<void> {
    // Create pending execution
    await prisma.workflowExecution.create({
      data: {
        workflowRuleId: ruleId,
        triggerType: trigger,
        triggerData: data,
        status: 'PENDING',
      },
    });

    // In production, this would be handled by a job queue (BullMQ)
    // For now, we'll use setTimeout for demo purposes
    setTimeout(async () => {
      await this.executeWorkflow(ruleId, trigger, data);
    }, delayMinutes * 60 * 1000);

    console.log(`[Workflow] Scheduled execution for rule ${ruleId} in ${delayMinutes} minutes`);
  }

  // ==================== Action Execution ====================

  /**
   * Execute a single workflow action
   */
  private async executeAction(
    action: WorkflowAction,
    data: Record<string, unknown>,
    userId: string
  ): Promise<ActionResult> {
    const { type, config } = action;

    switch (type) {
      case 'send_email':
        return this.executeSendEmail(config, data, userId);

      case 'send_notification':
        return this.executeSendNotification(config, data, userId);

      case 'update_status':
        return this.executeUpdateStatus(config, data);

      case 'add_tag':
        return this.executeAddTag(config, data);

      case 'remove_tag':
        return this.executeRemoveTag(config, data);

      case 'assign_to_list':
        return this.executeAssignToList(config, data);

      case 'create_task':
        return this.executeCreateTask(config, data, userId);

      case 'webhook':
        return this.executeWebhook(config, data);

      default:
        return {
          action: type,
          success: false,
          message: `Unknown action type: ${type}`,
        };
    }
  }

  /**
   * Send email action
   */
  private async executeSendEmail(
    config: Record<string, unknown>,
    data: Record<string, unknown>,
    userId: string
  ): Promise<ActionResult> {
    const { templateId, recipientField, customSubject, customBody } = config as {
      templateId?: string;
      recipientField?: string;
      customSubject?: string;
      customBody?: string;
    };

    // Get recipient email from data
    const recipientEmail = recipientField ? (data[recipientField] as string) : (data['email'] as string);

    if (!recipientEmail) {
      return {
        action: 'send_email',
        success: false,
        message: 'No recipient email found',
      };
    }

    // If using a template
    if (templateId) {
      const template = await prisma.emailTemplate.findFirst({
        where: { id: templateId, userId },
      });

      if (template) {
        // Replace merge tags in template
        let subject = template.subject;
        let body = template.body;

        const mergeTags = template.mergeTags as Array<{ tag: string; field: string }> || [];
        for (const tag of mergeTags) {
          const value = data[tag.field] as string || '';
          subject = subject.replace(new RegExp(`{{${tag.tag}}}`, 'g'), value);
          body = body.replace(new RegExp(`{{${tag.tag}}}`, 'g'), value);
        }

        await emailService.sendEmail({
          to: recipientEmail,
          subject,
          html: body,
        });

        return {
          action: 'send_email',
          success: true,
          message: `Email sent to ${recipientEmail}`,
          data: { templateId, recipient: recipientEmail },
        };
      }
    }

    // Custom email content
    if (customSubject && customBody) {
      const subject = this.interpolateString(customSubject, data);
      const body = this.interpolateString(customBody, data);

      await emailService.sendEmail({
        to: recipientEmail,
        subject,
        html: body,
      });

      return {
        action: 'send_email',
        success: true,
        message: `Email sent to ${recipientEmail}`,
        data: { recipient: recipientEmail },
      };
    }

    return {
      action: 'send_email',
      success: false,
      message: 'No email template or custom content provided',
    };
  }

  /**
   * Send in-app notification action
   */
  private async executeSendNotification(
    config: Record<string, unknown>,
    data: Record<string, unknown>,
    userId: string
  ): Promise<ActionResult> {
    const { title, message, type, link } = config as {
      title: string;
      message: string;
      type?: string;
      link?: string;
    };

    // Interpolate variables
    const notificationTitle = this.interpolateString(title, data);
    const notificationMessage = this.interpolateString(message, data);
    const notificationLink = link ? this.interpolateString(link, data) : undefined;

    // Store notification (assuming a notifications collection in MongoDB)
    // For now, just log it
    console.log(`[Workflow] Notification for user ${userId}:`, {
      title: notificationTitle,
      message: notificationMessage,
      type: type || 'info',
      link: notificationLink,
    });

    return {
      action: 'send_notification',
      success: true,
      message: 'Notification sent',
      data: { title: notificationTitle, userId },
    };
  }

  /**
   * Update status action
   */
  private async executeUpdateStatus(
    config: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<ActionResult> {
    const { resourceType, resourceIdField, newStatus } = config as {
      resourceType: string;
      resourceIdField: string;
      newStatus: string;
    };

    const resourceId = data[resourceIdField] as string;

    if (!resourceId) {
      return {
        action: 'update_status',
        success: false,
        message: 'Resource ID not found',
      };
    }

    try {
      switch (resourceType) {
        case 'campaign':
          await prisma.campaign.update({
            where: { id: resourceId },
            data: { status: newStatus as any },
          });
          break;

        case 'campaign_influencer':
          await prisma.campaignInfluencer.update({
            where: { id: resourceId },
            data: { status: newStatus as any },
          });
          break;

        case 'contract':
          await prisma.contract.update({
            where: { id: resourceId },
            data: { status: newStatus as any },
          });
          break;

        default:
          return {
            action: 'update_status',
            success: false,
            message: `Unknown resource type: ${resourceType}`,
          };
      }

      return {
        action: 'update_status',
        success: true,
        message: `Updated ${resourceType} status to ${newStatus}`,
        data: { resourceType, resourceId, newStatus },
      };
    } catch (error) {
      return {
        action: 'update_status',
        success: false,
        message: `Failed to update status: ${error}`,
      };
    }
  }

  /**
   * Add tag action
   */
  private async executeAddTag(
    config: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<ActionResult> {
    const { savedInfluencerIdField, tagId } = config as {
      savedInfluencerIdField: string;
      tagId: string;
    };

    const savedInfluencerId = data[savedInfluencerIdField] as string;

    if (!savedInfluencerId || !tagId) {
      return {
        action: 'add_tag',
        success: false,
        message: 'Missing influencer ID or tag ID',
      };
    }

    // This would add the tag to the influencer
    // Implementation depends on your tag system
    console.log(`[Workflow] Adding tag ${tagId} to influencer ${savedInfluencerId}`);

    return {
      action: 'add_tag',
      success: true,
      message: 'Tag added',
      data: { savedInfluencerId, tagId },
    };
  }

  /**
   * Remove tag action
   */
  private async executeRemoveTag(
    config: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<ActionResult> {
    const { savedInfluencerIdField, tagId } = config as {
      savedInfluencerIdField: string;
      tagId: string;
    };

    const savedInfluencerId = data[savedInfluencerIdField] as string;

    console.log(`[Workflow] Removing tag ${tagId} from influencer ${savedInfluencerId}`);

    return {
      action: 'remove_tag',
      success: true,
      message: 'Tag removed',
      data: { savedInfluencerId, tagId },
    };
  }

  /**
   * Assign to list action
   */
  private async executeAssignToList(
    config: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<ActionResult> {
    const { savedInfluencerIdField, listId } = config as {
      savedInfluencerIdField: string;
      listId: string;
    };

    const savedInfluencerId = data[savedInfluencerIdField] as string;

    if (!savedInfluencerId || !listId) {
      return {
        action: 'assign_to_list',
        success: false,
        message: 'Missing influencer ID or list ID',
      };
    }

    try {
      // Check if already in list
      const existing = await prisma.listInfluencer.findFirst({
        where: { listId, savedInfluencerId },
      });

      if (!existing) {
        await prisma.listInfluencer.create({
          data: { listId, savedInfluencerId },
        });
      }

      return {
        action: 'assign_to_list',
        success: true,
        message: 'Influencer assigned to list',
        data: { savedInfluencerId, listId },
      };
    } catch (error) {
      return {
        action: 'assign_to_list',
        success: false,
        message: `Failed to assign to list: ${error}`,
      };
    }
  }

  /**
   * Create task action (for future task management feature)
   */
  private async executeCreateTask(
    config: Record<string, unknown>,
    data: Record<string, unknown>,
    userId: string
  ): Promise<ActionResult> {
    const { title, description, dueInDays, priority } = config as {
      title: string;
      description?: string;
      dueInDays?: number;
      priority?: string;
    };

    const taskTitle = this.interpolateString(title, data);
    const taskDescription = description ? this.interpolateString(description, data) : undefined;

    // Store task (implementation depends on task management system)
    console.log(`[Workflow] Creating task for user ${userId}:`, {
      title: taskTitle,
      description: taskDescription,
      dueInDays,
      priority,
    });

    return {
      action: 'create_task',
      success: true,
      message: 'Task created',
      data: { title: taskTitle, userId },
    };
  }

  /**
   * Webhook action - call external URL
   */
  private async executeWebhook(
    config: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<ActionResult> {
    const { url, method, headers, bodyTemplate } = config as {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      bodyTemplate?: Record<string, unknown>;
    };

    if (!url) {
      return {
        action: 'webhook',
        success: false,
        message: 'No webhook URL provided',
      };
    }

    try {
      const webhookUrl = this.interpolateString(url, data);
      const body = bodyTemplate ? JSON.stringify(this.interpolateObject(bodyTemplate, data)) : JSON.stringify(data);

      const response = await fetch(webhookUrl, {
        method: method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body,
      });

      return {
        action: 'webhook',
        success: response.ok,
        message: response.ok ? 'Webhook called successfully' : `Webhook returned ${response.status}`,
        data: { url: webhookUrl, status: response.status },
      };
    } catch (error) {
      return {
        action: 'webhook',
        success: false,
        message: `Webhook failed: ${error}`,
      };
    }
  }

  // ==================== Helpers ====================

  /**
   * Check if all conditions are met
   */
  private checkConditions(conditions: WorkflowCondition[], data: Record<string, unknown>): boolean {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every(condition => {
      const fieldValue = this.getNestedValue(data, condition.field);

      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        case 'not_in':
          return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
        default:
          return false;
      }
    });
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Interpolate string with data values
   */
  private interpolateString(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Interpolate object values with data
   */
  private interpolateObject(obj: Record<string, unknown>, data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.interpolateString(value, data);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.interpolateObject(value as Record<string, unknown>, data);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // ==================== Execution History ====================

  /**
   * Get workflow execution history
   */
  async getExecutions(
    userId: string,
    options?: {
      ruleId?: string;
      status?: WorkflowExecutionStatus;
      limit?: number;
    }
  ) {
    return prisma.workflowExecution.findMany({
      where: {
        workflowRule: {
          userId,
          ...(options?.ruleId && { id: options.ruleId }),
        },
        ...(options?.status && { status: options.status }),
      },
      include: {
        workflowRule: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
    });
  }

  /**
   * Get execution details
   */
  async getExecution(userId: string, executionId: string) {
    return prisma.workflowExecution.findFirst({
      where: {
        id: executionId,
        workflowRule: { userId },
      },
      include: {
        workflowRule: true,
      },
    });
  }

  /**
   * Retry a failed execution
   */
  async retryExecution(userId: string, executionId: string) {
    const execution = await prisma.workflowExecution.findFirst({
      where: {
        id: executionId,
        workflowRule: { userId },
        status: 'FAILED',
      },
    });

    if (!execution) {
      throw new Error('Execution not found or not in failed state');
    }

    // Re-execute with original trigger data
    await this.executeWorkflow(
      execution.workflowRuleId,
      execution.triggerType,
      execution.triggerData as Record<string, unknown>
    );
  }
}

// Export singleton
export const workflowService = new WorkflowService();

// ==================== Trigger Helper Functions ====================

/**
 * Emit a workflow trigger event
 * Call this from other services when events happen
 */
export async function emitWorkflowTrigger(
  userId: string,
  trigger: WorkflowTrigger,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await workflowService.processTrigger({ userId, trigger, data });
  } catch (error) {
    console.error(`[Workflow] Error processing trigger ${trigger}:`, error);
  }
}
