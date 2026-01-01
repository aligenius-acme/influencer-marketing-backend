import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

// GET /api/v1/users/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    // TODO: Implement get current user
    res.status(501).json({ message: 'Get current user endpoint - Coming soon' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/users/me
router.patch('/me', authenticate, async (req, res, next) => {
  try {
    // TODO: Implement update current user
    res.status(501).json({ message: 'Update current user endpoint - Coming soon' });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/users/me/brand-profile
router.get('/me/brand-profile', authenticate, async (req, res, next) => {
  try {
    // TODO: Implement get brand profile
    res.status(501).json({ message: 'Get brand profile endpoint - Coming soon' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/users/me/brand-profile
router.patch('/me/brand-profile', authenticate, async (req, res, next) => {
  try {
    // TODO: Implement update brand profile
    res.status(501).json({ message: 'Update brand profile endpoint - Coming soon' });
  } catch (error) {
    next(error);
  }
});

export default router;
