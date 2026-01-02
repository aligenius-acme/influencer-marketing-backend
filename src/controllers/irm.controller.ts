import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { irmService } from '../services/irm.service.js';

// ==================== Custom Fields ====================

export const getCustomFields = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const fields = await irmService.getCustomFields(req.user!.userId);
    res.json({ success: true, data: fields });
  } catch (error) {
    next(error);
  }
};

export const getCustomField = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const field = await irmService.getCustomFieldById(req.user!.userId, req.params.id);
    res.json({ success: true, data: field });
  } catch (error) {
    next(error);
  }
};

export const createCustomField = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const field = await irmService.createCustomField(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: field });
  } catch (error) {
    next(error);
  }
};

export const updateCustomField = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const field = await irmService.updateCustomField(
      req.user!.userId,
      req.params.id,
      req.body
    );
    res.json({ success: true, data: field });
  } catch (error) {
    next(error);
  }
};

export const deleteCustomField = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await irmService.deleteCustomField(req.user!.userId, req.params.id);
    res.json({ success: true, message: 'Custom field deleted' });
  } catch (error) {
    next(error);
  }
};

export const reorderCustomFields = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await irmService.reorderCustomFields(req.user!.userId, req.body.fieldIds);
    res.json({ success: true, message: 'Custom fields reordered' });
  } catch (error) {
    next(error);
  }
};

// ==================== Communication Logs ====================

export const getCommunicationLogs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { savedInfluencerId, campaignId, type, limit, offset } = req.query;
    const result = await irmService.getCommunicationLogs(req.user!.userId, {
      savedInfluencerId: savedInfluencerId as string,
      campaignId: campaignId as string,
      type: type as any,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json({ success: true, data: result.logs, meta: { total: result.total } });
  } catch (error) {
    next(error);
  }
};

export const getCommunicationLog = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const log = await irmService.getCommunicationLog(req.user!.userId, req.params.id);
    res.json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

export const createCommunicationLog = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const log = await irmService.createCommunicationLog(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

export const updateCommunicationLog = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const log = await irmService.updateCommunicationLog(
      req.user!.userId,
      req.params.id,
      req.body
    );
    res.json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

export const deleteCommunicationLog = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await irmService.deleteCommunicationLog(req.user!.userId, req.params.id);
    res.json({ success: true, message: 'Communication log deleted' });
  } catch (error) {
    next(error);
  }
};

// ==================== Influencer Reviews ====================

export const getInfluencerReviews = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { savedInfluencerId } = req.query;
    const reviews = await irmService.getInfluencerReviews(
      req.user!.userId,
      savedInfluencerId as string
    );
    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
};

export const getInfluencerReview = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const review = await irmService.getInfluencerReview(req.user!.userId, req.params.id);
    res.json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

export const createInfluencerReview = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const review = await irmService.createInfluencerReview(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

export const updateInfluencerReview = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const review = await irmService.updateInfluencerReview(
      req.user!.userId,
      req.params.id,
      req.body
    );
    res.json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

export const deleteInfluencerReview = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await irmService.deleteInfluencerReview(req.user!.userId, req.params.id);
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    next(error);
  }
};

export const getInfluencerRatingSummary = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const summary = await irmService.getInfluencerRatingSummary(req.params.influencerId);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

// ==================== Tag Groups ====================

export const getTagGroups = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const groups = await irmService.getTagGroups(req.user!.userId);
    res.json({ success: true, data: groups });
  } catch (error) {
    next(error);
  }
};

export const createTagGroup = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const group = await irmService.createTagGroup(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
};

export const updateTagGroup = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const group = await irmService.updateTagGroup(
      req.user!.userId,
      req.params.id,
      req.body
    );
    res.json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
};

export const deleteTagGroup = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await irmService.deleteTagGroup(req.user!.userId, req.params.id);
    res.json({ success: true, message: 'Tag group deleted' });
  } catch (error) {
    next(error);
  }
};

export const initializeTagGroups = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const groups = await irmService.initializeDefaultTagGroups(req.user!.userId);
    res.json({ success: true, data: groups });
  } catch (error) {
    next(error);
  }
};
