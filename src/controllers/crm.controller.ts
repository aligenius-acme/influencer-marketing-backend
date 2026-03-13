/**
 * CRM Controller
 *
 * Handles CRM integration endpoints for Salesforce and HubSpot
 * Supports both stored connections and legacy credential-passing
 */

import { Request, Response, NextFunction } from 'express';
import { crmService } from '../services/crm.service.js';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

type CRMType = 'salesforce' | 'hubspot';

function isValidCRM(crm: string): crm is CRMType {
  return crm === 'salesforce' || crm === 'hubspot';
}

/**
 * Get available CRM integrations
 * GET /api/v1/crm/integrations
 */
export async function getIntegrations(req: Request, res: Response, next: NextFunction) {
  try {
    const integrations = crmService.getAvailableIntegrations();
    res.json({ success: true, data: integrations });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user's CRM connections
 * GET /api/v1/crm/connections
 */
export async function getConnections(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const connections = await crmService.getConnections(userId);

    // Remove sensitive tokens from response
    const safeConnections = connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      isActive: c.isActive,
      lastSyncAt: c.lastSyncAt,
      syncError: c.syncError,
      autoSync: c.autoSync,
      syncInterval: c.syncInterval,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    res.json({ success: true, data: safeConnections });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single CRM connection
 * GET /api/v1/crm/connections/:id
 */
export async function getConnection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = req.params;
    const connections = await crmService.getConnections(userId);
    const connection = connections.find((c) => c.id === id);

    if (!connection) {
      return res.status(404).json({ success: false, error: { message: 'Connection not found' } });
    }

    // Remove sensitive tokens from response
    const safeConnection = {
      id: connection.id,
      provider: connection.provider,
      isActive: connection.isActive,
      lastSyncAt: connection.lastSyncAt,
      syncError: connection.syncError,
      autoSync: connection.autoSync,
      syncInterval: connection.syncInterval,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };

    res.json({ success: true, data: safeConnection });
  } catch (error) {
    next(error);
  }
}

/**
 * Get OAuth URL for a CRM
 * GET /api/v1/crm/:crm/auth-url
 */
export async function getAuthUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { crm } = req.params;
    const { redirectUri } = req.query;

    if (!redirectUri) {
      return res.status(400).json({
        success: false,
        error: { message: 'redirectUri is required' },
      });
    }

    if (!isValidCRM(crm)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid CRM. Must be salesforce or hubspot' },
      });
    }

    const url = crmService.getAuthUrl(crm, redirectUri as string);
    res.json({ success: true, data: { url } });
  } catch (error) {
    next(error);
  }
}

/**
 * Exchange auth code for tokens (legacy - returns credentials)
 * POST /api/v1/crm/:crm/exchange
 */
export async function exchangeCode(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { crm } = req.params;
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({
        success: false,
        error: { message: 'code and redirectUri are required' },
      });
    }

    if (!isValidCRM(crm)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid CRM. Must be salesforce or hubspot' },
      });
    }

    const credentials = await crmService.exchangeCode(crm, code, redirectUri);

    res.json({
      success: true,
      data: {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        instanceUrl: credentials.instanceUrl,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Connect to a CRM (stores credentials securely)
 * POST /api/v1/crm/:crm/connect
 */
export async function connect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { crm } = req.params;
    const { code, redirectUri, autoSync, syncInterval } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({
        success: false,
        error: { message: 'code and redirectUri are required' },
      });
    }

    if (!isValidCRM(crm)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid CRM. Must be salesforce or hubspot' },
      });
    }

    const connection = await crmService.connect(
      userId,
      crm,
      code,
      redirectUri,
      { autoSync, syncInterval }
    );

    // Return safe connection info
    res.json({
      success: true,
      data: {
        id: connection.id,
        provider: connection.provider,
        isActive: connection.isActive,
        autoSync: connection.autoSync,
        syncInterval: connection.syncInterval,
        createdAt: connection.createdAt,
      },
      message: `Successfully connected to ${crm}`,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: { message: `Already connected to ${req.params.crm}` },
      });
    }
    next(error);
  }
}

/**
 * Disconnect from a CRM
 * DELETE /api/v1/crm/:crm/disconnect
 */
