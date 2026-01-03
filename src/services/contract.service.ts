/**
 * Contract Management Service
 *
 * Handles:
 * - Contract templates
 * - Contract creation and management
 * - Version control
 * - E-signature integration (DocuSign)
 * - Compliance tracking
 */

import { config } from '../config/index.js';
import { prisma } from '../config/postgres.js';
import { ContractStatus } from '@prisma/client';

// ==================== Types ====================

export interface CreateTemplateInput {
  name: string;
  description?: string;
  content: string;
  mergeTags?: string[];
  category?: string;
  isDefault?: boolean;
}

export interface CreateContractInput {
  title: string;
  content: string;
  templateId?: string;
  campaignId?: string;
  campaignInfluencerId?: string;
  usageRights?: Record<string, unknown>;
  exclusivity?: string;
  territories?: string[];
  contentTypes?: string[];
  effectiveDate?: Date;
  expirationDate?: Date;
  paymentAmount?: number;
  paymentCurrency?: string;
}

export interface SignerInput {
  name: string;
  email: string;
  role: string;
  order?: number;
}

export interface ContractFilters {
  status?: ContractStatus;
  campaignId?: string;
  templateId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ==================== Service ====================

class ContractService {
  private useDocuSign: boolean;

  constructor() {
    this.useDocuSign = !!config.docusign.integrationKey;
    if (!this.useDocuSign) {
      console.log('[ContractService] DocuSign not configured - e-signature disabled');
    }
  }

  // ==================== Templates ====================

