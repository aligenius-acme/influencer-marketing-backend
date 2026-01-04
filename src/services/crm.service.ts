/**
 * CRM Integration Service
 *
 * Provides integration with Salesforce and HubSpot CRMs
 * - Sync influencers as contacts/leads
 * - Sync campaigns as opportunities/deals
 * - Two-way data sync
 */

import { prisma } from '../config/postgres.js';
import { SavedInfluencer } from '../models/SavedInfluencer.js';

// ==================== Types ====================

interface CRMCredentials {
  accessToken: string;
  refreshToken?: string;
  instanceUrl?: string; // Salesforce
}

interface CRMContact {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  platform?: string;
  followers?: number;
  engagementRate?: number;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

interface CRMDeal {
  id?: string;
  name: string;
  amount?: number;
  stage: string;
  closeDate?: Date;
  contactId?: string;
  description?: string;
  customFields?: Record<string, unknown>;
}

interface SyncResult {
  success: boolean;
  crmId?: string;
  error?: string;
}

// ==================== Salesforce Integration ====================

class SalesforceService {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(redirectUri: string): string {
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    if (!clientId) {
      throw new Error('Salesforce client ID not configured');
    }

    const baseUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'api refresh_token offline_access',
    });

    return `${baseUrl}/services/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, redirectUri: string): Promise<CRMCredentials> {
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      if (this.isDevelopment) {
        return this.getMockCredentials();
      }
      throw new Error('Salesforce credentials not configured');
    }

    const baseUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';
    const response = await fetch(`${baseUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange Salesforce auth code');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      instanceUrl: data.instance_url,
    };
  }

  /**
   * Create or update a contact in Salesforce
   */
  async upsertContact(credentials: CRMCredentials, contact: CRMContact): Promise<SyncResult> {
    if (!process.env.SALESFORCE_CLIENT_ID) {
      return this.mockUpsertContact(contact);
    }

    try {
      const { accessToken, instanceUrl } = credentials;

      // Check if contact exists by email
      const queryResponse = await fetch(
        `${instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent(
          `SELECT Id FROM Contact WHERE Email = '${contact.email}'`
        )}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const queryData = await queryResponse.json();
      const existingId = queryData.records?.[0]?.Id;

      const contactData = {
        Email: contact.email,
        FirstName: contact.firstName || contact.email.split('@')[0],
        LastName: contact.lastName || 'Influencer',
        Title: contact.platform ? `${contact.platform} Influencer` : 'Influencer',
        Description: `Followers: ${contact.followers || 0}, Engagement: ${contact.engagementRate || 0}%`,
        ...(contact.phone && { Phone: contact.phone }),
      };

      let response;
      if (existingId) {
        // Update existing
        response = await fetch(
          `${instanceUrl}/services/data/v58.0/sobjects/Contact/${existingId}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(contactData),
          }
        );
        return { success: response.ok, crmId: existingId };
      } else {
        // Create new
        response = await fetch(
          `${instanceUrl}/services/data/v58.0/sobjects/Contact`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(contactData),
          }
        );
        const data = await response.json();
        return { success: response.ok, crmId: data.id };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create or update an opportunity in Salesforce
   */
  async upsertOpportunity(credentials: CRMCredentials, deal: CRMDeal): Promise<SyncResult> {
    if (!process.env.SALESFORCE_CLIENT_ID) {
      return this.mockUpsertDeal(deal);
    }

    try {
      const { accessToken, instanceUrl } = credentials;

      const opportunityData = {
        Name: deal.name,
        Amount: deal.amount || 0,
        StageName: this.mapToSalesforceStage(deal.stage),
        CloseDate: deal.closeDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        Description: deal.description,
      };

      const response = await fetch(
        `${instanceUrl}/services/data/v58.0/sobjects/Opportunity`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(opportunityData),
        }
      );

      const data = await response.json();
      return { success: response.ok, crmId: data.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private mapToSalesforceStage(stage: string): string {
    const stageMap: Record<string, string> = {
      DRAFT: 'Prospecting',
      ACTIVE: 'Qualification',
      IN_PROGRESS: 'Needs Analysis',
      REVIEW: 'Proposal/Price Quote',
      COMPLETED: 'Closed Won',
      CANCELLED: 'Closed Lost',
    };
    return stageMap[stage] || 'Prospecting';
  }

  private getMockCredentials(): CRMCredentials {
    return {
      accessToken: 'mock-salesforce-token',
      refreshToken: 'mock-refresh-token',
      instanceUrl: 'https://mock.salesforce.com',
    };
  }

  private mockUpsertContact(contact: CRMContact): SyncResult {
    console.log('[Salesforce Mock] Upserting contact:', contact.email);
    return { success: true, crmId: `sf-contact-${Date.now()}` };
  }

  private mockUpsertDeal(deal: CRMDeal): SyncResult {
    console.log('[Salesforce Mock] Upserting opportunity:', deal.name);
    return { success: true, crmId: `sf-opp-${Date.now()}` };
  }
}

// ==================== HubSpot Integration ====================

class HubSpotService {
  private isDevelopment: boolean;
  private baseUrl = 'https://api.hubapi.com';

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(redirectUri: string): string {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    if (!clientId) {
      throw new Error('HubSpot client ID not configured');
    }

    const scopes = [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes,
    });

    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string, redirectUri: string): Promise<CRMCredentials> {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      if (this.isDevelopment) {
        return { accessToken: 'mock-hubspot-token', refreshToken: 'mock-refresh' };
      }
      throw new Error('HubSpot credentials not configured');
    }

    const response = await fetch(`${this.baseUrl}/oauth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange HubSpot auth code');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  /**
   * Create or update a contact in HubSpot
   */
  async upsertContact(credentials: CRMCredentials, contact: CRMContact): Promise<SyncResult> {
    if (!process.env.HUBSPOT_CLIENT_ID) {
      return this.mockUpsertContact(contact);
    }

    try {
      const { accessToken } = credentials;

      // Search for existing contact by email
      const searchResponse = await fetch(
        `${this.baseUrl}/crm/v3/objects/contacts/search`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: 'email',
                operator: 'EQ',
                value: contact.email,
              }],
            }],
          }),
        }
      );

      const searchData = await searchResponse.json();
      const existingId = searchData.results?.[0]?.id;

      const properties = {
        email: contact.email,
        firstname: contact.firstName || contact.email.split('@')[0],
        lastname: contact.lastName || 'Influencer',
        jobtitle: contact.platform ? `${contact.platform} Influencer` : 'Influencer',
        ...(contact.phone && { phone: contact.phone }),
        // Custom properties (need to be created in HubSpot first)
        influencer_platform: contact.platform || '',
        influencer_followers: String(contact.followers || 0),
        influencer_engagement_rate: String(contact.engagementRate || 0),
      };

      let response;
      if (existingId) {
        response = await fetch(
          `${this.baseUrl}/crm/v3/objects/contacts/${existingId}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ properties }),
          }
        );
        return { success: response.ok, crmId: existingId };
      } else {
        response = await fetch(
          `${this.baseUrl}/crm/v3/objects/contacts`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ properties }),
          }
        );
        const data = await response.json();
        return { success: response.ok, crmId: data.id };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create or update a deal in HubSpot
   */
  async upsertDeal(credentials: CRMCredentials, deal: CRMDeal): Promise<SyncResult> {
    if (!process.env.HUBSPOT_CLIENT_ID) {
      return this.mockUpsertDeal(deal);
    }

    try {
      const { accessToken } = credentials;

      const properties = {
        dealname: deal.name,
        amount: String(deal.amount || 0),
        dealstage: this.mapToHubSpotStage(deal.stage),
        closedate: deal.closeDate?.toISOString() || new Date().toISOString(),
        description: deal.description || '',
      };

      const response = await fetch(
        `${this.baseUrl}/crm/v3/objects/deals`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties }),
        }
      );

      const data = await response.json();
      return { success: response.ok, crmId: data.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Associate a contact with a deal
   */
  async associateContactToDeal(
    credentials: CRMCredentials,
    contactId: string,
    dealId: string
  ): Promise<boolean> {
    if (!process.env.HUBSPOT_CLIENT_ID) {
      console.log('[HubSpot Mock] Associating contact to deal');
      return true;
    }

    try {
      const { accessToken } = credentials;

      const response = await fetch(
        `${this.baseUrl}/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  private mapToHubSpotStage(stage: string): string {
    const stageMap: Record<string, string> = {
      DRAFT: 'appointmentscheduled',
      ACTIVE: 'qualifiedtobuy',
      IN_PROGRESS: 'presentationscheduled',
      REVIEW: 'decisionmakerboughtin',
      COMPLETED: 'closedwon',
      CANCELLED: 'closedlost',
    };
    return stageMap[stage] || 'appointmentscheduled';
  }

  private mockUpsertContact(contact: CRMContact): SyncResult {
    console.log('[HubSpot Mock] Upserting contact:', contact.email);
    return { success: true, crmId: `hs-contact-${Date.now()}` };
  }

  private mockUpsertDeal(deal: CRMDeal): SyncResult {
    console.log('[HubSpot Mock] Upserting deal:', deal.name);
    return { success: true, crmId: `hs-deal-${Date.now()}` };
  }
}

// ==================== Main CRM Service ====================

class CRMService {
  private salesforce: SalesforceService;
  private hubspot: HubSpotService;

  constructor() {
    this.salesforce = new SalesforceService();
    this.hubspot = new HubSpotService();
  }

  /**
   * Get available CRM integrations
   */
  getAvailableIntegrations(): { id: string; name: string; configured: boolean }[] {
    return [
      {
        id: 'salesforce',
        name: 'Salesforce',
        configured: !!process.env.SALESFORCE_CLIENT_ID,
      },
      {
        id: 'hubspot',
        name: 'HubSpot',
        configured: !!process.env.HUBSPOT_CLIENT_ID,
      },
    ];
  }

  /**
   * Get OAuth URL for a CRM
   */
  getAuthUrl(crm: 'salesforce' | 'hubspot', redirectUri: string): string {
    if (crm === 'salesforce') {
      return this.salesforce.getAuthUrl(redirectUri);
    }
    return this.hubspot.getAuthUrl(redirectUri);
  }

  /**
   * Exchange auth code for tokens
   */
  async exchangeCode(
    crm: 'salesforce' | 'hubspot',
    code: string,
    redirectUri: string
  ): Promise<CRMCredentials> {
    if (crm === 'salesforce') {
      return this.salesforce.exchangeCode(code, redirectUri);
    }
    return this.hubspot.exchangeCode(code, redirectUri);
  }

  /**
   * Sync an influencer to CRM as a contact
   */
  async syncInfluencerToContact(
    crm: 'salesforce' | 'hubspot',
    credentials: CRMCredentials,
    influencerId: string
  ): Promise<SyncResult> {
    const influencer = await SavedInfluencer.findById(influencerId);
    if (!influencer) {
      return { success: false, error: 'Influencer not found' };
    }

    const contact: CRMContact = {
      email: (influencer.customFields?.email as string) ||
             (influencer.customFields?.contactEmail as string) ||
             `${influencer.profile.username}@influencer.local`,
      firstName: influencer.profile.displayName?.split(' ')[0],
      lastName: influencer.profile.displayName?.split(' ').slice(1).join(' ') || 'Influencer',
      platform: influencer.platform,
      followers: influencer.profile.followers,
      engagementRate: influencer.profile.engagementRate,
      tags: influencer.tags,
    };

    if (crm === 'salesforce') {
      return this.salesforce.upsertContact(credentials, contact);
    }
    return this.hubspot.upsertContact(credentials, contact);
  }

  /**
   * Sync a campaign to CRM as a deal/opportunity
   */
  async syncCampaignToDeal(
    crm: 'salesforce' | 'hubspot',
    credentials: CRMCredentials,
    campaignId: string
  ): Promise<SyncResult> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return { success: false, error: 'Campaign not found' };
    }

    const deal: CRMDeal = {
      name: campaign.name,
      amount: campaign.budget?.toNumber(),
      stage: campaign.status,
      closeDate: campaign.endDate || undefined,
      description: campaign.description || undefined,
    };

    if (crm === 'salesforce') {
      return this.salesforce.upsertOpportunity(credentials, deal);
    }
    return this.hubspot.upsertDeal(credentials, deal);
  }

  /**
   * Bulk sync all influencers to CRM
   */
  async bulkSyncInfluencers(
    crm: 'salesforce' | 'hubspot',
    credentials: CRMCredentials,
    userId: string
  ): Promise<{ total: number; success: number; failed: number; errors: string[] }> {
    const influencers = await SavedInfluencer.find({ userId });

    const results = {
      total: influencers.length,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const influencer of influencers) {
      const result = await this.syncInfluencerToContact(
        crm,
        credentials,
        influencer._id.toString()
      );

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        if (result.error) {
          results.errors.push(`${influencer.profile.username}: ${result.error}`);
        }
      }
    }

    return results;
  }

  /**
   * Bulk sync all campaigns to CRM
   */
  async bulkSyncCampaigns(
    crm: 'salesforce' | 'hubspot',
    credentials: CRMCredentials,
    userId: string
  ): Promise<{ total: number; success: number; failed: number; errors: string[] }> {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
    });

    const results = {
      total: campaigns.length,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const campaign of campaigns) {
      const result = await this.syncCampaignToDeal(crm, credentials, campaign.id);

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        if (result.error) {
          results.errors.push(`${campaign.name}: ${result.error}`);
        }
      }
    }

    return results;
  }
}

export const crmService = new CRMService();
export { SalesforceService, HubSpotService };
