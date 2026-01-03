/**
 * Contract Controller
 *
 * Handles API endpoints for contract management:
 * - Templates
 * - Contracts
 * - Signatures
 * - Versions
 */

import { Request, Response, NextFunction } from 'express';
import { contractService } from '../services/contract.service.js';

// ==================== Templates ====================

/**
 * Create template
 * POST /api/v1/contracts/templates
 */
export const createTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, description, content, mergeTags, category, isDefault } = req.body;

    if (!name || !content) {
      res.status(400).json({ error: 'Name and content are required' });
      return;
    }

    const template = await contractService.createTemplate(userId, {
      name,
      description,
      content,
      mergeTags,
      category,
      isDefault,
    });

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get templates
 * GET /api/v1/contracts/templates
 */
export const getTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { category, activeOnly } = req.query;

    const templates = await contractService.getTemplates(userId, {
      category: category as string,
      activeOnly: activeOnly === 'true',
    });

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get template
 * GET /api/v1/contracts/templates/:id
 */
export const getTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const template = await contractService.getTemplate(userId, id);

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update template
 * PATCH /api/v1/contracts/templates/:id
 */
export const updateTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const template = await contractService.updateTemplate(userId, id, req.body);

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete template
 * DELETE /api/v1/contracts/templates/:id
 */
export const deleteTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    await contractService.deleteTemplate(userId, id);

    res.json({
      success: true,
      message: 'Template deleted',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Contracts ====================

/**
 * Create contract
 * POST /api/v1/contracts
 */
export const createContract = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, content, templateId, campaignId, campaignInfluencerId, usageRights, exclusivity, territories, contentTypes, effectiveDate, expirationDate, paymentAmount, paymentCurrency } = req.body;

    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required' });
      return;
    }

    const contract = await contractService.createContract(userId, {
      title,
      content,
      templateId,
      campaignId,
      campaignInfluencerId,
      usageRights,
      exclusivity,
      territories,
      contentTypes,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
      expirationDate: expirationDate ? new Date(expirationDate) : undefined,
      paymentAmount,
      paymentCurrency,
    });

    res.status(201).json({
      success: true,
      data: contract,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create contract from template
 * POST /api/v1/contracts/from-template
 */
export const createFromTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { templateId, mergeData, ...overrides } = req.body;

    if (!templateId) {
      res.status(400).json({ error: 'templateId is required' });
      return;
    }

    const contract = await contractService.createFromTemplate(
      userId,
      templateId,
      mergeData || {},
      overrides
    );

    res.status(201).json({
      success: true,
      data: contract,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get contracts
 * GET /api/v1/contracts
 */
export const getContracts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { status, campaignId, templateId, search, limit, offset } = req.query;

    const result = await contractService.getContracts(userId, {
      status: status as any,
      campaignId: campaignId as string,
      templateId: templateId as string,
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result.contracts,
      meta: { total: result.total },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get contract
 * GET /api/v1/contracts/:id
 */
export const getContract = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const contract = await contractService.getContract(userId, id);

    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    res.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update contract
 * PATCH /api/v1/contracts/:id
 */
export const updateContract = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const contract = await contractService.updateContract(userId, id, req.body);

    res.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete contract
 * DELETE /api/v1/contracts/:id
 */
export const deleteContract = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    await contractService.deleteContract(userId, id);

    res.json({
      success: true,
      message: 'Contract deleted',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Signers ====================

/**
 * Add signer
 * POST /api/v1/contracts/:id/signers
 */
export const addSigner = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { name, email, role, order } = req.body;

    if (!name || !email || !role) {
      res.status(400).json({ error: 'Name, email, and role are required' });
      return;
    }

    const signer = await contractService.addSigner(userId, id, {
      name,
      email,
      role,
      order,
    });

    res.status(201).json({
      success: true,
      data: signer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove signer
 * DELETE /api/v1/contracts/:id/signers/:signerId
 */
export const removeSigner = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id, signerId } = req.params;

    await contractService.removeSigner(userId, id, signerId);

    res.json({
      success: true,
      message: 'Signer removed',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Signatures ====================

/**
 * Send for signature
 * POST /api/v1/contracts/:id/send-signature
 */
export const sendForSignature = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const result = await contractService.sendForSignature(userId, id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check signature status
 * GET /api/v1/contracts/:id/signature-status
 */
export const getSignatureStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const status = await contractService.checkSignatureStatus(userId, id);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mock sign (development)
 * POST /api/v1/contracts/:id/mock-sign
 */
export const mockSign = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { signerEmail } = req.body;

    if (!signerEmail) {
      res.status(400).json({ error: 'signerEmail is required' });
      return;
    }

    const result = await contractService.mockSign(userId, id, signerEmail);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Versions ====================

/**
 * Get version history
 * GET /api/v1/contracts/:id/versions
 */
export const getVersions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const versions = await contractService.getVersionHistory(userId, id);

    res.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Restore version
 * POST /api/v1/contracts/:id/restore/:version
 */
export const restoreVersion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id, version } = req.params;

    const contract = await contractService.restoreVersion(userId, id, parseInt(version));

    res.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Expiring ====================

/**
 * Get expiring contracts
 * GET /api/v1/contracts/expiring
 */
export const getExpiring = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { days } = req.query;

    const contracts = await contractService.getExpiringContracts(
      userId,
      days ? parseInt(days as string) : undefined
    );

    res.json({
      success: true,
      data: contracts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Renew contract
 * POST /api/v1/contracts/:id/renew
 */
export const renewContract = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { newExpirationDate } = req.body;

    if (!newExpirationDate) {
      res.status(400).json({ error: 'newExpirationDate is required' });
      return;
    }

    const contract = await contractService.renewContract(
      userId,
      id,
      new Date(newExpirationDate)
    );

    res.status(201).json({
      success: true,
      data: contract,
    });
  } catch (error) {
    next(error);
  }
};
