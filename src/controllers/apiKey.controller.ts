/**
 * API Key Controller
 *
 * Handles API key management endpoints
 */

import { Request, Response } from 'express';
import { apiKeyService, API_SCOPES } from '../services/apiKey.service.js';
import { auditService, AUDIT_ACTIONS, RESOURCE_TYPES } from '../services/audit.service.js';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Create a new API key
 */
export const createApiKey = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, workspaceId, permissions, rateLimit, expiresAt } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'API key name is required' });
    }

    // Validate permissions
    if (permissions) {
      const invalidPerms = permissions.filter(
        (p: string) => !Object.keys(API_SCOPES).includes(p)
      );
      if (invalidPerms.length > 0) {
        return res.status(400).json({
          error: `Invalid permissions: ${invalidPerms.join(', ')}`,
        });
      }
    }

    const apiKey = await apiKeyService.createApiKey(userId, {
      name,
      workspaceId,
      permissions,
      rateLimit,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    // Log audit event
    await auditService.logCreate(
      RESOURCE_TYPES.API_KEY,
      apiKey.id,
      apiKey.name,
      { name, permissions, workspaceId },
      { workspaceId, userId }
    );

    res.status(201).json({
      message: 'API key created successfully',
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key, // Only shown once!
        keyPrefix: apiKey.keyPrefix,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      warning: 'Save this API key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('[ApiKeyController] Create error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
};

/**
 * Get all API keys
 */
export const getApiKeys = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { workspaceId } = req.query;

    const apiKeys = await apiKeyService.getApiKeys({
      userId,
      workspaceId: workspaceId as string,
    });

    res.json({ apiKeys });
  } catch (error) {
    console.error('[ApiKeyController] Get keys error:', error);
    res.status(500).json({ error: 'Failed to get API keys' });
  }
};

/**
 * Get API key by ID
 */
export const getApiKey = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const apiKey = await apiKeyService.getApiKey(id);

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ apiKey });
  } catch (error) {
    console.error('[ApiKeyController] Get key error:', error);
    res.status(500).json({ error: 'Failed to get API key' });
  }
};

/**
 * Update API key
 */
export const updateApiKey = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { name, permissions, rateLimit, expiresAt, isActive } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate permissions
    if (permissions) {
      const invalidPerms = permissions.filter(
        (p: string) => !Object.keys(API_SCOPES).includes(p)
      );
      if (invalidPerms.length > 0) {
        return res.status(400).json({
          error: `Invalid permissions: ${invalidPerms.join(', ')}`,
        });
      }
    }

    const apiKey = await apiKeyService.updateApiKey(id, {
      name,
      permissions,
      rateLimit,
      expiresAt: expiresAt === null ? null : expiresAt ? new Date(expiresAt) : undefined,
      isActive,
    });

    // Log audit event
    await auditService.logUpdate(
      RESOURCE_TYPES.API_KEY,
      id,
      apiKey.name,
      {},
      { name, permissions, rateLimit, isActive },
      { userId }
    );

    res.json({
      message: 'API key updated successfully',
      apiKey,
    });
  } catch (error) {
    console.error('[ApiKeyController] Update error:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
};

/**
 * Revoke API key
 */
export const revokeApiKey = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const apiKey = await apiKeyService.getApiKey(id);
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await apiKeyService.revokeApiKey(id);

    // Log audit event
    await auditService.log({
      userId,
      action: AUDIT_ACTIONS.API_KEY_REVOKE,
      resourceType: RESOURCE_TYPES.API_KEY,
      resourceId: id,
      resourceName: apiKey.name,
    });

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('[ApiKeyController] Revoke error:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
};

/**
 * Regenerate API key
 */
export const regenerateApiKey = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const newApiKey = await apiKeyService.regenerateApiKey(id);

    // Log audit event
    await auditService.log({
      userId,
      action: AUDIT_ACTIONS.API_KEY_CREATE,
      resourceType: RESOURCE_TYPES.API_KEY,
      resourceId: newApiKey.id,
      resourceName: newApiKey.name,
      newValue: { regenerated: true },
    });

    res.json({
      message: 'API key regenerated successfully',
      apiKey: {
        id: newApiKey.id,
        name: newApiKey.name,
        key: newApiKey.key,
        keyPrefix: newApiKey.keyPrefix,
        permissions: newApiKey.permissions,
        rateLimit: newApiKey.rateLimit,
        expiresAt: newApiKey.expiresAt,
      },
      warning: 'Save this API key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('[ApiKeyController] Regenerate error:', error);
    const message = error instanceof Error ? error.message : 'Failed to regenerate API key';
    res.status(400).json({ error: message });
  }
};

/**
 * Get API key usage stats
 */
export const getUsageStats = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { days } = req.query;

    const stats = await apiKeyService.getUsageStats(
      id,
      days ? parseInt(days as string, 10) : 30
    );

    res.json({ stats });
  } catch (error) {
    console.error('[ApiKeyController] Get usage error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get usage stats';
    res.status(400).json({ error: message });
  }
};

/**
 * Get available scopes
 */
export const getScopes = async (_req: Request, res: Response) => {
  try {
    res.json({ scopes: API_SCOPES });
  } catch (error) {
    console.error('[ApiKeyController] Get scopes error:', error);
    res.status(500).json({ error: 'Failed to get scopes' });
  }
};
