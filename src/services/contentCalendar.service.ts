/**
 * Content Calendar Service
 *
 * Manages scheduled posts, content calendar, and post scheduling
 */

import { ScheduledPost, IScheduledPost, PostPlatform, PostType, PostStatus } from '../models/ScheduledPost.js';
import { BrandGuidelines, IBrandGuidelines } from '../models/BrandGuidelines.js';

// ==================== Types ====================

export interface CreatePostInput {
  campaignId?: string;
  influencerId?: string;
  title: string;
  caption: string;
  mediaUrls?: string[];
  hashtags?: string[];
  mentions?: string[];
  platform: PostPlatform;
  postType: PostType;
  scheduledAt: Date;
  timezone?: string;
  hasDisclosure?: boolean;
  disclosureType?: 'ad' | 'sponsored' | 'paid_partnership' | 'gifted';
  notes?: string;
  tags?: string[];
}

export interface UpdatePostInput {
  title?: string;
  caption?: string;
  mediaUrls?: string[];
  hashtags?: string[];
  mentions?: string[];
  platform?: PostPlatform;
  postType?: PostType;
  scheduledAt?: Date;
  timezone?: string;
  status?: PostStatus;
  hasDisclosure?: boolean;
  disclosureType?: 'ad' | 'sponsored' | 'paid_partnership' | 'gifted';
  brandGuidelinesChecked?: boolean;
  complianceNotes?: string;
  notes?: string;
  tags?: string[];
}

export interface CalendarQuery {
  startDate: Date;
  endDate: Date;
  platform?: PostPlatform;
  status?: PostStatus;
  campaignId?: string;
  influencerId?: string;
}

export interface ComplianceCheckResult {
  isCompliant: boolean;
  score: number;
  issues: {
    severity: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    suggestion?: string;
  }[];
  checklist: {
    item: string;
    passed: boolean;
    required: boolean;
  }[];
}

// ==================== Service ====================

class ContentCalendarService {
  // ==================== Scheduled Posts ====================

  /**
   * Create a new scheduled post
   */
  async createPost(userId: string, input: CreatePostInput): Promise<IScheduledPost> {
    const post = new ScheduledPost({
      userId,
      ...input,
      status: 'draft',
    });

    await post.save();
    return post;
  }

  /**
   * Get scheduled posts for calendar view
   */
  async getCalendarPosts(userId: string, query: CalendarQuery): Promise<IScheduledPost[]> {
    const filter: Record<string, unknown> = {
      userId,
      scheduledAt: {
        $gte: query.startDate,
        $lte: query.endDate,
      },
    };

    if (query.platform) filter.platform = query.platform;
    if (query.status) filter.status = query.status;
    if (query.campaignId) filter.campaignId = query.campaignId;
    if (query.influencerId) filter.influencerId = query.influencerId;

    return ScheduledPost.find(filter).sort({ scheduledAt: 1 });
  }

  /**
   * Get a single post
   */
  async getPost(userId: string, postId: string): Promise<IScheduledPost | null> {
    return ScheduledPost.findOne({ _id: postId, userId });
  }

  /**
   * Update a scheduled post
   */
  async updatePost(userId: string, postId: string, input: UpdatePostInput): Promise<IScheduledPost | null> {
    const post = await ScheduledPost.findOneAndUpdate(
      { _id: postId, userId },
      { $set: input },
      { new: true }
    );
    return post;
  }

  /**
   * Delete a scheduled post
   */
  async deletePost(userId: string, postId: string): Promise<boolean> {
    const result = await ScheduledPost.deleteOne({ _id: postId, userId });
    return result.deletedCount > 0;
  }

  /**
   * Reschedule a post (drag-and-drop)
   */
  async reschedulePost(
    userId: string,
    postId: string,
    newDate: Date
  ): Promise<IScheduledPost | null> {
    return ScheduledPost.findOneAndUpdate(
      { _id: postId, userId },
      { $set: { scheduledAt: newDate } },
      { new: true }
    );
  }

  /**
   * Bulk reschedule posts
   */
  async bulkReschedule(
    userId: string,
    updates: { postId: string; scheduledAt: Date }[]
  ): Promise<number> {
    let updated = 0;
    for (const update of updates) {
      const result = await ScheduledPost.updateOne(
        { _id: update.postId, userId },
        { $set: { scheduledAt: update.scheduledAt } }
      );
      if (result.modifiedCount > 0) updated++;
    }
    return updated;
  }

  // ==================== Status Management ====================

