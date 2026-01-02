import { Types } from 'mongoose';
import { CustomFieldDefinition, ICustomFieldDefinition, FieldType } from '../models/CustomFieldDefinition.js';
import { CommunicationLog, ICommunicationLog, CommunicationType, CommunicationDirection, CommunicationStatus } from '../models/CommunicationLog.js';
import { InfluencerReview, IInfluencerReview, IRatingBreakdown } from '../models/InfluencerReview.js';
import { TagGroup, ITagGroup, DEFAULT_TAG_GROUPS } from '../models/TagGroup.js';
import { SavedInfluencer } from '../models/SavedInfluencer.js';
import { NotFoundError, BadRequestError } from '../middlewares/errorHandler.js';

// ==================== Custom Fields ====================

interface CreateCustomFieldInput {
  fieldName: string;
  fieldLabel: string;
  fieldType: FieldType;
  options?: { value: string; label: string; color?: string }[];
  defaultValue?: string | number | boolean;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
}

interface UpdateCustomFieldInput {
  fieldLabel?: string;
  options?: { value: string; label: string; color?: string }[];
  defaultValue?: string | number | boolean;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  order?: number;
  isActive?: boolean;
}

class IRMService {
  // ==================== Custom Fields ====================

  async getCustomFields(userId: string): Promise<ICustomFieldDefinition[]> {
    return CustomFieldDefinition.find({ userId, isActive: true }).sort({ order: 1 });
  }

  async getCustomFieldById(userId: string, fieldId: string): Promise<ICustomFieldDefinition> {
    const field = await CustomFieldDefinition.findOne({
      _id: new Types.ObjectId(fieldId),
      userId,
    });

    if (!field) {
      throw NotFoundError('Custom field not found');
    }

    return field;
  }

  async createCustomField(userId: string, input: CreateCustomFieldInput): Promise<ICustomFieldDefinition> {
    // Generate field name from label if not provided
    const fieldName = input.fieldName || input.fieldLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    // Check for duplicate field name
    const existing = await CustomFieldDefinition.findOne({ userId, fieldName });
    if (existing) {
      throw BadRequestError(`A field with name "${fieldName}" already exists`);
    }

    // Get the highest order number
    const lastField = await CustomFieldDefinition.findOne({ userId }).sort({ order: -1 });
    const order = lastField ? lastField.order + 1 : 0;

    const field = await CustomFieldDefinition.create({
      userId,
      fieldName,
      fieldLabel: input.fieldLabel,
      fieldType: input.fieldType,
      options: input.options || [],
      defaultValue: input.defaultValue,
      required: input.required || false,
      placeholder: input.placeholder,
      helpText: input.helpText,
      order,
    });

    return field;
  }

  async updateCustomField(
    userId: string,
    fieldId: string,
    input: UpdateCustomFieldInput
  ): Promise<ICustomFieldDefinition> {
    const field = await CustomFieldDefinition.findOneAndUpdate(
      { _id: new Types.ObjectId(fieldId), userId },
      { $set: input },
      { new: true }
    );

    if (!field) {
      throw NotFoundError('Custom field not found');
    }

    return field;
  }

  async deleteCustomField(userId: string, fieldId: string): Promise<void> {
    const result = await CustomFieldDefinition.findOneAndDelete({
      _id: new Types.ObjectId(fieldId),
      userId,
    });

    if (!result) {
      throw NotFoundError('Custom field not found');
    }
  }

