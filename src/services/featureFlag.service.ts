/**
 * Feature Flag Service
 *
 * Provides runtime feature toggling with Redis caching.
 * Supports:
 * - Global enable/disable
 * - Percentage-based rollout
 * - Tenant-specific flags
 * - User-specific whitelist
 */

import { PrismaClient, FeatureFlag } from '@prisma/client';
import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern } from '../config/redis.js';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Cache settings
const CACHE_PREFIX = 'ff:';
const CACHE_ALL_KEY = `${CACHE_PREFIX}all`;
const CACHE_TTL = 60; // 60 seconds

export interface FeatureFlagInput {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  percentage?: number;
  tenantIds?: string[];
  userIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface FeatureFlagUpdate {
  name?: string;
  description?: string | null;
  enabled?: boolean;
  percentage?: number;
  tenantIds?: string[];
  userIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface FeatureFlagCheckContext {
  userId?: string;
  tenantId?: string;
}

class FeatureFlagService {
  /**
   * Create a new feature flag
   */
  async create(data: FeatureFlagInput, createdBy?: string): Promise<FeatureFlag> {
    const flag = await prisma.featureFlag.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        enabled: data.enabled ?? false,
        percentage: data.percentage ?? 100,
        tenantIds: data.tenantIds ?? [],
        userIds: data.userIds ?? [],
        metadata: data.metadata ?? {},
        createdBy,
        updatedBy: createdBy,
      },
    });

