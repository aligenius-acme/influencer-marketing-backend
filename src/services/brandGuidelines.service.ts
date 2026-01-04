/**
 * Brand Guidelines Service
 *
 * Manages brand guidelines, compliance rules, and content verification
 */

import { BrandGuidelines, IBrandGuidelines } from '../models/BrandGuidelines.js';
import { v4 as uuidv4 } from 'uuid';

// ==================== Types ====================

export interface CreateGuidelinesInput {
  workspaceId?: string;
  brandName: string;
  brandVoice?: string;
  brandValues?: string[];
  primaryColors?: string[];
  secondaryColors?: string[];
  forbiddenColors?: string[];
  logoUsage?: string;
  fontGuidelines?: string;
  requiredHashtags?: string[];
  forbiddenHashtags?: string[];
  requiredMentions?: string[];
  forbiddenMentions?: string[];
  forbiddenWords?: string[];
  ftcDisclosureRequired?: boolean;
  disclosurePosition?: 'beginning' | 'middle' | 'end' | 'any';
  approvedDisclosures?: string[];
  competitorBrands?: string[];
  competitorHashtags?: string[];
  contentRestrictions?: string[];
  requiresApproval?: boolean;
  approvalLevels?: number;
}

export interface UpdateGuidelinesInput extends Partial<CreateGuidelinesInput> {
  isActive?: boolean;
}

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  category: 'visual' | 'content' | 'legal' | 'brand';
}

export interface PlatformRule {
  platform: string;
  maxHashtags?: number;
  minHashtags?: number;
  captionMinLength?: number;
  captionMaxLength?: number;
  requiredElements?: string[];
}

// ==================== Service ====================

class BrandGuidelinesService {
  // ==================== CRUD Operations ====================

  /**
   * Create brand guidelines
   */
  async create(userId: string, input: CreateGuidelinesInput): Promise<IBrandGuidelines> {
    // Deactivate existing guidelines
    await BrandGuidelines.updateMany({ userId, isActive: true }, { isActive: false });

    const guidelines = new BrandGuidelines({
      userId,
      ...input,
      isActive: true,
      version: 1,
    });

    await guidelines.save();
    return guidelines;
  }

  /**
   * Get active brand guidelines
   */
  async getActive(userId: string): Promise<IBrandGuidelines | null> {
    return BrandGuidelines.findOne({ userId, isActive: true });
  }

  /**
   * Get all brand guidelines (including inactive)
   */
  async getAll(userId: string): Promise<IBrandGuidelines[]> {
    return BrandGuidelines.find({ userId }).sort({ version: -1 });
  }

  /**
   * Get guidelines by ID
   */
  async getById(userId: string, guidelinesId: string): Promise<IBrandGuidelines | null> {
    return BrandGuidelines.findOne({ _id: guidelinesId, userId });
  }

  /**
   * Update brand guidelines (creates new version)
   */
  async update(
    userId: string,
    guidelinesId: string,
    input: UpdateGuidelinesInput
  ): Promise<IBrandGuidelines | null> {
    const existing = await this.getById(userId, guidelinesId);
    if (!existing) return null;

    // Create new version
    if (Object.keys(input).some((k) => k !== 'isActive')) {
      const newVersion = new BrandGuidelines({
        ...existing.toObject(),
        _id: undefined,
        ...input,
        version: existing.version + 1,
        createdAt: undefined,
        updatedAt: undefined,
      });

      // Deactivate old version
      await BrandGuidelines.updateOne({ _id: guidelinesId }, { isActive: false });

      await newVersion.save();
      return newVersion;
    }

    // Just update status
    return BrandGuidelines.findOneAndUpdate(
      { _id: guidelinesId, userId },
      { $set: input },
      { new: true }
    );
  }

  /**
   * Delete brand guidelines
   */
  async delete(userId: string, guidelinesId: string): Promise<boolean> {
    const result = await BrandGuidelines.deleteOne({ _id: guidelinesId, userId });
    return result.deletedCount > 0;
  }

  // ==================== Checklist Management ====================

  /**
   * Add checklist item
   */
  async addChecklistItem(
    userId: string,
    guidelinesId: string,
    item: Omit<ChecklistItem, 'id'>
  ): Promise<IBrandGuidelines | null> {
    const checklistItem = {
      id: uuidv4(),
      ...item,
    };

    return BrandGuidelines.findOneAndUpdate(
      { _id: guidelinesId, userId },
      { $push: { checklistItems: checklistItem } },
      { new: true }
    );
  }

  /**
   * Remove checklist item
   */
  async removeChecklistItem(
    userId: string,
    guidelinesId: string,
    itemId: string
  ): Promise<IBrandGuidelines | null> {
    return BrandGuidelines.findOneAndUpdate(
      { _id: guidelinesId, userId },
      { $pull: { checklistItems: { id: itemId } } },
      { new: true }
    );
  }

  /**
   * Update checklist item
   */
  async updateChecklistItem(
    userId: string,
    guidelinesId: string,
    itemId: string,
    updates: Partial<ChecklistItem>
  ): Promise<IBrandGuidelines | null> {
    const updateFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      updateFields[`checklistItems.$.${key}`] = value;
    }

