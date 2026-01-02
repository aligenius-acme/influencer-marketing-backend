import { ContentSubmission, IContentSubmission, IFeedback, IContentFile } from '../models/ContentSubmission.js';
import { SavedInfluencer } from '../models/SavedInfluencer.js';
import { BadRequestError, NotFoundError } from '../middlewares/errorHandler.js';
import mongoose from 'mongoose';

interface CreateSubmissionInput {
  campaignId: string;
  influencerId: string;
  title: string;
  description?: string;
  contentType?: 'post' | 'story' | 'reel' | 'video' | 'blog' | 'other';
  dueDate?: Date;
  files?: Array<{
    type: 'image' | 'video' | 'document' | 'link';
    url: string;
    filename: string;
    mimeType?: string;
    size?: number;
    thumbnailUrl?: string;
  }>;
  externalLinks?: Array<{
    platform: string;
    url: string;
    label?: string;
  }>;
  metadata?: {
    hashtags?: string[];
    mentions?: string[];
    caption?: string;
  };
}

interface UpdateSubmissionInput {
  title?: string;
  description?: string;
  contentType?: 'post' | 'story' | 'reel' | 'video' | 'blog' | 'other';
  dueDate?: Date;
  files?: Array<{
    type: 'image' | 'video' | 'document' | 'link';
    url: string;
    filename: string;
    mimeType?: string;
    size?: number;
    thumbnailUrl?: string;
  }>;
  externalLinks?: Array<{
    platform: string;
    url: string;
    label?: string;
  }>;
  metadata?: {
    hashtags?: string[];
    mentions?: string[];
    caption?: string;
  };
}

interface SubmissionFilters {
  campaignId?: string;
  influencerId?: string;
  status?: string;
  contentType?: string;
  search?: string;
}

type SubmissionStatus = 'draft' | 'submitted' | 'in_review' | 'revision_requested' | 'approved' | 'rejected' | 'published';

class ContentApprovalService {
  /**
   * Create a new content submission
   */
  async createSubmission(
    userId: string,
    input: CreateSubmissionInput
  ): Promise<IContentSubmission> {
    // Get influencer details
    const influencer = await SavedInfluencer.findOne({
      _id: input.influencerId,
      userId,
    });

    if (!influencer) {
      throw NotFoundError('Influencer not found in your saved list');
    }

    const files: IContentFile[] = (input.files || []).map(file => ({
      _id: new mongoose.Types.ObjectId(),
      type: file.type,
      url: file.url,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      thumbnailUrl: file.thumbnailUrl,
      uploadedAt: new Date(),
    }));

    const submission = new ContentSubmission({
      userId,
      campaignId: input.campaignId,
      influencerId: input.influencerId,
      influencerDetails: {
        username: influencer.profile.username,
        displayName: influencer.profile.displayName,
        platform: influencer.platform,
        profileImage: influencer.profile.profileImage,
      },
      title: input.title,
      description: input.description,
      contentType: input.contentType || 'post',
      status: 'draft',
      files,
      externalLinks: input.externalLinks,
      metadata: input.metadata,
      dueDate: input.dueDate,
      feedback: [],
      revisionNumber: 1,
    });

    await submission.save();
    return submission;
  }

  /**
   * Get all submissions for a user
   */
  async getSubmissions(
    userId: string,
    filters: SubmissionFilters = {},
    page = 1,
    limit = 20
  ): Promise<{
    submissions: IContentSubmission[];
    total: number;
    hasMore: boolean;
  }> {
    const query: any = { userId };

    if (filters.campaignId) {
      query.campaignId = filters.campaignId;
    }

    if (filters.influencerId) {
      query.influencerId = filters.influencerId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.contentType) {
      query.contentType = filters.contentType;
    }

    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { 'influencerDetails.username': { $regex: filters.search, $options: 'i' } },
        { 'influencerDetails.displayName': { $regex: filters.search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      ContentSubmission.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      ContentSubmission.countDocuments(query),
    ]);

    return {
      submissions,
      total,
      hasMore: skip + submissions.length < total,
    };
  }

  /**
   * Get a single submission
   */
  async getSubmission(userId: string, submissionId: string): Promise<IContentSubmission> {
    const submission = await ContentSubmission.findOne({
      _id: submissionId,
      userId,
    });

    if (!submission) {
      throw NotFoundError('Content submission not found');
    }

    return submission;
  }

