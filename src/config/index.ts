import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // App
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: '/api/v1',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Database - PostgreSQL
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/influencer_platform',
  },

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/influencer_platform',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // ScrapCreators API
  scrapCreators: {
    apiUrl: process.env.SCRAPCREATORS_API_URL || 'https://api.scrapcreators.com',
    apiKey: process.env.SCRAPCREATORS_API_KEY || '',
  },

  // Email
  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    from: process.env.EMAIL_FROM || 'noreply@influencer-platform.com',
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    // Pricing plans (prices created in Stripe Dashboard)
    prices: {
      starter: process.env.STRIPE_PRICE_STARTER || '',
      professional: process.env.STRIPE_PRICE_PROFESSIONAL || '',
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE || '',
    },
  },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/v1/auth/google/callback',
  },

  // Shopify
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY || '',
    apiSecret: process.env.SHOPIFY_API_SECRET || '',
    scopes: 'read_products,write_products,read_orders,write_orders,read_price_rules,write_price_rules,read_discounts,write_discounts',
    apiVersion: '2024-01',
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || '',
  },

  // ==================== Phase 3: Social Media APIs ====================

  // Instagram Graph API
  instagram: {
    clientId: process.env.INSTAGRAM_CLIENT_ID || '',
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || '',
    callbackUrl: process.env.INSTAGRAM_CALLBACK_URL || 'http://localhost:4000/api/v1/social/callback/instagram',
  },

  // TikTok API
  tiktok: {
    clientKey: process.env.TIKTOK_CLIENT_KEY || '',
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
    callbackUrl: process.env.TIKTOK_CALLBACK_URL || 'http://localhost:4000/api/v1/social/callback/tiktok',
  },

  // YouTube Data API
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    callbackUrl: process.env.YOUTUBE_CALLBACK_URL || 'http://localhost:4000/api/v1/social/callback/youtube',
  },

  // ==================== Phase 3: E-Signature ====================

  // DocuSign
  docusign: {
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || '',
    secretKey: process.env.DOCUSIGN_SECRET_KEY || '',
    accountId: process.env.DOCUSIGN_ACCOUNT_ID || '',
    baseUrl: process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi',
    oauthUrl: process.env.DOCUSIGN_OAUTH_URL || 'https://account-d.docusign.com',
  },

  // ==================== Phase 3: AI Services ====================

  // OpenAI (for sentiment analysis, content suggestions)
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  // ==================== Phase 3: Background Jobs ====================

  // BullMQ (uses Redis connection)
  bullmq: {
    redisUrl: process.env.BULL_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Frontend URL (for OAuth redirects)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // API URL (for OAuth callbacks)
  apiUrl: process.env.API_URL || 'http://localhost:4000/api/v1',

  // AWS S3
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    bucketName: process.env.AWS_BUCKET_NAME || '',
    region: process.env.AWS_REGION || 'us-east-1',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
      : ['http://localhost:3000', 'http://localhost:3002'],
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
  },
} as const;

export type Config = typeof config;
