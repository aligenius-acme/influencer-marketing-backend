/**
 * Scheduled Report Controller
 *
 * Handles HTTP requests for scheduled reports
 */

import { Request, Response, NextFunction } from 'express';
import { scheduledReportService } from '../services/scheduledReport.service.js';

// ==================== CRUD ====================

export async function createReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    // Transform frontend format to service format
    const { config, schedule, ...rest } = req.body;
    const input = {
      ...rest,
      reportType: config?.type || rest.reportType,
      filters: config ? {
        dateRange: config.dateRange?.type,
        ...config.filters,
      } : rest.filters,
      frequency: schedule?.frequency || rest.frequency,
      dayOfWeek: schedule?.dayOfWeek ?? rest.dayOfWeek,
      dayOfMonth: schedule?.dayOfMonth ?? rest.dayOfMonth,
      time: schedule?.time || rest.time,
      timezone: schedule?.timezone || rest.timezone,
    };

    const report = await scheduledReportService.create(userId, input);

    res.status(201).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

export async function getReports(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const reports = await scheduledReportService.getAll(userId);

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
}

export async function getReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const report = await scheduledReportService.getById(userId, req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: { message: 'Report not found' },
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const report = await scheduledReportService.update(userId, req.params.id, req.body);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: { message: 'Report not found' },
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const deleted = await scheduledReportService.delete(userId, req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { message: 'Report not found' },
      });
    }

    res.json({
      success: true,
      message: 'Report deleted',
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const report = await scheduledReportService.toggle(userId, req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: { message: 'Report not found' },
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Report Generation ====================

export async function runReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const success = await scheduledReportService.runReport(userId, req.params.id);

    res.json({
      success,
      message: success ? 'Report sent successfully' : 'Failed to send report',
    });
  } catch (error) {
    next(error);
  }
}

export async function previewReport(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const data = await scheduledReportService.generateReportData(userId, req.params.id);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Templates ====================

export async function getTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const templates = scheduledReportService.getTemplates();

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
}

export async function createFromTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const { templateIndex, recipients, emailSubject, emailMessage } = req.body;
    const templates = scheduledReportService.getTemplates();
    const template = templates[templateIndex];

    if (!template) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid template index' },
      });
    }

    const report = await scheduledReportService.create(userId, {
      name: template.name,
      description: template.description,
      reportType: template.type,
      frequency: template.frequency,
      recipients,
      emailSubject,
      emailMessage,
    });

    res.status(201).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

// ==================== History ====================

export async function getReportHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const report = await scheduledReportService.getById(userId, req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: { message: 'Report not found' },
      });
    }

    res.json({
      success: true,
      data: report.history,
    });
  } catch (error) {
    next(error);
  }
}
