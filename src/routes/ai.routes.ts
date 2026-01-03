/**
 * AI Routes
 *
 * /api/v1/ai
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  // Match Scores
  calculateMatchScore,
  getMatchScores,
  getRecommendations,
  findSimilar,
  // Predictions
  predictCampaign,
  getPredictions,
  quickEstimate,
  // Fake Follower Analysis
  analyzeFakeFollowers,
  getFakeFollowerAnalysis,
  getAllFakeFollowerAnalyses,
  quickCheck,
} from '../controllers/ai.controller.js';

const router = Router();

// Public endpoints (for quick estimates without auth)
router.post('/quick-estimate', quickEstimate);
router.post('/quick-check', quickCheck);

// Protected routes
router.use(authenticate);

// Match Scores
router.get('/match-scores', getMatchScores);
router.post('/match-score/:influencerId', calculateMatchScore);
router.post('/recommendations', getRecommendations);
router.get('/similar/:influencerId', findSimilar);

// Predictions
router.post('/predict/:campaignId', predictCampaign);
router.get('/predictions/:campaignId', getPredictions);

// Fake Follower Analysis
router.get('/fake-follower', getAllFakeFollowerAnalyses);
router.get('/fake-follower/:influencerId', getFakeFollowerAnalysis);
router.post('/fake-follower/:influencerId', analyzeFakeFollowers);

export default router;
