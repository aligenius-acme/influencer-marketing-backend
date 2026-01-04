/**
 * CRM Controller
 *
 * Handles CRM integration endpoints for Salesforce and HubSpot
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

/**
 * Get available CRM integrations
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
 * Get OAuth URL for a CRM
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

    if (crm !== 'salesforce' && crm !== 'hubspot') {
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
 * Exchange auth code for tokens
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

    if (crm !== 'salesforce' && crm !== 'hubspot') {
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
 * Sync a single influencer to CRM
 */
export async function syncInfluencer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { crm } = req.params;
    const { influencerId, accessToken, refreshToken, instanceUrl } = req.body;

    if (!influencerId || !accessToken) {
      return res.status(400).json({
        success: false,
        error: { message: 'influencerId and accessToken are required' },
      });
    }

    if (crm !== 'salesforce' && crm !== 'hubspot') {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid CRM. Must be salesforce or hubspot' },
      });
    }

    const result = await crmService.syncInfluencerToContact(
      crm,
      { accessToken, refreshToken, instanceUrl },
      influencerId
    );

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
 * Sync a single campaign to CRM
 */
export async function syncCampaign(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { crm } = req.params;
    const { campaignId, accessToken, refreshToken, instanceUrl } = req.body;

    if (!campaignId || !accessToken) {
      return res.status(400).json({
        success: false,
        error: { message: 'campaignId and accessToken are required' },
      });
    }

    if (crm !== 'salesforce' && crm !== 'hubspot') {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid CRM. Must be salesforce or hubspot' },
      });
    }

    const result = await crmService.syncCampaignToDeal(
      crm,
      { accessToken, refreshToken, instanceUrl },
      campaignId
    );

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
 * Bulk sync all influencers to CRM
 */
export async function bulkSyncInfluencers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { crm } = req.params;
    const { accessToken, refreshToken, instanceUrl } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: { message: 'accessToken is required' },
      });
    }

    if (crm !== 'salesforce' && crm !== 'hubspot') {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid CRM. Must be salesforce or hubspot' },
      });
    }

    const result = await crmService.bulkSyncInfluencers(
      crm,
      { accessToken, refreshToken, instanceUrl },
      userId
    );

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
 * Bulk sync all campaigns to CRM
 */
export async function bulkSyncCampaigns(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }

    const { crm } = req.params;
    const { accessToken, refreshToken, instanceUrl } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: { message: 'accessToken is required' },
      });
    }

    if (crm !== 'salesforce' && crm !== 'hubspot') {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid CRM. Must be salesforce or hubspot' },
      });
    }

    const result = await crmService.bulkSyncCampaigns(
      crm,
      { accessToken, refreshToken, instanceUrl },
      userId
    );

    res.json({
      success: true,
      data: result,
      message: `Synced ${result.success}/${result.total} campaigns`,
    });
  } catch (error) {
    next(error);
  }
}
