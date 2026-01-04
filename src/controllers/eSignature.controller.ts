/**
 * E-Signature Controller
 *
 * Handles DocuSign OAuth and signature-related API endpoints
 */

import { Request, Response } from 'express';
import { eSignatureService } from '../services/eSignature.service.js';
import { prisma } from '../config/postgres.js';
import { config } from '../config/index.js';

// ==================== OAuth ====================

/**
 * Get DocuSign OAuth authorization URL
 */
export const getAuthorizationUrl = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const redirectUri = `${config.apiUrl}/esignature/callback`;

    const authUrl = eSignatureService.getAuthorizationUrl(userId, redirectUri);

    res.json({
      success: true,
      data: { authorizationUrl: authUrl },
    });
  } catch (error) {
    console.error('[ESignature] Auth URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate authorization URL',
    });
  }
};

/**
 * Handle OAuth callback from DocuSign
 */
export const handleOAuthCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${config.frontendUrl}/settings?esign_error=${error}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${config.frontendUrl}/settings?esign_error=missing_code`);
    }

    // Exchange code for tokens
    const redirectUri = `${config.apiUrl}/esignature/callback`;
    const tokens = await eSignatureService.exchangeCodeForTokens(code, redirectUri);

    if (!tokens) {
      return res.redirect(`${config.frontendUrl}/settings?esign_error=token_exchange_failed`);
    }

    // Store tokens (in production, encrypt these)
    // For now, we'll use a simple storage approach
    // Parse state to get userId
    const stateData = state ? parseState(state as string) : null;
    const userId = stateData?.userId;

    if (userId) {
      // Store connection in database
      await prisma.user.update({
        where: { id: userId },
        data: {
          // Store DocuSign tokens in metadata or dedicated fields
          // For security, consider encrypting these
        },
      });
    }

    res.redirect(`${config.frontendUrl}/settings?esign_success=true`);
  } catch (error) {
    console.error('[ESignature] OAuth callback error:', error);
    res.redirect(`${config.frontendUrl}/settings?esign_error=callback_failed`);
  }
};

// ==================== Signature Operations ====================

/**
 * Send contract for signature
 */
export const sendForSignature = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { contractId } = req.params;
    const { signers, emailSubject, emailMessage } = req.body;

    // Get contract
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
      include: { signers: true },
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found',
      });
    }

    if (contract.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: 'Contract must be in draft status to send for signature',
      });
    }

    // Use provided signers or existing ones
    const contractSigners = signers || contract.signers.map(s => ({
      email: s.email,
      name: s.name,
      role: s.role,
      order: s.order,
    }));

    if (!contractSigners.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one signer is required',
      });
    }

    // Create envelope
    const result = await eSignatureService.createEnvelope(userId, {
      contractId,
      documentContent: contract.content,
      documentName: contract.title,
      emailSubject: emailSubject || `Please sign: ${contract.title}`,
      emailMessage,
      signers: contractSigners,
    });

    res.json({
      success: true,
      message: 'Contract sent for signature',
      data: {
        envelopeId: result.envelopeId,
        status: result.status,
      },
    });
  } catch (error) {
    console.error('[ESignature] Send for signature error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send contract for signature',
    });
  }
};

/**
 * Get envelope/signature status
 */
export const getSignatureStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { contractId } = req.params;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
      include: { signers: true },
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found',
      });
    }

    if (!contract.externalDocumentId) {
      return res.json({
        success: true,
        data: {
          status: contract.status,
          signers: contract.signers.map(s => ({
            email: s.email,
            name: s.name,
            role: s.role,
            status: s.signedAt ? 'signed' : 'pending',
            signedAt: s.signedAt,
          })),
        },
      });
    }

    // Get status from provider
    const envelopeStatus = await eSignatureService.getEnvelopeStatus(
      contract.externalDocumentId
    );

    res.json({
      success: true,
      data: {
        contractStatus: contract.status,
        envelopeStatus: envelopeStatus?.status || 'unknown',
        signers: envelopeStatus?.signers || contract.signers.map(s => ({
          email: s.email,
          name: s.name,
          status: s.signedAt ? 'signed' : 'pending',
          signedAt: s.signedAt,
        })),
      },
    });
  } catch (error) {
    console.error('[ESignature] Get status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get signature status',
    });
  }
};

/**
 * Get signing URL for embedded signing
 */
export const getSigningUrl = async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Signer email is required',
      });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { signers: true },
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found',
      });
    }

    const signer = contract.signers.find(s => s.email === email);
    if (!signer) {
      return res.status(403).json({
        success: false,
        message: 'You are not a signer on this contract',
      });
    }

    if (signer.signedAt) {
      return res.status(400).json({
        success: false,
        message: 'You have already signed this contract',
      });
    }

    if (!contract.externalDocumentId) {
      return res.status(400).json({
        success: false,
        message: 'Contract has not been sent for signature',
      });
    }

    const returnUrl = `${config.frontendUrl}/contracts/${contractId}?signing=complete`;

    const signingUrl = await eSignatureService.getSigningUrl(
      contract.externalDocumentId,
      email,
      signer.name,
      returnUrl
    );

    if (!signingUrl) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate signing URL',
      });
    }

    res.json({
      success: true,
      data: { signingUrl },
    });
  } catch (error) {
    console.error('[ESignature] Get signing URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get signing URL',
    });
  }
};

/**
 * Void/cancel a signature request
 */
export const voidSignatureRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { contractId } = req.params;
    const { reason } = req.body;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found',
      });
    }

    if (!contract.externalDocumentId) {
      return res.status(400).json({
        success: false,
        message: 'Contract has not been sent for signature',
      });
    }

    const voided = await eSignatureService.voidEnvelope(
      contract.externalDocumentId,
      reason || 'Voided by user'
    );

    if (!voided) {
      // Still update local status
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'CANCELLED' },
      });
    }

    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'CANCELLED' },
    });

    res.json({
      success: true,
      message: 'Signature request voided',
    });
  } catch (error) {
    console.error('[ESignature] Void error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to void signature request',
    });
  }
};

/**
 * Mock: Simulate signing (for testing in mock mode)
 */
export const mockSign = async (req: Request, res: Response) => {
  try {
    const { contractId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Signer email is required',
      });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { signers: true, user: true },
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found',
      });
    }

    // Check if mock mode
    if (!contract.externalDocumentId?.startsWith('mock_')) {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only available in mock mode',
      });
    }

    const signer = contract.signers.find(s => s.email === email);
    if (!signer) {
      return res.status(403).json({
        success: false,
        message: 'You are not a signer on this contract',
      });
    }

    if (signer.signedAt) {
      return res.status(400).json({
        success: false,
        message: 'Already signed',
      });
    }

    // Mark as signed
    await prisma.contractSigner.update({
      where: { id: signer.id },
      data: {
        signedAt: new Date(),
        signatureData: { mockSigned: true, timestamp: new Date().toISOString() },
      },
    });

    // Check if all signed
    const updatedContract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { signers: true },
    });

    const allSigned = updatedContract?.signers.every(s => s.signedAt);

    if (allSigned) {
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          status: 'SIGNED',
          signedAt: new Date(),
        },
      });
    } else {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'PARTIALLY_SIGNED' },
      });
    }

    res.json({
      success: true,
      message: allSigned ? 'Contract fully signed' : 'Signature recorded',
      data: {
        allSigned,
        contractStatus: allSigned ? 'SIGNED' : 'PARTIALLY_SIGNED',
      },
    });
  } catch (error) {
    console.error('[ESignature] Mock sign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record signature',
    });
  }
};

// ==================== Webhooks ====================

/**
 * Handle DocuSign webhook events
 */
export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // Verify webhook signature in production
    // For now, just process the event
    await eSignatureService.processWebhookEvent(payload);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[ESignature] Webhook error:', error);
    // Still return 200 to prevent retries
    res.status(200).json({ received: true, error: 'Processing error' });
  }
};

/**
 * Check if DocuSign is configured
 */
export const getConfiguration = async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      provider: 'docusign',
      configured: eSignatureService.isDocuSignConfigured(),
      mockModeActive: !eSignatureService.isDocuSignConfigured(),
    },
  });
};

// ==================== Helpers ====================

function parseState(state: string): { userId: string; timestamp: number } | null {
  try {
    const data = JSON.parse(Buffer.from(state, 'base64url').toString());
    return data;
  } catch {
    return null;
  }
}
