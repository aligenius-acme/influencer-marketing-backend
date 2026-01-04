/**
 * SSO (Single Sign-On) Service
 *
 * Handles SAML and OIDC enterprise authentication
 */

import crypto from 'crypto';
import { prisma } from '../config/postgres.js';
import { config } from '../config/index.js';
import { SsoProvider, WorkspaceRole } from '@prisma/client';

// ==================== Types ====================

export interface SsoConfig {
  provider: SsoProvider;
  // SAML
  entityId?: string;
  ssoUrl?: string;
  sloUrl?: string;
  certificate?: string;
  // OIDC
  clientId?: string;
  clientSecret?: string;
  issuerUrl?: string;
  // Settings
  autoProvision?: boolean;
  defaultRole?: WorkspaceRole;
}

export interface SamlAssertion {
  nameId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  attributes?: Record<string, string>;
}

export interface OidcUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface SsoLoginResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  isNewUser?: boolean;
  error?: string;
}

// ==================== Service ====================

class SsoService {
  // ==================== Configuration ====================

  /**
   * Get SSO configuration for a workspace
   */
  async getConfiguration(workspaceId: string) {
    return prisma.ssoConfiguration.findUnique({
      where: { workspaceId },
    });
  }

  /**
   * Create or update SSO configuration
   */
  async configureSSO(workspaceId: string, config: SsoConfig) {
    const data = {
      provider: config.provider,
      entityId: config.entityId,
      ssoUrl: config.ssoUrl,
      sloUrl: config.sloUrl,
      certificate: config.certificate,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      issuerUrl: config.issuerUrl,
      autoProvision: config.autoProvision ?? true,
      defaultRole: config.defaultRole ?? 'MEMBER',
      isActive: true,
    };

    return prisma.ssoConfiguration.upsert({
      where: { workspaceId },
      create: { workspaceId, ...data },
      update: data,
    });
  }

  /**
   * Delete SSO configuration
   */
  async deleteConfiguration(workspaceId: string) {
    return prisma.ssoConfiguration.delete({
      where: { workspaceId },
    });
  }

  /**
   * Toggle SSO active status
   */
  async toggleConfiguration(workspaceId: string) {
    const config = await prisma.ssoConfiguration.findUnique({
      where: { workspaceId },
    });

    if (!config) return null;

    return prisma.ssoConfiguration.update({
      where: { workspaceId },
      data: { isActive: !config.isActive },
    });
  }

  // ==================== SAML Flow ====================

  /**
   * Generate SAML authentication request URL
   */
  generateSamlAuthUrl(workspaceId: string, ssoConfig: { ssoUrl: string; entityId: string }): string {
    const requestId = `_${crypto.randomUUID()}`;
    const issueInstant = new Date().toISOString();
    const callbackUrl = `${config.apiUrl}/sso/saml/callback`;

    // Build SAML AuthnRequest
    const authnRequest = `
      <samlp:AuthnRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${requestId}"
        Version="2.0"
        IssueInstant="${issueInstant}"
        Destination="${ssoConfig.ssoUrl}"
        AssertionConsumerServiceURL="${callbackUrl}"
        ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
        <saml:Issuer>${ssoConfig.entityId}</saml:Issuer>
        <samlp:NameIDPolicy
          Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
          AllowCreate="true"/>
      </samlp:AuthnRequest>
    `.trim();

    // Base64 encode and URL encode
    const encodedRequest = Buffer.from(authnRequest).toString('base64');
    const urlEncodedRequest = encodeURIComponent(encodedRequest);

    // Build redirect URL
    return `${ssoConfig.ssoUrl}?SAMLRequest=${urlEncodedRequest}&RelayState=${workspaceId}`;
  }

