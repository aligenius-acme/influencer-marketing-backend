import { z } from 'zod';

// ==================== Auth Schemas ====================

export const registerSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  companyName: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .max(255, 'Company name must be less than 255 characters'),
  industry: z.string().max(100).optional(),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address')
    .transform((v) => v.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const updateProfileSchema = z.object({
  avatarUrl: z.string().url().optional().or(z.literal('')),
  companyName: z.string().min(2).max(255).optional(),
  industry: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
  description: z.string().max(2000).optional(),
});

// ==================== Campaign Schemas ====================

export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255),
  description: z.string().max(5000).optional(),
  brief: z.string().max(10000).optional(),
  platform: z.enum(['instagram', 'tiktok', 'youtube', 'multi']).optional(),
  campaignType: z.enum(['sponsored_post', 'story', 'reel', 'video', 'multi']).optional(),
  budget: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  goals: z.record(z.string(), z.any()).optional(),
  hashtags: z.array(z.string()).optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']).optional(),
});

export const addCampaignInfluencerSchema = z.object({
  savedInfluencerId: z.string().min(1, 'Saved influencer ID is required'),
  agreedRate: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  deliverables: z.array(z.object({
    type: z.string().min(1),
    quantity: z.number().int().positive(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  })).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateCampaignInfluencerSchema = z.object({
  status: z.enum(['INVITED', 'ACCEPTED', 'DECLINED', 'NEGOTIATING', 'CONTRACTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  agreedRate: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  deliverables: z.array(z.object({
    type: z.string().min(1),
    quantity: z.number().int().positive(),
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  })).optional(),
  contentUrls: z.array(z.string().url()).optional(),
  notes: z.string().max(5000).optional(),
});

export const duplicateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

// ==================== List Schemas ====================

export const createListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(255),
  description: z.string().max(1000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
});

export const updateListSchema = createListSchema.partial();

// ==================== Pagination Schema ====================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ==================== Influencer Search Schemas ====================

export const influencerSearchSchema = z.object({
  platform: z.enum(['instagram', 'tiktok', 'youtube', 'twitter']).optional(),
  query: z.string().max(200).optional(),
  minFollowers: z.coerce.number().int().min(0).optional(),
  maxFollowers: z.coerce.number().int().min(0).optional(),
  minEngagement: z.coerce.number().min(0).max(100).optional(),
  maxEngagement: z.coerce.number().min(0).max(100).optional(),
  location: z.string().max(100).optional(),
  language: z.string().max(10).optional(),
  niche: z.array(z.string()).or(z.string().transform(s => s ? s.split(',').map(n => n.trim()) : [])).optional(),
  verified: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  sortBy: z.enum(['followers', 'engagement', 'relevance']).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const influencerProfileParamsSchema = z.object({
  platform: z.enum(['instagram', 'tiktok', 'youtube', 'twitter']),
  id: z.string().min(1),
});

// ==================== Saved Influencer Schemas ====================

const influencerProfileSchema = z.object({
  username: z.string().min(1),
  displayName: z.string().min(1),
  bio: z.string().default(''),
  profileImage: z.string().default(''),
  profileUrl: z.string().default(''),
  followers: z.number().int().min(0).default(0),
  following: z.number().int().min(0).default(0),
  postsCount: z.number().int().min(0).default(0),
  engagementRate: z.number().min(0).default(0),
  avgLikes: z.number().int().min(0).default(0),
  avgComments: z.number().int().min(0).default(0),
  verified: z.boolean().default(false),
  location: z.string().optional(),
  language: z.string().optional(),
  niches: z.array(z.string()).default([]),
});

const audienceDataSchema = z.object({
  demographics: z.object({
    age: z.record(z.string(), z.number()).optional(),
    gender: z.object({
      male: z.number(),
      female: z.number(),
      other: z.number(),
    }).optional(),
  }).optional(),
  topLocations: z.array(z.object({
    country: z.string(),
    city: z.string().optional(),
    percentage: z.number(),
  })).optional(),
  topInterests: z.array(z.object({
    interest: z.string(),
    percentage: z.number(),
  })).optional(),
  authenticityScore: z.number().optional(),
  reachability: z.number().optional(),
}).optional();

export const saveInfluencerSchema = z.object({
  scrapcreatorsId: z.string().min(1, 'ScrapCreators ID is required'),
  platform: z.enum(['instagram', 'tiktok', 'youtube', 'twitter']),
  profile: influencerProfileSchema,
  audience: audienceDataSchema,
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  isFavorite: z.boolean().optional(),
  listIds: z.array(z.string()).optional(),
});

export const updateSavedInfluencerSchema = z.object({
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  customFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  isFavorite: z.boolean().optional(),
});

export const addInfluencerToListSchema = z.object({
  influencerId: z.string().min(1, 'Influencer ID is required'),
});

export const bulkCheckSavedSchema = z.object({
  influencers: z.array(z.object({
    platform: z.string(),
    scrapcreatorsId: z.string(),
  })).min(1).max(100),
});

// ==================== Type Exports ====================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type InfluencerSearchInput = z.infer<typeof influencerSearchSchema>;
export type InfluencerProfileParams = z.infer<typeof influencerProfileParamsSchema>;
export type SaveInfluencerInput = z.infer<typeof saveInfluencerSchema>;
export type UpdateSavedInfluencerInput = z.infer<typeof updateSavedInfluencerSchema>;
export type AddCampaignInfluencerInput = z.infer<typeof addCampaignInfluencerSchema>;
export type UpdateCampaignInfluencerInput = z.infer<typeof updateCampaignInfluencerSchema>;
export type DuplicateCampaignInput = z.infer<typeof duplicateCampaignSchema>;