  /**
   * Create contract template
   */
  async createTemplate(userId: string, input: CreateTemplateInput) {
    // If setting as default, unset other defaults
    if (input.isDefault) {
      await prisma.contractTemplate.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.contractTemplate.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        content: input.content,
        mergeTags: input.mergeTags || [],
        category: input.category,
        isDefault: input.isDefault || false,
        isActive: true,
      },
    });
  }

  /**
   * Get all templates
   */
  async getTemplates(userId: string, options: { category?: string; activeOnly?: boolean } = {}) {
    const where: Record<string, unknown> = { userId };
    if (options.category) where.category = options.category;
    if (options.activeOnly) where.isActive = true;

    return prisma.contractTemplate.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get template by ID
   */
  async getTemplate(userId: string, templateId: string) {
    return prisma.contractTemplate.findFirst({
      where: { id: templateId, userId },
    });
  }

  /**
   * Update template
   */
  async updateTemplate(userId: string, templateId: string, updates: Partial<CreateTemplateInput>) {
    // If setting as default, unset other defaults
    if (updates.isDefault) {
      await prisma.contractTemplate.updateMany({
        where: { userId, isDefault: true, id: { not: templateId } },
        data: { isDefault: false },
      });
    }

    return prisma.contractTemplate.update({
      where: { id: templateId },
      data: updates,
    });
  }

  /**
   * Delete template
   */
  async deleteTemplate(userId: string, templateId: string) {
    const template = await prisma.contractTemplate.findFirst({
      where: { id: templateId, userId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    await prisma.contractTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });

    return true;
  }

  // ==================== Contracts ====================

  /**
   * Create contract
   */
  async createContract(userId: string, input: CreateContractInput) {
    const contract = await prisma.contract.create({
      data: {
        userId,
        title: input.title,
        content: input.content,
        templateId: input.templateId,
        campaignId: input.campaignId,
        campaignInfluencerId: input.campaignInfluencerId,
        status: 'DRAFT',
        version: 1,
        usageRights: input.usageRights || {},
        exclusivity: input.exclusivity,
        territories: input.territories || [],
        contentTypes: input.contentTypes || [],
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : undefined,
        expirationDate: input.expirationDate ? new Date(input.expirationDate) : undefined,
        paymentAmount: input.paymentAmount,
        paymentCurrency: input.paymentCurrency || 'USD',
      },
    });

    // Create initial version
    await prisma.contractVersion.create({
      data: {
        contractId: contract.id,
        version: 1,
        content: input.content,
        createdBy: userId,
      },
    });

    return contract;
  }

  /**
   * Create contract from template
   */
  async createFromTemplate(
    userId: string,
    templateId: string,
    mergeData: Record<string, string>,
    overrides: Partial<CreateContractInput> = {}
  ) {
    const template = await prisma.contractTemplate.findFirst({
      where: { id: templateId, userId, isActive: true },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Apply merge tags
    let content = template.content;
    for (const [tag, value] of Object.entries(mergeData)) {
      content = content.replace(new RegExp(`{{${tag}}}`, 'g'), value);
    }

    return this.createContract(userId, {
      title: overrides.title || `${template.name} - ${new Date().toLocaleDateString()}`,
      content,
      templateId,
      ...overrides,
    });
  }

  /**
   * Get contracts
   */
  async getContracts(userId: string, filters: ContractFilters = {}) {
    const where: Record<string, unknown> = { userId };

    if (filters.status) where.status = filters.status;
    if (filters.campaignId) where.campaignId = filters.campaignId;
    if (filters.templateId) where.templateId = filters.templateId;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          template: { select: { name: true } },
          signers: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: filters.offset || 0,
        take: filters.limit || 50,
      }),
      prisma.contract.count({ where }),
    ]);

    return { contracts, total };
  }

  /**
   * Get contract by ID
   */
  async getContract(userId: string, contractId: string) {
    return prisma.contract.findFirst({
      where: { id: contractId, userId },
      include: {
        template: { select: { name: true } },
        signers: { orderBy: { order: 'asc' } },
        versions: { orderBy: { version: 'desc' } },
      },
    });
  }

  /**
   * Update contract
   */
  async updateContract(
    userId: string,
    contractId: string,
    updates: Partial<CreateContractInput>,
    createVersion: boolean = true
  ) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    // Can only edit drafts
    if (contract.status !== 'DRAFT') {
      throw new Error('Only draft contracts can be edited');
    }

    const newVersion = createVersion && updates.content ? contract.version + 1 : contract.version;

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        ...updates,
        version: newVersion,
      },
    });

    // Create version record if content changed
    if (createVersion && updates.content) {
      await prisma.contractVersion.create({
        data: {
          contractId,
          version: newVersion,
          content: updates.content,
          changes: 'Content updated',
          createdBy: userId,
        },
      });
    }

    return updated;
  }

  /**
   * Delete contract
   */
  async deleteContract(userId: string, contractId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    if (contract.status !== 'DRAFT' && contract.status !== 'CANCELLED') {
      throw new Error('Only draft or cancelled contracts can be deleted');
    }

    await prisma.contract.delete({ where: { id: contractId } });
    return true;
  }

  // ==================== Signers ====================

  /**
   * Add signer to contract
   */
  async addSigner(userId: string, contractId: string, signer: SignerInput) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    return prisma.contractSigner.create({
      data: {
        contractId,
        name: signer.name,
        email: signer.email,
        role: signer.role,
        order: signer.order || 0,
      },
    });
  }

  /**
   * Remove signer
   */
  async removeSigner(userId: string, contractId: string, signerId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    await prisma.contractSigner.delete({ where: { id: signerId } });
    return true;
  }

  // ==================== E-Signature ====================

  /**
   * Send contract for signature
   */
  async sendForSignature(userId: string, contractId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
      include: { signers: { orderBy: { order: 'asc' } } },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    if (contract.signers.length === 0) {
      throw new Error('At least one signer is required');
    }

    if (!this.useDocuSign) {
      // Mock signature sending
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          status: 'PENDING_SIGNATURE',
          signatureProvider: 'mock',
          externalDocumentId: `mock_doc_${Date.now()}`,
          signatureRequestId: `mock_req_${Date.now()}`,
        },
      });

      return {
        success: true,
        provider: 'mock',
        message: 'Contract sent for signature (mock mode)',
      };
    }

    // Real DocuSign integration would go here
    // For now, return mock response
    return {
      success: true,
      provider: 'docusign',
      message: 'DocuSign integration pending',
    };
  }

  /**
   * Check signature status
   */
  async checkSignatureStatus(userId: string, contractId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
      include: { signers: true },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    if (!contract.signatureRequestId) {
      return { status: 'not_sent', signers: [] };
    }

    // In production, would check with signature provider
    // For mock mode, return current status
    const signedCount = contract.signers.filter(s => s.signedAt).length;
    const totalSigners = contract.signers.length;

    return {
      status: contract.status,
      signedCount,
      totalSigners,
      signers: contract.signers.map(s => ({
        name: s.name,
        email: s.email,
        role: s.role,
        signed: !!s.signedAt,
        signedAt: s.signedAt,
      })),
    };
  }

  /**
   * Mock sign contract (development only)
   */
  async mockSign(userId: string, contractId: string, signerEmail: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
      include: { signers: true },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    const signer = contract.signers.find(s => s.email === signerEmail);
    if (!signer) {
      throw new Error('Signer not found');
    }

    await prisma.contractSigner.update({
      where: { id: signer.id },
      data: {
        signedAt: new Date(),
        signatureData: { mock: true, signedAt: new Date().toISOString() },
      },
    });

    // Check if all signed
    const updatedContract = await prisma.contract.findFirst({
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

    return { success: true, allSigned };
  }

  // ==================== Version History ====================

  /**
   * Get version history
   */
  async getVersionHistory(userId: string, contractId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    return prisma.contractVersion.findMany({
      where: { contractId },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Restore version
   */
  async restoreVersion(userId: string, contractId: string, version: number) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    if (contract.status !== 'DRAFT') {
      throw new Error('Only drafts can be restored');
    }

    const versionRecord = await prisma.contractVersion.findFirst({
      where: { contractId, version },
    });

    if (!versionRecord) {
      throw new Error('Version not found');
    }

    return this.updateContract(userId, contractId, { content: versionRecord.content }, true);
  }

  // ==================== Expiring Contracts ====================

  /**
   * Get contracts expiring soon
   */
  async getExpiringContracts(userId: string, daysAhead: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return prisma.contract.findMany({
      where: {
        userId,
        status: { in: ['SIGNED', 'ACTIVE'] },
        expirationDate: {
          gte: new Date(),
          lte: futureDate,
        },
      },
      include: {
        signers: true,
      },
      orderBy: { expirationDate: 'asc' },
    });
  }

  /**
   * Renew contract
   */
  async renewContract(userId: string, contractId: string, newExpirationDate: Date) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, userId },
      include: { signers: true },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    // Create new contract based on this one
    const newContract = await prisma.contract.create({
      data: {
        userId,
        title: `${contract.title} (Renewed)`,
        content: contract.content,
        templateId: contract.templateId,
        campaignId: contract.campaignId,
        status: 'DRAFT',
        version: 1,
        usageRights: contract.usageRights as object,
        exclusivity: contract.exclusivity,
        territories: contract.territories,
        contentTypes: contract.contentTypes,
        effectiveDate: contract.expirationDate, // Start from old expiration
        expirationDate: newExpirationDate,
        paymentAmount: contract.paymentAmount,
        paymentCurrency: contract.paymentCurrency,
      },
    });

    // Copy signers
    for (const signer of contract.signers) {
      await prisma.contractSigner.create({
        data: {
          contractId: newContract.id,
          name: signer.name,
          email: signer.email,
          role: signer.role,
          order: signer.order,
        },
      });
    }

    // Update old contract status
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'RENEWED' },
    });

    return newContract;
  }
}

// Export singleton instance
export const contractService = new ContractService();
