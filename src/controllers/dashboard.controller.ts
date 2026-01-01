import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service.js';

interface AuthRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

export const getDashboardStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'User not authenticated', code: 'UNAUTHORIZED' },
      });
      return;
    }

    const stats = await dashboardService.getDashboardStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};