  /**
   * Process SAML response (simplified - in production use proper SAML library)
   */
  async processSamlResponse(samlResponse: string, relayState: string): Promise<SsoLoginResult> {
    try {
      // Decode SAML response
      const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8');

      // In production, you would:
      // 1. Validate the signature using the IdP's certificate
      // 2. Check the response status
      // 3. Verify the audience and destination
      // 4. Extract user attributes from the assertion

      // For now, parse basic assertion (mock implementation)
      const assertion = this.parseSamlAssertion(decodedResponse);

      if (!assertion || !assertion.email) {
        return { success: false, error: 'Invalid SAML response' };
      }

      // Get workspace and SSO config
      const workspaceId = relayState;
      const ssoConfig = await this.getConfiguration(workspaceId);

      if (!ssoConfig || !ssoConfig.isActive) {
        return { success: false, error: 'SSO not configured for this workspace' };
      }

      // Find or create user
      const result = await this.findOrCreateUser(assertion.email, {
        firstName: assertion.firstName,
        lastName: assertion.lastName,
        workspaceId,
        autoProvision: ssoConfig.autoProvision,
        defaultRole: ssoConfig.defaultRole,
      });

      return result;
    } catch (error) {
      console.error('[SSO] SAML processing error:', error);
      return { success: false, error: 'Failed to process SAML response' };
    }
  }

  /**
   * Parse SAML assertion (simplified)
   */
  private parseSamlAssertion(response: string): SamlAssertion | null {
    try {
      // Extract email from NameID (simplified regex - use proper XML parser in production)
      const nameIdMatch = response.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
      const email = nameIdMatch ? nameIdMatch[1] : null;

      if (!email) return null;

      // Extract first name
      const firstNameMatch = response.match(/<saml:Attribute Name="firstName"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/);
      const firstName = firstNameMatch ? firstNameMatch[1] : undefined;

      // Extract last name
      const lastNameMatch = response.match(/<saml:Attribute Name="lastName"[^>]*>\s*<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/);
      const lastName = lastNameMatch ? lastNameMatch[1] : undefined;

      return {
        nameId: email,
        email,
        firstName,
        lastName,
      };
    } catch {
      return null;
    }
  }

  // ==================== OIDC Flow ====================

