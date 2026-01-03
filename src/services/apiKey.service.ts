/**
 * API Key Service
 *
 * Handles API key management:
 * - Key generation and hashing
 * - Key validation
 * - Usage tracking
 * - Rate limiting
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// API Key prefix for identification
const API_KEY_PREFIX = 'im_sk_'; // Influencer Marketing Secret Key

// Available API scopes
export const API_SCOPES = {
  // Read scopes
  'campaigns:read': 'Read campaign data',
  'influencers:read': 'Read saved influencer data',
  'analytics:read': 'Read analytics data',
  'contracts:read': 'Read contract data',

  // Write scopes
  'campaigns:write': 'Create and update campaigns',
  'influencers:write': 'Manage saved influencers',
  'contracts:write': 'Create and update contracts',

  // Delete scopes
  'campaigns:delete': 'Delete campaigns',
  'influencers:delete': 'Delete saved influencers',

  // Special scopes
  'webhooks:manage': 'Manage webhook subscriptions',
  'all': 'Full API access',
};

class ApiKeyService {
  /**
   * Generate a new API key
   */
  async createApiKey(
    userId: string,
    data: {
      name: string;
      workspaceId?: string;
      permissions?: string[];
      rateLimit?: number;
      expiresAt?: Date;
    }
  ) {
    // Generate a secure random key
    const rawKey = crypto.randomBytes(32).toString('hex');
    const fullKey = `${API_KEY_PREFIX}${rawKey}`;

    // Hash the key for storage
    const keyHash = this.hashKey(fullKey);

    // Store first 12 characters for display (prefix + 4 chars)
    const keyPrefix = fullKey.substring(0, 12);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId,
        workspaceId: data.workspaceId,
        name: data.name,
        keyHash,
        keyPrefix,
        permissions: data.permissions || ['all'],
        rateLimit: data.rateLimit || 1000,
        expiresAt: data.expiresAt,
      },
    });

    // Return the key details with the raw key (only shown once)
    return {
      ...apiKey,
      key: fullKey, // Only returned on creation
    };
  }

  /**
   * Hash an API key for storage
   */
  hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Validate an API key and return its details
   */
  async validateKey(key: string): Promise<{
    valid: boolean;
    apiKey?: Awaited<ReturnType<typeof prisma.apiKey.findUnique>>;
    error?: string;
  }> {
    // Check prefix
    if (!key.startsWith(API_KEY_PREFIX)) {
      return { valid: false, error: 'Invalid API key format' };
    }

    // Hash and lookup
    const keyHash = this.hashKey(key);
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            plan: true,
            isActive: true,
          },
        },
      },
    });

    if (!apiKey) {
      return { valid: false, error: 'API key not found' };
    }

    // Check if active
    if (!apiKey.isActive) {
      return { valid: false, error: 'API key is disabled' };
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    // Check workspace is active (if applicable)
    if (apiKey.workspace && !apiKey.workspace.isActive) {
      return { valid: false, error: 'Workspace is disabled' };
    }

    return { valid: true, apiKey };
  }

  /**
   * Record API key usage
   */
  async recordUsage(keyId: string) {
    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    });
  }

  /**
   * Check if API key has permission
   */
  hasPermission(apiKey: { permissions: unknown }, scope: string): boolean {
    const permissions = apiKey.permissions as string[];

    // 'all' scope grants full access
    if (permissions.includes('all')) {
      return true;
    }

    return permissions.includes(scope);
  }

  /**
   * Get all API keys for a user/workspace
   */
  async getApiKeys(params: { userId?: string; workspaceId?: string }) {
    const where: { userId?: string; workspaceId?: string | null } = {};

    if (params.workspaceId) {
      where.workspaceId = params.workspaceId;
    } else if (params.userId) {
      where.userId = params.userId;
      where.workspaceId = null; // Personal keys only
    }

    return prisma.apiKey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        rateLimit: true,
        lastUsedAt: true,
        usageCount: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get API key by ID
   */
  async getApiKey(keyId: string) {
    return prisma.apiKey.findUnique({
      where: { id: keyId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        rateLimit: true,
        lastUsedAt: true,
        usageCount: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Update API key
   */
  async updateApiKey(
    keyId: string,
    data: {
      name?: string;
      permissions?: string[];
      rateLimit?: number;
      expiresAt?: Date | null;
      isActive?: boolean;
    }
  ) {
    return prisma.apiKey.update({
      where: { id: keyId },
      data,
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        rateLimit: true,
        expiresAt: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Revoke (delete) an API key
   */
  async revokeApiKey(keyId: string) {
    return prisma.apiKey.delete({
      where: { id: keyId },
    });
  }

  /**
   * Regenerate an API key (creates new key, revokes old)
   */
  async regenerateApiKey(keyId: string) {
    const existing = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!existing) {
      throw new Error('API key not found');
    }

    // Delete old key
    await prisma.apiKey.delete({ where: { id: keyId } });

    // Create new key with same settings
    return this.createApiKey(existing.userId, {
      name: existing.name,
      workspaceId: existing.workspaceId || undefined,
      permissions: existing.permissions as string[],
      rateLimit: existing.rateLimit,
      expiresAt: existing.expiresAt || undefined,
    });
  }

  /**
   * Get usage stats for an API key
   */
  async getUsageStats(keyId: string, days: number = 30) {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      select: {
        usageCount: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    // For detailed stats, you'd typically use a time-series database
    // This is a simplified version
    return {
      totalRequests: apiKey.usageCount,
      lastUsed: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      averagePerDay: apiKey.usageCount / Math.max(1, days),
    };
  }

  /**
   * Check rate limit for an API key
   * Returns remaining requests and reset time
   */
  async checkRateLimit(keyId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    // In production, you'd use Redis for rate limiting
    // This is a simplified check using the database

    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
      select: {
        rateLimit: true,
        usageCount: true,
      },
    });

    if (!apiKey) {
      return { allowed: false, remaining: 0, resetAt: new Date() };
    }

    // Simplified: just check if under limit
    // Real implementation would track requests per minute with Redis
    const remaining = Math.max(0, apiKey.rateLimit - (apiKey.usageCount % apiKey.rateLimit));
    const resetAt = new Date();
    resetAt.setMinutes(resetAt.getMinutes() + 1);

    return {
      allowed: remaining > 0,
      remaining,
      resetAt,
    };
  }
}

export const apiKeyService = new ApiKeyService();
export default apiKeyService;
