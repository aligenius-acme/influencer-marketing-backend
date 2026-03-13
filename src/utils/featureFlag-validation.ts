import { z } from 'zod';

// Feature flag key pattern: lowercase letters, numbers, underscores
const keyPattern = /^[a-z][a-z0-9_]*$/;

// Create feature flag schema
export const createFeatureFlagSchema = z.object({
  key: z
    .string()
    .min(2, 'Key must be at least 2 characters')
    .max(50, 'Key must be less than 50 characters')
    .regex(keyPattern, 'Key must start with a letter and contain only lowercase letters, numbers, and underscores'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  enabled: z.boolean().optional().default(false),
  percentage: z
    .number()
    .int('Percentage must be an integer')
    .min(0, 'Percentage must be at least 0')
    .max(100, 'Percentage must be at most 100')
    .optional()
    .default(100),
  tenantIds: z.array(z.string().uuid()).optional().default([]),
  userIds: z.array(z.string().uuid()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
});

// Update feature flag schema
export const updateFeatureFlagSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .nullable()
    .optional(),
  enabled: z.boolean().optional(),
  percentage: z
    .number()
    .int('Percentage must be an integer')
    .min(0, 'Percentage must be at least 0')
    .max(100, 'Percentage must be at most 100')
    .optional(),
  tenantIds: z.array(z.string().uuid()).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Toggle feature flag schema
export const toggleFeatureFlagSchema = z.object({
  enabled: z.boolean(),
});

// Check feature flags schema (for batch checking)
export const checkFeatureFlagsSchema = z.object({
  keys: z.array(z.string()).min(1, 'At least one key is required'),
  context: z.object({
    userId: z.string().uuid().optional(),
    tenantId: z.string().uuid().optional(),
  }).optional(),
});

// Feature flag key param schema
export const featureFlagKeyParamSchema = z.object({
  key: z.string().min(1, 'Key is required'),
});

// Feature flag ID param schema
export const featureFlagIdParamSchema = z.object({
  id: z.string().uuid('Invalid feature flag ID'),
});

export type CreateFeatureFlagInput = z.infer<typeof createFeatureFlagSchema>;
export type UpdateFeatureFlagInput = z.infer<typeof updateFeatureFlagSchema>;
export type ToggleFeatureFlagInput = z.infer<typeof toggleFeatureFlagSchema>;
export type CheckFeatureFlagsInput = z.infer<typeof checkFeatureFlagsSchema>;
