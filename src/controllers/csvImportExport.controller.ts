import { Request, Response, NextFunction } from 'express';
import { csvImportExportService } from '../services/csvImportExport.service.js';
import { BadRequestError } from '../middlewares/errorHandler.js';
import multer, { FileFilterCallback } from 'multer';

// Type for authenticated request with file
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
  file?: Express.Multer.File;
}

// Configure multer for file upload
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

/**
 * Export saved influencers to CSV
 * GET /api/v1/csv/export
 */
export const exportToCsv = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { listId, favoritesOnly, platform } = req.query;

    const csv = await csvImportExportService.exportToCsv(userId, {
      listId: listId as string,
      favoritesOnly: favoritesOnly === 'true',
      platform: platform as string,
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=influencers_${new Date().toISOString().split('T')[0]}.csv`
    );

    res.send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * Get CSV import template
 * GET /api/v1/csv/template
 */
export const getImportTemplate = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const template = csvImportExportService.getImportTemplate();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=influencer_import_template.csv'
    );

    res.send(template);
  } catch (error) {
    next(error);
  }
};

/**
 * Validate CSV before import (dry run)
 * POST /api/v1/csv/validate
 */
export const validateCsv = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const file = req.file;
    if (!file) {
      throw BadRequestError('No file uploaded');
    }

    const csvContent = file.buffer.toString('utf-8');
    const { headers, rows } = csvImportExportService.parseCsv(csvContent);
    const validation = await csvImportExportService.validateCsv(userId, headers, rows);

    res.json({
      success: true,
      data: {
        ...validation,
        headers,
        totalRows: rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Import influencers from CSV
 * POST /api/v1/csv/import
 */
export const importFromCsv = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const file = req.file;
    if (!file) {
      throw BadRequestError('No file uploaded');
    }

    const { skipDuplicates, defaultTags, listId } = req.body;

    const csvContent = file.buffer.toString('utf-8');
    const { headers, rows } = csvImportExportService.parseCsv(csvContent);

    const result = await csvImportExportService.importFromCsv(
      userId,
      headers,
      rows,
      {
        skipDuplicates: skipDuplicates === 'true' || skipDuplicates === true,
        defaultTags: defaultTags ? (Array.isArray(defaultTags) ? defaultTags : defaultTags.split(',').map((t: string) => t.trim())) : [],
        listId: listId as string,
      }
    );

    res.json({
      success: true,
      data: result,
      message: `Successfully imported ${result.success} influencers. ${result.duplicates} duplicates ${skipDuplicates ? 'skipped' : 'updated'}. ${result.failed} failed.`,
    });
  } catch (error) {
    next(error);
  }
};
