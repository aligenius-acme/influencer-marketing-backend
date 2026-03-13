/**
 * CRM Integration Service
 *
 * Provides integration with Salesforce and HubSpot CRMs
 * - Sync influencers as contacts/leads
 * - Sync campaigns as opportunities/deals
 * - Two-way data sync
 * - Persistent connection and mapping storage
 */

import { prisma } from '../config/postgres.js';
import { SavedInfluencer } from '../models/SavedInfluencer.js';
import { CRMProvider, CRMSyncStatus, CRMConnection, CRMEntityMapping } from '@prisma/client';
import crypto from 'crypto';

// ==================== Types ====================

interface CRMCredentials {
  accessToken: string;
  refreshToken?: string;
  instanceUrl?: string; // Salesforce
  portalId?: string;    // HubSpot
  expiresAt?: Date;
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
  isNew?: boolean;
}

interface BulkSyncResult {
  total: number;
  success: number;
  failed: number;
  created: number;
  updated: number;
  errors: string[];
}

// ==================== Connection Management ====================

class ConnectionManager {
  /**
   * Save or update a CRM connection
   */
  async saveConnection(
    userId: string,
    provider: CRMProvider,
    credentials: CRMCredentials
  ): Promise<CRMConnection> {
    return prisma.cRMConnection.upsert({
      where: {
        userId_provider: { userId, provider },
      },
      create: {
        userId,
        provider,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        tokenExpiresAt: credentials.expiresAt,
        instanceUrl: credentials.instanceUrl,
        portalId: credentials.portalId,
        isActive: true,
      },
      update: {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        tokenExpiresAt: credentials.expiresAt,
        instanceUrl: credentials.instanceUrl,
        portalId: credentials.portalId,
        isActive: true,
        syncError: null,
      },
    });
  }

