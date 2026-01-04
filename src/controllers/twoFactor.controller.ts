/**
 * Two-Factor Authentication Controller
 *
 * Handles 2FA setup, verification, and management
 */

import { Request, Response } from 'express';
import * as twoFactorService from '../services/twoFactor.service.js';
import { authService } from '../services/auth.service.js';
import { config } from '../config/index.js';

/**
 * Get 2FA status for current user
 */
export async function getStatus(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const status = await twoFactorService.getTwoFactorStatus(userId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Get 2FA status error:', error);
    res.status(500).json({ message: 'Failed to get 2FA status' });
  }
}

/**
 * Generate 2FA setup (secret + QR code)
 */
export async function generateSetup(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const email = req.user?.email;

    if (!userId || !email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const setupData = await twoFactorService.generateTwoFactorSetup(userId, email);

    res.json({
      success: true,
      data: {
        qrCodeUrl: setupData.qrCodeUrl,
        secret: setupData.secret,
        backupCodes: setupData.backupCodes,
      },
    });
  } catch (error) {
    console.error('Generate 2FA setup error:', error);
    res.status(500).json({ message: 'Failed to generate 2FA setup' });
  }
}

/**
 * Enable 2FA by verifying TOTP token
 */
export async function enable(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Verification code is required' });
    }

    const result = await twoFactorService.enableTwoFactor(userId, token);

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({ message: 'Failed to enable 2FA' });
  }
}

/**
 * Verify 2FA token (for login flow)
 * Returns tokens upon successful verification
 */
export async function verify(req: Request, res: Response) {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ message: 'User ID and token are required' });
    }

    const result = await twoFactorService.verifyTwoFactorToken(userId, token);

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    // Complete the login flow after successful 2FA verification
    const loginResult = await authService.completeLoginAfter2FA(userId);

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', loginResult.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    res.json({
      success: true,
      message: 'Login successful',
      usedBackupCode: result.usedBackupCode,
      data: {
        user: loginResult.user,
        accessToken: loginResult.tokens.accessToken,
      },
    });
  } catch (error) {
    console.error('Verify 2FA error:', error);
    res.status(500).json({ message: 'Failed to verify 2FA token' });
  }
}

/**
 * Disable 2FA
 */
export async function disable(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const result = await twoFactorService.disableTwoFactor(userId, password);

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ message: 'Failed to disable 2FA' });
  }
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Verification code is required' });
    }

    const result = await twoFactorService.regenerateBackupCodes(userId, token);

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    res.json({
      success: true,
      message: result.message,
      data: {
        backupCodes: result.backupCodes,
      },
    });
  } catch (error) {
    console.error('Regenerate backup codes error:', error);
    res.status(500).json({ message: 'Failed to regenerate backup codes' });
  }
}
