import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  // Connected Accounts
  createConnectedAccount,
  getOnboardingLink,
  syncAccountStatus,
  getAccountByInfluencer,

  // Payouts
  createPayout,
  getPayouts,
  getAccountPayouts,
  getPayoutStats,

  // Invoices
  createInvoice,
  getInvoices,
  getInvoiceById,
  sendInvoice,
  markInvoiceAsPaid,
  voidInvoice,
  getInvoiceStats,

  // Webhooks
  handleConnectWebhook,
} from '../controllers/payout.controller.js';

const router = Router();

// Webhook route - raw body parsing handled in app.ts
router.post('/webhook', handleConnectWebhook);

// All other routes require authentication
router.use(authenticate);

// ==================== Connected Accounts ====================

// Create connected account for influencer
router.post('/accounts', createConnectedAccount);

// Get onboarding link
router.get('/accounts/:id/onboarding', getOnboardingLink);

// Sync account status from Stripe
router.post('/accounts/:id/sync', syncAccountStatus);

// Get account by influencer ID
router.get('/accounts/influencer/:savedInfluencerId', getAccountByInfluencer);

// Get payouts for a specific account
router.get('/accounts/:id/payouts', getAccountPayouts);

// ==================== Payouts ====================

// Get payout statistics
router.get('/stats', getPayoutStats);

// List payouts for authenticated user
router.get('/', getPayouts);

// Create a payout
router.post('/', createPayout);

// ==================== Invoices ====================

// Get invoice statistics (must be before /:id route)
router.get('/invoices/stats', getInvoiceStats);

// List invoices
router.get('/invoices', getInvoices);

// Create invoice
router.post('/invoices', createInvoice);

// Get invoice by ID
router.get('/invoices/:id', getInvoiceById);

// Send invoice
router.post('/invoices/:id/send', sendInvoice);

// Mark invoice as paid
router.post('/invoices/:id/pay', markInvoiceAsPaid);

// Void invoice
router.post('/invoices/:id/void', voidInvoice);

export default router;
