import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/postgres.js';
import { config } from '../config/index.js';
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  NotFoundError
} from '../middlewares/errorHandler.js';

interface RegisterInput {
  email: string;
  password: string;
  companyName: string;
  industry?: string;
  website?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface UserResponse {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  createdAt: Date;
  brandProfile: {
    id: string;
    companyName: string;
    industry: string | null;
    website: string | null;
    logoUrl: string | null;
    description: string | null;
  } | null;
}

class AuthService {
  private readonly SALT_ROUNDS = 12;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    const { email, password, companyName, industry, website } = input;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw ConflictError('An account with this email already exists');
    }

    // Validate password strength
    this.validatePassword(password);

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user with brand profile in a transaction
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role: 'BRAND',
        emailVerified: false,
        brandProfile: {
          create: {
            companyName,
            industry,
            website,
          },
        },
      },
      include: {
        brandProfile: true,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    const { email, password } = input;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { brandProfile: true },
    });

    if (!user || !user.passwordHash) {
      throw UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const tokens = await this.generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: this.formatUserResponse(user),
      tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Hash the refresh token to compare with stored hash
    const tokenHash = this.hashToken(refreshToken);

    // Find the refresh token in database
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!storedToken) {
      throw UnauthorizedError('Invalid or expired refresh token');
    }

    // Delete the used refresh token (rotate tokens)
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Generate new tokens
    const tokens = await this.generateTokens({
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    });

    return tokens;
  }

  /**
   * Logout user (invalidate refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    await prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * Get current user
   */
  async getCurrentUser(userId: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { brandProfile: true },
    });

    if (!user) {
      throw NotFoundError('User not found');
    }

    return this.formatUserResponse(user);
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: { avatarUrl?: string; companyName?: string; industry?: string; website?: string; description?: string }
  ): Promise<UserResponse> {
    const { avatarUrl, ...brandProfileData } = data;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(Object.keys(brandProfileData).length > 0 && {
          brandProfile: {
            update: brandProfileData,
          },
        }),
      },
      include: { brandProfile: true },
    });

    return this.formatUserResponse(user);
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success message to prevent email enumeration
    if (!user) {
      return { message: 'If an account exists with this email, you will receive a password reset link' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = this.hashToken(resetToken);
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token (you'd need to add this field to the User model)
    // For now, we'll just return the token (in production, send via email)
    // await prisma.user.update({
    //   where: { id: user.id },
    //   data: { resetTokenHash, resetTokenExpiry },
    // });

    // TODO: Send email with reset link
    console.log(`Password reset token for ${email}: ${resetToken}`);

    return { message: 'If an account exists with this email, you will receive a password reset link' };
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    this.validatePassword(newPassword);

    // TODO: Implement password reset with token validation
    // const tokenHash = this.hashToken(token);
    // const user = await prisma.user.findFirst({
    //   where: {
    //     resetTokenHash: tokenHash,
    //     resetTokenExpiry: { gt: new Date() },
    //   },
    // });

    return { message: 'Password has been reset successfully' };
  }

  // ==================== Private Methods ====================

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(payload: TokenPayload): Promise<AuthTokens> {
    // Generate access token
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    // Generate refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = this.hashToken(refreshToken);

    // Calculate expiry date for refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        userId: payload.userId,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Hash a token using SHA-256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw BadRequestError('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      throw BadRequestError('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      throw BadRequestError('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      throw BadRequestError('Password must contain at least one number');
    }
  }

  /**
   * Format user response (exclude sensitive data)
   */
  private formatUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      brandProfile: user.brandProfile
        ? {
            id: user.brandProfile.id,
            companyName: user.brandProfile.companyName,
            industry: user.brandProfile.industry,
            website: user.brandProfile.website,
            logoUrl: user.brandProfile.logoUrl,
            description: user.brandProfile.description,
          }
        : null,
    };
  }
}

export const authService = new AuthService();
