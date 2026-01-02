import { Router } from 'express';
import {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  initializeTemplates,
  previewTemplate,
  getMergeTags,
  getTemplateTypes,
} from '../controllers/emailTemplate.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  createEmailTemplateSchema,
  updateEmailTemplateSchema,
  previewEmailTemplateSchema,
} from '../utils/emailTemplate-validation.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/email-templates/merge-tags
 * @desc    Get available merge tags
 * @access  Private
 */
router.get('/merge-tags', getMergeTags);

/**
 * @route   GET /api/v1/email-templates/types
 * @desc    Get template types
 * @access  Private
 */
router.get('/types', getTemplateTypes);

/**
 * @route   POST /api/v1/email-templates/initialize
 * @desc    Initialize default templates for user
 * @access  Private
 */
router.post('/initialize', initializeTemplates);

/**
 * @route   GET /api/v1/email-templates
 * @desc    Get all email templates
 * @access  Private
 */
router.get('/', getTemplates);

/**
 * @route   POST /api/v1/email-templates
 * @desc    Create a new template
 * @access  Private
 */
router.post('/', validate(createEmailTemplateSchema), createTemplate);

/**
 * @route   GET /api/v1/email-templates/:id
 * @desc    Get a single template
 * @access  Private
 */
router.get('/:id', getTemplate);

/**
 * @route   PATCH /api/v1/email-templates/:id
 * @desc    Update a template
 * @access  Private
 */
router.patch('/:id', validate(updateEmailTemplateSchema), updateTemplate);

/**
 * @route   DELETE /api/v1/email-templates/:id
 * @desc    Delete a template
 * @access  Private
 */
router.delete('/:id', deleteTemplate);

/**
 * @route   POST /api/v1/email-templates/:id/duplicate
 * @desc    Duplicate a template
 * @access  Private
 */
router.post('/:id/duplicate', duplicateTemplate);

/**
 * @route   POST /api/v1/email-templates/:id/preview
 * @desc    Preview template with merge data
 * @access  Private
 */
router.post('/:id/preview', validate(previewEmailTemplateSchema), previewTemplate);

export default router;
