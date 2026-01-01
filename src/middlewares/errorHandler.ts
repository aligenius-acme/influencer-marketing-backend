import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log error
  console.error(`[Error] ${statusCode} - ${message}`, {
    stack: err.stack,
    code: err.code,
  });

  // Send response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(config.env === 'development' && {
        stack: err.stack,
        code: err.code,
      }),
    },
  });
};

// Custom error class
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error creators
export const BadRequestError = (message: string = 'Bad Request') =>
  new ApiError(400, message, 'BAD_REQUEST');

export const UnauthorizedError = (message: string = 'Unauthorized') =>
  new ApiError(401, message, 'UNAUTHORIZED');

export const ForbiddenError = (message: string = 'Forbidden') =>
  new ApiError(403, message, 'FORBIDDEN');

export const NotFoundError = (message: string = 'Not Found') =>
  new ApiError(404, message, 'NOT_FOUND');

export const ConflictError = (message: string = 'Conflict') =>
  new ApiError(409, message, 'CONFLICT');

export const ValidationError = (message: string = 'Validation Error') =>
  new ApiError(422, message, 'VALIDATION_ERROR');

export const InternalError = (message: string = 'Internal Server Error') =>
  new ApiError(500, message, 'INTERNAL_ERROR');
