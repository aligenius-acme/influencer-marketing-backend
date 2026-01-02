import { z } from 'zod';

// ==================== Custom Fields ====================

const selectOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  color: z.string().optional(),
});

export const createCustomFieldSchema = z.object({
  fieldName: z.string().min(1).max(100).optional(),
  fieldLabel: z.string().min(1).max(100),
  fieldType: z.enum(['text', 'number', 'email', 'url', 'date', 'select', 'multi-select', 'boolean', 'textarea']),
  options: z.array(selectOptionSchema).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  required: z.boolean().optional(),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(500).optional(),
});

export const updateCustomFieldSchema = z.object({
  fieldLabel: z.string().min(1).max(100).optional(),
  options: z.array(selectOptionSchema).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  required: z.boolean().optional(),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(500).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const reorderFieldsSchema = z.object({
  fieldIds: z.array(z.string().min(1)),
});

// ==================== Communication Logs ====================

const attachmentSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  type: z.string().min(1),
  size: z.number().int().positive(),
});

export const createCommunicationLogSchema = z.object({
  savedInfluencerId: z.string().min(1),
  campaignId: z.string().optional(),
  type: z.enum(['email', 'dm', 'call', 'meeting', 'note', 'other']),
  direction: z.enum(['inbound', 'outbound']),
  subject: z.string().max(500).optional(),
  content: z.string().min(1).max(50000),
  status: z.enum(['draft', 'scheduled', 'sent', 'delivered', 'opened', 'replied', 'bounced', 'failed']).optional(),
  scheduledAt: z.string().datetime().optional(),
  emailFrom: z.string().email().optional(),
  emailTo: z.string().email().optional(),
  emailCc: z.array(z.string().email()).optional(),
  emailBcc: z.array(z.string().email()).optional(),
  attachments: z.array(attachmentSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateCommunicationLogSchema = z.object({
  subject: z.string().max(500).optional(),
  content: z.string().min(1).max(50000).optional(),
  status: z.enum(['draft', 'scheduled', 'sent', 'delivered', 'opened', 'replied', 'bounced', 'failed']).optional(),
  scheduledAt: z.string().datetime().optional(),
});

// ==================== Influencer Reviews ====================

const ratingBreakdownSchema = z.object({
  communication: z.number().min(1).max(5),
  contentQuality: z.number().min(1).max(5),
  professionalism: z.number().min(1).max(5),
  timeliness: z.number().min(1).max(5),
  valueForMoney: z.number().min(1).max(5),
});

export const createInfluencerReviewSchema = z.object({
  savedInfluencerId: z.string().min(1),
  campaignId: z.string().optional(),
  rating: z.number().min(1).max(5),
  ratingBreakdown: ratingBreakdownSchema.optional(),
  title: z.string().max(200).optional(),
  review: z.string().min(10).max(5000),
  pros: z.array(z.string().max(200)).max(10).optional(),
  cons: z.array(z.string().max(200)).max(10).optional(),
  wouldWorkAgain: z.boolean(),
  recommendToOthers: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const updateInfluencerReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  ratingBreakdown: ratingBreakdownSchema.optional(),
  title: z.string().max(200).optional(),
  review: z.string().min(10).max(5000).optional(),
  pros: z.array(z.string().max(200)).max(10).optional(),
  cons: z.array(z.string().max(200)).max(10).optional(),
  wouldWorkAgain: z.boolean().optional(),
  recommendToOthers: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

// ==================== Tag Groups ====================

const tagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().min(4).max(20),
  description: z.string().max(200).optional(),
});

export const createTagGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().min(4).max(20).optional(),
  tags: z.array(tagSchema).max(50).optional(),
});

export const updateTagGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().min(4).max(20).optional(),
  tags: z.array(tagSchema).max(50).optional(),
  order: z.number().int().min(0).optional(),
});

// Type exports
export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>;
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>;
export type CreateCommunicationLogInput = z.infer<typeof createCommunicationLogSchema>;
export type UpdateCommunicationLogInput = z.infer<typeof updateCommunicationLogSchema>;
export type CreateInfluencerReviewInput = z.infer<typeof createInfluencerReviewSchema>;
export type UpdateInfluencerReviewInput = z.infer<typeof updateInfluencerReviewSchema>;
export type CreateTagGroupInput = z.infer<typeof createTagGroupSchema>;
export type UpdateTagGroupInput = z.infer<typeof updateTagGroupSchema>;
