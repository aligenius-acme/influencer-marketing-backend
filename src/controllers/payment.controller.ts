import { Request, Response, NextFunction } from 'express';
import { stripeService, PlanType } from '../services/stripe.service.js';
import { BadRequestError } from '../middlewares/errorHandler.js';
import { config } from '../config/index.js';

// Type for authenticated request
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Get all available plans
 * GET /api/v1/payments/plans
 */
export const getPlans = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const plans = stripeService.getPlans();

    res.json({
      success: true,
      data: { plans },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's subscription
 * GET /api/v1/payments/subscription
 */
export const getSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const subscription = await stripeService.getSubscription(userId);

    res.json({
      success: true,
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create checkout session for a plan
 * POST /api/v1/payments/checkout
 */
export const createCheckout = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { plan } = req.body;

    if (!plan || !['STARTER', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)) {
      throw BadRequestError('Invalid plan. Must be STARTER, PROFESSIONAL, or ENTERPRISE');
    }

    const successUrl = `${config.frontendUrl}/settings/billing?success=true`;
    const cancelUrl = `${config.frontendUrl}/settings/billing?canceled=true`;

    const session = await stripeService.createCheckoutSession(
      userId,
      plan as PlanType,
      successUrl,
      cancelUrl
    );

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create billing portal session
 * POST /api/v1/payments/portal
 */
export const createPortal = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const returnUrl = `${config.frontendUrl}/settings/billing`;
    const url = await stripeService.createPortalSession(userId, returnUrl);

    res.json({
      success: true,
      data: { url },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel subscription
 * POST /api/v1/payments/cancel
 */
export const cancelSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    await stripeService.cancelSubscription(userId);

    res.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resume canceled subscription
 * POST /api/v1/payments/resume
 */
export const resumeSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    await stripeService.resumeSubscription(userId);

    res.json({
      success: true,
      message: 'Subscription resumed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment history
 * GET /api/v1/payments/history
 */
export const getPaymentHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const payments = await stripeService.getPaymentHistory(userId, limit);

    res.json({
      success: true,
      data: { payments },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Stripe webhook
 * POST /api/v1/payments/webhook
 */
export const handleWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      throw BadRequestError('Missing Stripe signature');
    }

    await stripeService.handleWebhook(req.body, signature);

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};

/**
 * Check plan limits for a feature
 * GET /api/v1/payments/limits/:feature
 */
export const checkLimits = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { feature } = req.params;
    const { currentCount } = req.query;

    if (!['savedInfluencers', 'campaigns', 'searches', 'exports'].includes(feature)) {
      throw BadRequestError('Invalid feature');
    }

    const result = await stripeService.checkPlanLimit(
      userId,
      feature as 'savedInfluencers' | 'campaigns' | 'searches' | 'exports',
      parseInt(currentCount as string) || 0
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
