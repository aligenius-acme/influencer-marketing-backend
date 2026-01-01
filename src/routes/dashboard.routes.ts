import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { getDashboardStats } from '../controllers/dashboard.controller.js';

const router = Router();

// GET /api/v1/dashboard/stats - Get aggregated dashboard stats
router.get('/stats', authenticate, getDashboardStats);

export default router;
