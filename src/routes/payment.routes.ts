import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  getPlans,
  getSubscription,
  createCheckout,
  createPortal,
  cancelSubscription,
  resumeSubscription,
  getPaymentHistory,
  handleWebhook,
  checkLimits,
} from '../controllers/payment.controller.js';

const router = Router();

// Webhook route - raw body parsing is handled in app.ts before JSON parser
router.post('/webhook', handleWebhook);

// Public routes
router.get('/plans', getPlans);

// Protected routes
router.use(authenticate);

// Subscription management
router.get('/subscription', getSubscription);
router.post('/checkout', createCheckout);
router.post('/portal', createPortal);
router.post('/cancel', cancelSubscription);
router.post('/resume', resumeSubscription);

// Payment history
router.get('/history', getPaymentHistory);

// Plan limits
router.get('/limits/:feature', checkLimits);

export default router;