  /**
   * Submit post for approval
   */
  async submitForApproval(userId: string, postId: string): Promise<IScheduledPost | null> {
    return ScheduledPost.findOneAndUpdate(
      { _id: postId, userId, status: 'draft' },
      { $set: { status: 'pending_approval' } },
      { new: true }
    );
  }

  /**
   * Approve a post
   */
  async approvePost(userId: string, postId: string, approverId: string): Promise<IScheduledPost | null> {
    return ScheduledPost.findOneAndUpdate(
      { _id: postId, userId, status: 'pending_approval' },
      {
        $set: {
          status: 'approved',
          approvedBy: approverId,
          approvedAt: new Date(),
        },
      },
      { new: true }
    );
  }

  /**
   * Reject a post
   */
  async rejectPost(
    userId: string,
    postId: string,
    reason: string
  ): Promise<IScheduledPost | null> {
    return ScheduledPost.findOneAndUpdate(
      { _id: postId, userId, status: 'pending_approval' },
      {
        $set: {
          status: 'draft',
          rejectionReason: reason,
        },
      },
      { new: true }
    );
  }

  /**
   * Schedule an approved post
   */
  async schedulePost(userId: string, postId: string): Promise<IScheduledPost | null> {
    return ScheduledPost.findOneAndUpdate(
      { _id: postId, userId, status: { $in: ['draft', 'approved'] } },
      { $set: { status: 'scheduled' } },
      { new: true }
    );
  }

  /**
   * Mark post as published
   */
  async markAsPublished(
    userId: string,
    postId: string,
    publishedUrl?: string
  ): Promise<IScheduledPost | null> {
    const updateData: Record<string, unknown> = {
      status: 'published',
      publishedAt: new Date(),
    };

    if (publishedUrl) {
      updateData.previewUrl = publishedUrl;
    }

    return ScheduledPost.findOneAndUpdate(
      { _id: postId, userId },
      { $set: updateData },
      { new: true }
    );
  }

  // ==================== Calendar Views ====================

