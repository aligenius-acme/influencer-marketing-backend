import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError, ForbiddenError } from './errorHandler.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Use Request directly - Express.User is extended in src/types/express.d.ts
export type AuthenticatedRequest = Request;

// Type-safe middleware wrapper for Express 5 compatibility
const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.accessToken;

    if (!token) {
      throw UnauthorizedError('Access token is required');
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(UnauthorizedError('Token has expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
};

// Export as RequestHandler for Express 5 compatibility
export const authenticate: RequestHandler = authMiddleware as RequestHandler;

export const authorize = (...roles: string[]): RequestHandler => {
  return ((req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(ForbiddenError('Insufficient permissions'));
    }

    next();
  }) as RequestHandler;
};

// Optional authentication - doesn't throw if no token
const optionalAuthMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies?.accessToken;

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      req.user = decoded;
    }

    next();
  } catch {
    // Ignore token errors for optional auth
    next();
  }
};

export const optionalAuth: RequestHandler = optionalAuthMiddleware as RequestHandler;
