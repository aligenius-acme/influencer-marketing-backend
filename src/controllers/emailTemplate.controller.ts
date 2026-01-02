import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { emailTemplateService } from '../services/emailTemplate.service.js';

/**
 * Get all email templates
 * GET /api/v1/email-templates
 */
export const getTemplates = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type } = req.query;
    const templates = await emailTemplateService.getTemplates(
      req.user!.userId,
      type as string | undefined
    );

    res.status(200).json({
      success: true,
      data: { templates },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single template
 * GET /api/v1/email-templates/:id
 */
export const getTemplate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const template = await emailTemplateService.getTemplate(
      req.user!.userId,
      req.params.id
    );

    res.status(200).json({
      success: true,
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new template
 * POST /api/v1/email-templates
 */
export const createTemplate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const template = await emailTemplateService.createTemplate(
      req.user!.userId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a template
 * PATCH /api/v1/email-templates/:id
 */
export const updateTemplate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const template = await emailTemplateService.updateTemplate(
      req.user!.userId,
      req.params.id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: 'Template updated successfully',
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a template
 * DELETE /api/v1/email-templates/:id
 */
export const deleteTemplate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await emailTemplateService.deleteTemplate(req.user!.userId, req.params.id);

    res.status(200).json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Duplicate a template
 * POST /api/v1/email-templates/:id/duplicate
 */
export const duplicateTemplate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const template = await emailTemplateService.duplicateTemplate(
      req.user!.userId,
      req.params.id
    );

    res.status(201).json({
      success: true,
      message: 'Template duplicated successfully',
      data: { template },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initialize default templates
 * POST /api/v1/email-templates/initialize
 */
export const initializeTemplates = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await emailTemplateService.initializeDefaultTemplates(
      req.user!.userId
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: { created: result.created },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Preview template with merge data
 * POST /api/v1/email-templates/:id/preview
 */
export const previewTemplate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const preview = await emailTemplateService.previewTemplate(
      req.user!.userId,
      req.params.id,
      req.body
    );

    res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get available merge tags
 * GET /api/v1/email-templates/merge-tags
 */
export const getMergeTags = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const mergeTags = emailTemplateService.getMergeTags();

    res.status(200).json({
      success: true,
      data: { mergeTags },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get template types
 * GET /api/v1/email-templates/types
 */
export const getTemplateTypes = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const templateTypes = emailTemplateService.getTemplateTypes();

    res.status(200).json({
      success: true,
      data: { templateTypes },
    });
  } catch (error) {
    next(error);
  }
};
