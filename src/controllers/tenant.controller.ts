/**
 * Tenant/White-Label Controller
 *
 * Handles branding and custom domain endpoints
 */

import { Request, Response } from 'express';
import { tenantService } from '../services/tenant.service.js';
import { auditService, AUDIT_ACTIONS, RESOURCE_TYPES } from '../services/audit.service.js';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Get branding for a workspace
 */
export const getBranding = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const branding = await tenantService.getBranding(workspaceId);

    res.json({ branding });
  } catch (error) {
    console.error('[TenantController] Get branding error:', error);
    res.status(500).json({ error: 'Failed to get branding' });
  }
};

/**
 * Get branding by domain (public endpoint)
 */
export const getBrandingByDomain = async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;

    const branding = await tenantService.getBrandingByDomain(domain);

    if (!branding) {
      return res.status(404).json({ error: 'Domain not found or not verified' });
    }

    res.json({ branding });
  } catch (error) {
    console.error('[TenantController] Get branding by domain error:', error);
    res.status(500).json({ error: 'Failed to get branding' });
  }
};

/**
 * Update branding
 */
export const updateBranding = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { workspaceId } = req.params;
    const { colors, assets, email, loginWelcomeText, hidePlatformBranding, customLoginPage } =
      req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const branding = await tenantService.upsertBranding(workspaceId, {
      colors,
      assets,
      email,
      loginWelcomeText,
      hidePlatformBranding,
      customLoginPage,
    });

    // Log audit event
    await auditService.log({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.BRANDING_CHANGE,
      resourceType: RESOURCE_TYPES.BRANDING,
      resourceId: workspaceId,
      newValue: { colors, assets, email },
    });

    res.json({
      message: 'Branding updated successfully',
      branding,
    });
  } catch (error) {
    console.error('[TenantController] Update branding error:', error);
    res.status(500).json({ error: 'Failed to update branding' });
  }
};

/**
 * Set custom domain
 */
export const setCustomDomain = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { workspaceId } = req.params;
    const { domain } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const result = await tenantService.setCustomDomain(workspaceId, domain);

    // Log audit event
    await auditService.log({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.SETTINGS_CHANGE,
      resourceType: RESOURCE_TYPES.BRANDING,
      resourceId: workspaceId,
      newValue: { customDomain: domain },
    });

    res.json({
      message: 'Custom domain set successfully',
      domain: result.customDomain,
      verified: result.domainVerified,
    });
  } catch (error) {
    console.error('[TenantController] Set domain error:', error);
    const message = error instanceof Error ? error.message : 'Failed to set custom domain';
    res.status(400).json({ error: message });
  }
};

/**
 * Get domain verification info
 */
export const getDomainVerification = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const verificationInfo = await tenantService.getDomainVerificationInfo(workspaceId);

    res.json({ verification: verificationInfo });
  } catch (error) {
    console.error('[TenantController] Get verification error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get verification info';
    res.status(400).json({ error: message });
  }
};

/**
 * Verify custom domain
 */
export const verifyDomain = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { workspaceId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await tenantService.verifyDomain(workspaceId);

    if (result.verified) {
      // Log audit event
      await auditService.log({
        workspaceId,
        userId,
        action: AUDIT_ACTIONS.SETTINGS_CHANGE,
        resourceType: RESOURCE_TYPES.BRANDING,
        resourceId: workspaceId,
        newValue: { domainVerified: true },
      });
    }

    res.json(result);
  } catch (error) {
    console.error('[TenantController] Verify domain error:', error);
    res.status(500).json({ error: 'Failed to verify domain' });
  }
};

/**
 * Remove custom domain
 */
export const removeCustomDomain = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { workspaceId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await tenantService.removeCustomDomain(workspaceId);

    // Log audit event
    await auditService.log({
      workspaceId,
      userId,
      action: AUDIT_ACTIONS.SETTINGS_CHANGE,
      resourceType: RESOURCE_TYPES.BRANDING,
      resourceId: workspaceId,
      newValue: { customDomain: null },
    });

    res.json({ message: 'Custom domain removed successfully' });
  } catch (error) {
    console.error('[TenantController] Remove domain error:', error);
    res.status(500).json({ error: 'Failed to remove custom domain' });
  }
};

/**
 * Get complete tenant configuration
 */
export const getTenantConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const config = await tenantService.getTenantConfig(workspaceId);

    if (!config) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({ config });
  } catch (error) {
    console.error('[TenantController] Get config error:', error);
    res.status(500).json({ error: 'Failed to get tenant config' });
  }
};

/**
 * Get CSS variables for branding
 */
export const getCssVariables = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const branding = await tenantService.getBranding(workspaceId);

    if (!branding) {
      return res.status(404).json({ error: 'Branding not found' });
    }

    const css = tenantService.generateCssVariables(branding);

    res.type('text/css').send(css);
  } catch (error) {
    console.error('[TenantController] Get CSS error:', error);
    res.status(500).json({ error: 'Failed to generate CSS' });
  }
};

/**
 * Delete branding
 */
export const deleteBranding = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { workspaceId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await tenantService.deleteBranding(workspaceId);

    // Log audit event
    await auditService.logDelete(
      RESOURCE_TYPES.BRANDING,
      workspaceId,
      'Branding',
      {},
      { workspaceId, userId }
    );

    res.json({ message: 'Branding deleted successfully' });
  } catch (error) {
    console.error('[TenantController] Delete branding error:', error);
    res.status(500).json({ error: 'Failed to delete branding' });
  }
};