  /**
   * Generate OIDC authorization URL
   */
  generateOidcAuthUrl(workspaceId: string, ssoConfig: { issuerUrl: string; clientId: string }): string {
    const state = this.encodeState({ workspaceId, timestamp: Date.now() });
    const nonce = crypto.randomUUID();
    const callbackUrl = `${config.apiUrl}/sso/oidc/callback`;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: ssoConfig.clientId,
      redirect_uri: callbackUrl,
      scope: 'openid email profile',
      state,
      nonce,
    });

    return `${ssoConfig.issuerUrl}/authorize?${params.toString()}`;
  }

  /**
   * Exchange OIDC authorization code for tokens
   */
  async exchangeOidcCode(code: string, workspaceId: string): Promise<SsoLoginResult> {
    const ssoConfig = await this.getConfiguration(workspaceId);

    if (!ssoConfig || !ssoConfig.isActive) {
      return { success: false, error: 'SSO not configured for this workspace' };
    }

    if (!ssoConfig.clientId || !ssoConfig.clientSecret || !ssoConfig.issuerUrl) {
      return { success: false, error: 'OIDC configuration incomplete' };
    }

    try {
      const callbackUrl = `${config.apiUrl}/sso/oidc/callback`;

      // Exchange code for tokens
      const tokenResponse = await fetch(`${ssoConfig.issuerUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: callbackUrl,
          client_id: ssoConfig.clientId,
          client_secret: ssoConfig.clientSecret,
        }),
      });

      if (!tokenResponse.ok) {
        return { success: false, error: 'Failed to exchange authorization code' };
      }

      const tokens = await tokenResponse.json() as { access_token: string; id_token?: string };

      // Get user info
      const userInfoResponse = await fetch(`${ssoConfig.issuerUrl}/userinfo`, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        return { success: false, error: 'Failed to get user info' };
      }

      const userInfo = await userInfoResponse.json() as OidcUserInfo;

      if (!userInfo.email) {
        return { success: false, error: 'Email not provided by identity provider' };
      }

      // Find or create user
      return this.findOrCreateUser(userInfo.email, {
        firstName: userInfo.given_name,
        lastName: userInfo.family_name,
        picture: userInfo.picture,
        workspaceId,
        autoProvision: ssoConfig.autoProvision,
        defaultRole: ssoConfig.defaultRole,
      });
    } catch (error) {
      console.error('[SSO] OIDC error:', error);
      return { success: false, error: 'OIDC authentication failed' };
    }
  }

  // ==================== User Management ====================

  /**
   * Find existing user or create new one via SSO
   */
  private async findOrCreateUser(
    email: string,
    options: {
      firstName?: string;
      lastName?: string;
      picture?: string;
      workspaceId: string;
      autoProvision: boolean;
      defaultRole: WorkspaceRole;
    }
  ): Promise<SsoLoginResult> {
    // Find existing user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    let isNewUser = false;

    if (!user) {
      if (!options.autoProvision) {
        return { success: false, error: 'User not found and auto-provisioning is disabled' };
      }

      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          emailVerified: true,
          authProvider: 'LOCAL', // Will be tracked as SSO via workspace membership
          role: 'BRAND',
        },
      });

      // Create brand profile
      const companyName = [options.firstName, options.lastName].filter(Boolean).join(' ') || email.split('@')[0];
      await prisma.brandProfile.create({
        data: {
          userId: user.id,
          companyName,
          logoUrl: options.picture,
        },
      });

      isNewUser = true;
    }

    // Ensure user is member of workspace
    const existingMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: options.workspaceId,
          userId: user.id,
        },
      },
    });

    if (!existingMembership) {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: options.workspaceId,
          userId: user.id,
          role: options.defaultRole,
        },
      });
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: [options.firstName, options.lastName].filter(Boolean).join(' ') || undefined,
      },
      isNewUser,
    };
  }

  // ==================== Helpers ====================

  /**
   * Encode state parameter
   */
  private encodeState(data: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }

  /**
   * Decode state parameter
   */
  decodeState(state: string): Record<string, unknown> | null {
    try {
      return JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return null;
    }
  }

  /**
   * Get SSO login URL for a workspace
   */
  async getLoginUrl(workspaceId: string): Promise<string | null> {
    const ssoConfig = await this.getConfiguration(workspaceId);

    if (!ssoConfig || !ssoConfig.isActive) {
      return null;
    }

    switch (ssoConfig.provider) {
      case 'SAML':
        if (ssoConfig.ssoUrl && ssoConfig.entityId) {
          return this.generateSamlAuthUrl(workspaceId, {
            ssoUrl: ssoConfig.ssoUrl,
            entityId: ssoConfig.entityId,
          });
        }
        break;

      case 'OIDC':
      case 'OKTA':
      case 'AZURE_AD':
        if (ssoConfig.issuerUrl && ssoConfig.clientId) {
          return this.generateOidcAuthUrl(workspaceId, {
            issuerUrl: ssoConfig.issuerUrl,
            clientId: ssoConfig.clientId,
          });
        }
        break;

      case 'GOOGLE_WORKSPACE':
        // Use Google OAuth with workspace domain restriction
        if (ssoConfig.clientId) {
          const state = this.encodeState({ workspaceId, timestamp: Date.now() });
          return `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${ssoConfig.clientId}&` +
            `redirect_uri=${encodeURIComponent(`${config.apiUrl}/sso/google/callback`)}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent('openid email profile')}&` +
            `state=${state}&` +
            `hd=${ssoConfig.entityId || ''}`; // hd parameter restricts to Google Workspace domain
        }
        break;
    }

    return null;
  }

  /**
   * Get SP (Service Provider) metadata for SAML
   */
  getSpMetadata(workspaceId: string): string {
    const entityId = `${config.apiUrl}/sso/metadata/${workspaceId}`;
    const acsUrl = `${config.apiUrl}/sso/saml/callback`;
    const sloUrl = `${config.apiUrl}/sso/saml/logout`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor
  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${entityId}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}"
      index="0"
      isDefault="true"/>
    <md:SingleLogoutService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${sloUrl}"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }
}

// Export singleton
export const ssoService = new SsoService();
