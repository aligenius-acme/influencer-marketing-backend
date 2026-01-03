/**
 * Social Media Routes
 *
 * /api/v1/social
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  getConnections,
  initiateConnection,
  handleCallback,
  disconnectPlatform,
  getMetrics,
  triggerSync,
  getConnection,
} from '../controllers/socialMedia.controller.js';

const router = Router();

// OAuth callback - no auth required (state validation handles security)
router.get('/callback/:platform', handleCallback);

// All other routes require authentication
router.use(authenticate);

// Connection management
router.get('/connections', getConnections);
router.post('/connect/:platform', initiateConnection);
router.delete('/disconnect/:platform', disconnectPlatform);
router.get('/connection/:platform', getConnection);

// Metrics
router.get('/metrics/:platform', getMetrics);
router.post('/sync/:connectionId', triggerSync);

export default router;
