/**
 * Two-Factor Authentication Service
 *
 * Handles TOTP generation, verification, and backup codes
 */

import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { prisma } from '../config/postgres.js';

const APP_NAME = 'Influencer Pro';

export interface TwoFactorSetupData {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface TwoFactorVerifyResult {
  success: boolean;
  message: string;
  usedBackupCode?: boolean;
}

/**
 * Generate a new 2FA secret and QR code for setup
 */
export async function generateTwoFactorSetup(
  userId: string,
  email: string
): Promise<TwoFactorSetupData> {
  // Generate secret
  const secret = authenticator.generateSecret();

  // Generate OTP Auth URL
  const otpAuthUrl = authenticator.keyuri(email, APP_NAME, secret);

  // Generate QR code as data URL
  const qrCodeUrl = await QRCode.toDataURL(otpAuthUrl);

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);

  // Store secret temporarily (not enabled yet)
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret,
      backupCodes: backupCodes.map(hashBackupCode),
    },
  });

  return {
    secret,
    qrCodeUrl,
    backupCodes,
  };
}

/**
 * Verify TOTP code and enable 2FA
 */
export async function enableTwoFactor(
  userId: string,
  token: string
): Promise<TwoFactorVerifyResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  });

  if (!user) {
    return { success: false, message: 'User not found' };
  }

  if (user.twoFactorEnabled) {
    return { success: false, message: '2FA is already enabled' };
  }

  if (!user.twoFactorSecret) {
    return { success: false, message: 'Please generate a 2FA setup first' };
  }

  // Verify the token
  const isValid = authenticator.verify({
    token,
    secret: user.twoFactorSecret,
  });

  if (!isValid) {
    return { success: false, message: 'Invalid verification code' };
  }

  // Enable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true },
  });

  return { success: true, message: '2FA enabled successfully' };
}

/**
 * Verify TOTP token during login
 */
export async function verifyTwoFactorToken(
  userId: string,
  token: string
): Promise<TwoFactorVerifyResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorSecret: true,
      twoFactorEnabled: true,
      backupCodes: true,
    },
  });

  if (!user) {
    return { success: false, message: 'User not found' };
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    return { success: false, message: '2FA is not enabled for this account' };
  }

  // First, try to verify as TOTP token
  const isValidTotp = authenticator.verify({
    token,
    secret: user.twoFactorSecret,
  });

  if (isValidTotp) {
    return { success: true, message: 'Verification successful' };
  }

  // If not a valid TOTP, check backup codes
  const normalizedToken = token.replace(/-/g, '').toUpperCase();
  const hashedToken = hashBackupCode(normalizedToken);
  const backupCodeIndex = user.backupCodes.findIndex(
    (code) => code === hashedToken
  );

  if (backupCodeIndex !== -1) {
    // Remove used backup code
    const updatedCodes = [...user.backupCodes];
    updatedCodes.splice(backupCodeIndex, 1);

    await prisma.user.update({
      where: { id: userId },
      data: { backupCodes: updatedCodes },
    });

    return {
      success: true,
      message: 'Verification successful (backup code used)',
      usedBackupCode: true,
    };
  }

  return { success: false, message: 'Invalid verification code' };
}

/**
 * Disable 2FA for user
 */
export async function disableTwoFactor(
  userId: string,
  password: string
): Promise<TwoFactorVerifyResult> {
  const bcryptModule = await import('bcryptjs');
  const bcrypt = bcryptModule.default || bcryptModule;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, twoFactorEnabled: true },
  });

  if (!user) {
    return { success: false, message: 'User not found' };
  }

  if (!user.twoFactorEnabled) {
    return { success: false, message: '2FA is not enabled' };
  }

  // Verify password
  if (!user.passwordHash) {
    return { success: false, message: 'Cannot disable 2FA for OAuth accounts' };
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    return { success: false, message: 'Invalid password' };
  }

  // Disable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      backupCodes: [],
    },
  });

  return { success: true, message: '2FA disabled successfully' };
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(
  userId: string,
  token: string
): Promise<{ success: boolean; message: string; backupCodes?: string[] }> {
  // Verify current 2FA token first
  const verifyResult = await verifyTwoFactorToken(userId, token);
  if (!verifyResult.success) {
    return { success: false, message: 'Invalid verification code' };
  }

  // Generate new backup codes
  const newBackupCodes = generateBackupCodes(10);

  await prisma.user.update({
    where: { id: userId },
    data: { backupCodes: newBackupCodes.map(hashBackupCode) },
  });

  return {
    success: true,
    message: 'Backup codes regenerated successfully',
    backupCodes: newBackupCodes,
  };
}

/**
 * Check if user has 2FA enabled
 */
export async function getTwoFactorStatus(
  userId: string
): Promise<{ enabled: boolean; backupCodesRemaining: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, backupCodes: true },
  });

  return {
    enabled: user?.twoFactorEnabled || false,
    backupCodesRemaining: user?.backupCodes?.length || 0,
  };
}

// Helper functions

function generateBackupCodes(count: number): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    // Format as XXXX-XXXX for readability
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
  }
  return codes;
}

function hashBackupCode(code: string): string {
  const normalized = code.replace(/-/g, '').toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