  async reorderCustomFields(userId: string, fieldIds: string[]): Promise<void> {
    const updates = fieldIds.map((id, index) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(id), userId },
        update: { $set: { order: index } },
      },
    }));

    await CustomFieldDefinition.bulkWrite(updates);
  }

  // ==================== Communication Logs ====================

  async getCommunicationLogs(
    userId: string,
    filters: {
      savedInfluencerId?: string;
      campaignId?: string;
      type?: CommunicationType;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ logs: ICommunicationLog[]; total: number }> {
    const query: Record<string, unknown> = { userId };

    if (filters.savedInfluencerId) {
      query.savedInfluencerId = new Types.ObjectId(filters.savedInfluencerId);
    }
    if (filters.campaignId) {
      query.campaignId = filters.campaignId;
    }
    if (filters.type) {
      query.type = filters.type;
    }

    const [logs, total] = await Promise.all([
      CommunicationLog.find(query)
        .sort({ createdAt: -1 })
        .skip(filters.offset || 0)
        .limit(filters.limit || 50)
        .populate('savedInfluencerId', 'profile.username profile.displayName profile.profileImage platform'),
      CommunicationLog.countDocuments(query),
    ]);

    return { logs, total };
  }

  async getCommunicationLog(userId: string, logId: string): Promise<ICommunicationLog> {
    const log = await CommunicationLog.findOne({
      _id: new Types.ObjectId(logId),
      userId,
    }).populate('savedInfluencerId', 'profile.username profile.displayName profile.profileImage platform');

    if (!log) {
      throw NotFoundError('Communication log not found');
    }

    return log;
  }

  async createCommunicationLog(
    userId: string,
    input: {
      savedInfluencerId: string;
      campaignId?: string;
      type: CommunicationType;
      direction: CommunicationDirection;
      subject?: string;
      content: string;
      status?: CommunicationStatus;
      scheduledAt?: Date;
      emailFrom?: string;
      emailTo?: string;
      emailCc?: string[];
      emailBcc?: string[];
      attachments?: { name: string; url: string; type: string; size: number }[];
      metadata?: Record<string, unknown>;
    }
  ): Promise<ICommunicationLog> {
    // Verify influencer exists and belongs to user
    const influencer = await SavedInfluencer.findOne({
      _id: new Types.ObjectId(input.savedInfluencerId),
      userId,
    });

    if (!influencer) {
      throw NotFoundError('Influencer not found');
    }

    const log = await CommunicationLog.create({
      userId,
      savedInfluencerId: new Types.ObjectId(input.savedInfluencerId),
      campaignId: input.campaignId,
      type: input.type,
      direction: input.direction,
      subject: input.subject,
      content: input.content,
      status: input.status || 'sent',
      scheduledAt: input.scheduledAt,
      sentAt: input.status !== 'draft' && input.status !== 'scheduled' ? new Date() : undefined,
      emailFrom: input.emailFrom,
      emailTo: input.emailTo,
      emailCc: input.emailCc,
      emailBcc: input.emailBcc,
      attachments: input.attachments || [],
      metadata: input.metadata,
    });

    return log.populate('savedInfluencerId', 'profile.username profile.displayName profile.profileImage platform');
  }

  async updateCommunicationLog(
    userId: string,
    logId: string,
    input: {
      subject?: string;
      content?: string;
      status?: CommunicationStatus;
      scheduledAt?: Date;
    }
  ): Promise<ICommunicationLog> {
    const updateData: Record<string, unknown> = { ...input };

    // If status is changing to 'sent', set sentAt
    if (input.status === 'sent') {
      updateData.sentAt = new Date();
    }

    const log = await CommunicationLog.findOneAndUpdate(
      { _id: new Types.ObjectId(logId), userId },
      { $set: updateData },
      { new: true }
    ).populate('savedInfluencerId', 'profile.username profile.displayName profile.profileImage platform');

    if (!log) {
      throw NotFoundError('Communication log not found');
    }

    return log;
  }

  async deleteCommunicationLog(userId: string, logId: string): Promise<void> {
    const result = await CommunicationLog.findOneAndDelete({
      _id: new Types.ObjectId(logId),
      userId,
    });

    if (!result) {
      throw NotFoundError('Communication log not found');
    }
  }

  // ==================== Influencer Reviews ====================

  async getInfluencerReviews(
    userId: string,
    savedInfluencerId?: string
  ): Promise<IInfluencerReview[]> {
    const query: Record<string, unknown> = { userId };

    if (savedInfluencerId) {
      query.savedInfluencerId = new Types.ObjectId(savedInfluencerId);
    }

    return InfluencerReview.find(query)
      .sort({ createdAt: -1 })
      .populate('savedInfluencerId', 'profile.username profile.displayName profile.profileImage platform');
  }

  async getInfluencerReview(userId: string, reviewId: string): Promise<IInfluencerReview> {
    const review = await InfluencerReview.findOne({
      _id: new Types.ObjectId(reviewId),
      userId,
    }).populate('savedInfluencerId', 'profile.username profile.displayName profile.profileImage platform');

    if (!review) {
      throw NotFoundError('Review not found');
    }

    return review;
  }

  async createInfluencerReview(
    userId: string,
    input: {
      savedInfluencerId: string;
      campaignId?: string;
      rating: number;
      ratingBreakdown?: IRatingBreakdown;
      title?: string;
      review: string;
      pros?: string[];
      cons?: string[];
      wouldWorkAgain: boolean;
      recommendToOthers?: boolean;
      isPublic?: boolean;
    }
  ): Promise<IInfluencerReview> {
    // Verify influencer exists and belongs to user
    const influencer = await SavedInfluencer.findOne({
      _id: new Types.ObjectId(input.savedInfluencerId),
      userId,
    });

    if (!influencer) {
      throw NotFoundError('Influencer not found');
    }

    // Check for existing review
    const existing = await InfluencerReview.findOne({
      userId,
      savedInfluencerId: new Types.ObjectId(input.savedInfluencerId),
      campaignId: input.campaignId,
    });

    if (existing) {
      throw BadRequestError('You have already reviewed this influencer for this campaign');
    }

    // Calculate overall rating from breakdown if provided
    let rating = input.rating;
    if (input.ratingBreakdown) {
      const breakdown = input.ratingBreakdown;
      rating = (
        breakdown.communication +
        breakdown.contentQuality +
        breakdown.professionalism +
        breakdown.timeliness +
        breakdown.valueForMoney
      ) / 5;
    }

    const review = await InfluencerReview.create({
      userId,
      savedInfluencerId: new Types.ObjectId(input.savedInfluencerId),
      campaignId: input.campaignId,
      rating: Math.round(rating * 10) / 10, // Round to 1 decimal
      ratingBreakdown: input.ratingBreakdown,
      title: input.title,
      review: input.review,
      pros: input.pros || [],
      cons: input.cons || [],
      wouldWorkAgain: input.wouldWorkAgain,
      recommendToOthers: input.recommendToOthers || false,
      isPublic: input.isPublic || false,
      isVerified: !!input.campaignId, // Auto-verify if linked to a campaign
    });

    return review.populate('savedInfluencerId', 'profile.username profile.displayName profile.profileImage platform');
  }

  async updateInfluencerReview(
    userId: string,
    reviewId: string,
    input: {
      rating?: number;
      ratingBreakdown?: IRatingBreakdown;
      title?: string;
      review?: string;
      pros?: string[];
      cons?: string[];
      wouldWorkAgain?: boolean;
      recommendToOthers?: boolean;
      isPublic?: boolean;
    }
  ): Promise<IInfluencerReview> {
    const updateData: Record<string, unknown> = { ...input };

    // Recalculate overall rating from breakdown if provided
    if (input.ratingBreakdown) {
      const breakdown = input.ratingBreakdown;
      updateData.rating = Math.round((
        breakdown.communication +
        breakdown.contentQuality +
        breakdown.professionalism +
        breakdown.timeliness +
        breakdown.valueForMoney
      ) / 5 * 10) / 10;
    }

    const review = await InfluencerReview.findOneAndUpdate(
      { _id: new Types.ObjectId(reviewId), userId },
      { $set: updateData },
      { new: true }
    ).populate('savedInfluencerId', 'profile.username profile.displayName profile.profileImage platform');

    if (!review) {
      throw NotFoundError('Review not found');
    }

    return review;
  }

  async deleteInfluencerReview(userId: string, reviewId: string): Promise<void> {
    const result = await InfluencerReview.findOneAndDelete({
      _id: new Types.ObjectId(reviewId),
      userId,
    });

    if (!result) {
      throw NotFoundError('Review not found');
    }
  }

  async getInfluencerRatingSummary(savedInfluencerId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    wouldWorkAgainPercentage: number;
    ratingDistribution: Record<number, number>;
  }> {
    const reviews = await InfluencerReview.find({
      savedInfluencerId: new Types.ObjectId(savedInfluencerId),
      isPublic: true,
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        wouldWorkAgainPercentage: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const wouldWorkAgain = reviews.filter(r => r.wouldWorkAgain).length;

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => {
      const rounded = Math.round(r.rating);
      ratingDistribution[rounded] = (ratingDistribution[rounded] || 0) + 1;
    });

    return {
      averageRating: Math.round((totalRating / reviews.length) * 10) / 10,
      totalReviews: reviews.length,
      wouldWorkAgainPercentage: Math.round((wouldWorkAgain / reviews.length) * 100),
      ratingDistribution,
    };
  }

  // ==================== Tag Groups ====================

  async getTagGroups(userId: string): Promise<ITagGroup[]> {
    return TagGroup.find({ userId, isActive: true }).sort({ order: 1 });
  }

  async createTagGroup(
    userId: string,
    input: { name: string; description?: string; color?: string; tags?: { name: string; color: string; description?: string }[] }
  ): Promise<ITagGroup> {
    const existing = await TagGroup.findOne({ userId, name: input.name });
    if (existing) {
      throw BadRequestError(`A tag group with name "${input.name}" already exists`);
    }

    const lastGroup = await TagGroup.findOne({ userId }).sort({ order: -1 });
    const order = lastGroup ? lastGroup.order + 1 : 0;

    return TagGroup.create({
      userId,
      name: input.name,
      description: input.description,
      color: input.color || '#6366F1',
      tags: input.tags || [],
      order,
    });
  }

  async updateTagGroup(
    userId: string,
    groupId: string,
    input: { name?: string; description?: string; color?: string; tags?: { name: string; color: string; description?: string }[]; order?: number }
  ): Promise<ITagGroup> {
    const group = await TagGroup.findOneAndUpdate(
      { _id: new Types.ObjectId(groupId), userId },
      { $set: input },
      { new: true }
    );

    if (!group) {
      throw NotFoundError('Tag group not found');
    }

    return group;
  }

  async deleteTagGroup(userId: string, groupId: string): Promise<void> {
    const result = await TagGroup.findOneAndDelete({
      _id: new Types.ObjectId(groupId),
      userId,
    });

    if (!result) {
      throw NotFoundError('Tag group not found');
    }
  }

  async initializeDefaultTagGroups(userId: string): Promise<ITagGroup[]> {
    const existing = await TagGroup.findOne({ userId });
    if (existing) {
      return this.getTagGroups(userId);
    }

    const groups = await TagGroup.insertMany(
      DEFAULT_TAG_GROUPS.map((group, index) => ({
        userId,
        ...group,
        order: index,
      }))
    );

    return groups;
  }
}

export const irmService = new IRMService();
