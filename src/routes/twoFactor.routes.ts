/**
 * Two-Factor Authentication Routes
 *
 * /api/v1/2fa
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as twoFactorController from '../controllers/twoFactor.controller.js';

const router = Router();

// Get 2FA status (requires auth)
router.get('/status', authenticate, twoFactorController.getStatus);

// Generate 2FA setup (requires auth)
router.post('/setup', authenticate, twoFactorController.generateSetup);

// Enable 2FA with verification code (requires auth)
router.post('/enable', authenticate, twoFactorController.enable);

// Verify 2FA token (public - used during login)
router.post('/verify', twoFactorController.verify);

// Disable 2FA (requires auth + password)
router.post('/disable', authenticate, twoFactorController.disable);

// Regenerate backup codes (requires auth + current token)
router.post('/backup-codes/regenerate', authenticate, twoFactorController.regenerateBackupCodes);

export default router;
