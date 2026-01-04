/**
 * Brand Guidelines Model (MongoDB)
 *
 * Stores brand guidelines and compliance rules for content verification
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IBrandGuidelines extends Document {
  userId: string;
  workspaceId?: string;

  // Brand Identity
  brandName: string;
  brandVoice: string;
  brandValues: string[];

  // Visual Guidelines
  primaryColors: string[];
  secondaryColors: string[];
  forbiddenColors: string[];
  logoUsage: string;
  fontGuidelines: string;

  // Content Rules
  requiredHashtags: string[];
  forbiddenHashtags: string[];
  requiredMentions: string[];
  forbiddenMentions: string[];
  forbiddenWords: string[];
  requiredDisclosures: string[];

  // FTC Compliance
  ftcDisclosureRequired: boolean;
  disclosurePosition: 'beginning' | 'middle' | 'end' | 'any';
  approvedDisclosures: string[]; // e.g., "#ad", "#sponsored", "Paid partnership"

  // Platform-Specific Rules
  platformRules: {
    platform: string;
    maxHashtags?: number;
    minHashtags?: number;
    captionMinLength?: number;
    captionMaxLength?: number;
    requiredElements?: string[];
  }[];

  // Competitor Restrictions
  competitorBrands: string[];
  competitorHashtags: string[];

  // Content Restrictions
  contentRestrictions: string[];
  ageRestricted: boolean;
  geographicRestrictions: string[];

  // Approval Workflow
  requiresApproval: boolean;
  approvalLevels: number;
  autoApproveInfluencerIds: string[];

  // Checklist Items
  checklistItems: {
    id: string;
    label: string;
    required: boolean;
    category: 'visual' | 'content' | 'legal' | 'brand';
  }[];

  isActive: boolean;
  version: number;

  createdAt: Date;
  updatedAt: Date;
}

const BrandGuidelinesSchema = new Schema<IBrandGuidelines>(
  {
    userId: { type: String, required: true, index: true },
    workspaceId: { type: String, index: true },

    brandName: { type: String, required: true },
    brandVoice: { type: String, default: '' },
    brandValues: [{ type: String }],

    primaryColors: [{ type: String }],
    secondaryColors: [{ type: String }],
    forbiddenColors: [{ type: String }],
    logoUsage: { type: String, default: '' },
    fontGuidelines: { type: String, default: '' },

    requiredHashtags: [{ type: String }],
    forbiddenHashtags: [{ type: String }],
    requiredMentions: [{ type: String }],
    forbiddenMentions: [{ type: String }],
    forbiddenWords: [{ type: String }],
    requiredDisclosures: [{ type: String }],

    ftcDisclosureRequired: { type: Boolean, default: true },
    disclosurePosition: {
      type: String,
      enum: ['beginning', 'middle', 'end', 'any'],
      default: 'beginning',
    },
    approvedDisclosures: {
      type: [String],
      default: ['#ad', '#sponsored', '#paidpartnership', 'Paid partnership with'],
    },

    platformRules: [
      {
        platform: { type: String },
        maxHashtags: { type: Number },
        minHashtags: { type: Number },
        captionMinLength: { type: Number },
        captionMaxLength: { type: Number },
        requiredElements: [{ type: String }],
      },
    ],

    competitorBrands: [{ type: String }],
    competitorHashtags: [{ type: String }],

    contentRestrictions: [{ type: String }],
    ageRestricted: { type: Boolean, default: false },
    geographicRestrictions: [{ type: String }],

    requiresApproval: { type: Boolean, default: true },
    approvalLevels: { type: Number, default: 1 },
    autoApproveInfluencerIds: [{ type: String }],

    checklistItems: [
      {
        id: { type: String },
        label: { type: String },
        required: { type: Boolean },
        category: {
          type: String,
          enum: ['visual', 'content', 'legal', 'brand'],
        },
      },
    ],

    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
  },
  {
    timestamps: true,
  }
);

BrandGuidelinesSchema.index({ userId: 1, isActive: 1 });

export const BrandGuidelines = mongoose.model<IBrandGuidelines>('BrandGuidelines', BrandGuidelinesSchema);
