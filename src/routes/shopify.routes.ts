import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  // OAuth & Store
  getAuthUrl,
  handleCallback,
  disconnectStore,
  getStoreInfo,
  // Products
  syncProducts,
  getProducts,
  getProduct,
  // Discount Codes
  createDiscountCode,
  getDiscountCodes,
  getDiscountCode,
  deleteDiscountCode,
  // Sales
  getAttributedSales,
  getSalesStats,
  getSalesByInfluencer,
  // Seeding
  createSeedingCampaign,
  getSeedingCampaign,
  updateSeedingCampaign,
  createShipment,
  updateShipment,
  // Webhook
  handleWebhook,
} from '../controllers/shopify.controller.js';

const router = Router();

// ==================== Webhook (No Auth - Raw Body) ====================
// Webhook route - raw body parsing is handled in app.ts before JSON parser
router.post('/webhook', handleWebhook);

// ==================== Protected Routes ====================
router.use(authenticate);

// Store Connection
router.get('/auth', getAuthUrl);
router.get('/callback', handleCallback);
router.delete('/disconnect', disconnectStore);
router.get('/store', getStoreInfo);

// Products
router.get('/products', getProducts);
router.post('/products/sync', syncProducts);
router.get('/products/:id', getProduct);

// Discount Codes
router.post('/discount-codes', createDiscountCode);
router.get('/discount-codes', getDiscountCodes);
router.get('/discount-codes/:id', getDiscountCode);
router.delete('/discount-codes/:id', deleteDiscountCode);

// Sales Attribution
router.get('/sales', getAttributedSales);
router.get('/sales/stats', getSalesStats);
router.get('/sales/by-influencer', getSalesByInfluencer);

// Seeding Campaigns
router.post('/seeding', createSeedingCampaign);
router.get('/seeding/:campaignId', getSeedingCampaign);
router.patch('/seeding/:campaignId', updateSeedingCampaign);
router.post('/seeding/:campaignId/shipments', createShipment);
router.patch('/seeding/shipments/:id', updateShipment);

export default router;
