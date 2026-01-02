import { z } from 'zod';

// Template types
const templateTypes = [
  'outreach',
  'follow_up',
  'collaboration',
  'negotiation',
  'confirmation',
  'reminder',
  'thank_you',
  'custom',
] as const;

// Create email template schema
export const createEmailTemplateSchema = z.object({
  name: z
    .string()
    .min(1, 'Template name is required')
    .max(100, 'Template name must be less than 100 characters'),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(500, 'Subject must be less than 500 characters'),
  body: z
    .string()
    .min(1, 'Body is required')
    .max(50000, 'Body must be less than 50000 characters'),
  templateType: z.enum(templateTypes, {
    errorMap: () => ({ message: 'Invalid template type' }),
  }),
  variables: z.array(z.string()).optional(),
});

// Update email template schema
export const updateEmailTemplateSchema = z.object({
  name: z
    .string()
    .min(1, 'Template name is required')
    .max(100, 'Template name must be less than 100 characters')
    .optional(),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(500, 'Subject must be less than 500 characters')
    .optional(),
  body: z
    .string()
    .min(1, 'Body is required')
    .max(50000, 'Body must be less than 50000 characters')
    .optional(),
  templateType: z.enum(templateTypes, {
    errorMap: () => ({ message: 'Invalid template type' }),
  }).optional(),
  variables: z.array(z.string()).optional(),
});

// Preview template schema
export const previewEmailTemplateSchema = z.object({
  influencer: z.object({
    name: z.string().optional(),
    username: z.string().optional(),
    platform: z.string().optional(),
    followers: z.number().optional(),
    email: z.string().email().optional(),
  }).optional(),
  brand: z.object({
    name: z.string().optional(),
    website: z.string().optional(),
    senderName: z.string().optional(),
    senderEmail: z.string().email().optional(),
  }).optional(),
  campaign: z.object({
    name: z.string().optional(),
    budget: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    brief: z.string().optional(),
  }).optional(),
  customMessage: z.string().optional(),
});

export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>;
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;
export type PreviewEmailTemplateInput = z.infer<typeof previewEmailTemplateSchema>;
