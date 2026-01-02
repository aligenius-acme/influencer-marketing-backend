import { SavedInfluencer, ISavedInfluencer } from '../models/SavedInfluencer.js';
import { InfluencerList } from '../models/InfluencerList.js';
import { BadRequestError } from '../middlewares/errorHandler.js';
import { Types } from 'mongoose';

// CSV column definitions for export
const EXPORT_COLUMNS = [
  'username',
  'display_name',
  'platform',
  'followers',
  'following',
  'engagement_rate',
  'avg_likes',
  'avg_comments',
  'verified',
  'bio',
  'location',
  'niches',
  'profile_url',
  'contact_email',
  'rate_per_post',
  'notes',
  'tags',
  'is_favorite',
  'lists',
  'created_at',
];

// Required columns for import
const REQUIRED_IMPORT_COLUMNS = ['username', 'platform'];

// Valid platforms
const VALID_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'twitter'];

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
  duplicates: number;
}

interface ParsedInfluencer {
  username: string;
  displayName?: string;
  platform: string;
  followers?: number;
  following?: number;
  engagementRate?: number;
  avgLikes?: number;
  avgComments?: number;
  verified?: boolean;
  bio?: string;
  location?: string;
  niches?: string[];
  profileUrl?: string;
  contactEmail?: string;
  ratePerPost?: number;
  notes?: string;
  tags?: string[];
  isFavorite?: boolean;
}

class CsvImportExportService {
  /**
   * Export saved influencers to CSV format
   */
  async exportToCsv(userId: string, options: {
    listId?: string;
    favoritesOnly?: boolean;
    platform?: string;
  } = {}): Promise<string> {
    // Build query
    const query: any = { userId };

    if (options.listId) {
      query.lists = new Types.ObjectId(options.listId);
    }

    if (options.favoritesOnly) {
      query.isFavorite = true;
    }

    if (options.platform) {
      query.platform = options.platform;
    }

    // Fetch influencers
    const influencers = await SavedInfluencer.find(query)
      .populate('lists', 'name')
      .sort({ createdAt: -1 });

    if (influencers.length === 0) {
      throw BadRequestError('No influencers found to export');
    }

    // Generate CSV
    const rows: string[] = [];

    // Header row
    rows.push(EXPORT_COLUMNS.join(','));

    // Data rows
    for (const inf of influencers) {
      const listNames = (inf.lists as any[])
        .map((l: any) => l.name || '')
        .filter(Boolean)
        .join('; ');

      const customFields = (inf.customFields as unknown as Map<string, any>) || new Map();

      const row = [
        this.escapeCSV(inf.profile.username),
        this.escapeCSV(inf.profile.displayName),
        inf.platform,
        inf.profile.followers,
        inf.profile.following,
        inf.profile.engagementRate.toFixed(2),
        inf.profile.avgLikes,
        inf.profile.avgComments,
        inf.profile.verified ? 'Yes' : 'No',
        this.escapeCSV(inf.profile.bio),
        this.escapeCSV(inf.profile.location || ''),
        this.escapeCSV(inf.profile.niches.join('; ')),
        this.escapeCSV(inf.profile.profileUrl),
        this.escapeCSV(customFields.get('contactEmail') || ''),
        customFields.get('ratePerPost') || '',
        this.escapeCSV(inf.notes),
        this.escapeCSV(inf.tags.join('; ')),
        inf.isFavorite ? 'Yes' : 'No',
        this.escapeCSV(listNames),
        inf.createdAt.toISOString(),
      ];

      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Parse CSV content and validate
   */
  parseCsv(csvContent: string): { headers: string[]; rows: string[][] } {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
      throw BadRequestError('CSV file must have a header row and at least one data row');
    }

    const headers = this.parseCSVRow(lines[0]).map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));
    const rows = lines.slice(1).map(line => this.parseCSVRow(line));

    // Validate required columns
    for (const required of REQUIRED_IMPORT_COLUMNS) {
      if (!headers.includes(required)) {
        throw BadRequestError(`Missing required column: ${required}`);
      }
    }

