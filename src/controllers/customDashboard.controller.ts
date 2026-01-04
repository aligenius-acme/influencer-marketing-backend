/**
 * Custom Dashboard Controller
 *
 * Handles HTTP requests for custom dashboards and Advanced BI
 */

import { Request, Response, NextFunction } from 'express';
import { customDashboardService } from '../services/customDashboard.service.js';

// ==================== Dashboard CRUD ====================

export async function createDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const dashboard = await customDashboardService.createDashboard(userId, req.body);

    res.status(201).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDashboards(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const dashboards = await customDashboardService.getDashboards(userId);

    res.json({
      success: true,
      data: dashboards,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const dashboard = await customDashboardService.getDashboard(userId, req.params.id);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard not found' },
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDashboardByToken(req: Request, res: Response, next: NextFunction) {
  try {
    const dashboard = await customDashboardService.getDashboardByToken(req.params.token);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard not found or not public' },
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const dashboard = await customDashboardService.updateDashboard(userId, req.params.id, req.body);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard not found' },
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const deleted = await customDashboardService.deleteDashboard(userId, req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard not found' },
      });
    }

    res.json({
      success: true,
      message: 'Dashboard deleted',
    });
  } catch (error) {
    next(error);
  }
}

export async function duplicateDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const { name } = req.body;
    const dashboard = await customDashboardService.duplicateDashboard(userId, req.params.id, name);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard not found' },
      });
    }

    res.status(201).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Widget Management ====================

export async function addWidget(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const dashboard = await customDashboardService.addWidget(userId, req.params.id, req.body);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard not found' },
      });
    }

    res.status(201).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateWidget(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const dashboard = await customDashboardService.updateWidget(
      userId,
      req.params.dashboardId,
      req.params.widgetId,
      req.body
    );

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard or widget not found' },
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeWidget(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const dashboard = await customDashboardService.removeWidget(
      userId,
      req.params.dashboardId,
      req.params.widgetId
    );

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard or widget not found' },
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateWidgetPositions(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const dashboard = await customDashboardService.updateWidgetPositions(
      userId,
      req.params.id,
      req.body.positions
    );

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard not found' },
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Sharing ====================

export async function generatePublicLink(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const token = await customDashboardService.generatePublicLink(userId, req.params.id);

    if (!token) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard not found' },
      });
    }

    res.json({
      success: true,
      data: { token, url: `/dashboards/public/${token}` },
    });
  } catch (error) {
    next(error);
  }
}

export async function revokePublicLink(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const revoked = await customDashboardService.revokePublicLink(userId, req.params.id);

    if (!revoked) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard not found' },
      });
    }

    res.json({
      success: true,
      message: 'Public link revoked',
    });
  } catch (error) {
    next(error);
  }
}

export async function shareDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const { shareWithUserId, permission } = req.body;
    const dashboard = await customDashboardService.shareDashboard(
      userId,
      req.params.id,
      shareWithUserId,
      permission
    );

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard not found' },
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

export async function unshareDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const dashboard = await customDashboardService.unshareDashboard(
      userId,
      req.params.id,
      req.params.shareUserId
    );

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: { message: 'Dashboard not found' },
      });
    }

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Widget Data ====================

export async function getDashboardData(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const { startDate, endDate } = req.query;
    const dateRange = startDate && endDate
      ? { start: new Date(startDate as string), end: new Date(endDate as string) }
      : undefined;

    const data = await customDashboardService.getDashboardData(userId, req.params.id, dateRange);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Templates ====================

export async function getTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const templates = customDashboardService.getTemplates();

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
}

export async function createFromTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const { templateIndex, name } = req.body;
    const templates = customDashboardService.getTemplates();
    const template = templates[templateIndex];

    if (!template) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid template index' },
      });
    }

    // Create dashboard
    const dashboard = await customDashboardService.createDashboard(userId, {
      name: name || template.name,
      description: template.description,
    });

    // Add widgets
    for (const widget of template.widgets) {
      await customDashboardService.addWidget(userId, dashboard._id.toString(), widget);
    }

    // Fetch updated dashboard
    const result = await customDashboardService.getDashboard(userId, dashboard._id.toString());

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
