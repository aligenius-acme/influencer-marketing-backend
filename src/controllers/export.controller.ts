/**
 * Export Controller
 *
 * Handles data export to CSV, Excel, and Google Sheets
 */

import { Request, Response, NextFunction } from 'express';
import { exportService } from '../services/export.service.js';

// Export influencers
export async function exportInfluencers(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const format = (req.query.format as string) || 'csv';

    const result = await exportService.exportInfluencers(userId, { format: format as 'csv' });

    if ('data' in result) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);
    } else {
      res.json({ success: true, data: result });
    }
  } catch (error) {
    next(error);
  }
}

// Export campaigns
export async function exportCampaigns(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const format = (req.query.format as string) || 'csv';

    const result = await exportService.exportCampaigns(userId, { format: format as 'csv' });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error) {
    next(error);
  }
}

// Export analytics
export async function exportAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const format = (req.query.format as string) || 'csv';
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const result = await exportService.exportAnalytics(userId, {
      format: format as 'csv',
      startDate,
      endDate,
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error) {
    next(error);
  }
}

// Export to Google Sheets
export async function exportToGoogleSheets(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const { dataType, accessToken, refreshToken, spreadsheetId, sheetName } = req.body;

    if (!dataType || !accessToken) {
      return res.status(400).json({
        success: false,
        error: { message: 'dataType and accessToken are required' },
      });
    }

    const result = await exportService.exportToGoogleSheets(
      userId,
      dataType,
      { accessToken, refreshToken },
      { spreadsheetId, sheetName }
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// Get Google OAuth URL
export async function getGoogleAuthUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const redirectUri = req.query.redirectUri as string;

    if (!redirectUri) {
      return res.status(400).json({
        success: false,
        error: { message: 'redirectUri is required' },
      });
    }

    const url = exportService.getGoogleAuthUrl(redirectUri);

    res.json({
      success: true,
      data: { url },
    });
  } catch (error) {
    next(error);
  }
}

// Exchange Google auth code for tokens
export async function exchangeGoogleCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({
        success: false,
        error: { message: 'code and redirectUri are required' },
      });
    }

    const tokens = await exportService.getGoogleTokens(code, redirectUri);

    res.json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    next(error);
  }
}