  /**
   * Get a CRM connection for a user
   */
  async getConnection(
    userId: string,
    provider: CRMProvider
  ): Promise<CRMConnection | null> {
    return prisma.cRMConnection.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    });
  }

  /**
   * Get all active connections for a user
   */
  async getUserConnections(userId: string): Promise<CRMConnection[]> {
    return prisma.cRMConnection.findMany({
      where: { userId, isActive: true },
    });
  }

  /**
   * Disconnect a CRM
   */
  async disconnect(userId: string, provider: CRMProvider): Promise<boolean> {
    try {
      await prisma.cRMConnection.update({
        where: {
          userId_provider: { userId, provider },
        },
        data: {
          isActive: false,
          accessToken: '',
          refreshToken: null,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update connection settings
   */
  async updateSettings(
    connectionId: string,
    settings: { autoSync?: boolean; syncInterval?: number }
  ): Promise<CRMConnection> {
    return prisma.cRMConnection.update({
      where: { id: connectionId },
      data: {
        autoSync: settings.autoSync,
        syncInterval: settings.syncInterval,
      },
    });
  }

  /**
   * Update last sync time
   */
  async updateLastSync(connectionId: string, error?: string): Promise<void> {
    await prisma.cRMConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        syncError: error || null,
      },
    });
  }

  /**
   * Get credentials from connection
   */
  getCredentials(connection: CRMConnection): CRMCredentials {
    return {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken || undefined,
      instanceUrl: connection.instanceUrl || undefined,
      portalId: connection.portalId || undefined,
      expiresAt: connection.tokenExpiresAt || undefined,
    };
  }
}

// ==================== Entity Mapping Management ====================

class MappingManager {
  /**
   * Save or update an entity mapping
   */
  async saveMapping(
    connectionId: string,
    userId: string,
    provider: CRMProvider,
    localType: string,
    localId: string,
    crmId: string,
    crmType: string,
    dataHash?: string
  ): Promise<CRMEntityMapping> {
    return prisma.cRMEntityMapping.upsert({
      where: {
        userId_provider_localType_localId: {
          userId,
          provider,
          localType,
          localId,
        },
      },
      create: {
        connectionId,
        userId,
        provider,
        localType,
        localId,
        crmId,
        crmType,
        syncStatus: CRMSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
        localDataHash: dataHash,
      },
      update: {
        crmId,
        syncStatus: CRMSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
        syncError: null,
        localDataHash: dataHash,
      },
    });
  }

  /**
   * Get mapping for a local entity
   */
  async getMapping(
    userId: string,
    provider: CRMProvider,
    localType: string,
    localId: string
  ): Promise<CRMEntityMapping | null> {
    return prisma.cRMEntityMapping.findUnique({
      where: {
        userId_provider_localType_localId: {
          userId,
          provider,
          localType,
          localId,
        },
      },
    });
  }

  /**
   * Get all mappings for a connection with optional filters
   */
  async getConnectionMappings(
    connectionId: string,
    filters?: { localType?: string; syncStatus?: string }
  ): Promise<CRMEntityMapping[]> {
    return prisma.cRMEntityMapping.findMany({
      where: {
        connectionId,
        ...(filters?.localType && { localType: filters.localType }),
        ...(filters?.syncStatus && { syncStatus: filters.syncStatus as CRMSyncStatus }),
      },
      orderBy: { lastSyncedAt: 'desc' },
    });
  }

  /**
   * Mark mapping as failed
   */
  async markFailed(mappingId: string, error: string): Promise<void> {
    await prisma.cRMEntityMapping.update({
      where: { id: mappingId },
      data: {
        syncStatus: CRMSyncStatus.FAILED,
        syncError: error,
      },
    });
  }

  /**
   * Generate data hash for change detection
   */
  generateHash(data: Record<string, unknown>): string {
    return crypto
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
  }
}

// ==================== Sync Log Management ====================

class SyncLogManager {
  /**
   * Create a sync log entry
   */
  async startSync(
    connectionId: string,
    userId: string,
    syncType: string,
    direction: string,
    entityType: string
  ) {
    return prisma.cRMSyncLog.create({
      data: {
        connectionId,
        userId,
        syncType,
        direction,
        entityType,
        status: 'running',
      },
    });
  }

  /**
   * Complete a sync log
   */
  async completeSync(
    logId: string,
    results: {
      processed: number;
      created: number;
      updated: number;
      failed: number;
      errors: string[];
    }
  ) {
    await prisma.cRMSyncLog.update({
      where: { id: logId },
      data: {
        status: results.failed > 0 && results.processed === results.failed ? 'failed' : 'completed',
        recordsProcessed: results.processed,
        recordsCreated: results.created,
        recordsUpdated: results.updated,
        recordsFailed: results.failed,
        errors: results.errors,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Get sync history for a connection
   */
  async getSyncHistory(connectionId: string, limit = 10, offset = 0) {
    return prisma.cRMSyncLog.findMany({
      where: { connectionId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}

// ==================== Salesforce Integration ====================

class SalesforceService {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

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

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      instance_url: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      instanceUrl: data.instance_url,
    };
  }

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

      const queryData = await queryResponse.json() as { records?: { Id: string }[] };
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
        return { success: response.ok, crmId: existingId, isNew: false };
      } else {
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
        const data = await response.json() as { id: string };
        return { success: response.ok, crmId: data.id, isNew: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

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

      const data = await response.json() as { id: string };
      return { success: response.ok, crmId: data.id, isNew: true };
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
    return { success: true, crmId: `sf-contact-${Date.now()}`, isNew: true };
  }

  private mockUpsertDeal(deal: CRMDeal): SyncResult {
    console.log('[Salesforce Mock] Upserting opportunity:', deal.name);
    return { success: true, crmId: `sf-opp-${Date.now()}`, isNew: true };
  }
}

// ==================== HubSpot Integration ====================

class HubSpotService {
  private isDevelopment: boolean;
  private baseUrl = 'https://api.hubapi.com';

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

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

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

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

      const searchData = await searchResponse.json() as { results?: { id: string }[] };
      const existingId = searchData.results?.[0]?.id;

      const properties = {
        email: contact.email,
        firstname: contact.firstName || contact.email.split('@')[0],
        lastname: contact.lastName || 'Influencer',
        jobtitle: contact.platform ? `${contact.platform} Influencer` : 'Influencer',
        ...(contact.phone && { phone: contact.phone }),
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
        return { success: response.ok, crmId: existingId, isNew: false };
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
        const data = await response.json() as { id: string };
        return { success: response.ok, crmId: data.id, isNew: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

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

      const data = await response.json() as { id: string };
      return { success: response.ok, crmId: data.id, isNew: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

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
    return { success: true, crmId: `hs-contact-${Date.now()}`, isNew: true };
  }

  private mockUpsertDeal(deal: CRMDeal): SyncResult {
    console.log('[HubSpot Mock] Upserting deal:', deal.name);
    return { success: true, crmId: `hs-deal-${Date.now()}`, isNew: true };
  }
}

// ==================== Main CRM Service ====================

class CRMService {
  private salesforce: SalesforceService;
  private hubspot: HubSpotService;
  private connectionManager: ConnectionManager;
  private mappingManager: MappingManager;
  private syncLogManager: SyncLogManager;

  constructor() {
    this.salesforce = new SalesforceService();
    this.hubspot = new HubSpotService();
    this.connectionManager = new ConnectionManager();
    this.mappingManager = new MappingManager();
    this.syncLogManager = new SyncLogManager();
  }

  // ==================== Connection Methods ====================

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

  getAuthUrl(crm: 'salesforce' | 'hubspot', redirectUri: string): string {
    if (crm === 'salesforce') {
      return this.salesforce.getAuthUrl(redirectUri);
    }
    return this.hubspot.getAuthUrl(redirectUri);
  }

  /**
   * Connect a CRM (exchange code and save connection)
   */
  async connect(
    userId: string,
    crm: 'salesforce' | 'hubspot',
    code: string,
    redirectUri: string,
    options?: { autoSync?: boolean; syncInterval?: number }
  ): Promise<CRMConnection> {
    const provider = crm === 'salesforce' ? CRMProvider.SALESFORCE : CRMProvider.HUBSPOT;

    // Exchange code for credentials
    const credentials = crm === 'salesforce'
      ? await this.salesforce.exchangeCode(code, redirectUri)
      : await this.hubspot.exchangeCode(code, redirectUri);

    // Save connection to database
    const connection = await this.connectionManager.saveConnection(userId, provider, credentials);

    // Apply options if provided
    if (options?.autoSync !== undefined || options?.syncInterval !== undefined) {
      return this.connectionManager.updateSettings(connection.id, options);
    }

    return connection;
  }

  /**
   * Get user's CRM connections
   */
  async getConnections(userId: string): Promise<CRMConnection[]> {
    return this.connectionManager.getUserConnections(userId);
  }

  /**
   * Get a specific connection
   */
  async getConnection(userId: string, provider: CRMProvider): Promise<CRMConnection | null> {
    return this.connectionManager.getConnection(userId, provider);
  }

  /**
   * Disconnect a CRM
   */
  async disconnect(userId: string, crm: 'salesforce' | 'hubspot'): Promise<boolean> {
    const provider = crm === 'salesforce' ? CRMProvider.SALESFORCE : CRMProvider.HUBSPOT;
    return this.connectionManager.disconnect(userId, provider);
  }

  /**
   * Update connection settings
   */
  async updateConnectionSettings(
    connectionId: string,
    settings: { autoSync?: boolean; syncInterval?: number }
  ): Promise<CRMConnection> {
    return this.connectionManager.updateSettings(connectionId, settings);
  }

  /**
   * Get sync history
   */
  async getSyncHistory(connectionId: string, limit = 10, offset = 0) {
    return this.syncLogManager.getSyncHistory(connectionId, limit, offset);
  }

  /**
   * Get entity mappings for a connection
   */
  async getEntityMappings(
    connectionId: string,
    filters?: { localType?: string; syncStatus?: string }
  ) {
    return this.mappingManager.getConnectionMappings(connectionId, filters);
  }

  // ==================== Sync Methods ====================

  private toProvider(crm: string | CRMProvider): CRMProvider {
    if (typeof crm === 'string') {
      return crm.toLowerCase() === 'salesforce' ? CRMProvider.SALESFORCE : CRMProvider.HUBSPOT;
    }
    return crm;
  }

  /**
   * Sync an influencer to CRM as a contact (uses stored connection)
   */
  async syncInfluencer(
    userId: string,
    crm: string | CRMProvider,
    influencerId: string
  ): Promise<SyncResult & { mappingId?: string }> {
    const provider = this.toProvider(crm);
    const connection = await this.connectionManager.getConnection(userId, provider);
    if (!connection || !connection.isActive) {
      return { success: false, error: 'CRM not connected' };
    }

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

    const credentials = this.connectionManager.getCredentials(connection);
    const result = provider === CRMProvider.SALESFORCE
      ? await this.salesforce.upsertContact(credentials, contact)
      : await this.hubspot.upsertContact(credentials, contact);

    if (result.success && result.crmId) {
      // Save mapping
      const dataHash = this.mappingManager.generateHash(contact as unknown as Record<string, unknown>);
      const mapping = await this.mappingManager.saveMapping(
        connection.id,
        userId,
        provider,
        'influencer',
        influencerId,
        result.crmId,
        'Contact',
        dataHash
      );

      // Update last sync
      await this.connectionManager.updateLastSync(connection.id);

      return { ...result, mappingId: mapping.id };
    }

    return result;
  }

  /**
   * Sync a campaign to CRM as a deal/opportunity (uses stored connection)
   */
  async syncCampaign(
    userId: string,
    crm: string | CRMProvider,
    campaignId: string
  ): Promise<SyncResult & { mappingId?: string }> {
    const provider = this.toProvider(crm);
    const connection = await this.connectionManager.getConnection(userId, provider);
    if (!connection || !connection.isActive) {
      return { success: false, error: 'CRM not connected' };
    }

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

    const credentials = this.connectionManager.getCredentials(connection);
    const result = provider === CRMProvider.SALESFORCE
      ? await this.salesforce.upsertOpportunity(credentials, deal)
      : await this.hubspot.upsertDeal(credentials, deal);

    if (result.success && result.crmId) {
      // Save mapping
      const dataHash = this.mappingManager.generateHash(deal as unknown as Record<string, unknown>);
      const mapping = await this.mappingManager.saveMapping(
        connection.id,
        userId,
        provider,
        'campaign',
        campaignId,
        result.crmId,
        provider === CRMProvider.SALESFORCE ? 'Opportunity' : 'Deal',
        dataHash
      );

      // Update last sync
      await this.connectionManager.updateLastSync(connection.id);

      return { ...result, mappingId: mapping.id };
    }

    return result;
  }

  /**
   * Bulk sync all influencers to CRM
   */
  async bulkSyncInfluencers(
    userId: string,
    crm: string | CRMProvider
  ): Promise<BulkSyncResult> {
    const provider = this.toProvider(crm);
    const connection = await this.connectionManager.getConnection(userId, provider);
    if (!connection || !connection.isActive) {
      return { total: 0, success: 0, failed: 0, created: 0, updated: 0, errors: ['CRM not connected'] };
    }

    const influencers = await SavedInfluencer.find({ userId });

    // Start sync log
    const syncLog = await this.syncLogManager.startSync(
      connection.id,
      userId,
      'manual',
      'outbound',
      'influencer'
    );

    const results: BulkSyncResult = {
      total: influencers.length,
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    for (const influencer of influencers) {
      const result = await this.syncInfluencer(userId, provider, influencer._id.toString());

      if (result.success) {
        results.success++;
        if (result.isNew) {
          results.created++;
        } else {
          results.updated++;
        }
      } else {
        results.failed++;
        if (result.error) {
          results.errors.push(`${influencer.profile.username}: ${result.error}`);
        }
      }
    }

    // Complete sync log
    await this.syncLogManager.completeSync(syncLog.id, {
      processed: results.total,
      created: results.created,
      updated: results.updated,
      failed: results.failed,
      errors: results.errors,
    });

    // Update connection last sync
    await this.connectionManager.updateLastSync(
      connection.id,
      results.failed > 0 ? `${results.failed} records failed` : undefined
    );

    return results;
  }

  /**
   * Bulk sync all campaigns to CRM
   */
  async bulkSyncCampaigns(
    userId: string,
    crm: string | CRMProvider
  ): Promise<BulkSyncResult> {
    const provider = this.toProvider(crm);
    const connection = await this.connectionManager.getConnection(userId, provider);
    if (!connection || !connection.isActive) {
      return { total: 0, success: 0, failed: 0, created: 0, updated: 0, errors: ['CRM not connected'] };
    }

    const campaigns = await prisma.campaign.findMany({
      where: { userId },
    });

    // Start sync log
    const syncLog = await this.syncLogManager.startSync(
      connection.id,
      userId,
      'manual',
      'outbound',
      'campaign'
    );

    const results: BulkSyncResult = {
      total: campaigns.length,
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    for (const campaign of campaigns) {
      const result = await this.syncCampaign(userId, provider, campaign.id);

      if (result.success) {
        results.success++;
        if (result.isNew) {
          results.created++;
        } else {
          results.updated++;
        }
      } else {
        results.failed++;
        if (result.error) {
          results.errors.push(`${campaign.name}: ${result.error}`);
        }
      }
    }

    // Complete sync log
    await this.syncLogManager.completeSync(syncLog.id, {
      processed: results.total,
      created: results.created,
      updated: results.updated,
      failed: results.failed,
      errors: results.errors,
    });

    // Update connection last sync
    await this.connectionManager.updateLastSync(
      connection.id,
      results.failed > 0 ? `${results.failed} records failed` : undefined
    );

    return results;
  }

  // ==================== Legacy Methods (for backward compatibility) ====================

  /**
   * @deprecated Use connect() instead
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
   * @deprecated Use syncInfluencer() instead
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
   * @deprecated Use syncCampaign() instead
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
   * @deprecated Use bulkSyncInfluencers() instead
   * Legacy bulk sync with passed credentials
   */
  async bulkSyncInfluencersLegacy(
    crm: 'salesforce' | 'hubspot',
    credentials: CRMCredentials,
    userId: string
  ): Promise<BulkSyncResult> {
    const influencers = await SavedInfluencer.find({ userId });

    const results: BulkSyncResult = {
      total: influencers.length,
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    for (const influencer of influencers) {
      const result = await this.syncInfluencerToContact(crm, credentials, influencer._id.toString());

      if (result.success) {
        results.success++;
        if (result.isNew) {
          results.created++;
        } else {
          results.updated++;
        }
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
   * @deprecated Use bulkSyncCampaigns() instead
   * Legacy bulk sync with passed credentials
   */
  async bulkSyncCampaignsLegacy(
    crm: 'salesforce' | 'hubspot',
    credentials: CRMCredentials,
    userId: string
  ): Promise<BulkSyncResult> {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
    });

    const results: BulkSyncResult = {
      total: campaigns.length,
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    for (const campaign of campaigns) {
      const result = await this.syncCampaignToDeal(crm, credentials, campaign.id);

      if (result.success) {
        results.success++;
        if (result.isNew) {
          results.created++;
        } else {
          results.updated++;
        }
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
export { SalesforceService, HubSpotService, ConnectionManager, MappingManager, SyncLogManager };
export type { CRMCredentials, CRMContact, CRMDeal, SyncResult, BulkSyncResult };
