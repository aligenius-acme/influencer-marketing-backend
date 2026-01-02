import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { messagingService } from '../services/messaging.service.js';
import { BadRequestError } from '../middlewares/errorHandler.js';

/**
 * Get or create a conversation with an influencer
 */
export async function getOrCreateConversation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { influencerId, campaignId, initialMessage } = req.body;

    if (!influencerId) {
      throw BadRequestError('Influencer ID is required');
    }

    const conversation = await messagingService.getOrCreateConversation(
      req.user!.userId,
      { influencerId, campaignId, initialMessage }
    );

    res.status(200).json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all conversations for the authenticated user
 */
export async function getConversations(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      status,
      campaignId,
      platform,
      search,
      hasUnread,
      labels,
      page = '1',
      limit = '20',
    } = req.query;

    const filters = {
      status: status as 'active' | 'archived' | 'blocked' | undefined,
      campaignId: campaignId as string | undefined,
      platform: platform as string | undefined,
      search: search as string | undefined,
      hasUnread: hasUnread === 'true',
      labels: labels ? (labels as string).split(',') : undefined,
    };

    const result = await messagingService.getConversations(
      req.user!.userId,
      filters,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single conversation with messages
 */
export async function getConversation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { conversationId } = req.params;

    const conversation = await messagingService.getConversation(
      req.user!.userId,
      conversationId
    );

    res.status(200).json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get messages for a conversation with pagination
 */
export async function getMessages(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { conversationId } = req.params;
    const { page = '1', limit = '50' } = req.query;

    const result = await messagingService.getMessages(
      req.user!.userId,
      conversationId,
      parseInt(page as string, 10),
      parseInt(limit as string, 10)
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { conversationId } = req.params;
    const { content, messageType, templateId, attachments } = req.body;

    if (!content) {
      throw BadRequestError('Message content is required');
    }

    const message = await messagingService.sendMessage(
      req.user!.userId,
      conversationId,
      { content, messageType, templateId, attachments }
    );

    res.status(201).json({
      success: true,
      data: { message },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Simulate an influencer reply (for demo/testing)
 */
export async function simulateReply(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;

    if (!content) {
      throw BadRequestError('Message content is required');
    }

    const message = await messagingService.simulateInfluencerReply(
      req.user!.userId,
      conversationId,
      content
    );

    res.status(201).json({
      success: true,
      data: { message },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark all messages in a conversation as read
 */
export async function markAsRead(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { conversationId } = req.params;

    await messagingService.markAsRead(req.user!.userId, conversationId);

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Archive a conversation
 */
export async function archiveConversation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { conversationId } = req.params;

    await messagingService.archiveConversation(req.user!.userId, conversationId);

    res.status(200).json({
      success: true,
      message: 'Conversation archived',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Unarchive a conversation
 */
export async function unarchiveConversation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { conversationId } = req.params;

    await messagingService.unarchiveConversation(req.user!.userId, conversationId);

    res.status(200).json({
      success: true,
      message: 'Conversation unarchived',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Block a conversation
 */
export async function blockConversation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { conversationId } = req.params;

    await messagingService.blockConversation(req.user!.userId, conversationId);

    res.status(200).json({
      success: true,
      message: 'Conversation blocked',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update labels on a conversation
 */
export async function updateLabels(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { conversationId } = req.params;
    const { labels } = req.body;

    if (!Array.isArray(labels)) {
      throw BadRequestError('Labels must be an array');
    }

    await messagingService.updateLabels(req.user!.userId, conversationId, labels);

    res.status(200).json({
      success: true,
      message: 'Labels updated',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update notes on a conversation
 */
export async function updateNotes(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { conversationId } = req.params;
    const { notes } = req.body;

    if (typeof notes !== 'string') {
      throw BadRequestError('Notes must be a string');
    }

    await messagingService.updateNotes(req.user!.userId, conversationId, notes);

    res.status(200).json({
      success: true,
      message: 'Notes updated',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { conversationId } = req.params;

    await messagingService.deleteConversation(req.user!.userId, conversationId);

    res.status(200).json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get unread message count
 */
export async function getUnreadCount(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const count = await messagingService.getUnreadCount(req.user!.userId);

    res.status(200).json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get messaging stats
 */
export async function getStats(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const stats = await messagingService.getStats(req.user!.userId);

    res.status(200).json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Search messages across all conversations
 */
export async function searchMessages(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { q, limit = '20' } = req.query;

    if (!q || typeof q !== 'string') {
      throw BadRequestError('Search query is required');
    }

    const results = await messagingService.searchMessages(
      req.user!.userId,
      q,
      parseInt(limit as string, 10)
    );

    res.status(200).json({
      success: true,
      data: { results },
    });
  } catch (error) {
    next(error);
  }
}
