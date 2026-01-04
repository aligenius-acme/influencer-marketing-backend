/**
 * SSO Controller
 *
 * Handles SSO authentication endpoints
 */

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ssoService } from '../services/sso.service.js';
import { config } from '../config/index.js';
import { SsoProvider } from '@prisma/client';

// ==================== Configuration ====================

/**
 * Get SSO configuration for a workspace
 */
export const getConfiguration = async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const ssoConfig = await ssoService.getConfiguration(workspaceId);

    if (!ssoConfig) {
      return res.json({
        success: true,
        data: null,
        message: 'No SSO configuration found',
      });
    }

    // Don't expose secrets
    res.json({
      success: true,
      data: {
        provider: ssoConfig.provider,
        entityId: ssoConfig.entityId,
        ssoUrl: ssoConfig.ssoUrl,
        sloUrl: ssoConfig.sloUrl,
        issuerUrl: ssoConfig.issuerUrl,
        clientId: ssoConfig.clientId,
        autoProvision: ssoConfig.autoProvision,
        defaultRole: ssoConfig.defaultRole,
        isActive: ssoConfig.isActive,
        createdAt: ssoConfig.createdAt,
        updatedAt: ssoConfig.updatedAt,
      },
    });
  } catch (error) {
    console.error('[SSO] Get config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get SSO configuration',
    });
  }
};

/**
 * Configure SSO for a workspace
 */
export const configureSSO = async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { provider, ...configData } = req.body;

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: 'Provider is required',
      });
    }

    // Validate required fields based on provider
    if (provider === 'SAML') {
      if (!configData.ssoUrl || !configData.entityId || !configData.certificate) {
        return res.status(400).json({
          success: false,
          message: 'SAML requires ssoUrl, entityId, and certificate',
        });
      }
    } else if (['OIDC', 'OKTA', 'AZURE_AD'].includes(provider)) {
      if (!configData.issuerUrl || !configData.clientId || !configData.clientSecret) {
        return res.status(400).json({
          success: false,
          message: 'OIDC requires issuerUrl, clientId, and clientSecret',
        });
      }
    }

    const ssoConfig = await ssoService.configureSSO(workspaceId, {
      provider: provider as SsoProvider,
      ...configData,
    });

    res.json({
      success: true,
      message: 'SSO configured successfully',
      data: {
        provider: ssoConfig.provider,
        isActive: ssoConfig.isActive,
      },
    });
  } catch (error) {
    console.error('[SSO] Configure error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to configure SSO',
    });
  }
};

/**
 * Delete SSO configuration
 */
export const deleteConfiguration = async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;

    await ssoService.deleteConfiguration(workspaceId);

    res.json({
      success: true,
      message: 'SSO configuration deleted',
    });
  } catch (error) {
    console.error('[SSO] Delete config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete SSO configuration',
    });
  }
};

/**
 * Toggle SSO active status
 */
export const toggleConfiguration = async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const ssoConfig = await ssoService.toggleConfiguration(workspaceId);

    if (!ssoConfig) {
      return res.status(404).json({
        success: false,
        message: 'SSO configuration not found',
      });
    }

    res.json({
      success: true,
      message: `SSO ${ssoConfig.isActive ? 'enabled' : 'disabled'}`,
      data: { isActive: ssoConfig.isActive },
    });
  } catch (error) {
    console.error('[SSO] Toggle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle SSO',
    });
  }
};

// ==================== Login Flow ====================

/**
 * Initiate SSO login
 */
export const initiateLogin = async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const loginUrl = await ssoService.getLoginUrl(workspaceId);

    if (!loginUrl) {
      return res.status(400).json({
        success: false,
        message: 'SSO not configured for this workspace',
      });
    }

    res.json({
      success: true,
      data: { loginUrl },
    });
  } catch (error) {
    console.error('[SSO] Initiate login error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate SSO login',
    });
  }
};

/**
 * Handle SAML callback
 */
