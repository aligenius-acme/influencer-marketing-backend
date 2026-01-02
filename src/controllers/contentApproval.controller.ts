import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { contentApprovalService } from '../services/contentApproval.service.js';
import { BadRequestError } from '../middlewares/errorHandler.js';

/**
 * Create a new content submission
 */
export async function createSubmission(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      campaignId,
      influencerId,
      title,
      description,
      contentType,
      dueDate,
      files,
      externalLinks,
      metadata,
    } = req.body;

    if (!campaignId || !influencerId || !title) {
      throw BadRequestError('Campaign ID, influencer ID, and title are required');
    }

    const submission = await contentApprovalService.createSubmission(
      req.user!.userId,
      {
        campaignId,
        influencerId,
        title,
        description,
        contentType,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        files,
        externalLinks,
        metadata,
      }
    );

    res.status(201).json({
      success: true,
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all submissions
 */
export async function getSubmissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const {
      campaignId,
      influencerId,
      status,
      contentType,
      search,
      page = '1',
      limit = '20',
    } = req.query;

    const filters = {
      campaignId: campaignId as string | undefined,
      influencerId: influencerId as string | undefined,
      status: status as string | undefined,
      contentType: contentType as string | undefined,
      search: search as string | undefined,
    };

    const result = await contentApprovalService.getSubmissions(
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
 * Get a single submission
 */
export async function getSubmission(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { submissionId } = req.params;

    const submission = await contentApprovalService.getSubmission(
      req.user!.userId,
      submissionId
    );

    res.status(200).json({
      success: true,
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a submission
 */
export async function updateSubmission(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { submissionId } = req.params;
    const { title, description, contentType, dueDate, files, externalLinks, metadata } = req.body;

    const submission = await contentApprovalService.updateSubmission(
      req.user!.userId,
      submissionId,
      {
        title,
        description,
        contentType,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        files,
        externalLinks,
        metadata,
      }
    );

    res.status(200).json({
      success: true,
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a submission
 */
export async function deleteSubmission(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { submissionId } = req.params;

    await contentApprovalService.deleteSubmission(req.user!.userId, submissionId);

    res.status(200).json({
      success: true,
      message: 'Submission deleted',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submit content for review
 */
export async function submitForReview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { submissionId } = req.params;

    const submission = await contentApprovalService.submitForReview(
      req.user!.userId,
      submissionId
    );

    res.status(200).json({
      success: true,
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Start reviewing content
 */
export async function startReview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { submissionId } = req.params;

    const submission = await contentApprovalService.startReview(
      req.user!.userId,
      submissionId
    );

    res.status(200).json({
      success: true,
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Request revisions
 */
export async function requestRevision(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { submissionId } = req.params;
    const { feedback } = req.body;

    if (!feedback) {
      throw BadRequestError('Feedback is required when requesting revisions');
    }

    const submission = await contentApprovalService.requestRevision(
      req.user!.userId,
      submissionId,
      feedback
    );

    res.status(200).json({
      success: true,
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve content
 */
export async function approveContent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { submissionId } = req.params;
    const { feedback } = req.body;

    const submission = await contentApprovalService.approveContent(
      req.user!.userId,
      submissionId,
      feedback
    );

    res.status(200).json({
      success: true,
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reject content
 */
export async function rejectContent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { submissionId } = req.params;
    const { feedback } = req.body;

    if (!feedback) {
      throw BadRequestError('Feedback is required when rejecting content');
    }

    const submission = await contentApprovalService.rejectContent(
      req.user!.userId,
      submissionId,
      feedback
    );

    res.status(200).json({
      success: true,
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark content as published
 */
export async function markAsPublished(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { submissionId } = req.params;
    const { publishedUrl } = req.body;

    const submission = await contentApprovalService.markAsPublished(
      req.user!.userId,
      submissionId,
      publishedUrl
    );

    res.status(200).json({
      success: true,
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add feedback to a submission
 */
export async function addFeedback(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { submissionId } = req.params;
    const { content, attachments } = req.body;

    if (!content) {
      throw BadRequestError('Feedback content is required');
    }

    const submission = await contentApprovalService.addFeedback(
      req.user!.userId,
      submissionId,
      content,
      attachments
    );

    res.status(200).json({
      success: true,
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get submission statistics
 */
export async function getStats(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { campaignId } = req.query;

    const stats = await contentApprovalService.getStats(
      req.user!.userId,
      campaignId as string | undefined
    );

    res.status(200).json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get submissions for a specific campaign
 */
export async function getCampaignSubmissions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { campaignId } = req.params;

    const submissions = await contentApprovalService.getCampaignSubmissions(
      req.user!.userId,
      campaignId
    );

    res.status(200).json({
      success: true,
      data: { submissions },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Revert submission to draft
 */
export async function revertToDraft(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { submissionId } = req.params;

    const submission = await contentApprovalService.revertToDraft(
      req.user!.userId,
      submissionId
    );

    res.status(200).json({
      success: true,
      data: { submission },
    });
  } catch (error) {
    next(error);
  }
}
