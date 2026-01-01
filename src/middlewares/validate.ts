import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from './errorHandler.js';

type RequestLocation = 'body' | 'query' | 'params';

/**
 * Middleware to validate request data using Zod schemas
 */
export const validate = (schema: ZodSchema, location: RequestLocation = 'body') => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = req[location];
      const validated = await schema.parseAsync(data);

      // Replace request data with validated/transformed data
      req[location] = validated as typeof req[typeof location];

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        next(ValidationError(errors[0]?.message || 'Validation failed'));
      } else {
        next(error);
      }
    }
  };
};

/**
 * Validate multiple locations at once
 */
export const validateMultiple = (schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        const validatedQuery = await schemas.query.parseAsync(req.query);
        Object.assign(req.query, validatedQuery);
      }
      if (schemas.params) {
        const validatedParams = await schemas.params.parseAsync(req.params);
        Object.assign(req.params, validatedParams);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        next(ValidationError(errors[0]?.message || 'Validation failed'));
      } else {
        next(error);
      }
    }
  };
};
