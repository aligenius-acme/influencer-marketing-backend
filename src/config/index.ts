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

  // Frontend URL (for OAuth redirects)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // AWS S3
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    bucketName: process.env.AWS_BUCKET_NAME || '',
    region: process.env.AWS_REGION || 'us-east-1',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
  },
} as const;

export type Config = typeof config;
