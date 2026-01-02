import crypto from 'crypto';
import { prisma } from '../config/postgres.js';
import { config } from '../config/index.js';
import { BadRequestError, NotFoundError } from '../middlewares/errorHandler.js';
import { Prisma } from '@prisma/client';

// Check if Shopify is configured
const isConfigured = !!(config.shopify.apiKey && config.shopify.apiSecret);

if (!isConfigured) {
  console.log('Shopify not configured - using mock data for development');
}

// Mock product data for development
const MOCK_PRODUCTS = [
  {
    shopifyProductId: 'mock_prod_1',
    title: 'Premium Skincare Set',
    description: 'Complete skincare routine with cleanser, toner, and moisturizer',
    handle: 'premium-skincare-set',
    imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400',
    price: 89.99,
    currency: 'USD',
    variants: [{ id: 'var_1', title: 'Default', price: 89.99, sku: 'SKC-001' }],
    tags: ['skincare', 'beauty', 'gift-set'],
    productType: 'Skincare',
    vendor: 'BeautyBrand',
  },
  {
    shopifyProductId: 'mock_prod_2',
    title: 'Wireless Bluetooth Headphones',
    description: 'Premium noise-canceling headphones with 30-hour battery life',
    handle: 'wireless-bluetooth-headphones',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
    price: 199.99,
    currency: 'USD',
    variants: [
      { id: 'var_2a', title: 'Black', price: 199.99, sku: 'HP-BLK' },
      { id: 'var_2b', title: 'White', price: 199.99, sku: 'HP-WHT' },
    ],
    tags: ['electronics', 'audio', 'wireless'],
    productType: 'Electronics',
    vendor: 'TechGear',
  },
  {
    shopifyProductId: 'mock_prod_3',
    title: 'Organic Cotton T-Shirt',
    description: 'Soft, sustainable t-shirt made from 100% organic cotton',
    handle: 'organic-cotton-tshirt',
    imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
    price: 34.99,
    currency: 'USD',
    variants: [
      { id: 'var_3a', title: 'S / White', price: 34.99, sku: 'TS-S-W' },
      { id: 'var_3b', title: 'M / White', price: 34.99, sku: 'TS-M-W' },
      { id: 'var_3c', title: 'L / White', price: 34.99, sku: 'TS-L-W' },
    ],
    tags: ['clothing', 'sustainable', 'organic'],
    productType: 'Apparel',
    vendor: 'EcoWear',
  },
  {
    shopifyProductId: 'mock_prod_4',
    title: 'Fitness Tracker Watch',
    description: 'Track your steps, heart rate, and sleep with this smart fitness watch',
    handle: 'fitness-tracker-watch',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
    price: 149.99,
    currency: 'USD',
    variants: [{ id: 'var_4', title: 'Default', price: 149.99, sku: 'FT-001' }],
    tags: ['fitness', 'wearable', 'health'],
    productType: 'Wearables',
    vendor: 'FitTech',
  },
  {
    shopifyProductId: 'mock_prod_5',
    title: 'Artisan Coffee Beans',
    description: 'Single-origin, ethically sourced coffee beans - 1lb bag',
    handle: 'artisan-coffee-beans',
    imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400',
    price: 24.99,
    currency: 'USD',
    variants: [
      { id: 'var_5a', title: 'Light Roast', price: 24.99, sku: 'CF-LT' },
      { id: 'var_5b', title: 'Medium Roast', price: 24.99, sku: 'CF-MD' },
      { id: 'var_5c', title: 'Dark Roast', price: 24.99, sku: 'CF-DK' },
    ],
    tags: ['coffee', 'food', 'organic'],
    productType: 'Food & Beverage',
    vendor: 'CoffeeHouse',
  },
];

