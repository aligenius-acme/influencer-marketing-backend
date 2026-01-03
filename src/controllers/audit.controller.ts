/**
 * Audit Controller
 *
 * Handles audit log viewing endpoints
 */

import { Request, Response } from 'express';
import { AuditLog } from '@prisma/client';
import { auditService, AUDIT_ACTIONS, RESOURCE_TYPES } from '../services/audit.service.js';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Get audit logs with filters
 */
export const getLogs = async (req: AuthRequest, res: Response) => {
  try {
    const {
      workspaceId,
      userId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      limit,
      offset,
    } = req.query;

    const { logs, total } = await auditService.getLogs({
      workspaceId: workspaceId as string,
      userId: userId as string,
      action: action as string,
      resourceType: resourceType as string,
      resourceId: resourceId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json({
      logs,
      total,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });
  } catch (error) {
    console.error('[AuditController] Get logs error:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
};

/**
 * Get audit log by ID
 */
export const getLog = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const log = await auditService.getLog(id);

    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    res.json({ log });
  } catch (error) {
    console.error('[AuditController] Get log error:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
};

/**
 * Get resource history
 */
export const getResourceHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { resourceType, resourceId } = req.params;
    const { limit } = req.query;

    const history = await auditService.getResourceHistory(
      resourceType,
      resourceId,
      limit ? parseInt(limit as string, 10) : 50
    );

    res.json({ history });
  } catch (error) {
    console.error('[AuditController] Get resource history error:', error);
    res.status(500).json({ error: 'Failed to get resource history' });
  }
};

/**
 * Get user activity
 */
export const getUserActivity = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;

    const activity = await auditService.getUserActivity(
      userId,
      limit ? parseInt(limit as string, 10) : 50
    );

    res.json({ activity });
  } catch (error) {
    console.error('[AuditController] Get user activity error:', error);
    res.status(500).json({ error: 'Failed to get user activity' });
  }
};

/**
 * Get workspace activity summary
 */
export const getWorkspaceSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { days } = req.query;

    const summary = await auditService.getWorkspaceSummary(
      workspaceId,
      days ? parseInt(days as string, 10) : 30
    );

    res.json({ summary });
  } catch (error) {
    console.error('[AuditController] Get workspace summary error:', error);
    res.status(500).json({ error: 'Failed to get workspace summary' });
  }
};

/**
 * Get available audit actions and resource types
 */
export const getMetadata = async (_req: Request, res: Response) => {
  try {
    res.json({
      actions: AUDIT_ACTIONS,
      resourceTypes: RESOURCE_TYPES,
    });
  } catch (error) {
    console.error('[AuditController] Get metadata error:', error);
    res.status(500).json({ error: 'Failed to get metadata' });
  }
};

/**
 * Export audit logs (CSV/JSON)
 */
export const exportLogs = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { format = 'json' } = req.query;
    const {
      workspaceId,
      startDate,
      endDate,
    } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get logs for export
    const { logs } = await auditService.getLogs({
      workspaceId: workspaceId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: 10000, // Max export limit
    });

    // Log the export action
    await auditService.logExport(
      RESOURCE_TYPES.SETTINGS,
      { count: logs.length, format: format as string },
      { workspaceId: workspaceId as string, userId }
    );

    if (format === 'csv') {
      // Generate CSV
      const headers = ['ID', 'Timestamp', 'Action', 'Resource Type', 'Resource ID', 'User ID', 'IP Address'];
      const csvRows = [
        headers.join(','),
        ...logs.map((log: AuditLog) =>
          [
            log.id,
            log.createdAt.toISOString(),
            log.action,
            log.resourceType,
            log.resourceId || '',
            log.userId || '',
            log.ipAddress || '',
          ].join(',')
        ),
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
      res.send(csvRows.join('\n'));
    } else {
      // JSON export
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
      res.json({ logs, exportedAt: new Date().toISOString(), count: logs.length });
    }
  } catch (error) {
    console.error('[AuditController] Export logs error:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
};
