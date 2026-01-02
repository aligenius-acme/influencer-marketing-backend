import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  exportToCsv,
  getImportTemplate,
  validateCsv,
  importFromCsv,
  upload,
} from '../controllers/csvImportExport.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Export influencers to CSV
router.get('/export', exportToCsv);

// Get import template
router.get('/template', getImportTemplate);

// Validate CSV before import (dry run)
router.post('/validate', upload.single('file'), validateCsv);

// Import influencers from CSV
router.post('/import', upload.single('file'), importFromCsv);

export default router;