    await this.invalidateCache();
    return flag;
  }

  /**
   * Get all feature flags
   */
  async getAll(): Promise<FeatureFlag[]> {
    // Try cache first
    const cached = await cacheGet<FeatureFlag[]>(CACHE_ALL_KEY);
    if (cached) {
      return cached;
    }

    const flags = await prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });

    // Cache for 60 seconds
    await cacheSet(CACHE_ALL_KEY, flags, CACHE_TTL);
    return flags;
  }

  /**
   * Get a feature flag by key
   */
  async getByKey(key: string): Promise<FeatureFlag | null> {
    const cacheKey = `${CACHE_PREFIX}${key}`;

    // Try cache first
    const cached = await cacheGet<FeatureFlag>(cacheKey);
    if (cached) {
      return cached;
    }

    const flag = await prisma.featureFlag.findUnique({
      where: { key },
    });

    if (flag) {
      await cacheSet(cacheKey, flag, CACHE_TTL);
    }

    return flag;
  }

  /**
   * Get a feature flag by ID
   */
  async getById(id: string): Promise<FeatureFlag | null> {
    return prisma.featureFlag.findUnique({
      where: { id },
    });
  }

  /**
   * Update a feature flag
   */
  async update(id: string, data: FeatureFlagUpdate, updatedBy?: string): Promise<FeatureFlag> {
    const flag = await prisma.featureFlag.update({
      where: { id },
      data: {
        ...data,
        updatedBy,
      },
    });

    await this.invalidateCache();
    return flag;
  }

  /**
   * Update a feature flag by key
   */
  async updateByKey(key: string, data: FeatureFlagUpdate, updatedBy?: string): Promise<FeatureFlag> {
    const flag = await prisma.featureFlag.update({
      where: { key },
      data: {
        ...data,
        updatedBy,
      },
    });

    await this.invalidateCache();
    return flag;
  }

  /**
   * Delete a feature flag
   */
  async delete(id: string): Promise<void> {
    await prisma.featureFlag.delete({
      where: { id },
    });

    await this.invalidateCache();
  }

  /**
   * Toggle a feature flag on/off
   */
  async toggle(key: string, enabled: boolean, updatedBy?: string): Promise<FeatureFlag> {
    const flag = await prisma.featureFlag.update({
      where: { key },
      data: {
        enabled,
        updatedBy,
      },
    });

    await this.invalidateCache();
    return flag;
  }

  /**
   * Check if a feature is enabled for a given context
   *
   * Evaluation order:
   * 1. If flag doesn't exist, return false
   * 2. If flag is disabled, return false
   * 3. If user is in whitelist (userIds), return true
   * 4. If tenantIds specified and tenant not in list, return false
   * 5. Apply percentage rollout using consistent hashing
   */
  async isEnabled(key: string, context: FeatureFlagCheckContext = {}): Promise<boolean> {
    const flag = await this.getByKey(key);

    // Flag doesn't exist
    if (!flag) {
      return false;
    }

    // Flag is globally disabled
    if (!flag.enabled) {
      return false;
    }

    // User whitelist check
    if (context.userId && flag.userIds.length > 0) {
      if (flag.userIds.includes(context.userId)) {
        return true;
      }
    }

    // Tenant targeting check
    if (flag.tenantIds.length > 0) {
      if (!context.tenantId || !flag.tenantIds.includes(context.tenantId)) {
        return false;
      }
    }

    // Percentage rollout
    if (flag.percentage < 100) {
      return this.isInPercentage(key, context.userId || context.tenantId || '', flag.percentage);
    }

    return true;
  }

  /**
   * Check multiple features at once (for frontend initialization)
   */
  async checkMultiple(keys: string[], context: FeatureFlagCheckContext = {}): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Batch check using Promise.all for efficiency
    await Promise.all(
      keys.map(async (key) => {
        results[key] = await this.isEnabled(key, context);
      })
    );

    return results;
  }

  /**
   * Get all enabled features for a context (for frontend initialization)
   */
  async getEnabledFeatures(context: FeatureFlagCheckContext = {}): Promise<string[]> {
    const flags = await this.getAll();
    const enabled: string[] = [];

    for (const flag of flags) {
      if (await this.isEnabled(flag.key, context)) {
        enabled.push(flag.key);
      }
    }

    return enabled;
  }

  /**
   * Seed default feature flags
   */
  async seedDefaults(): Promise<void> {
    const defaults: FeatureFlagInput[] = [
      {
        key: 'ai_recommendations',
        name: 'AI Recommendations',
        description: 'AI-powered influencer matching and recommendations',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'social_listening',
        name: 'Social Listening',
        description: 'Brand mention monitoring and sentiment analysis',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'contract_management',
        name: 'Contract Management',
        description: 'Contract templates and e-signature integration',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'payout_system',
        name: 'Payout System',
        description: 'Stripe Connect payouts to influencers',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'shopify_integration',
        name: 'Shopify Integration',
        description: 'E-commerce integration with Shopify stores',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'content_calendar',
        name: 'Content Calendar',
        description: 'Content planning and scheduling calendar',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'custom_dashboards',
        name: 'Custom Dashboards',
        description: 'Create custom analytics dashboards',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'workflow_automation',
        name: 'Workflow Automation',
        description: 'Automated workflow rules and triggers',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'sso_authentication',
        name: 'SSO Authentication',
        description: 'Single Sign-On with SAML/OIDC providers',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'crm_integrations',
        name: 'CRM Integrations',
        description: 'Salesforce and HubSpot integration',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'two_factor_auth',
        name: 'Two-Factor Authentication',
        description: 'TOTP-based 2FA for enhanced security',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'api_access',
        name: 'API Access',
        description: 'REST API key management',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'webhooks',
        name: 'Webhooks',
        description: 'Outbound webhook notifications',
        enabled: true,
        percentage: 100,
      },
      {
        key: 'white_label',
        name: 'White Label',
        description: 'Custom branding and white-labeling',
        enabled: false,
        percentage: 100,
      },
      {
        key: 'beta_features',
        name: 'Beta Features',
        description: 'Early access to beta features',
        enabled: false,
        percentage: 10,
      },
    ];

    for (const flag of defaults) {
      const exists = await prisma.featureFlag.findUnique({
        where: { key: flag.key },
      });

      if (!exists) {
        await prisma.featureFlag.create({
          data: {
            ...flag,
            createdBy: 'system',
            updatedBy: 'system',
          },
        });
      }
    }

    await this.invalidateCache();
  }

  /**
   * Consistent hash-based percentage check
   * Uses MD5 hash of (key + identifier) to ensure consistent results
   */
  private isInPercentage(key: string, identifier: string, percentage: number): boolean {
    if (percentage >= 100) return true;
    if (percentage <= 0) return false;

    const hash = crypto
      .createHash('md5')
      .update(`${key}:${identifier}`)
      .digest('hex');

    // Use first 8 characters of hash (32 bits) for percentage
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const maxValue = 0xffffffff;
    const percentValue = (hashValue / maxValue) * 100;

    return percentValue < percentage;
  }

  /**
   * Invalidate all feature flag caches
   */
  private async invalidateCache(): Promise<void> {
    try {
      await cacheDeletePattern(`${CACHE_PREFIX}*`);
    } catch (error) {
      console.error('Failed to invalidate feature flag cache:', error);
    }
  }
}

export const featureFlagService = new FeatureFlagService();
