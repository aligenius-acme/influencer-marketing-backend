/**
 * Export Routes
 *
 * Handles data export to CSV, Excel, and Google Sheets
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as exportController from '../controllers/export.controller.js';

const router = Router();

// GET /api/v1/export/influencers - Export influencers to CSV
router.get('/influencers', authenticate, exportController.exportInfluencers);

// GET /api/v1/export/campaigns - Export campaigns to CSV
router.get('/campaigns', authenticate, exportController.exportCampaigns);

// GET /api/v1/export/analytics - Export analytics to CSV
router.get('/analytics', authenticate, exportController.exportAnalytics);

// POST /api/v1/export/google-sheets - Export to Google Sheets
router.post('/google-sheets', authenticate, exportController.exportToGoogleSheets);

// GET /api/v1/export/google-sheets/auth-url - Get Google OAuth URL
router.get('/google-sheets/auth-url', authenticate, exportController.getGoogleAuthUrl);

// POST /api/v1/export/google-sheets/exchange - Exchange auth code for tokens
router.post('/google-sheets/exchange', authenticate, exportController.exchangeGoogleCode);

export default router;