    return BrandGuidelines.findOneAndUpdate(
      { _id: guidelinesId, userId, 'checklistItems.id': itemId },
      { $set: updateFields },
      { new: true }
    );
  }

  // ==================== Platform Rules ====================

  /**
   * Add or update platform rule
   */
  async setPlatformRule(
    userId: string,
    guidelinesId: string,
    rule: PlatformRule
  ): Promise<IBrandGuidelines | null> {
    // Remove existing rule for platform
    await BrandGuidelines.updateOne(
      { _id: guidelinesId, userId },
      { $pull: { platformRules: { platform: rule.platform } } }
    );

    // Add new rule
    return BrandGuidelines.findOneAndUpdate(
      { _id: guidelinesId, userId },
      { $push: { platformRules: rule } },
      { new: true }
    );
  }

  /**
   * Remove platform rule
   */
  async removePlatformRule(
    userId: string,
    guidelinesId: string,
    platform: string
  ): Promise<IBrandGuidelines | null> {
    return BrandGuidelines.findOneAndUpdate(
      { _id: guidelinesId, userId },
      { $pull: { platformRules: { platform } } },
      { new: true }
    );
  }

  // ==================== Competitor Management ====================

  /**
   * Add competitor brand
   */
  async addCompetitor(
    userId: string,
    guidelinesId: string,
    competitor: string
  ): Promise<IBrandGuidelines | null> {
    return BrandGuidelines.findOneAndUpdate(
      { _id: guidelinesId, userId },
      { $addToSet: { competitorBrands: competitor } },
      { new: true }
    );
  }

  /**
   * Remove competitor brand
   */
  async removeCompetitor(
    userId: string,
    guidelinesId: string,
    competitor: string
  ): Promise<IBrandGuidelines | null> {
    return BrandGuidelines.findOneAndUpdate(
      { _id: guidelinesId, userId },
      { $pull: { competitorBrands: competitor } },
      { new: true }
    );
  }

  // ==================== Auto-Approve ====================

  /**
   * Add influencer to auto-approve list
   */
  async addAutoApprove(
    userId: string,
    guidelinesId: string,
    influencerId: string
  ): Promise<IBrandGuidelines | null> {
    return BrandGuidelines.findOneAndUpdate(
      { _id: guidelinesId, userId },
      { $addToSet: { autoApproveInfluencerIds: influencerId } },
      { new: true }
    );
  }

  /**
   * Remove influencer from auto-approve list
   */
  async removeAutoApprove(
    userId: string,
    guidelinesId: string,
    influencerId: string
  ): Promise<IBrandGuidelines | null> {
    return BrandGuidelines.findOneAndUpdate(
      { _id: guidelinesId, userId },
      { $pull: { autoApproveInfluencerIds: influencerId } },
      { new: true }
    );
  }

  /**
   * Check if influencer is auto-approved
   */
  async isAutoApproved(userId: string, influencerId: string): Promise<boolean> {
    const guidelines = await this.getActive(userId);
    if (!guidelines) return false;
    return guidelines.autoApproveInfluencerIds.includes(influencerId);
  }

  // ==================== Templates ====================

  /**
   * Get default guidelines template
   */
  getDefaultTemplate(): CreateGuidelinesInput {
    return {
      brandName: '',
      brandVoice: 'Professional, friendly, and authentic',
      brandValues: ['Quality', 'Innovation', 'Transparency'],
      primaryColors: [],
      secondaryColors: [],
      forbiddenColors: [],
      requiredHashtags: [],
      forbiddenHashtags: [],
      forbiddenWords: [],
      ftcDisclosureRequired: true,
      disclosurePosition: 'beginning',
      approvedDisclosures: ['#ad', '#sponsored', '#paidpartnership', 'Paid partnership with'],
      competitorBrands: [],
      contentRestrictions: [],
      requiresApproval: true,
      approvalLevels: 1,
    };
  }

  /**
   * Get industry-specific template
   */
  getIndustryTemplate(industry: string): CreateGuidelinesInput {
    const base = this.getDefaultTemplate();

    const industryTemplates: Record<string, Partial<CreateGuidelinesInput>> = {
      fashion: {
        brandVoice: 'Stylish, aspirational, and trend-forward',
        brandValues: ['Style', 'Quality', 'Sustainability'],
        requiredHashtags: ['#fashion', '#style'],
        contentRestrictions: ['No competitor products visible', 'No price comparisons'],
      },
      beauty: {
        brandVoice: 'Empowering, inclusive, and expert',
        brandValues: ['Beauty', 'Confidence', 'Self-care'],
        requiredHashtags: ['#beauty', '#skincare'],
        contentRestrictions: ['No before/after claims without disclaimer', 'No medical claims'],
      },
      tech: {
        brandVoice: 'Innovative, clear, and helpful',
        brandValues: ['Innovation', 'Reliability', 'User-first'],
        requiredHashtags: ['#tech'],
        contentRestrictions: ['No competitor bashing', 'Accurate specifications only'],
      },
      food: {
        brandVoice: 'Appetizing, fun, and authentic',
        brandValues: ['Quality', 'Taste', 'Freshness'],
        requiredHashtags: ['#foodie'],
        contentRestrictions: ['No health claims without approval', 'Allergen info required'],
      },
      fitness: {
        brandVoice: 'Motivating, supportive, and results-focused',
        brandValues: ['Health', 'Performance', 'Community'],
        requiredHashtags: ['#fitness', '#workout'],
        contentRestrictions: ['No unrealistic body claims', 'Consult doctor disclaimer'],
      },
    };

    return {
      ...base,
      ...(industryTemplates[industry] || {}),
    };
  }
}

export const brandGuidelinesService = new BrandGuidelinesService();
