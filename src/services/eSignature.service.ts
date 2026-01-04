/**
 * E-Signature Service
 *
 * Handles electronic signature integration with DocuSign
 * Falls back to mock mode when DocuSign is not configured
 */

import crypto from 'crypto';
import { config } from '../config/index.js';
import { prisma } from '../config/postgres.js';
import { emailService } from './email.service.js';

// ==================== Types ====================

export interface SignerInfo {
  email: string;
  name: string;
  role: string;
  order?: number;
}

export interface EnvelopeRequest {
  contractId: string;
  documentContent: string;
  documentName: string;
  emailSubject: string;
  emailMessage?: string;
  signers: SignerInfo[];
}

export interface EnvelopeStatus {
  envelopeId: string;
  status: 'created' | 'sent' | 'delivered' | 'signed' | 'completed' | 'declined' | 'voided';
  signers: {
    email: string;
    name: string;
    status: string;
    signedAt?: Date;
  }[];
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// ==================== Service ====================

class ESignatureService {
  private isConfigured: boolean;
  private baseUrl: string;
  private oauthUrl: string;

  constructor() {
    this.isConfigured = !!(
      config.docusign.integrationKey &&
      config.docusign.secretKey
    );
    this.baseUrl = config.docusign.baseUrl;
    this.oauthUrl = config.docusign.oauthUrl;

    if (!this.isConfigured) {
      console.log('[ESignatureService] DocuSign not configured - using mock mode');
    }
  }

  // ==================== OAuth Flow ====================

  /**
   * Get OAuth authorization URL for DocuSign
   */
  getAuthorizationUrl(userId: string, redirectUri: string): string {
    if (!this.isConfigured) {
      return `/contracts?mock=true&message=DocuSign not configured`;
    }

    const state = this.generateState(userId);
    const scopes = 'signature impersonation';

    return `${this.oauthUrl}/oauth/auth?` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `client_id=${config.docusign.integrationKey}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const credentials = Buffer.from(
        `${config.docusign.integrationKey}:${config.docusign.secretKey}`
      ).toString('base64');

      const response = await fetch(`${this.oauthUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        console.error('DocuSign token exchange failed:', await response.text());
        return null;
      }

      const data = await response.json() as { access_token: string; refresh_token: string; expires_in: number };

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      console.error('DocuSign OAuth error:', error);
      return null;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const credentials = Buffer.from(
        `${config.docusign.integrationKey}:${config.docusign.secretKey}`
      ).toString('base64');

      const response = await fetch(`${this.oauthUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as { access_token: string; refresh_token?: string; expires_in: number };

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      console.error('DocuSign refresh error:', error);
      return null;
    }
  }

  // ==================== Envelope Management ====================

  /**
   * Create and send envelope for signature
   */
  async createEnvelope(
    userId: string,
    request: EnvelopeRequest,
    accessToken?: string
  ): Promise<{ envelopeId: string; status: string }> {
    // Use mock mode if not configured or no token
    if (!this.isConfigured || !accessToken) {
      return this.createMockEnvelope(userId, request);
    }

    try {
      // Get account ID from user info
      const userInfo = await this.getUserInfo(accessToken);
      const accountId = userInfo?.accounts?.[0]?.accountId || config.docusign.accountId;

      // Create envelope definition
      const envelopeDefinition = this.buildEnvelopeDefinition(request);

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${accountId}/envelopes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(envelopeDefinition),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('DocuSign envelope creation failed:', error);
        // Fallback to mock
        return this.createMockEnvelope(userId, request);
      }

      const data = await response.json() as { envelopeId: string; status: string };

      // Update contract with envelope info
      await prisma.contract.update({
        where: { id: request.contractId },
        data: {
          status: 'PENDING_SIGNATURE',
          signatureProvider: 'docusign',
          externalDocumentId: data.envelopeId,
          signatureRequestId: data.envelopeId,
        },
      });

      return {
        envelopeId: data.envelopeId,
        status: data.status,
      };
    } catch (error) {
      console.error('DocuSign API error:', error);
      return this.createMockEnvelope(userId, request);
    }
  }

  /**
   * Get envelope status
   */
  async getEnvelopeStatus(
    envelopeId: string,
    accessToken?: string
  ): Promise<EnvelopeStatus | null> {
    // Check if mock envelope
    if (envelopeId.startsWith('mock_')) {
      return this.getMockEnvelopeStatus(envelopeId);
    }

    if (!this.isConfigured || !accessToken) {
      return null;
    }

    try {
      const userInfo = await this.getUserInfo(accessToken);
      const accountId = userInfo?.accounts?.[0]?.accountId || config.docusign.accountId;

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}?include=recipients`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      interface DocuSignEnvelopeResponse {
        envelopeId: string;
        status: string;
        recipients?: {
          signers?: Array<{
            email: string;
            name: string;
            status: string;
            signedDateTime?: string;
          }>;
        };
      }

      const data = await response.json() as DocuSignEnvelopeResponse;

      return {
        envelopeId: data.envelopeId,
        status: data.status as EnvelopeStatus['status'],
        signers: data.recipients?.signers?.map((s) => ({
          email: s.email,
          name: s.name,
          status: s.status,
          signedAt: s.signedDateTime ? new Date(s.signedDateTime) : undefined,
        })) || [],
      };
    } catch (error) {
      console.error('DocuSign status error:', error);
      return null;
    }
  }

