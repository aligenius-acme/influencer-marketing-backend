/**
 * Audit Service
 *
 * Handles audit logging:
 * - Activity tracking
 * - Change history
 * - Compliance logs
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Audit actions
export const AUDIT_ACTIONS = {
  // Auth actions
  LOGIN: 'login',
  LOGOUT: 'logout',
  PASSWORD_CHANGE: 'password_change',
  PASSWORD_RESET: 'password_reset',

  // CRUD actions
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',

  // Export/Import
  EXPORT: 'export',
  IMPORT: 'import',

  // Team actions
  INVITE: 'invite',
  JOIN: 'join',
  LEAVE: 'leave',
  ROLE_CHANGE: 'role_change',

  // API actions
  API_KEY_CREATE: 'api_key_create',
  API_KEY_REVOKE: 'api_key_revoke',

  // Settings
  SETTINGS_CHANGE: 'settings_change',
  BRANDING_CHANGE: 'branding_change',
};

// Resource types
export const RESOURCE_TYPES = {
  USER: 'user',
  WORKSPACE: 'workspace',
  MEMBER: 'member',
  CAMPAIGN: 'campaign',
  INFLUENCER: 'influencer',
  CONTRACT: 'contract',
  API_KEY: 'api_key',
  WEBHOOK: 'webhook',
  BRANDING: 'branding',
  SETTINGS: 'settings',
};

interface AuditLogEntry {
  workspaceId?: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

class AuditService {
  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry) {
    try {
      return await prisma.auditLog.create({
        data: {
          workspaceId: entry.workspaceId,
          userId: entry.userId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          resourceName: entry.resourceName,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      // Don't let audit logging errors break the application
      console.error('[AuditService] Failed to log:', error);
      return null;
    }
  }

  /**
   * Log a create action
   */
  async logCreate(
    resourceType: string,
    resourceId: string,
    resourceName: string,
    newValue: Record<string, unknown>,
    context: { workspaceId?: string; userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    return this.log({
      ...context,
      action: AUDIT_ACTIONS.CREATE,
      resourceType,
      resourceId,
      resourceName,
      newValue: this.sanitizeValue(newValue),
    });
  }

  /**
   * Log an update action
   */
  async logUpdate(
    resourceType: string,
    resourceId: string,
    resourceName: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    context: { workspaceId?: string; userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    return this.log({
      ...context,
      action: AUDIT_ACTIONS.UPDATE,
      resourceType,
      resourceId,
      resourceName,
      oldValue: this.sanitizeValue(oldValue),
      newValue: this.sanitizeValue(newValue),
    });
  }

  /**
   * Log a delete action
   */
  async logDelete(
    resourceType: string,
    resourceId: string,
    resourceName: string,
    oldValue: Record<string, unknown>,
    context: { workspaceId?: string; userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    return this.log({
      ...context,
      action: AUDIT_ACTIONS.DELETE,
      resourceType,
      resourceId,
      resourceName,
      oldValue: this.sanitizeValue(oldValue),
    });
  }

  /**
   * Log an export action
   */
  async logExport(
    resourceType: string,
    details: { count: number; format?: string },
    context: { workspaceId?: string; userId?: string; ipAddress?: string; userAgent?: string }
  ) {
    return this.log({
      ...context,
      action: AUDIT_ACTIONS.EXPORT,
      resourceType,
      newValue: details as Prisma.InputJsonValue,
    });
  }

  /**
   * Get audit logs with filters
   */
  async getLogs(filters: {
    workspaceId?: string;
    userId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.workspaceId) where.workspaceId = filters.workspaceId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.resourceId) where.resourceId = filters.resourceId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) (where.createdAt as Record<string, Date>).gte = filters.startDate;
      if (filters.endDate) (where.createdAt as Record<string, Date>).lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get audit log by ID
   */
  async getLog(logId: string) {
    return prisma.auditLog.findUnique({
      where: { id: logId },
    });
  }

  /**
   * Get resource history
   */
  async getResourceHistory(resourceType: string, resourceId: string, limit: number = 50) {
    return prisma.auditLog.findMany({
      where: {
        resourceType,
        resourceId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId: string, limit: number = 50) {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get activity summary for a workspace
   */
  async getWorkspaceSummary(
    workspaceId: string,
    days: number = 30
  ): Promise<{
    totalEvents: number;
    byAction: Record<string, number>;
    byResource: Record<string, number>;
    byUser: Record<string, number>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await prisma.auditLog.findMany({
      where: {
        workspaceId,
        createdAt: { gte: startDate },
      },
      select: {
        action: true,
        resourceType: true,
        userId: true,
      },
    });

    const byAction: Record<string, number> = {};
    const byResource: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    logs.forEach((log) => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byResource[log.resourceType] = (byResource[log.resourceType] || 0) + 1;
      if (log.userId) {
        byUser[log.userId] = (byUser[log.userId] || 0) + 1;
      }
    });

    return {
      totalEvents: logs.length,
      byAction,
      byResource,
      byUser,
    };
  }

  /**
   * Clean up old audit logs
   */
  async cleanup(retentionDays: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return { deleted: result.count };
  }

  /**
   * Sanitize values before storing (remove sensitive data)
   */
  private sanitizeValue(value: Record<string, unknown>): Prisma.InputJsonValue {
    const sensitiveFields = [
      'password',
      'passwordHash',
      'accessToken',
      'refreshToken',
      'secret',
      'apiKey',
      'token',
    ];

    const sanitized: Record<string, Prisma.InputJsonValue | null> = {};

    for (const [key, val] of Object.entries(value)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        sanitized[key] = this.sanitizeValue(val as Record<string, unknown>);
      } else {
        sanitized[key] = val as Prisma.InputJsonValue | null;
      }
    }

    return sanitized as Prisma.InputJsonValue;
  }
}

export const auditService = new AuditService();
export default auditService;
