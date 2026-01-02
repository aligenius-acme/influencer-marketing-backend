import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import passport from './config/passport.js';

import { config } from './config/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import influencerRoutes from './routes/influencer.routes.js';
import savedInfluencerRoutes from './routes/savedInfluencer.routes.js';
import campaignRoutes from './routes/campaign.routes.js';
import listRoutes from './routes/list.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import irmRoutes from './routes/irm.routes.js';
import emailTemplateRoutes from './routes/emailTemplate.routes.js';
import csvImportExportRoutes from './routes/csvImportExport.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import messagingRoutes from './routes/messaging.routes.js';
import contentApprovalRoutes from './routes/contentApproval.routes.js';

const app: Express = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Stripe webhook needs raw body - must be before JSON parser
app.use(`${config.apiPrefix}/payments/webhook`, express.raw({ type: 'application/json' }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Passport initialization (for OAuth)
app.use(passport.initialize());

// Logging
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// API routes
app.use(`${config.apiPrefix}/auth`, authRoutes);
app.use(`${config.apiPrefix}/users`, userRoutes);
app.use(`${config.apiPrefix}/influencers`, influencerRoutes);
app.use(`${config.apiPrefix}/saved-influencers`, savedInfluencerRoutes);
app.use(`${config.apiPrefix}/campaigns`, campaignRoutes);
app.use(`${config.apiPrefix}/lists`, listRoutes);
app.use(`${config.apiPrefix}/analytics`, analyticsRoutes);
app.use(`${config.apiPrefix}/dashboard`, dashboardRoutes);
app.use(`${config.apiPrefix}/irm`, irmRoutes);
app.use(`${config.apiPrefix}/email-templates`, emailTemplateRoutes);
app.use(`${config.apiPrefix}/csv`, csvImportExportRoutes);
app.use(`${config.apiPrefix}/payments`, paymentRoutes);
app.use(`${config.apiPrefix}/messaging`, messagingRoutes);
app.use(`${config.apiPrefix}/content`, contentApprovalRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
