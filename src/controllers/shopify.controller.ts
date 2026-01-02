import { Request, Response, NextFunction } from 'express';
import { shopifyService } from '../services/shopify.service.js';
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

// ==================== OAuth & Store Connection ====================

/**
 * Get Shopify OAuth URL
 * GET /api/v1/shopify/auth
 */
export const getAuthUrl = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { shop } = req.query;

    if (!shop || typeof shop !== 'string') {
      throw BadRequestError('Shop domain is required (e.g., mystore.myshopify.com)');
    }

    // Validate shop domain format
    if (!shop.endsWith('.myshopify.com')) {
      throw BadRequestError('Invalid shop domain. Must be in format: mystore.myshopify.com');
    }

    const redirectUri = `${config.frontendUrl}/settings/integrations?shopify=callback`;
    const authUrl = shopifyService.getAuthUrl(userId, shop, redirectUri);

    res.json({
      success: true,
      data: { authUrl },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Shopify OAuth callback
 * GET /api/v1/shopify/callback
 */
export const handleCallback = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { code, shop } = req.query;

    if (!code || typeof code !== 'string') {
      throw BadRequestError('Authorization code is required');
    }

    if (!shop || typeof shop !== 'string') {
      throw BadRequestError('Shop domain is required');
    }

    const result = await shopifyService.handleOAuthCallback(userId, code, shop);

    res.json({
      success: true,
      message: 'Shopify store connected successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disconnect Shopify store
 * DELETE /api/v1/shopify/disconnect
 */
export const disconnectStore = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    await shopifyService.disconnectStore(userId);

    res.json({
      success: true,
      message: 'Shopify store disconnected successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get connected store info
 * GET /api/v1/shopify/store
 */
export const getStoreInfo = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const store = await shopifyService.getStoreInfo(userId);

    res.json({
      success: true,
      data: { store },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Products ====================

/**
 * Sync products from Shopify
 * POST /api/v1/shopify/products/sync
 */
export const syncProducts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const result = await shopifyService.syncProducts(userId);

    res.json({
      success: true,
      message: `Synced ${result.synced} products from Shopify`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get synced products
 * GET /api/v1/shopify/products
 */
export const getProducts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { search, productType, page, limit } = req.query;

    const result = await shopifyService.getProducts(userId, {
      search: search as string,
      productType: productType as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
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
 * Get single product
 * GET /api/v1/shopify/products/:id
 */
export const getProduct = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { id } = req.params;
    const product = await shopifyService.getProduct(userId, id);

    res.json({
      success: true,
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Discount Codes ====================

/**
 * Create discount code
 * POST /api/v1/shopify/discount-codes
 */
export const createDiscountCode = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { code, discountType, discountValue, campaignInfluencerId, maxUses, startsAt, expiresAt } = req.body;

    if (!code || typeof code !== 'string') {
      throw BadRequestError('Discount code is required');
    }

    if (!discountType || !['PERCENTAGE', 'FIXED_AMOUNT'].includes(discountType)) {
      throw BadRequestError('Discount type must be PERCENTAGE or FIXED_AMOUNT');
    }

    if (typeof discountValue !== 'number' || discountValue <= 0) {
      throw BadRequestError('Discount value must be a positive number');
    }

    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      throw BadRequestError('Percentage discount cannot exceed 100');
    }

    const discountCode = await shopifyService.createDiscountCode(userId, {
      code,
      discountType,
      discountValue,
      campaignInfluencerId,
      maxUses,
      startsAt: startsAt ? new Date(startsAt) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json({
      success: true,
      message: 'Discount code created successfully',
      data: { discountCode },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get discount codes
 * GET /api/v1/shopify/discount-codes
 */
export const getDiscountCodes = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { campaignInfluencerId, isActive, page, limit } = req.query;

    const result = await shopifyService.getDiscountCodes(userId, {
      campaignInfluencerId: campaignInfluencerId as string,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
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
 * Get single discount code
 * GET /api/v1/shopify/discount-codes/:id
 */
export const getDiscountCode = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { id } = req.params;
    const discountCode = await shopifyService.getDiscountCode(userId, id);

    res.json({
      success: true,
      data: { discountCode },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete discount code
 * DELETE /api/v1/shopify/discount-codes/:id
 */
export const deleteDiscountCode = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { id } = req.params;
    await shopifyService.deleteDiscountCode(userId, id);

    res.json({
      success: true,
      message: 'Discount code deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Sales Attribution ====================

/**
 * Get attributed sales
 * GET /api/v1/shopify/sales
 */
export const getAttributedSales = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { discountCodeId, startDate, endDate, page, limit } = req.query;

    const result = await shopifyService.getAttributedSales(userId, {
      discountCodeId: discountCodeId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
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
 * Get sales statistics
 * GET /api/v1/shopify/sales/stats
 */
export const getSalesStats = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const stats = await shopifyService.getSalesStats(userId);

    res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sales by influencer
 * GET /api/v1/shopify/sales/by-influencer
 */
export const getSalesByInfluencer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const data = await shopifyService.getSalesByInfluencer(userId);

    res.json({
      success: true,
      data: { influencers: data },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Seeding Campaigns ====================

/**
 * Create or update seeding campaign
 * POST /api/v1/shopify/seeding
 */
export const createSeedingCampaign = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { campaignId, products, shippingInstructions } = req.body;

    if (!campaignId) {
      throw BadRequestError('Campaign ID is required');
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      throw BadRequestError('At least one product is required');
    }

    const seedingCampaign = await shopifyService.createSeedingCampaign(userId, campaignId, {
      products,
      shippingInstructions,
    });

    res.status(201).json({
      success: true,
      message: 'Seeding campaign created successfully',
      data: { seedingCampaign },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get seeding campaign
 * GET /api/v1/shopify/seeding/:campaignId
 */
export const getSeedingCampaign = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { campaignId } = req.params;
    const seedingCampaign = await shopifyService.getSeedingCampaign(userId, campaignId);

    res.json({
      success: true,
      data: { seedingCampaign },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update seeding campaign
 * PATCH /api/v1/shopify/seeding/:campaignId
 */
export const updateSeedingCampaign = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { campaignId } = req.params;
    const { products, shippingInstructions } = req.body;

    const seedingCampaign = await shopifyService.createSeedingCampaign(userId, campaignId, {
      products: products || [],
      shippingInstructions,
    });

    res.json({
      success: true,
      message: 'Seeding campaign updated successfully',
      data: { seedingCampaign },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create shipment
 * POST /api/v1/shopify/seeding/:campaignId/shipments
 */
export const createShipment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { campaignId } = req.params;
    const { campaignInfluencerId, products, shippingAddress, notes } = req.body;

    if (!campaignInfluencerId) {
      throw BadRequestError('Campaign influencer ID is required');
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      throw BadRequestError('At least one product is required');
    }

    const shipment = await shopifyService.createShipment(userId, campaignId, {
      campaignInfluencerId,
      products,
      shippingAddress,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'Shipment created successfully',
      data: { shipment },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update shipment
 * PATCH /api/v1/shopify/seeding/shipments/:id
 */
export const updateShipment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw BadRequestError('User not authenticated');
    }

    const { id } = req.params;
    const { status, trackingNumber, carrier, notes } = req.body;

    if (status && !['PENDING', 'SHIPPED', 'DELIVERED', 'RETURNED'].includes(status)) {
      throw BadRequestError('Invalid shipment status');
    }

    const shipment = await shopifyService.updateShipment(userId, id, {
      status,
      trackingNumber,
      carrier,
      notes,
    });

    res.json({
      success: true,
      message: 'Shipment updated successfully',
      data: { shipment },
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Webhooks ====================

/**
 * Handle Shopify webhook
 * POST /api/v1/shopify/webhook
 */
export const handleWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const topic = req.headers['x-shopify-topic'] as string;
    const shop = req.headers['x-shopify-shop-domain'] as string;
    const signature = req.headers['x-shopify-hmac-sha256'] as string;

    if (!topic || !shop) {
      throw BadRequestError('Missing required Shopify headers');
    }

    // Verify signature
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const isValid = shopifyService.verifyWebhookSignature(rawBody, signature || '');

    if (!isValid) {
      console.error('Invalid Shopify webhook signature');
      throw BadRequestError('Invalid webhook signature');
    }

    // Parse body if needed
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    await shopifyService.handleWebhook(topic, shop, body);

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};