export const handleSamlCallback = async (req: Request, res: Response) => {
  try {
    const { SAMLResponse, RelayState } = req.body;

    if (!SAMLResponse) {
      return res.redirect(`${config.frontendUrl}/login?error=missing_saml_response`);
    }

    const result = await ssoService.processSamlResponse(SAMLResponse, RelayState || '');

    if (!result.success || !result.user) {
      return res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(result.error || 'sso_failed')}`);
    }

    // Generate JWT token
    const token = generateToken(result.user);

    // Redirect with token
    res.redirect(`${config.frontendUrl}/sso/callback?token=${token}&new=${result.isNewUser ? '1' : '0'}`);
  } catch (error) {
    console.error('[SSO] SAML callback error:', error);
    res.redirect(`${config.frontendUrl}/login?error=sso_failed`);
  }
};

/**
 * Handle OIDC callback
 */
export const handleOidcCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${config.frontendUrl}/login?error=${error}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${config.frontendUrl}/login?error=missing_code`);
    }

    // Decode state to get workspace ID
    const stateData = ssoService.decodeState(state as string);
    const workspaceId = stateData?.workspaceId as string;

    if (!workspaceId) {
      return res.redirect(`${config.frontendUrl}/login?error=invalid_state`);
    }

    const result = await ssoService.exchangeOidcCode(code, workspaceId);

    if (!result.success || !result.user) {
      return res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(result.error || 'sso_failed')}`);
    }

    // Generate JWT token
    const token = generateToken(result.user);

    // Redirect with token
    res.redirect(`${config.frontendUrl}/sso/callback?token=${token}&new=${result.isNewUser ? '1' : '0'}`);
  } catch (error) {
    console.error('[SSO] OIDC callback error:', error);
    res.redirect(`${config.frontendUrl}/login?error=sso_failed`);
  }
};

/**
 * Handle Google Workspace callback
 */
export const handleGoogleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${config.frontendUrl}/login?error=${error}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${config.frontendUrl}/login?error=missing_code`);
    }

    // Decode state to get workspace ID
    const stateData = ssoService.decodeState(state as string);
    const workspaceId = stateData?.workspaceId as string;

    if (!workspaceId) {
      return res.redirect(`${config.frontendUrl}/login?error=invalid_state`);
    }

    // Get SSO config for client credentials
    const ssoConfig = await ssoService.getConfiguration(workspaceId);

    if (!ssoConfig || !ssoConfig.clientId || !ssoConfig.clientSecret) {
      return res.redirect(`${config.frontendUrl}/login?error=sso_not_configured`);
    }

    // Exchange code for tokens with Google
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: ssoConfig.clientId,
        client_secret: ssoConfig.clientSecret,
        redirect_uri: `${config.apiUrl}/sso/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      return res.redirect(`${config.frontendUrl}/login?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json() as { access_token: string };

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      return res.redirect(`${config.frontendUrl}/login?error=userinfo_failed`);
    }

    interface GoogleUserInfo {
      id: string;
      email: string;
      verified_email: boolean;
      name: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
      hd?: string; // Hosted domain for Google Workspace
    }

    const userInfo = await userInfoResponse.json() as GoogleUserInfo;

    // Check domain restriction if entityId is set (Google Workspace domain)
    if (ssoConfig.entityId && userInfo.hd !== ssoConfig.entityId) {
      return res.redirect(`${config.frontendUrl}/login?error=domain_not_allowed`);
    }

    // Use the SSO service to handle user creation/lookup
    const result = await ssoService.exchangeOidcCode(code, workspaceId);

    if (!result.success || !result.user) {
      return res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(result.error || 'sso_failed')}`);
    }

    // Generate JWT token
    const token = generateToken(result.user);

    // Redirect with token
    res.redirect(`${config.frontendUrl}/sso/callback?token=${token}&new=${result.isNewUser ? '1' : '0'}`);
  } catch (error) {
    console.error('[SSO] Google callback error:', error);
    res.redirect(`${config.frontendUrl}/login?error=sso_failed`);
  }
};

// ==================== Metadata ====================

/**
 * Get SP metadata for SAML
 */
export const getSpMetadata = async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;

    const metadata = ssoService.getSpMetadata(workspaceId);

    res.set('Content-Type', 'application/xml');
    res.send(metadata);
  } catch (error) {
    console.error('[SSO] Get metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate SP metadata',
    });
  }
};

// ==================== Helpers ====================

/**
 * Generate JWT token for authenticated user
 */
function generateToken(user: { id: string; email: string }): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/**
 * Get available SSO providers
 */
export const getProviders = async (_req: Request, res: Response) => {
  const providers = [
    { value: 'SAML', label: 'SAML 2.0', description: 'Generic SAML 2.0 identity provider' },
    { value: 'OIDC', label: 'OpenID Connect', description: 'Generic OIDC identity provider' },
    { value: 'OKTA', label: 'Okta', description: 'Okta identity management' },
    { value: 'AZURE_AD', label: 'Azure AD', description: 'Microsoft Azure Active Directory' },
    { value: 'GOOGLE_WORKSPACE', label: 'Google Workspace', description: 'Google Workspace (G Suite)' },
  ];

  res.json({
    success: true,
    data: providers,
  });
};
