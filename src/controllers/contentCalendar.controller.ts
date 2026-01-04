/**
 * Content Calendar Controller
 *
 * Handles HTTP requests for content calendar and scheduled posts
 */

import { Request, Response, NextFunction } from 'express';
import { contentCalendarService } from '../services/contentCalendar.service.js';
import { brandGuidelinesService } from '../services/brandGuidelines.service.js';

// ==================== Scheduled Posts ====================

export async function createPost(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const post = await contentCalendarService.createPost(userId, req.body);

    res.status(201).json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCalendarPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const { startDate, endDate, platform, status, campaignId, influencerId } = req.query;

    const posts = await contentCalendarService.getCalendarPosts(userId, {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      platform: platform as any,
      status: status as any,
      campaignId: campaignId as string,
      influencerId: influencerId as string,
    });

    res.json({
      success: true,
      data: posts,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPost(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const post = await contentCalendarService.getPost(userId, req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: { message: 'Post not found' },
      });
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePost(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const post = await contentCalendarService.updatePost(userId, req.params.id, req.body);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: { message: 'Post not found' },
      });
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
}

export async function deletePost(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const deleted = await contentCalendarService.deletePost(userId, req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { message: 'Post not found' },
      });
    }

    res.json({
      success: true,
      message: 'Post deleted',
    });
  } catch (error) {
    next(error);
  }
}

export async function reschedulePost(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const { scheduledAt } = req.body;
    const post = await contentCalendarService.reschedulePost(
      userId,
      req.params.id,
      new Date(scheduledAt)
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        error: { message: 'Post not found' },
      });
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
}

export async function bulkReschedule(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const updates = req.body.updates.map((u: any) => ({
      postId: u.postId,
      scheduledAt: new Date(u.scheduledAt),
    }));

    const count = await contentCalendarService.bulkReschedule(userId, updates);

    res.json({
      success: true,
      data: { updated: count },
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Status Management ====================

export async function submitForApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const post = await contentCalendarService.submitForApproval(userId, req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: { message: 'Post not found or not in draft status' },
      });
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
}

export async function approvePost(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const post = await contentCalendarService.approvePost(userId, req.params.id, userId);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: { message: 'Post not found or not pending approval' },
      });
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectPost(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const { reason } = req.body;
    const post = await contentCalendarService.rejectPost(userId, req.params.id, reason);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: { message: 'Post not found or not pending approval' },
      });
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
}

export async function schedulePost(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const post = await contentCalendarService.schedulePost(userId, req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: { message: 'Post not found' },
      });
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAsPublished(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const { publishedUrl } = req.body;
    const post = await contentCalendarService.markAsPublished(userId, req.params.id, publishedUrl);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: { message: 'Post not found' },
      });
    }

    res.json({
      success: true,
      data: post,
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Calendar Views ====================

export async function getPostsByDate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const { startDate, endDate } = req.query;

    const posts = await contentCalendarService.getPostsByDate(
      userId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: posts,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUpcomingPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const limit = parseInt(req.query.limit as string) || 10;
    const posts = await contentCalendarService.getUpcomingPosts(userId, limit);

    res.json({
      success: true,
      data: posts,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPendingApproval(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const posts = await contentCalendarService.getPendingApproval(userId);

    res.json({
      success: true,
      data: posts,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCalendarStats(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const { startDate, endDate } = req.query;

    const stats = await contentCalendarService.getCalendarStats(
      userId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Compliance ====================

export async function checkCompliance(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const result = await contentCalendarService.checkCompliance(userId, req.params.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// ==================== Brand Guidelines ====================

export async function getGuidelines(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const guidelines = await brandGuidelinesService.getActive(userId);

    res.json({
      success: true,
      data: guidelines,
    });
  } catch (error) {
    next(error);
  }
}

export async function createGuidelines(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const guidelines = await brandGuidelinesService.create(userId, req.body);

    res.status(201).json({
      success: true,
      data: guidelines,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateGuidelines(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('User not found');

    const guidelines = await brandGuidelinesService.update(userId, req.params.id, req.body);

    if (!guidelines) {
      return res.status(404).json({
        success: false,
        error: { message: 'Guidelines not found' },
      });
    }

    res.json({
      success: true,
      data: guidelines,
    });
  } catch (error) {
    next(error);
  }
}

export async function getGuidelinesTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const { industry } = req.query;

    const template = industry
      ? brandGuidelinesService.getIndustryTemplate(industry as string)
      : brandGuidelinesService.getDefaultTemplate();

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
}