    return { headers, rows };
  }

  /**
   * Import influencers from parsed CSV data
   */
  async importFromCsv(
    userId: string,
    headers: string[],
    rows: string[][],
    options: {
      skipDuplicates?: boolean;
      defaultTags?: string[];
      listId?: string;
    } = {}
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      duplicates: 0,
    };

    // Get column indices
    const colIndex = (name: string) => headers.indexOf(name);

    // Validate list exists if specified
    let targetList = null;
    if (options.listId) {
      targetList = await InfluencerList.findOne({
        _id: options.listId,
        userId,
      });

      if (!targetList) {
        throw BadRequestError('Target list not found');
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for 1-indexed and header row

      try {
        // Parse row data
        const parsed = this.parseRow(headers, row, colIndex);

        // Validate required fields
        if (!parsed.username) {
          result.errors.push({ row: rowNum, error: 'Missing username' });
          result.failed++;
          continue;
        }

        if (!parsed.platform || !VALID_PLATFORMS.includes(parsed.platform.toLowerCase())) {
          result.errors.push({ row: rowNum, error: `Invalid platform: ${parsed.platform}. Must be one of: ${VALID_PLATFORMS.join(', ')}` });
          result.failed++;
          continue;
        }

        const platform = parsed.platform.toLowerCase() as 'instagram' | 'tiktok' | 'youtube' | 'twitter';

        // Check for existing
        const existing = await SavedInfluencer.findOne({
          userId,
          'profile.username': parsed.username.toLowerCase(),
          platform,
        });

        if (existing) {
          if (options.skipDuplicates) {
            result.duplicates++;
            continue;
          } else {
            // Update existing
            existing.profile.displayName = parsed.displayName || existing.profile.displayName;
            existing.profile.followers = parsed.followers ?? existing.profile.followers;
            existing.profile.following = parsed.following ?? existing.profile.following;
            existing.profile.engagementRate = parsed.engagementRate ?? existing.profile.engagementRate;
            existing.profile.avgLikes = parsed.avgLikes ?? existing.profile.avgLikes;
            existing.profile.avgComments = parsed.avgComments ?? existing.profile.avgComments;
            existing.profile.verified = parsed.verified ?? existing.profile.verified;
            existing.profile.bio = parsed.bio || existing.profile.bio;
            existing.profile.location = parsed.location || existing.profile.location;
            existing.profile.profileUrl = parsed.profileUrl || existing.profile.profileUrl;

            if (parsed.niches?.length) {
              existing.profile.niches = [...new Set([...existing.profile.niches, ...parsed.niches])];
            }

            if (parsed.notes) {
              existing.notes = parsed.notes;
            }

            if (parsed.tags?.length) {
              existing.tags = [...new Set([...existing.tags, ...parsed.tags, ...(options.defaultTags || [])])];
            }

            if (parsed.contactEmail) {
              (existing.customFields as unknown as Map<string, any>).set('contactEmail', parsed.contactEmail);
            }

            if (parsed.ratePerPost) {
              (existing.customFields as unknown as Map<string, any>).set('ratePerPost', parsed.ratePerPost);
            }

            if (parsed.isFavorite !== undefined) {
              existing.isFavorite = parsed.isFavorite;
            }

            // Add to target list if specified
            if (targetList && !existing.lists.some(l => l.toString() === options.listId)) {
              existing.lists.push(targetList._id);
            }

            await existing.save();
            result.success++;
            continue;
          }
        }

        // Create new influencer
        const newInfluencer = new SavedInfluencer({
          userId,
          scrapcreatorsId: `imported_${Date.now()}_${i}`,
          platform,
          profile: {
            username: parsed.username.toLowerCase(),
            displayName: parsed.displayName || parsed.username,
            bio: parsed.bio || '',
            profileImage: '',
            profileUrl: parsed.profileUrl || this.generateProfileUrl(parsed.username, platform),
            followers: parsed.followers || 0,
            following: parsed.following || 0,
            postsCount: 0,
            engagementRate: parsed.engagementRate || 0,
            avgLikes: parsed.avgLikes || 0,
            avgComments: parsed.avgComments || 0,
            verified: parsed.verified || false,
            location: parsed.location,
            niches: parsed.niches || [],
          },
          notes: parsed.notes || '',
          tags: [...(parsed.tags || []), ...(options.defaultTags || [])],
          customFields: new Map<string, any>([
            ...(parsed.contactEmail ? [['contactEmail', parsed.contactEmail] as [string, string]] : []),
            ...(parsed.ratePerPost ? [['ratePerPost', parsed.ratePerPost] as [string, number]] : []),
          ]),
          isFavorite: parsed.isFavorite ?? true,
          lists: targetList ? [targetList._id] : [],
          lastSynced: new Date(),
        });

        await newInfluencer.save();

        // Update list count
        if (targetList) {
          await InfluencerList.findByIdAndUpdate(targetList._id, {
            $inc: { influencerCount: 1 },
          });
        }

        result.success++;
      } catch (error: any) {
        result.errors.push({ row: rowNum, error: error.message || 'Unknown error' });
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Get CSV template for import
   */
  getImportTemplate(): string {
    const headers = [
      'username',
      'display_name',
      'platform',
      'followers',
      'engagement_rate',
      'bio',
      'location',
      'niches',
      'profile_url',
      'contact_email',
      'rate_per_post',
      'notes',
      'tags',
    ];

    const exampleRow = [
      'example_user',
      'Example User',
      'instagram',
      '50000',
      '3.5',
      'Fashion & lifestyle blogger',
      'New York, USA',
      'fashion; lifestyle; beauty',
      'https://instagram.com/example_user',
      'contact@example.com',
      '500',
      'Met at conference',
      'fashion; priority',
    ];

    return [headers.join(','), exampleRow.join(',')].join('\n');
  }

  /**
   * Validate CSV before import (dry run)
   */
  async validateCsv(
    userId: string,
    headers: string[],
    rows: string[][]
  ): Promise<{
    valid: number;
    invalid: number;
    duplicates: number;
    errors: Array<{ row: number; error: string }>;
    preview: Array<{
      row: number;
      username: string;
      platform: string;
      status: 'new' | 'duplicate' | 'invalid';
    }>;
  }> {
    const result = {
      valid: 0,
      invalid: 0,
      duplicates: 0,
      errors: [] as Array<{ row: number; error: string }>,
      preview: [] as Array<{
        row: number;
        username: string;
        platform: string;
        status: 'new' | 'duplicate' | 'invalid';
      }>,
    };

    const colIndex = (name: string) => headers.indexOf(name);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const username = row[colIndex('username')]?.trim() || '';
      const platform = row[colIndex('platform')]?.trim().toLowerCase() || '';

      if (!username) {
        result.errors.push({ row: rowNum, error: 'Missing username' });
        result.invalid++;
        result.preview.push({ row: rowNum, username: '(empty)', platform, status: 'invalid' });
        continue;
      }

      if (!VALID_PLATFORMS.includes(platform)) {
        result.errors.push({ row: rowNum, error: `Invalid platform: ${platform}` });
        result.invalid++;
        result.preview.push({ row: rowNum, username, platform, status: 'invalid' });
        continue;
      }

      // Check for duplicate
      const existing = await SavedInfluencer.findOne({
        userId,
        'profile.username': username.toLowerCase(),
        platform,
      });

      if (existing) {
        result.duplicates++;
        result.preview.push({ row: rowNum, username, platform, status: 'duplicate' });
      } else {
        result.valid++;
        result.preview.push({ row: rowNum, username, platform, status: 'new' });
      }
    }

    return result;
  }

  // ==================== Private Helper Methods ====================

  /**
   * Escape a value for CSV
   */
  private escapeCSV(value: string): string {
    if (!value) return '';
    // If value contains comma, newline, or quote, wrap in quotes and escape existing quotes
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Parse a single CSV row handling quoted values
   */
  private parseCSVRow(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Parse a row into an influencer object
   */
  private parseRow(
    headers: string[],
    row: string[],
    colIndex: (name: string) => number
  ): ParsedInfluencer {
    const getValue = (name: string): string => {
      const idx = colIndex(name);
      return idx >= 0 ? (row[idx] || '').trim() : '';
    };

    const getNumber = (name: string): number | undefined => {
      const val = getValue(name);
      const num = parseFloat(val);
      return isNaN(num) ? undefined : num;
    };

    const getBool = (name: string): boolean | undefined => {
      const val = getValue(name).toLowerCase();
      if (val === 'yes' || val === 'true' || val === '1') return true;
      if (val === 'no' || val === 'false' || val === '0') return false;
      return undefined;
    };

    const getArray = (name: string): string[] => {
      const val = getValue(name);
      if (!val) return [];
      return val.split(/[;,]/).map(s => s.trim()).filter(Boolean);
    };

    return {
      username: getValue('username'),
      displayName: getValue('display_name') || getValue('displayname') || getValue('name'),
      platform: getValue('platform'),
      followers: getNumber('followers'),
      following: getNumber('following'),
      engagementRate: getNumber('engagement_rate') || getNumber('engagementrate'),
      avgLikes: getNumber('avg_likes') || getNumber('avglikes'),
      avgComments: getNumber('avg_comments') || getNumber('avgcomments'),
      verified: getBool('verified'),
      bio: getValue('bio') || getValue('description'),
      location: getValue('location') || getValue('country'),
      niches: getArray('niches') || getArray('categories') || getArray('niche'),
      profileUrl: getValue('profile_url') || getValue('profileurl') || getValue('url'),
      contactEmail: getValue('contact_email') || getValue('email'),
      ratePerPost: getNumber('rate_per_post') || getNumber('rate'),
      notes: getValue('notes'),
      tags: getArray('tags'),
      isFavorite: getBool('is_favorite') || getBool('favorite'),
    };
  }

  /**
   * Generate profile URL from username and platform
   */
  private generateProfileUrl(username: string, platform: string): string {
    const urls: Record<string, string> = {
      instagram: `https://instagram.com/${username}`,
      tiktok: `https://tiktok.com/@${username}`,
      youtube: `https://youtube.com/@${username}`,
      twitter: `https://twitter.com/${username}`,
    };
    return urls[platform] || '';
  }
}

export const csvImportExportService = new CsvImportExportService();