export async function disconnect(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { crm } = req.params;

    if (!isValidCRM(crm)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid CRM. Must be salesforce or hubspot' },
      });
    }

    const success = await crmService.disconnect(userId, crm);

    if (success) {
      res.json({
        success: true,
        message: `Successfully disconnected from ${crm}`,
      });
    } else {
      res.status(404).json({
        success: false,
        error: { message: `No ${crm} connection found` },
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Update CRM connection settings
 * PATCH /api/v1/crm/connections/:id
 */
export async function updateConnection(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = req.params;
    const { autoSync, syncInterval } = req.body;

    // Verify connection belongs to user
    const connections = await crmService.getConnections(userId);
    const connection = connections.find((c) => c.id === id);

    if (!connection) {
      return res.status(404).json({ success: false, error: { message: 'Connection not found' } });
    }

    const updated = await crmService.updateConnectionSettings(id, { autoSync, syncInterval });

    res.json({
      success: true,
      data: {
        id: updated.id,
        provider: updated.provider,
        isActive: updated.isActive,
        autoSync: updated.autoSync,
        syncInterval: updated.syncInterval,
      },
      message: 'Connection settings updated',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get sync history for a connection
 * GET /api/v1/crm/connections/:id/history
 */
export async function getSyncHistory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Verify connection belongs to user
    const connections = await crmService.getConnections(userId);
    const connection = connections.find((c) => c.id === id);

    if (!connection) {
      return res.status(404).json({ success: false, error: { message: 'Connection not found' } });
    }

    const history = await crmService.getSyncHistory(id, limit, offset);

    res.json({
      success: true,
      data: history,
      pagination: {
        limit,
        offset,
        hasMore: history.length === limit,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get entity mappings for a connection
 * GET /api/v1/crm/connections/:id/mappings
 */
export async function getEntityMappings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = req.params;
    const { localType, syncStatus } = req.query;

    // Verify connection belongs to user
    const connections = await crmService.getConnections(userId);
    const connection = connections.find((c) => c.id === id);

    if (!connection) {
      return res.status(404).json({ success: false, error: { message: 'Connection not found' } });
    }

    const mappings = await crmService.getEntityMappings(id, {
      localType: localType as string,
      syncStatus: syncStatus as string,
    });

    res.json({ success: true, data: mappings });
  } catch (error) {
    next(error);
  }
}

/**
 * Sync a single influencer to CRM (uses stored connection)
 * POST /api/v1/crm/:crm/sync/influencer
 */
export async function syncInfluencer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { crm } = req.params;
    const { influencerId, accessToken, refreshToken, instanceUrl } = req.body;

    if (!influencerId) {
      return res.status(400).json({
        success: false,
        error: { message: 'influencerId is required' },
      });
    }

    if (!isValidCRM(crm)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid CRM. Must be salesforce or hubspot' },
      });
    }

    let result;

    // If credentials provided, use legacy method
    if (accessToken) {
      result = await crmService.syncInfluencerToContact(
        crm,
        { accessToken, refreshToken, instanceUrl },
        influencerId
      );
    } else {
      // Use stored connection
      result = await crmService.syncInfluencer(userId, crm, influencerId);
    }

    if (result.success) {
      res.json({
        success: true,
        data: { crmId: result.crmId },
        message: 'Influencer synced successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: { message: result.error || 'Failed to sync influencer' },
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Sync a single campaign to CRM (uses stored connection)
 * POST /api/v1/crm/:crm/sync/campaign
 */
export async function syncCampaign(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { crm } = req.params;
    const { campaignId, accessToken, refreshToken, instanceUrl } = req.body;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: { message: 'campaignId is required' },
      });
    }

    if (!isValidCRM(crm)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid CRM. Must be salesforce or hubspot' },
      });
    }

    let result;

    // If credentials provided, use legacy method
    if (accessToken) {
      result = await crmService.syncCampaignToDeal(
        crm,
        { accessToken, refreshToken, instanceUrl },
        campaignId
      );
    } else {
      // Use stored connection
      result = await crmService.syncCampaign(userId, crm, campaignId);
    }

    if (result.success) {
      res.json({
        success: true,
        data: { crmId: result.crmId },
        message: 'Campaign synced successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: { message: result.error || 'Failed to sync campaign' },
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Bulk sync all influencers to CRM (uses stored connection)
 * POST /api/v1/crm/:crm/sync/influencers/bulk
 */
export async function bulkSyncInfluencers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { crm } = req.params;
    const { accessToken, refreshToken, instanceUrl } = req.body;

    if (!isValidCRM(crm)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid CRM. Must be salesforce or hubspot' },
      });
    }

    let result;

    // If credentials provided, use legacy method
    if (accessToken) {
      result = await crmService.bulkSyncInfluencersLegacy(
        crm,
        { accessToken, refreshToken, instanceUrl },
        userId
      );
    } else {
      // Use stored connection
      result = await crmService.bulkSyncInfluencers(userId, crm);
    }

    res.json({
      success: true,
      data: result,
      message: `Synced ${result.success}/${result.total} influencers`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Bulk sync all campaigns to CRM (uses stored connection)
 * POST /api/v1/crm/:crm/sync/campaigns/bulk
 */
export async function bulkSyncCampaigns(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { crm } = req.params;
    const { accessToken, refreshToken, instanceUrl } = req.body;

    if (!isValidCRM(crm)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid CRM. Must be salesforce or hubspot' },
      });
    }

    let result;

    // If credentials provided, use legacy method
    if (accessToken) {
      result = await crmService.bulkSyncCampaignsLegacy(
        crm,
        { accessToken, refreshToken, instanceUrl },
        userId
      );
    } else {
      // Use stored connection
      result = await crmService.bulkSyncCampaigns(userId, crm);
    }

    res.json({
      success: true,
      data: result,
      message: `Synced ${result.success}/${result.total} campaigns`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Trigger a full sync for a connection
 * POST /api/v1/crm/connections/:id/sync
 */
export async function triggerFullSync(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { id } = req.params;
    const { entityTypes } = req.body; // Optional: ['influencers', 'campaigns']

    // Verify connection belongs to user
    const connections = await crmService.getConnections(userId);
    const connection = connections.find((c) => c.id === id);

    if (!connection) {
      return res.status(404).json({ success: false, error: { message: 'Connection not found' } });
    }

    const crm = connection.provider.toLowerCase() as CRMType;
    const results: Record<string, any> = {};

    // Sync influencers
    if (!entityTypes || entityTypes.includes('influencers')) {
      results.influencers = await crmService.bulkSyncInfluencers(userId, crm);
    }

    // Sync campaigns
    if (!entityTypes || entityTypes.includes('campaigns')) {
      results.campaigns = await crmService.bulkSyncCampaigns(userId, crm);
    }

    res.json({
      success: true,
      data: results,
      message: 'Sync completed',
    });
  } catch (error) {
    next(error);
  }
}
