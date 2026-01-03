/**
 * Tenant/White-Label Service
 *
 * Handles multi-tenant customization:
 * - Custom branding
 * - Custom domains
 * - Domain verification
 * - Email customization
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface BrandingColors {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

interface BrandingAssets {
  logoUrl?: string;
  logomarkUrl?: string;
  faviconUrl?: string;
  loginBackgroundUrl?: string;
}

interface EmailBranding {
  emailFromName?: string;
  emailFromAddress?: string;
  emailLogoUrl?: string;
  emailFooterText?: string;
}

class TenantService {
  /**
   * Get branding for a workspace
   */
  async getBranding(workspaceId: string) {
    return prisma.tenantBranding.findUnique({
      where: { workspaceId },
    });
  }

  /**
   * Get branding by custom domain
   */
  async getBrandingByDomain(domain: string) {
    return prisma.tenantBranding.findFirst({
      where: {
        customDomain: domain.toLowerCase(),
        domainVerified: true,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Create or update branding
   */
  async upsertBranding(
    workspaceId: string,
    data: {
      colors?: BrandingColors;
      assets?: BrandingAssets;
      email?: EmailBranding;
      loginWelcomeText?: string;
      hidePlatformBranding?: boolean;
      customLoginPage?: boolean;
    }
  ) {
    const updateData: Record<string, unknown> = {};

    // Colors
    if (data.colors) {
      if (data.colors.primaryColor) updateData.primaryColor = data.colors.primaryColor;
      if (data.colors.secondaryColor) updateData.secondaryColor = data.colors.secondaryColor;
      if (data.colors.accentColor) updateData.accentColor = data.colors.accentColor;
    }

    // Assets
    if (data.assets) {
      if (data.assets.logoUrl) updateData.logoUrl = data.assets.logoUrl;
      if (data.assets.logomarkUrl) updateData.logomarkUrl = data.assets.logomarkUrl;
      if (data.assets.faviconUrl) updateData.faviconUrl = data.assets.faviconUrl;
      if (data.assets.loginBackgroundUrl) updateData.loginBackgroundUrl = data.assets.loginBackgroundUrl;
    }

    // Email
    if (data.email) {
      if (data.email.emailFromName) updateData.emailFromName = data.email.emailFromName;
      if (data.email.emailFromAddress) updateData.emailFromAddress = data.email.emailFromAddress;
      if (data.email.emailLogoUrl) updateData.emailLogoUrl = data.email.emailLogoUrl;
      if (data.email.emailFooterText) updateData.emailFooterText = data.email.emailFooterText;
    }

    // Other settings
    if (data.loginWelcomeText !== undefined) updateData.loginWelcomeText = data.loginWelcomeText;
    if (data.hidePlatformBranding !== undefined) updateData.hidePlatformBranding = data.hidePlatformBranding;
    if (data.customLoginPage !== undefined) updateData.customLoginPage = data.customLoginPage;

    return prisma.tenantBranding.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        ...updateData,
      },
      update: updateData,
    });
  }

  /**
   * Set custom domain
   */
  async setCustomDomain(workspaceId: string, domain: string) {
    // Normalize domain
    const normalizedDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');

    // Check if domain is already in use
    const existing = await prisma.tenantBranding.findFirst({
      where: {
        customDomain: normalizedDomain,
        workspaceId: { not: workspaceId },
      },
    });

    if (existing) {
      throw new Error('Domain is already in use by another workspace');
    }

    // Generate verification token
    const verifyToken = `im-verify-${crypto.randomBytes(16).toString('hex')}`;

    return prisma.tenantBranding.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        customDomain: normalizedDomain,
        domainVerified: false,
        domainVerifyToken: verifyToken,
      },
      update: {
        customDomain: normalizedDomain,
        domainVerified: false,
        domainVerifyToken: verifyToken,
      },
    });
  }

  /**
   * Get domain verification instructions
   */
  async getDomainVerificationInfo(workspaceId: string) {
    const branding = await prisma.tenantBranding.findUnique({
      where: { workspaceId },
      select: {
        customDomain: true,
        domainVerified: true,
        domainVerifyToken: true,
      },
    });

    if (!branding || !branding.customDomain) {
      throw new Error('No custom domain configured');
    }

    return {
      domain: branding.customDomain,
      verified: branding.domainVerified,
      verificationMethod: 'TXT',
      dnsRecord: {
        type: 'TXT',
        name: `_influencer-verify.${branding.customDomain}`,
        value: branding.domainVerifyToken,
      },
      cnameRecord: {
        type: 'CNAME',
        name: branding.customDomain,
        value: 'app.influencerplatform.com', // Your platform's domain
      },
    };
  }

  /**
   * Verify custom domain
   * In production, this would actually check DNS records
   */
  async verifyDomain(workspaceId: string): Promise<{
    verified: boolean;
    message: string;
  }> {
    const branding = await prisma.tenantBranding.findUnique({
      where: { workspaceId },
      select: {
        customDomain: true,
        domainVerifyToken: true,
      },
    });

    if (!branding || !branding.customDomain) {
      return { verified: false, message: 'No custom domain configured' };
    }

    // In production, you would:
    // 1. Query DNS for TXT record at _influencer-verify.{domain}
    // 2. Check if the record matches domainVerifyToken
    // 3. Also verify CNAME is pointed correctly

    // For development, we'll simulate verification
    const isVerified = process.env.NODE_ENV === 'development' ||
      await this.checkDnsRecords(branding.customDomain, branding.domainVerifyToken);

    if (isVerified) {
      await prisma.tenantBranding.update({
        where: { workspaceId },
        data: { domainVerified: true },
      });

      return { verified: true, message: 'Domain verified successfully' };
    }

    return {
      verified: false,
      message: 'DNS records not found. Please ensure the TXT and CNAME records are properly configured.',
    };
  }

  /**
   * Check DNS records (mock implementation)
   */
  private async checkDnsRecords(domain: string, expectedToken: string | null): Promise<boolean> {
    // In production, use dns module or external service like Google DNS API
    // to verify TXT records
    console.log(`[TenantService] Checking DNS for ${domain}, token: ${expectedToken}`);

    // Mock: always return true in development
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Remove custom domain
   */
  async removeCustomDomain(workspaceId: string) {
    return prisma.tenantBranding.update({
      where: { workspaceId },
      data: {
        customDomain: null,
        domainVerified: false,
        domainVerifyToken: null,
      },
    });
  }

  /**
   * Get complete tenant configuration
   * Returns branding + workspace info for rendering
   */
  async getTenantConfig(workspaceId: string) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        branding: true,
      },
    });

    if (!workspace) {
      return null;
    }

    const branding = workspace.branding;

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        plan: workspace.plan,
      },
      branding: {
        colors: {
          primary: branding?.primaryColor || '#8b5cf6', // Default purple
          secondary: branding?.secondaryColor || '#1f2937',
          accent: branding?.accentColor || '#3b82f6',
        },
        assets: {
          logo: branding?.logoUrl,
          logomark: branding?.logomarkUrl,
          favicon: branding?.faviconUrl,
          loginBackground: branding?.loginBackgroundUrl,
        },
        customDomain: branding?.domainVerified ? branding.customDomain : null,
        hidePlatformBranding: branding?.hidePlatformBranding || false,
        customLoginPage: branding?.customLoginPage || false,
        loginWelcomeText: branding?.loginWelcomeText,
      },
      email: {
        fromName: branding?.emailFromName || workspace.name,
        fromAddress: branding?.emailFromAddress,
        logoUrl: branding?.emailLogoUrl || branding?.logoUrl,
        footerText: branding?.emailFooterText,
      },
    };
  }

  /**
   * Generate CSS variables for branding
   */
  generateCssVariables(branding: {
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
  }): string {
    const variables: string[] = [];

    if (branding.primaryColor) {
      variables.push(`--color-primary: ${branding.primaryColor};`);
    }
    if (branding.secondaryColor) {
      variables.push(`--color-secondary: ${branding.secondaryColor};`);
    }
    if (branding.accentColor) {
      variables.push(`--color-accent: ${branding.accentColor};`);
    }

    return `:root { ${variables.join(' ')} }`;
  }

  /**
   * Delete all branding for a workspace
   */
  async deleteBranding(workspaceId: string) {
    return prisma.tenantBranding.delete({
      where: { workspaceId },
    }).catch(() => null); // Ignore if doesn't exist
  }
}

export const tenantService = new TenantService();
export default tenantService;