  /**
   * Void an envelope
   */
  async voidEnvelope(
    envelopeId: string,
    reason: string,
    accessToken?: string
  ): Promise<boolean> {
    if (envelopeId.startsWith('mock_')) {
      return true;
    }

    if (!this.isConfigured || !accessToken) {
      return false;
    }

    try {
      const userInfo = await this.getUserInfo(accessToken);
      const accountId = userInfo?.accounts?.[0]?.accountId || config.docusign.accountId;

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'voided',
            voidedReason: reason,
          }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('DocuSign void error:', error);
      return false;
    }
  }

  /**
   * Get signing URL for embedded signing
   */
  async getSigningUrl(
    envelopeId: string,
    signerEmail: string,
    signerName: string,
    returnUrl: string,
    accessToken?: string
  ): Promise<string | null> {
    if (envelopeId.startsWith('mock_')) {
      // For mock, return the return URL with success params
      return `${returnUrl}?event=signing_complete&envelope=${envelopeId}`;
    }

    if (!this.isConfigured || !accessToken) {
      return null;
    }

    try {
      const userInfo = await this.getUserInfo(accessToken);
      const accountId = userInfo?.accounts?.[0]?.accountId || config.docusign.accountId;

      const response = await fetch(
        `${this.baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: signerEmail,
            userName: signerName,
            returnUrl,
            authenticationMethod: 'none',
            clientUserId: signerEmail,
          }),
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as { url: string };
      return data.url;
    } catch (error) {
      console.error('DocuSign signing URL error:', error);
      return null;
    }
  }

  // ==================== Webhook Handling ====================

  /**
   * Process DocuSign webhook event
   */
  async processWebhookEvent(payload: any): Promise<void> {
    const event = payload.event;
    const envelopeId = payload.data?.envelopeId || payload.envelopeId;

    if (!envelopeId) {
      console.log('[ESignature] Webhook: No envelope ID');
      return;
    }

    // Find contract by envelope ID
    const contract = await prisma.contract.findFirst({
      where: {
        OR: [
          { externalDocumentId: envelopeId },
          { signatureRequestId: envelopeId },
        ],
      },
      include: { signers: true, user: true },
    });

    if (!contract) {
      console.log('[ESignature] Webhook: Contract not found for envelope', envelopeId);
      return;
    }

    switch (event) {
      case 'envelope-sent':
        await this.handleEnvelopeSent(contract);
        break;

      case 'envelope-delivered':
        await this.handleEnvelopeDelivered(contract);
        break;

      case 'recipient-signed':
      case 'envelope-signed':
        await this.handleRecipientSigned(contract, payload);
        break;

      case 'envelope-completed':
        await this.handleEnvelopeCompleted(contract);
        break;

      case 'envelope-declined':
        await this.handleEnvelopeDeclined(contract, payload);
        break;

      case 'envelope-voided':
        await this.handleEnvelopeVoided(contract);
        break;

      default:
        console.log('[ESignature] Unhandled webhook event:', event);
    }
  }

  private async handleEnvelopeSent(contract: any): Promise<void> {
    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: 'PENDING_SIGNATURE' },
    });
  }

  private async handleEnvelopeDelivered(contract: any): Promise<void> {
    // Email was delivered to signers
    console.log('[ESignature] Envelope delivered to signers');
  }

  private async handleRecipientSigned(contract: any, payload: any): Promise<void> {
    const signerEmail = payload.data?.recipientEmail || payload.recipientEmail;

    if (signerEmail) {
      const signer = contract.signers.find((s: any) => s.email === signerEmail);
      if (signer) {
        await prisma.contractSigner.update({
          where: { id: signer.id },
          data: {
            signedAt: new Date(),
            signatureData: { event: 'signed', timestamp: new Date().toISOString() },
          },
        });
      }
    }

    // Check if all signed
    const updatedContract = await prisma.contract.findUnique({
      where: { id: contract.id },
      include: { signers: true },
    });

    const signedCount = updatedContract?.signers.filter(s => s.signedAt).length || 0;
    const totalSigners = updatedContract?.signers.length || 0;

    if (signedCount > 0 && signedCount < totalSigners) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { status: 'PARTIALLY_SIGNED' },
      });
    }
  }

  private async handleEnvelopeCompleted(contract: any): Promise<void> {
    // Mark all signers as signed if not already
    await prisma.contractSigner.updateMany({
      where: { contractId: contract.id, signedAt: null },
      data: { signedAt: new Date() },
    });

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
      },
    });

    // Send notification email
    if (contract.user?.email) {
      await emailService.sendContractSignedEmail(contract.user.email, {
        recipientName: contract.user.companyName || contract.user.email,
        contractTitle: contract.title,
        contractId: contract.id,
        signerName: 'All parties',
        signedAt: new Date(),
        allSigned: true,
        viewUrl: `${config.frontendUrl}/contracts/${contract.id}`,
      });
    }
  }

  private async handleEnvelopeDeclined(contract: any, payload: any): Promise<void> {
    const reason = payload.data?.declinedReason || 'No reason provided';

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: 'CANCELLED',
      },
    });

    // Notify user
    console.log('[ESignature] Contract declined:', contract.id, reason);
  }

  private async handleEnvelopeVoided(contract: any): Promise<void> {
    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: 'CANCELLED' },
    });
  }

  // ==================== Mock Mode ====================

  private async createMockEnvelope(
    userId: string,
    request: EnvelopeRequest
  ): Promise<{ envelopeId: string; status: string }> {
    const envelopeId = `mock_env_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Update contract
    await prisma.contract.update({
      where: { id: request.contractId },
      data: {
        status: 'PENDING_SIGNATURE',
        signatureProvider: 'mock',
        externalDocumentId: envelopeId,
        signatureRequestId: envelopeId,
      },
    });

    // Send mock signature request emails
    for (const signer of request.signers) {
      await this.sendMockSignatureEmail(
        signer.email,
        signer.name,
        request.documentName,
        request.contractId,
        envelopeId
      );
    }

    return {
      envelopeId,
      status: 'sent',
    };
  }

  private async getMockEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus> {
    const contract = await prisma.contract.findFirst({
      where: {
        OR: [
          { externalDocumentId: envelopeId },
          { signatureRequestId: envelopeId },
        ],
      },
      include: { signers: true },
    });

    if (!contract) {
      return {
        envelopeId,
        status: 'created',
        signers: [],
      };
    }

    const signedCount = contract.signers.filter(s => s.signedAt).length;
    let status: EnvelopeStatus['status'] = 'sent';

    if (signedCount === contract.signers.length && signedCount > 0) {
      status = 'completed';
    } else if (signedCount > 0) {
      status = 'signed';
    }

    return {
      envelopeId,
      status,
      signers: contract.signers.map(s => ({
        email: s.email,
        name: s.name,
        status: s.signedAt ? 'completed' : 'sent',
        signedAt: s.signedAt || undefined,
      })),
    };
  }

  private async sendMockSignatureEmail(
    email: string,
    name: string,
    documentName: string,
    contractId: string,
    envelopeId: string
  ): Promise<void> {
    const signUrl = `${config.frontendUrl}/contracts/${contractId}/sign?envelope=${envelopeId}&email=${encodeURIComponent(email)}`;

    await emailService.sendSignatureRequestEmail(email, {
      recipientName: name,
      senderName: 'Influencer Platform',
      contractTitle: documentName,
      contractId,
      signingUrl: signUrl,
    });
  }

  // ==================== Helpers ====================

  private generateState(userId: string): string {
    const data = { userId, timestamp: Date.now() };
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }

  private parseState(state: string): { userId: string; timestamp: number } | null {
    try {
      const data = JSON.parse(Buffer.from(state, 'base64url').toString());
      return data;
    } catch {
      return null;
    }
  }

  private async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await fetch(`${this.oauthUrl}/oauth/userinfo`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      return response.json();
    } catch {
      return null;
    }
  }

  private buildEnvelopeDefinition(request: EnvelopeRequest): any {
    // Convert HTML content to base64
    const documentBase64 = Buffer.from(request.documentContent).toString('base64');

    return {
      emailSubject: request.emailSubject,
      emailBlurb: request.emailMessage || 'Please review and sign the attached document.',
      status: 'sent',
      documents: [
        {
          documentId: '1',
          name: request.documentName,
          fileExtension: 'html',
          documentBase64,
        },
      ],
      recipients: {
        signers: request.signers.map((signer, index) => ({
          recipientId: String(index + 1),
          email: signer.email,
          name: signer.name,
          routingOrder: signer.order || index + 1,
          tabs: {
            signHereTabs: [
              {
                documentId: '1',
                pageNumber: '1',
                anchorString: '/sig/',
                anchorXOffset: '0',
                anchorYOffset: '0',
              },
            ],
            dateSignedTabs: [
              {
                documentId: '1',
                pageNumber: '1',
                anchorString: '/date/',
                anchorXOffset: '0',
                anchorYOffset: '0',
              },
            ],
          },
        })),
      },
    };
  }

  /**
   * Check if DocuSign is configured
   */
  isDocuSignConfigured(): boolean {
    return this.isConfigured;
  }
}

// Export singleton
export const eSignatureService = new ESignatureService();