  /**
   * Update a submission
   */
  async updateSubmission(
    userId: string,
    submissionId: string,
    input: UpdateSubmissionInput
  ): Promise<IContentSubmission> {
    const submission = await ContentSubmission.findOne({
      _id: submissionId,
      userId,
    });

    if (!submission) {
      throw NotFoundError('Content submission not found');
    }

    // Only allow updates if not approved or published
    if (['approved', 'published'].includes(submission.status)) {
      throw BadRequestError('Cannot update approved or published content');
    }

    if (input.title) submission.title = input.title;
    if (input.description !== undefined) submission.description = input.description;
    if (input.contentType) submission.contentType = input.contentType;
    if (input.dueDate) submission.dueDate = input.dueDate;
    if (input.externalLinks) submission.externalLinks = input.externalLinks;
    if (input.metadata) submission.metadata = input.metadata;

    if (input.files) {
      submission.files = input.files.map(file => ({
        _id: new mongoose.Types.ObjectId(),
        type: file.type,
        url: file.url,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        thumbnailUrl: file.thumbnailUrl,
        uploadedAt: new Date(),
      })) as any;
    }

    await submission.save();
    return submission;
  }

  /**
   * Submit content for review
   */
  async submitForReview(userId: string, submissionId: string): Promise<IContentSubmission> {
    const submission = await ContentSubmission.findOne({
      _id: submissionId,
      userId,
    });

    if (!submission) {
      throw NotFoundError('Content submission not found');
    }

    if (!['draft', 'revision_requested'].includes(submission.status)) {
      throw BadRequestError('Content can only be submitted from draft or revision requested status');
    }

    if (submission.files.length === 0 && (!submission.externalLinks || submission.externalLinks.length === 0)) {
      throw BadRequestError('Please add at least one file or external link before submitting');
    }

    submission.status = 'submitted';
    submission.submittedAt = new Date();

    await submission.save();
    return submission;
  }

  /**
   * Start reviewing content
   */
  async startReview(userId: string, submissionId: string): Promise<IContentSubmission> {
    const submission = await ContentSubmission.findOne({
      _id: submissionId,
      userId,
    });

    if (!submission) {
      throw NotFoundError('Content submission not found');
    }

    if (submission.status !== 'submitted') {
      throw BadRequestError('Can only review submitted content');
    }

    submission.status = 'in_review';
    submission.reviewedAt = new Date();

    await submission.save();
    return submission;
  }

  /**
   * Request revisions
   */
  async requestRevision(
    userId: string,
    submissionId: string,
    feedbackContent: string
  ): Promise<IContentSubmission> {
    const submission = await ContentSubmission.findOne({
      _id: submissionId,
      userId,
    });

    if (!submission) {
      throw NotFoundError('Content submission not found');
    }

    if (!['submitted', 'in_review'].includes(submission.status)) {
      throw BadRequestError('Can only request revisions for submitted or in-review content');
    }

    // Add feedback
    const feedback: Partial<IFeedback> = {
      _id: new mongoose.Types.ObjectId(),
      authorId: userId,
      authorType: 'brand',
      content: feedbackContent,
      createdAt: new Date(),
    };

    submission.feedback.push(feedback as IFeedback);
    submission.status = 'revision_requested';
    submission.revisionNumber += 1;

    await submission.save();
    return submission;
  }

  /**
   * Approve content
   */
  async approveContent(
    userId: string,
    submissionId: string,
    feedbackContent?: string
  ): Promise<IContentSubmission> {
    const submission = await ContentSubmission.findOne({
      _id: submissionId,
      userId,
    });

    if (!submission) {
      throw NotFoundError('Content submission not found');
    }

    if (!['submitted', 'in_review'].includes(submission.status)) {
      throw BadRequestError('Can only approve submitted or in-review content');
    }

    // Add approval feedback if provided
    if (feedbackContent) {
      const feedback: Partial<IFeedback> = {
        _id: new mongoose.Types.ObjectId(),
        authorId: userId,
        authorType: 'brand',
        content: feedbackContent,
        createdAt: new Date(),
      };
      submission.feedback.push(feedback as IFeedback);
    }

    submission.status = 'approved';
    submission.approvedAt = new Date();

    await submission.save();
    return submission;
  }

