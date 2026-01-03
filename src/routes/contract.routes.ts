/**
 * Contract Routes
 *
 * /api/v1/contracts
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  // Templates
  createTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  // Contracts
  createContract,
  createFromTemplate,
  getContracts,
  getContract,
  updateContract,
  deleteContract,
  // Signers
  addSigner,
  removeSigner,
  // Signatures
  sendForSignature,
  getSignatureStatus,
  mockSign,
  // Versions
  getVersions,
  restoreVersion,
  // Expiring
  getExpiring,
  renewContract,
} from '../controllers/contract.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Templates
router.post('/templates', createTemplate);
router.get('/templates', getTemplates);
router.get('/templates/:id', getTemplate);
router.patch('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

// Expiring contracts (before :id routes to avoid conflict)
router.get('/expiring', getExpiring);

// Create from template
router.post('/from-template', createFromTemplate);

// Contracts
router.post('/', createContract);
router.get('/', getContracts);
router.get('/:id', getContract);
router.patch('/:id', updateContract);
router.delete('/:id', deleteContract);

// Signers
router.post('/:id/signers', addSigner);
router.delete('/:id/signers/:signerId', removeSigner);

// Signatures
router.post('/:id/send-signature', sendForSignature);
router.get('/:id/signature-status', getSignatureStatus);
router.post('/:id/mock-sign', mockSign);

// Versions
router.get('/:id/versions', getVersions);
router.post('/:id/restore/:version', restoreVersion);

// Renewal
router.post('/:id/renew', renewContract);

export default router;