  /**
   * Get posts grouped by date
   */
  async getPostsByDate(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, IScheduledPost[]>> {
    const posts = await this.getCalendarPosts(userId, { startDate, endDate });

    const grouped: Record<string, IScheduledPost[]> = {};
    for (const post of posts) {
      const dateKey = post.scheduledAt.toISOString().split('T')[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(post);
    }

    return grouped;
  }

  /**
   * Get upcoming posts
   */
  async getUpcomingPosts(userId: string, limit: number = 10): Promise<IScheduledPost[]> {
    return ScheduledPost.find({
      userId,
      scheduledAt: { $gte: new Date() },
      status: { $in: ['scheduled', 'approved'] },
    })
      .sort({ scheduledAt: 1 })
      .limit(limit);
  }

  /**
   * Get posts pending approval
   */
  async getPendingApproval(userId: string): Promise<IScheduledPost[]> {
    return ScheduledPost.find({
      userId,
      status: 'pending_approval',
    }).sort({ scheduledAt: 1 });
  }

  // ==================== Analytics ====================

  /**
   * Get calendar statistics
   */
  async getCalendarStats(userId: string, startDate: Date, endDate: Date) {
    const posts = await ScheduledPost.find({
      userId,
      scheduledAt: { $gte: startDate, $lte: endDate },
    });

    const stats = {
      total: posts.length,
      byStatus: {} as Record<string, number>,
      byPlatform: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      compliance: {
        withDisclosure: 0,
        guidelinesChecked: 0,
      },
    };

    for (const post of posts) {
      stats.byStatus[post.status] = (stats.byStatus[post.status] || 0) + 1;
      stats.byPlatform[post.platform] = (stats.byPlatform[post.platform] || 0) + 1;
      stats.byType[post.postType] = (stats.byType[post.postType] || 0) + 1;

      if (post.hasDisclosure) stats.compliance.withDisclosure++;
      if (post.brandGuidelinesChecked) stats.compliance.guidelinesChecked++;
    }

    return stats;
  }

  // ==================== Brand Guidelines Compliance ====================

  /**
   * Check post against brand guidelines
   */
  async checkCompliance(
    userId: string,
    postId: string
  ): Promise<ComplianceCheckResult> {
    const post = await this.getPost(userId, postId);
    if (!post) {
      throw new Error('Post not found');
    }

    const guidelines = await BrandGuidelines.findOne({ userId, isActive: true });

    const result: ComplianceCheckResult = {
      isCompliant: true,
      score: 100,
      issues: [],
      checklist: [],
    };

    // FTC Disclosure Check
    if (guidelines?.ftcDisclosureRequired) {
      const hasDisclosure = this.checkFtcDisclosure(post, guidelines);
      result.checklist.push({
        item: 'FTC Disclosure',
        passed: hasDisclosure,
        required: true,
      });
      if (!hasDisclosure) {
        result.issues.push({
          severity: 'error',
          category: 'legal',
          message: 'FTC disclosure is required but not found in caption',
          suggestion: `Add one of: ${guidelines.approvedDisclosures.join(', ')}`,
        });
        result.score -= 30;
      }
    }

    // Required Hashtags
    if (guidelines?.requiredHashtags?.length) {
      const missingHashtags = guidelines.requiredHashtags.filter(
        (tag) => !post.hashtags.includes(tag.replace('#', ''))
      );
      const hasTags = missingHashtags.length === 0;
      result.checklist.push({
        item: 'Required Hashtags',
        passed: hasTags,
        required: true,
      });
      if (!hasTags) {
        result.issues.push({
          severity: 'warning',
          category: 'brand',
          message: `Missing required hashtags: ${missingHashtags.join(', ')}`,
        });
        result.score -= 10;
      }
    }

    // Forbidden Words
    if (guidelines?.forbiddenWords?.length) {
      const foundForbidden = guidelines.forbiddenWords.filter((word) =>
        post.caption.toLowerCase().includes(word.toLowerCase())
      );
      const noForbidden = foundForbidden.length === 0;
      result.checklist.push({
        item: 'No Forbidden Words',
        passed: noForbidden,
        required: true,
      });
      if (!noForbidden) {
        result.issues.push({
          severity: 'error',
          category: 'content',
          message: `Caption contains forbidden words: ${foundForbidden.join(', ')}`,
          suggestion: 'Remove or replace these words',
        });
        result.score -= 20;
      }
    }

    // Competitor Mentions
    if (guidelines?.competitorBrands?.length) {
      const mentionsCompetitor = guidelines.competitorBrands.some(
        (comp) =>
          post.caption.toLowerCase().includes(comp.toLowerCase()) ||
          post.mentions.some((m) => m.toLowerCase().includes(comp.toLowerCase()))
      );
      result.checklist.push({
        item: 'No Competitor Mentions',
        passed: !mentionsCompetitor,
        required: true,
      });
      if (mentionsCompetitor) {
        result.issues.push({
          severity: 'error',
          category: 'brand',
          message: 'Content mentions competitor brands',
        });
        result.score -= 25;
      }
    }

    // Platform-specific rules
    const platformRule = guidelines?.platformRules?.find((r) => r.platform === post.platform);
    if (platformRule) {
      if (platformRule.maxHashtags && post.hashtags.length > platformRule.maxHashtags) {
        result.issues.push({
          severity: 'warning',
          category: 'content',
          message: `Too many hashtags (${post.hashtags.length}/${platformRule.maxHashtags})`,
        });
        result.score -= 5;
      }
      if (platformRule.captionMaxLength && post.caption.length > platformRule.captionMaxLength) {
        result.issues.push({
          severity: 'warning',
          category: 'content',
          message: `Caption too long (${post.caption.length}/${platformRule.captionMaxLength} chars)`,
        });
        result.score -= 5;
      }
    }

    // Custom checklist items
    if (guidelines?.checklistItems?.length) {
      for (const item of guidelines.checklistItems) {
        result.checklist.push({
          item: item.label,
          passed: false, // Manual check required
          required: item.required,
        });
      }
    }

    result.isCompliant = result.score >= 70 && !result.issues.some((i) => i.severity === 'error');

    return result;
  }

  /**
   * Check if FTC disclosure is present
   */
  private checkFtcDisclosure(post: IScheduledPost, guidelines: IBrandGuidelines): boolean {
    if (post.hasDisclosure) return true;

    const captionLower = post.caption.toLowerCase();
    const approvedDisclosures = guidelines.approvedDisclosures.map((d) => d.toLowerCase());

    // Check caption for approved disclosures
    for (const disclosure of approvedDisclosures) {
      if (captionLower.includes(disclosure)) {
        // Check position if required
        if (guidelines.disclosurePosition === 'beginning') {
          const index = captionLower.indexOf(disclosure);
          if (index <= 50) return true; // Within first 50 chars
        } else {
          return true;
        }
      }
    }

    // Check hashtags
    const hashtagsLower = post.hashtags.map((h) => h.toLowerCase());
    return approvedDisclosures.some((d) => hashtagsLower.includes(d.replace('#', '')));
  }
}

export const contentCalendarService = new ContentCalendarService();