  /**
   * Reject content
   */
  async rejectContent(
    userId: string,
    submissionId: string,
    feedbackContent: string
  ): Promise<IContentSubmission> {
    const submission = await ContentSubmission.findOne({
      _id: submissionId,
      userId,
    });

    if (!submission) {
      throw NotFoundError('Content submission not found');
    }

    if (!['submitted', 'in_review'].includes(submission.status)) {
      throw BadRequestError('Can only reject submitted or in-review content');
    }

    // Add rejection feedback
    const feedback: Partial<IFeedback> = {
      _id: new mongoose.Types.ObjectId(),
      authorId: userId,
      authorType: 'brand',
      content: feedbackContent,
      createdAt: new Date(),
    };

    submission.feedback.push(feedback as IFeedback);
    submission.status = 'rejected';

    await submission.save();
    return submission;
  }

  /**
   * Mark content as published
   */
  async markAsPublished(
    userId: string,
    submissionId: string,
    publishedUrl?: string
  ): Promise<IContentSubmission> {
    const submission = await ContentSubmission.findOne({
      _id: submissionId,
      userId,
    });

    if (!submission) {
      throw NotFoundError('Content submission not found');
    }

    if (submission.status !== 'approved') {
      throw BadRequestError('Only approved content can be marked as published');
    }

    submission.status = 'published';
    submission.publishedAt = new Date();
    if (publishedUrl) {
      submission.publishedUrl = publishedUrl;
    }

    await submission.save();
    return submission;
  }

  /**
   * Add feedback to a submission
   */
  async addFeedback(
    userId: string,
    submissionId: string,
    content: string,
    attachments?: Array<{ type: 'image' | 'document'; url: string; filename: string }>
  ): Promise<IContentSubmission> {
    const submission = await ContentSubmission.findOne({
      _id: submissionId,
      userId,
    });

    if (!submission) {
      throw NotFoundError('Content submission not found');
    }

    const feedback: Partial<IFeedback> = {
      _id: new mongoose.Types.ObjectId(),
      authorId: userId,
      authorType: 'brand',
      content,
      attachments,
      createdAt: new Date(),
    };

    submission.feedback.push(feedback as IFeedback);
    await submission.save();

    return submission;
  }

  /**
   * Delete a submission
   */
  async deleteSubmission(userId: string, submissionId: string): Promise<void> {
    const result = await ContentSubmission.deleteOne({
      _id: submissionId,
      userId,
    });

    if (result.deletedCount === 0) {
      throw NotFoundError('Content submission not found');
    }
  }

  /**
   * Get submission statistics
   */
  async getStats(userId: string, campaignId?: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byContentType: Record<string, number>;
    pendingReview: number;
    approved: number;
    published: number;
  }> {
    const matchStage: any = { userId };
    if (campaignId) {
      matchStage.campaignId = campaignId;
    }

    const [statusStats, typeStats] = await Promise.all([
      ContentSubmission.aggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      ContentSubmission.aggregate([
        { $match: matchStage },
        { $group: { _id: '$contentType', count: { $sum: 1 } } },
      ]),
    ]);

    const byStatus: Record<string, number> = {};
    let total = 0;
    statusStats.forEach((s) => {
      byStatus[s._id] = s.count;
      total += s.count;
    });

    const byContentType: Record<string, number> = {};
    typeStats.forEach((t) => {
      byContentType[t._id] = t.count;
    });

    return {
      total,
      byStatus,
      byContentType,
      pendingReview: (byStatus['submitted'] || 0) + (byStatus['in_review'] || 0),
      approved: byStatus['approved'] || 0,
      published: byStatus['published'] || 0,
    };
  }

  /**
   * Get submissions for a specific campaign
   */
  async getCampaignSubmissions(
    userId: string,
    campaignId: string
  ): Promise<IContentSubmission[]> {
    return ContentSubmission.find({
      userId,
      campaignId,
    }).sort({ updatedAt: -1 });
  }

  /**
   * Revert to draft status
   */
  async revertToDraft(userId: string, submissionId: string): Promise<IContentSubmission> {
    const submission = await ContentSubmission.findOne({
      _id: submissionId,
      userId,
    });

    if (!submission) {
      throw NotFoundError('Content submission not found');
    }

    if (['approved', 'published'].includes(submission.status)) {
      throw BadRequestError('Cannot revert approved or published content to draft');
    }

    submission.status = 'draft';
    await submission.save();

    return submission;
  }
}

export const contentApprovalService = new ContentApprovalService();