// Generate mock sales data
function generateMockSales(discountCodeId: string, code: string) {
  const sales = [];
  const numSales = Math.floor(Math.random() * 10) + 1;

  for (let i = 0; i < numSales; i++) {
    const subtotal = Math.random() * 200 + 50;
    const discountAmount = subtotal * 0.2; // 20% discount
    sales.push({
      id: `mock_sale_${discountCodeId}_${i}`,
      discountCodeId,
      shopifyOrderId: `mock_order_${Date.now()}_${i}`,
      orderNumber: `#${1000 + Math.floor(Math.random() * 9000)}`,
      subtotal,
      discountAmount,
      totalPrice: subtotal - discountAmount,
      currency: 'USD',
      customerEmail: `customer${i}@example.com`,
      commission: (subtotal - discountAmount) * 0.1, // 10% commission
      commissionRate: 10,
      orderDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });
  }

  return sales;
}

class ShopifyService {
  // ==================== OAuth & Store Connection ====================

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(userId: string, shop: string, redirectUri: string): string {
    if (!isConfigured) {
      // Mock mode - redirect directly with mock data
      const mockToken = Buffer.from(JSON.stringify({ userId, shop, mock: true })).toString('base64');
      return `${redirectUri}?code=mock_code&shop=${shop}&state=${mockToken}`;
    }

    const state = crypto.randomBytes(16).toString('hex');
    const scopes = config.shopify.scopes;

    return `https://${shop}/admin/oauth/authorize?client_id=${config.shopify.apiKey}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
  }

  /**
   * Handle OAuth callback and exchange code for access token
   */
  async handleOAuthCallback(
    userId: string,
    code: string,
    shop: string
  ): Promise<{ store: any }> {
    // Check if user already has a store connected
    const existingStore = await prisma.shopifyStore.findUnique({
      where: { userId },
    });

    if (existingStore) {
      throw BadRequestError('You already have a Shopify store connected. Disconnect it first.');
    }

    let accessToken: string;
    let storeName: string | null = null;
    let storeEmail: string | null = null;
    let currency = 'USD';

    if (!isConfigured || code === 'mock_code') {
      // Mock mode
      accessToken = 'mock_access_token_' + crypto.randomBytes(16).toString('hex');
      storeName = 'Demo Store';
      storeEmail = 'demo@example.com';
    } else {
      // Real Shopify OAuth
      const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.shopify.apiKey,
          client_secret: config.shopify.apiSecret,
          code,
        }),
      });

      if (!response.ok) {
        throw BadRequestError('Failed to authenticate with Shopify');
      }

      const data = await response.json() as { access_token: string };
      accessToken = data.access_token;

      // Get store info
      const storeResponse = await fetch(`https://${shop}/admin/api/${config.shopify.apiVersion}/shop.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
      });

      if (storeResponse.ok) {
        const storeData = await storeResponse.json() as { shop: { name: string; email: string; currency: string } };
        storeName = storeData.shop.name;
        storeEmail = storeData.shop.email;
        currency = storeData.shop.currency;
      }
    }

    // Save store to database
    const store = await prisma.shopifyStore.create({
      data: {
        userId,
        shopDomain: shop,
        accessToken,
        scope: config.shopify.scopes,
        storeName,
        storeEmail,
        currency,
        isActive: true,
      },
    });

    // Sync products in background
    this.syncProducts(userId).catch(console.error);

    return { store };
  }

  /**
   * Disconnect Shopify store
   */
  async disconnectStore(userId: string): Promise<void> {
    const store = await prisma.shopifyStore.findUnique({
      where: { userId },
    });

    if (!store) {
      throw NotFoundError('No Shopify store connected');
    }

    // Delete store and related data (cascades)
    await prisma.shopifyStore.delete({
      where: { userId },
    });
  }

  /**
   * Get connected store info
   */
  async getStoreInfo(userId: string) {
    const store = await prisma.shopifyStore.findUnique({
      where: { userId },
      include: {
        _count: {
          select: {
            products: true,
            discountCodes: true,
          },
        },
      },
    });

    if (!store) {
      return null;
    }

    // Get sales count
    const salesCount = await prisma.attributedSale.count({
      where: {
        discountCode: {
          storeId: store.id,
        },
      },
    });

    return {
      ...store,
      accessToken: undefined, // Don't expose token
      productsCount: store._count.products,
      discountCodesCount: store._count.discountCodes,
      salesCount,
    };
  }

  // ==================== Products ====================

  /**
   * Sync products from Shopify
   */
  async syncProducts(userId: string): Promise<{ synced: number }> {
    const store = await prisma.shopifyStore.findUnique({
      where: { userId },
    });

    if (!store) {
      throw NotFoundError('No Shopify store connected');
    }

    let products: any[];

    if (!isConfigured || store.accessToken.startsWith('mock_')) {
      // Mock mode - use mock products
      products = MOCK_PRODUCTS;
    } else {
      // Real Shopify API call
      const response = await fetch(
        `https://${store.shopDomain}/admin/api/${config.shopify.apiVersion}/products.json?limit=250`,
        {
          headers: { 'X-Shopify-Access-Token': store.accessToken },
        }
      );

      if (!response.ok) {
        throw BadRequestError('Failed to fetch products from Shopify');
      }

      const data = await response.json() as { products: any[] };
      products = data.products.map((p: any) => ({
        shopifyProductId: String(p.id),
        title: p.title,
        description: p.body_html,
        handle: p.handle,
        imageUrl: p.images?.[0]?.src || null,
        price: parseFloat(p.variants?.[0]?.price || '0'),
        compareAtPrice: p.variants?.[0]?.compare_at_price ? parseFloat(p.variants[0].compare_at_price) : null,
        currency: store.currency,
        variants: p.variants?.map((v: any) => ({
          id: String(v.id),
          title: v.title,
          price: parseFloat(v.price),
          sku: v.sku,
        })) || [],
        tags: p.tags?.split(',').map((t: string) => t.trim()) || [],
        productType: p.product_type,
        vendor: p.vendor,
      }));
    }

    // Upsert products
    for (const product of products) {
      await prisma.shopifyProduct.upsert({
        where: {
          storeId_shopifyProductId: {
            storeId: store.id,
            shopifyProductId: product.shopifyProductId,
          },
        },
        create: {
          storeId: store.id,
          ...product,
          price: new Prisma.Decimal(product.price),
          compareAtPrice: product.compareAtPrice ? new Prisma.Decimal(product.compareAtPrice) : null,
          syncedAt: new Date(),
        },
        update: {
          ...product,
          price: new Prisma.Decimal(product.price),
          compareAtPrice: product.compareAtPrice ? new Prisma.Decimal(product.compareAtPrice) : null,
          isAvailable: true,
          syncedAt: new Date(),
        },
      });
    }

    // Update store last sync time
    await prisma.shopifyStore.update({
      where: { id: store.id },
      data: { lastSyncAt: new Date() },
    });

    return { synced: products.length };
  }

  /**
   * Get synced products
   */
  async getProducts(
    userId: string,
    options: {
      search?: string;
      productType?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const store = await prisma.shopifyStore.findUnique({
      where: { userId },
    });

    if (!store) {
      throw NotFoundError('No Shopify store connected');
    }

    const { search, productType, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      storeId: store.id,
      isAvailable: true,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (productType) {
      where.productType = productType;
    }

    const [products, total] = await Promise.all([
      prisma.shopifyProduct.findMany({
        where,
        skip,
        take: limit,
        orderBy: { title: 'asc' },
      }),
      prisma.shopifyProduct.count({ where }),
    ]);

    return {
      products,
      total,
      page,
      limit,
      hasMore: skip + products.length < total,
    };
  }

  /**
   * Get single product
   */
  async getProduct(userId: string, productId: string) {
    const store = await prisma.shopifyStore.findUnique({
      where: { userId },
    });

    if (!store) {
      throw NotFoundError('No Shopify store connected');
    }

    const product = await prisma.shopifyProduct.findFirst({
      where: {
        id: productId,
        storeId: store.id,
      },
    });

    if (!product) {
      throw NotFoundError('Product not found');
    }

    return product;
  }

  // ==================== Discount Codes ====================

  /**
   * Create a discount code for an influencer
   */
  async createDiscountCode(
    userId: string,
    options: {
      code: string;
      discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
      discountValue: number;
      campaignInfluencerId?: string;
      maxUses?: number;
      startsAt?: Date;
      expiresAt?: Date;
    }
  ) {
    const store = await prisma.shopifyStore.findUnique({
      where: { userId },
    });

    if (!store) {
      throw NotFoundError('No Shopify store connected');
    }

    // Check if code already exists
    const existingCode = await prisma.discountCode.findFirst({
      where: {
        storeId: store.id,
        code: options.code.toUpperCase(),
      },
    });

    if (existingCode) {
      throw BadRequestError('Discount code already exists');
    }

    let shopifyPriceRuleId: string | null = null;
    let shopifyDiscountId: string | null = null;

    if (isConfigured && !store.accessToken.startsWith('mock_')) {
      // Create price rule in Shopify
      const priceRuleData = {
        price_rule: {
          title: options.code,
          target_type: 'line_item',
          target_selection: 'all',
          allocation_method: 'across',
          value_type: options.discountType === 'PERCENTAGE' ? 'percentage' : 'fixed_amount',
          value: options.discountType === 'PERCENTAGE'
            ? `-${options.discountValue}`
            : `-${options.discountValue}`,
          customer_selection: 'all',
          usage_limit: options.maxUses,
          starts_at: options.startsAt?.toISOString(),
          ends_at: options.expiresAt?.toISOString(),
        },
      };

      const priceRuleResponse = await fetch(
        `https://${store.shopDomain}/admin/api/${config.shopify.apiVersion}/price_rules.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': store.accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(priceRuleData),
        }
      );

      if (priceRuleResponse.ok) {
        const priceRuleResult = await priceRuleResponse.json() as { price_rule: { id: number | string } };
        shopifyPriceRuleId = String(priceRuleResult.price_rule.id);

        // Create discount code
        const discountResponse = await fetch(
          `https://${store.shopDomain}/admin/api/${config.shopify.apiVersion}/price_rules/${shopifyPriceRuleId}/discount_codes.json`,
          {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': store.accessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              discount_code: { code: options.code.toUpperCase() },
            }),
          }
        );

        if (discountResponse.ok) {
          const discountResult = await discountResponse.json() as { discount_code: { id: number | string } };
          shopifyDiscountId = String(discountResult.discount_code.id);
        }
      }
    }

    // Save to database
    const discountCode = await prisma.discountCode.create({
      data: {
        storeId: store.id,
        campaignInfluencerId: options.campaignInfluencerId,
        code: options.code.toUpperCase(),
        shopifyPriceRuleId,
        shopifyDiscountId,
        discountType: options.discountType,
        discountValue: new Prisma.Decimal(options.discountValue),
        maxUses: options.maxUses,
        startsAt: options.startsAt,
        expiresAt: options.expiresAt,
        isActive: true,
      },
      include: {
        campaignInfluencer: true,
      },
    });

    return discountCode;
  }

  /**
   * Get discount codes
   */
  async getDiscountCodes(
    userId: string,
    options: {
      campaignInfluencerId?: string;
      isActive?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const store = await prisma.shopifyStore.findUnique({
      where: { userId },
    });

    if (!store) {
      throw NotFoundError('No Shopify store connected');
    }

    const { campaignInfluencerId, isActive, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: any = { storeId: store.id };

    if (campaignInfluencerId) {
      where.campaignInfluencerId = campaignInfluencerId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [codes, total] = await Promise.all([
      prisma.discountCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          campaignInfluencer: true,
          _count: {
            select: { attributedSales: true },
          },
        },
      }),
      prisma.discountCode.count({ where }),
    ]);

    return {
      codes,
      total,
      page,
      limit,
      hasMore: skip + codes.length < total,
    };
  }

  /**
   * Get single discount code
   */
  async getDiscountCode(userId: string, codeId: string) {
    const store = await prisma.shopifyStore.findUnique({
      where: { userId },
    });

    if (!store) {
      throw NotFoundError('No Shopify store connected');
    }

    const code = await prisma.discountCode.findFirst({
      where: {
        id: codeId,
        storeId: store.id,
      },
      include: {
        campaignInfluencer: true,
        attributedSales: {
          orderBy: { orderDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!code) {
      throw NotFoundError('Discount code not found');
    }

    return code;
  }

  /**
   * Delete discount code
   */
  async deleteDiscountCode(userId: string, codeId: string): Promise<void> {
    const store = await prisma.shopifyStore.findUnique({
      where: { userId },
    });

    if (!store) {
      throw NotFoundError('No Shopify store connected');
    }

    const code = await prisma.discountCode.findFirst({
      where: {
        id: codeId,
        storeId: store.id,
      },
    });

    if (!code) {
      throw NotFoundError('Discount code not found');
    }

    // Delete from Shopify if real
    if (isConfigured && !store.accessToken.startsWith('mock_') && code.shopifyPriceRuleId) {
      await fetch(
        `https://${store.shopDomain}/admin/api/${config.shopify.apiVersion}/price_rules/${code.shopifyPriceRuleId}.json`,
        {
          method: 'DELETE',
          headers: { 'X-Shopify-Access-Token': store.accessToken },
        }
      );
    }

    // Delete from database
    await prisma.discountCode.delete({
      where: { id: codeId },
    });
  }

  // ==================== Sales Attribution ====================

  /**
   * Get attributed sales
   */
  async getAttributedSales(
    userId: string,
    options: {
      discountCodeId?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const store = await prisma.shopifyStore.findUnique({
      where: { userId },
    });

    if (!store) {
      throw NotFoundError('No Shopify store connected');
    }

    const { discountCodeId, startDate, endDate, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      discountCode: {
        storeId: store.id,
      },
    };

    if (discountCodeId) {
      where.discountCodeId = discountCodeId;
    }

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = startDate;
      if (endDate) where.orderDate.lte = endDate;
    }

    const [sales, total] = await Promise.all([
      prisma.attributedSale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { orderDate: 'desc' },
        include: {
          discountCode: {
            include: {
              campaignInfluencer: true,
            },
          },
        },
      }),
      prisma.attributedSale.count({ where }),
    ]);

    return {
      sales,
      total,
      page,
      limit,
      hasMore: skip + sales.length < total,
    };
  }

  /**
   * Get sales statistics
   */
  async getSalesStats(userId: string) {
    const store = await prisma.shopifyStore.findUnique({
      where: { userId },
    });

    if (!store) {
      throw NotFoundError('No Shopify store connected');
    }

    const sales = await prisma.attributedSale.findMany({
      where: {
        discountCode: {
          storeId: store.id,
        },
      },
      include: {
        discountCode: {
          include: {
            campaignInfluencer: true,
          },
        },
      },
    });

    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.totalPrice), 0);
    const totalCommission = sales.reduce((sum, s) => sum + Number(s.commission || 0), 0);
    const totalDiscount = sales.reduce((sum, s) => sum + Number(s.discountAmount), 0);

    // Group by influencer
    const byInfluencer: Record<string, { sales: number; revenue: number; commission: number }> = {};
    for (const sale of sales) {
      const influencerId = sale.discountCode.campaignInfluencerId || 'unassigned';
      if (!byInfluencer[influencerId]) {
        byInfluencer[influencerId] = { sales: 0, revenue: 0, commission: 0 };
      }
      byInfluencer[influencerId].sales++;
      byInfluencer[influencerId].revenue += Number(sale.totalPrice);
      byInfluencer[influencerId].commission += Number(sale.commission || 0);
    }

    return {
      totalSales: sales.length,
      totalRevenue,
      totalCommission,
      totalDiscount,
      averageOrderValue: sales.length > 0 ? totalRevenue / sales.length : 0,
      byInfluencer,
    };
  }

  /**
   * Get sales grouped by influencer
   */
  async getSalesByInfluencer(userId: string) {
    const store = await prisma.shopifyStore.findUnique({
      where: { userId },
    });

    if (!store) {
      throw NotFoundError('No Shopify store connected');
    }

    const codes = await prisma.discountCode.findMany({
      where: {
        storeId: store.id,
        campaignInfluencerId: { not: null },
      },
      include: {
        campaignInfluencer: true,
        attributedSales: true,
      },
    });

    return codes.map(code => ({
      influencerId: code.campaignInfluencerId,
      code: code.code,
      discountType: code.discountType,
      discountValue: code.discountValue,
      salesCount: code.attributedSales.length,
      totalRevenue: code.attributedSales.reduce((sum, s) => sum + Number(s.totalPrice), 0),
      totalCommission: code.attributedSales.reduce((sum, s) => sum + Number(s.commission || 0), 0),
    }));
  }

  // ==================== Seeding Campaigns ====================

  /**
   * Create or update seeding campaign
   */
  async createSeedingCampaign(
    userId: string,
    campaignId: string,
    data: {
      products: Array<{ productId: string; variantId?: string; quantity: number }>;
      shippingInstructions?: string;
    }
  ) {
    // Verify campaign belongs to user
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      throw NotFoundError('Campaign not found');
    }

    const seedingCampaign = await prisma.seedingCampaign.upsert({
      where: { campaignId },
      create: {
        campaignId,
        products: data.products,
        shippingInstructions: data.shippingInstructions,
      },
      update: {
        products: data.products,
        shippingInstructions: data.shippingInstructions,
      },
      include: {
        shipments: {
          include: {
            campaignInfluencer: true,
          },
        },
      },
    });

    return seedingCampaign;
  }

  /**
   * Get seeding campaign details
   */
  async getSeedingCampaign(userId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      throw NotFoundError('Campaign not found');
    }

    const seedingCampaign = await prisma.seedingCampaign.findUnique({
      where: { campaignId },
      include: {
        shipments: {
          include: {
            campaignInfluencer: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return seedingCampaign;
  }

  /**
   * Create shipment for an influencer
   */
  async createShipment(
    userId: string,
    campaignId: string,
    data: {
      campaignInfluencerId: string;
      products: Array<{ productId: string; variantId?: string; quantity: number }>;
      shippingAddress?: object;
      notes?: string;
    }
  ) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      throw NotFoundError('Campaign not found');
    }

    const seedingCampaign = await prisma.seedingCampaign.findUnique({
      where: { campaignId },
    });

    if (!seedingCampaign) {
      throw BadRequestError('Seeding campaign not set up');
    }

    const shipment = await prisma.seedingShipment.create({
      data: {
        seedingCampaignId: seedingCampaign.id,
        campaignInfluencerId: data.campaignInfluencerId,
        products: data.products,
        shippingAddress: data.shippingAddress,
        notes: data.notes,
        status: 'PENDING',
      },
      include: {
        campaignInfluencer: true,
      },
    });

    return shipment;
  }

  /**
   * Update shipment status
   */
  async updateShipment(
    userId: string,
    shipmentId: string,
    data: {
      status?: 'PENDING' | 'SHIPPED' | 'DELIVERED' | 'RETURNED';
      trackingNumber?: string;
      carrier?: string;
      notes?: string;
    }
  ) {
    // Verify ownership through relations
    const shipment = await prisma.seedingShipment.findFirst({
      where: { id: shipmentId },
      include: {
        seedingCampaign: {
          include: {
            campaign: true,
          },
        },
      },
    });

    if (!shipment || shipment.seedingCampaign.campaign.userId !== userId) {
      throw NotFoundError('Shipment not found');
    }

    const updateData: any = { ...data };

    if (data.status === 'SHIPPED' && !shipment.shippedAt) {
      updateData.shippedAt = new Date();
    }

    if (data.status === 'DELIVERED' && !shipment.deliveredAt) {
      updateData.deliveredAt = new Date();
    }

    const updated = await prisma.seedingShipment.update({
      where: { id: shipmentId },
      data: updateData,
      include: {
        campaignInfluencer: true,
      },
    });

    return updated;
  }

  // ==================== Webhooks ====================

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    if (!config.shopify.webhookSecret) {
      return !isConfigured; // Allow in mock mode
    }

    const hmac = crypto
      .createHmac('sha256', config.shopify.webhookSecret)
      .update(body, 'utf8')
      .digest('base64');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac));
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(topic: string, shop: string, body: any): Promise<void> {
    console.log(`Shopify webhook received: ${topic} from ${shop}`);

    const store = await prisma.shopifyStore.findFirst({
      where: { shopDomain: shop },
    });

    if (!store) {
      console.log(`Store not found for webhook: ${shop}`);
      return;
    }

    switch (topic) {
      case 'orders/create':
      case 'orders/updated':
        await this.handleOrderWebhook(store.id, body);
        break;

      case 'products/update':
        await this.handleProductUpdateWebhook(store.id, body);
        break;

      case 'products/delete':
        await this.handleProductDeleteWebhook(store.id, body);
        break;

      case 'app/uninstalled':
        await this.handleAppUninstalledWebhook(store.id);
        break;

      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }
  }

  private async handleOrderWebhook(storeId: string, order: any): Promise<void> {
    // Check if order used one of our discount codes
    const discountCodes = order.discount_codes || [];

    for (const dc of discountCodes) {
      const code = await prisma.discountCode.findFirst({
        where: {
          storeId,
          code: dc.code.toUpperCase(),
        },
      });

      if (code) {
        // Calculate commission
        const totalPrice = parseFloat(order.total_price || '0');
        const discountAmount = parseFloat(dc.amount || '0');
        const commissionRate = 10; // Default 10%
        const commission = totalPrice * (commissionRate / 100);

        // Upsert sale record
        await prisma.attributedSale.upsert({
          where: {
            discountCodeId_shopifyOrderId: {
              discountCodeId: code.id,
              shopifyOrderId: String(order.id),
            },
          },
          create: {
            discountCodeId: code.id,
            shopifyOrderId: String(order.id),
            orderNumber: order.name || `#${order.order_number}`,
            subtotal: new Prisma.Decimal(parseFloat(order.subtotal_price || '0')),
            discountAmount: new Prisma.Decimal(discountAmount),
            totalPrice: new Prisma.Decimal(totalPrice),
            currency: order.currency || 'USD',
            customerEmail: order.email,
            commission: new Prisma.Decimal(commission),
            commissionRate: new Prisma.Decimal(commissionRate),
            orderDate: new Date(order.created_at),
          },
          update: {
            subtotal: new Prisma.Decimal(parseFloat(order.subtotal_price || '0')),
            totalPrice: new Prisma.Decimal(totalPrice),
          },
        });

        // Update usage count
        await prisma.discountCode.update({
          where: { id: code.id },
          data: { usageCount: { increment: 1 } },
        });
      }
    }
  }

  private async handleProductUpdateWebhook(storeId: string, product: any): Promise<void> {
    await prisma.shopifyProduct.updateMany({
      where: {
        storeId,
        shopifyProductId: String(product.id),
      },
      data: {
        title: product.title,
        description: product.body_html,
        handle: product.handle,
        imageUrl: product.images?.[0]?.src,
        price: new Prisma.Decimal(parseFloat(product.variants?.[0]?.price || '0')),
        variants: product.variants?.map((v: any) => ({
          id: String(v.id),
          title: v.title,
          price: parseFloat(v.price),
          sku: v.sku,
        })) || [],
        tags: product.tags?.split(',').map((t: string) => t.trim()) || [],
        productType: product.product_type,
        vendor: product.vendor,
        syncedAt: new Date(),
      },
    });
  }

  private async handleProductDeleteWebhook(storeId: string, product: any): Promise<void> {
    await prisma.shopifyProduct.updateMany({
      where: {
        storeId,
        shopifyProductId: String(product.id),
      },
      data: {
        isAvailable: false,
      },
    });
  }

  private async handleAppUninstalledWebhook(storeId: string): Promise<void> {
    await prisma.shopifyStore.update({
      where: { id: storeId },
      data: { isActive: false },
    });
  }
}

export const shopifyService = new ShopifyService();
