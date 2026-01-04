import { Request, Response, NextFunction } from 'express';
import { payoutService, CreateInvoiceParams, LineItem } from '../services/payout.service.js';
import { BadRequestError } from '../middlewares/errorHandler.js';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

// ==================== Connected Accounts ====================

/**
 * Create connected account for influencer
 * POST /api/v1/payouts/accounts
 */
export const createConnectedAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { savedInfluencerId, email, country } = req.body;

    if (!savedInfluencerId || !email) {
      throw BadRequestError('savedInfluencerId and email are required');
    }

    const result = await payoutService.createConnectedAccount({
      savedInfluencerId,
      email,
      country,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get onboarding link for connected account
 * GET /api/v1/payouts/accounts/:id/onboarding
 */
export const getOnboardingLink = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const url = await payoutService.getOnboardingLink(id);

    res.json({
      success: true,
      data: { url },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync connected account status
 * POST /api/v1/payouts/accounts/:id/sync
 */
export const syncAccountStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const account = await payoutService.syncAccountStatus(id);

    res.json({
      success: true,
      data: { account },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get connected account by influencer
 * GET /api/v1/payouts/accounts/influencer/:savedInfluencerId
 */
export const getAccountByInfluencer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { savedInfluencerId } = req.params;
    const account = await payoutService.getConnectedAccountByInfluencer(savedInfluencerId);

    res.json({
      success: true,
      data: { account },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Payouts ====================

/**
 * Create a payout to influencer
 * POST /api/v1/payouts
 */
export const createPayout = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const {
      connectedAccountId,
      amount,
      currency,
      description,
      campaignId,
      campaignInfluencerId,
      invoiceId,
      metadata,
    } = req.body;

    if (!connectedAccountId || !amount) {
      throw BadRequestError('connectedAccountId and amount are required');
    }

    const payout = await payoutService.createPayout({
      userId,
      connectedAccountId,
      amount,
      currency,
      description,
      campaignId,
      campaignInfluencerId,
      invoiceId,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: { payout },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payouts for authenticated user
 * GET /api/v1/payouts
 */
export const getPayouts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { status, limit, offset } = req.query;

    const result = await payoutService.getPayoutsByUser(userId, {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payouts for a connected account
 * GET /api/v1/payouts/accounts/:id/payouts
 */
export const getAccountPayouts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { limit, offset } = req.query;

    const result = await payoutService.getPayoutsByAccount(id, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payout statistics
 * GET /api/v1/payouts/stats
 */
export const getPayoutStats = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const stats = await payoutService.getPayoutStats(userId);

    res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Invoices ====================

/**
 * Create an invoice
 * POST /api/v1/payouts/invoices
 */
export const createInvoice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const {
      savedInfluencerId,
      campaignId,
      campaignInfluencerId,
      contractId,
      lineItems,
      notes,
      paymentTerms,
      dueDate,
      taxRate,
      discountAmount,
    } = req.body;

    if (!savedInfluencerId || !lineItems || !dueDate) {
      throw BadRequestError('savedInfluencerId, lineItems, and dueDate are required');
    }

    const params: CreateInvoiceParams = {
      userId,
      savedInfluencerId,
      campaignId,
      campaignInfluencerId,
      contractId,
      lineItems: lineItems as LineItem[],
      notes,
      paymentTerms,
      dueDate: new Date(dueDate),
      taxRate,
      discountAmount,
    };

    const invoice = await payoutService.createInvoice(params);

    res.status(201).json({
      success: true,
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoices for authenticated user
 * GET /api/v1/payouts/invoices
 */
export const getInvoices = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { status, limit, offset } = req.query;

    const result = await payoutService.getInvoices(userId, {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoice by ID
 * GET /api/v1/payouts/invoices/:id
 */
export const getInvoiceById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const invoice = await payoutService.getInvoiceById(id);

    res.json({
      success: true,
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send invoice
 * POST /api/v1/payouts/invoices/:id/send
 */
export const sendInvoice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const invoice = await payoutService.sendInvoice(id);

    res.json({
      success: true,
      data: { invoice },
      message: 'Invoice sent successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark invoice as paid
 * POST /api/v1/payouts/invoices/:id/pay
 */
export const markInvoiceAsPaid = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { createPayout = true } = req.body;

    const invoice = await payoutService.markInvoiceAsPaid(id, createPayout);

    res.json({
      success: true,
      data: { invoice },
      message: 'Invoice marked as paid',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Void invoice
 * POST /api/v1/payouts/invoices/:id/void
 */
export const voidInvoice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const invoice = await payoutService.updateInvoiceStatus(id, 'VOIDED');

    res.json({
      success: true,
      data: { invoice },
      message: 'Invoice voided',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get invoice statistics
 * GET /api/v1/payouts/invoices/stats
 */
export const getInvoiceStats = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const stats = await payoutService.getInvoiceStats(userId);

    res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Webhooks ====================

/**
 * Handle Stripe Connect webhooks
 * POST /api/v1/payouts/webhook
 */
export const handleConnectWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      throw BadRequestError('Missing Stripe signature');
    }

    await payoutService.handleConnectWebhook(req.body, signature);

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};
