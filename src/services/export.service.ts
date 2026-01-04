/**
 * Export Service
 *
 * Handles data export to various formats including Google Sheets
 */

import { google } from 'googleapis';
import { prisma } from '../config/postgres.js';
import { SavedInfluencer } from '../models/SavedInfluencer.js';
import { Campaign } from '@prisma/client';

// Types for export data
interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

interface ExportOptions {
  format: 'csv' | 'xlsx' | 'google_sheets';
  columns?: string[];
  filters?: Record<string, unknown>;
}

interface GoogleSheetsAuth {
  accessToken: string;
  refreshToken?: string;
}

class ExportService {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  // ==================== Influencer Export ====================

  async exportInfluencers(
    userId: string,
    options: ExportOptions
  ): Promise<{ data: string; filename: string; mimeType: string } | { spreadsheetId: string; url: string }> {
    const influencers = await SavedInfluencer.find({ userId });

    const columns: ExportColumn[] = [
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Display Name', key: 'displayName', width: 25 },
      { header: 'Platform', key: 'platform', width: 12 },
      { header: 'Followers', key: 'followers', width: 15 },
      { header: 'Engagement Rate', key: 'engagementRate', width: 15 },
      { header: 'Bio', key: 'bio', width: 40 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Tags', key: 'tags', width: 30 },
      { header: 'Notes', key: 'notes', width: 40 },
      { header: 'Is Favorite', key: 'isFavorite', width: 12 },
      { header: 'Added Date', key: 'createdAt', width: 20 },
    ];

    const rows = influencers.map(inf => ({
      username: inf.profile.username || '',
      displayName: inf.profile.displayName || '',
      platform: inf.platform,
      followers: inf.profile.followers || 0,
      engagementRate: inf.profile.engagementRate ? `${inf.profile.engagementRate}%` : '',
      bio: inf.profile.bio || '',
      email: (inf.customFields?.email as string) || (inf.customFields?.contactEmail as string) || '',
      tags: inf.tags.join(', '),
      notes: inf.notes || '',
      isFavorite: inf.isFavorite ? 'Yes' : 'No',
      createdAt: inf.createdAt.toISOString().split('T')[0],
    }));

    if (options.format === 'csv') {
      return this.generateCSV(columns, rows, 'influencers');
    }

    throw new Error(`Export format ${options.format} not supported for influencers`);
  }

  // ==================== Campaign Export ====================

  async exportCampaigns(
    userId: string,
    options: ExportOptions
  ): Promise<{ data: string; filename: string; mimeType: string }> {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        _count: { select: { influencers: true } },
      },
    });

    const columns: ExportColumn[] = [
      { header: 'Campaign Name', key: 'name', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Platform', key: 'platform', width: 12 },
      { header: 'Budget', key: 'budget', width: 15 },
      { header: 'Start Date', key: 'startDate', width: 15 },
      { header: 'End Date', key: 'endDate', width: 15 },
      { header: 'Influencers', key: 'influencerCount', width: 12 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Created', key: 'createdAt', width: 15 },
    ];

    const rows = campaigns.map(c => ({
      name: c.name,
      status: c.status,
      platform: c.platform || '',
      budget: c.budget ? `${c.currency || 'USD'} ${c.budget}` : '',
      startDate: c.startDate ? c.startDate.toISOString().split('T')[0] : '',
      endDate: c.endDate ? c.endDate.toISOString().split('T')[0] : '',
      influencerCount: c._count.influencers,
      description: c.description || '',
      createdAt: c.createdAt.toISOString().split('T')[0],
    }));

    if (options.format === 'csv') {
      return this.generateCSV(columns, rows, 'campaigns');
    }

    throw new Error(`Export format ${options.format} not supported for campaigns`);
  }

  // ==================== Analytics Export ====================

  async exportAnalytics(
    userId: string,
    options: ExportOptions & { startDate?: Date; endDate?: Date }
  ): Promise<{ data: string; filename: string; mimeType: string }> {
    const campaigns = await prisma.campaign.findMany({
      where: {
        userId,
        createdAt: {
          gte: options.startDate,
          lte: options.endDate,
        },
      },
      include: {
        influencers: true,
      },
    });

    const columns: ExportColumn[] = [
      { header: 'Campaign', key: 'campaign', width: 30 },
      { header: 'Total Influencers', key: 'totalInfluencers', width: 15 },
      { header: 'Completed', key: 'completed', width: 12 },
      { header: 'In Progress', key: 'inProgress', width: 12 },
      { header: 'Total Budget', key: 'budget', width: 15 },
      { header: 'Spent', key: 'spent', width: 15 },
      { header: 'ROI', key: 'roi', width: 12 },
    ];

    const rows = campaigns.map(c => {
      const completed = c.influencers.filter(i => i.status === 'COMPLETED').length;
      const inProgress = c.influencers.filter(i => ['CONTENT_PENDING', 'CONTENT_SUBMITTED', 'APPROVED'].includes(i.status)).length;
      const spent = c.influencers.reduce((sum, i) => sum + (i.agreedRate?.toNumber() || 0), 0);
      const budget = c.budget?.toNumber() || 0;

      return {
        campaign: c.name,
        totalInfluencers: c.influencers.length,
        completed,
        inProgress,
        budget: budget ? `${c.currency || 'USD'} ${budget}` : '',
        spent: spent ? `${c.currency || 'USD'} ${spent}` : '',
        roi: budget > 0 ? `${((spent / budget) * 100).toFixed(1)}%` : 'N/A',
      };
    });

    if (options.format === 'csv') {
      return this.generateCSV(columns, rows, 'analytics');
    }

    throw new Error(`Export format ${options.format} not supported for analytics`);
  }

  // ==================== Google Sheets Integration ====================

  /**
   * Export data directly to Google Sheets
   * Requires Google OAuth tokens
   */
  async exportToGoogleSheets(
    userId: string,
    dataType: 'influencers' | 'campaigns' | 'analytics',
    auth: GoogleSheetsAuth,
    options?: { spreadsheetId?: string; sheetName?: string }
  ): Promise<{ spreadsheetId: string; url: string }> {
    // Check if Google credentials are configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      // Mock mode - return a simulated response
      if (this.isDevelopment) {
        console.log('\n========== GOOGLE SHEETS EXPORT ===========');
        console.log(`Data Type: ${dataType}`);
        console.log(`User: ${userId}`);
        console.log('Note: Google Sheets API credentials not configured');
        console.log('In production, this would create/update a Google Sheet');
        console.log('=============================================\n');

        return {
          spreadsheetId: 'mock-spreadsheet-id',
          url: 'https://docs.google.com/spreadsheets/d/mock-spreadsheet-id/edit',
        };
      }
      throw new Error('Google Sheets API not configured');
    }

    // Real implementation with Google Sheets API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: auth.accessToken,
      refresh_token: auth.refreshToken,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Get data based on type
    let data: unknown[][];
    let title: string;

    switch (dataType) {
      case 'influencers': {
        const result = await this.exportInfluencers(userId, { format: 'csv' }) as { data: string };
        data = this.csvToArray(result.data);
        title = 'Influencers Export';
        break;
      }
      case 'campaigns': {
        const result = await this.exportCampaigns(userId, { format: 'csv' });
        data = this.csvToArray(result.data);
        title = 'Campaigns Export';
        break;
      }
      case 'analytics': {
        const result = await this.exportAnalytics(userId, { format: 'csv' });
        data = this.csvToArray(result.data);
        title = 'Analytics Export';
        break;
      }
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }

    let spreadsheetId = options?.spreadsheetId;

    if (!spreadsheetId) {
      // Create new spreadsheet
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: [{ properties: { title: options?.sheetName || 'Data' } }],
        },
      });
      spreadsheetId = spreadsheet.data.spreadsheetId!;
    }

    // Update the sheet with data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${options?.sheetName || 'Sheet1'}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: data },
    });

    return {
      spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  }

  /**
   * Get Google OAuth authorization URL
   */
  getGoogleAuthUrl(redirectUri: string): string {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google API credentials not configured');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getGoogleTokens(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google API credentials not configured');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);

    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token || undefined,
    };
  }

  // ==================== CSV Generation ====================

  private generateCSV(
    columns: ExportColumn[],
    rows: Record<string, unknown>[],
    filename: string
  ): { data: string; filename: string; mimeType: string } {
    const headers = columns.map(c => this.escapeCSV(c.header)).join(',');
    const csvRows = rows.map(row =>
      columns.map(c => this.escapeCSV(String(row[c.key] ?? ''))).join(',')
    );

    const csv = [headers, ...csvRows].join('\n');

    return {
      data: csv,
      filename: `${filename}_${new Date().toISOString().split('T')[0]}.csv`,
      mimeType: 'text/csv',
    };
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private csvToArray(csv: string): unknown[][] {
    const lines = csv.split('\n');
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current);
      return result;
    });
  }
}

export const exportService = new ExportService();
