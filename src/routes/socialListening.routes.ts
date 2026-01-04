/**
 * Social Listening Routes
 *
 * /api/v1/listening
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  // Rules
  createRule,
  getRules,
  getRule,
  updateRule,
  deleteRule,
  toggleRule,
  updateRuleNotifications,
  // Mentions
  getMentions,
  getMention,
  reviewMention,
  flagMention,
  getStats,
  // Trends
  generateTrendReport,
  getTrendReports,
  getTrendReport,
  // Mock
  addMockMention,
} from '../controllers/socialListening.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Rules
router.post('/rules', createRule);
router.get('/rules', getRules);
router.get('/rules/:id', getRule);
router.patch('/rules/:id', updateRule);
router.delete('/rules/:id', deleteRule);
router.post('/rules/:id/toggle', toggleRule);
router.patch('/rules/:id/notifications', updateRuleNotifications);

// Mentions
router.get('/mentions', getMentions);
router.get('/mentions/stats', getStats);
router.get('/mentions/:id', getMention);
router.post('/mentions/:id/review', reviewMention);
router.post('/mentions/:id/flag', flagMention);

// Trends
router.post('/trends', generateTrendReport);
router.get('/trends', getTrendReports);
router.get('/trends/:id', getTrendReport);

// Mock data (development)
router.post('/mock-mention', addMockMention);

export default router;
