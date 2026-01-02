import { Request, Response, NextFunction } from 'express';
import { savedInfluencerService } from '../services/savedInfluencer.service.js';

// ==================== Saved Influencer Endpoints ====================

// Save an influencer
export const saveInfluencer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { scrapcreatorsId, platform, profile, audience, notes, tags, isFavorite, listIds } = req.body;

    const savedInfluencer = await savedInfluencerService.saveInfluencer({
      userId,
      scrapcreatorsId,
      platform,
      profile,
      audience,
      notes,
      tags,
      isFavorite,
      listIds,
    });

    res.status(201).json({
      success: true,
      data: savedInfluencer,
    });
  } catch (error) {
    next(error);
  }
};

// Get all saved influencers with filters
export const getSavedInfluencers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const {
      platform,
      query,
      tags,
      isFavorite,
      listId,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await savedInfluencerService.searchSavedInfluencers(userId, {
      platform: platform as string,
      query: query as string,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      isFavorite: isFavorite === 'true' ? true : isFavorite === 'false' ? false : undefined,
      listId: listId as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Get a single saved influencer
export const getSavedInfluencer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const influencer = await savedInfluencerService.getSavedInfluencer(userId, id);

    if (!influencer) {
      res.status(404).json({ success: false, message: 'Saved influencer not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: influencer,
    });
  } catch (error) {
    next(error);
  }
};

// Update a saved influencer
export const updateSavedInfluencer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { notes, tags, customFields, isFavorite } = req.body;

    const influencer = await savedInfluencerService.updateSavedInfluencer(userId, id, {
      notes,
      tags,
      customFields,
      isFavorite,
    });

    if (!influencer) {
      res.status(404).json({ success: false, message: 'Saved influencer not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: influencer,
    });
  } catch (error) {
    next(error);
  }
};

// Remove a saved influencer
export const removeSavedInfluencer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const deleted = await savedInfluencerService.removeSavedInfluencer(userId, id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'Saved influencer not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Influencer removed from saved',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== Favorites Endpoints ====================

// Get favorites
export const getFavorites = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { page = '1', limit = '20' } = req.query;
    const result = await savedInfluencerService.getFavorites(
      userId,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Toggle favorite
export const toggleFavorite = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const influencer = await savedInfluencerService.toggleFavorite(userId, id);

    if (!influencer) {
      res.status(404).json({ success: false, message: 'Saved influencer not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: influencer,
    });
  } catch (error) {
    next(error);
  }
};

// Check if influencer is saved
export const checkIfSaved = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { platform, scrapcreatorsId } = req.query;
    const result = await savedInfluencerService.checkIfSaved(
      userId,
      platform as string,
      scrapcreatorsId as string
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk check if influencers are saved
export const bulkCheckIfSaved = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { influencers } = req.body;
    const result = await savedInfluencerService.bulkCheckIfSaved(userId, influencers);

    // Convert Map to object for JSON response
    const resultObj: Record<string, { saved: boolean; id?: string; isFavorite?: boolean }> = {};
    result.forEach((value, key) => {
      resultObj[key] = value;
    });

    res.status(200).json({
      success: true,
      data: resultObj,
    });
  } catch (error) {
    next(error);
  }
};

// Get stats
export const getStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const stats = await savedInfluencerService.getStats(userId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== List Endpoints ====================

// Create a list
export const createList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { name, description, color } = req.body;
    const list = await savedInfluencerService.createList({
      userId,
      name,
      description,
      color,
    });

    res.status(201).json({
      success: true,
      data: list,
    });
  } catch (error: any) {
    // Handle duplicate key error
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'A list with this name already exists',
      });
      return;
    }
    next(error);
  }
};

// Get all lists
export const getLists = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const lists = await savedInfluencerService.getLists(userId);

    res.status(200).json({
      success: true,
      data: lists,
    });
  } catch (error) {
    next(error);
  }
};

// Get a single list
export const getList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const list = await savedInfluencerService.getList(userId, id);

    if (!list) {
      res.status(404).json({ success: false, message: 'List not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
};

// Update a list
export const updateList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { name, description, color } = req.body;

    const list = await savedInfluencerService.updateList(userId, id, {
      name,
      description,
      color,
    });

    if (!list) {
      res.status(404).json({ success: false, message: 'List not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: list,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'A list with this name already exists',
      });
      return;
    }
    next(error);
  }
};

// Delete a list
export const deleteList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const deleted = await savedInfluencerService.deleteList(userId, id);

    if (!deleted) {
      res.status(404).json({ success: false, message: 'List not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'List deleted',
    });
  } catch (error) {
    next(error);
  }
};

// Add influencer to list
export const addInfluencerToList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { influencerId } = req.body;

    const added = await savedInfluencerService.addInfluencerToList(userId, id, influencerId);

    if (!added) {
      res.status(404).json({ success: false, message: 'List or influencer not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Influencer added to list',
    });
  } catch (error) {
    next(error);
  }
};

// Remove influencer from list
export const removeInfluencerFromList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id, influencerId } = req.params;
    const removed = await savedInfluencerService.removeInfluencerFromList(userId, id, influencerId);

    if (!removed) {
      res.status(404).json({ success: false, message: 'List or influencer not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Influencer removed from list',
    });
  } catch (error) {
    next(error);
  }
};

// Get influencers in a list
export const getInfluencersInList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { page = '1', limit = '20' } = req.query;

    const result = await savedInfluencerService.getInfluencersInList(
      userId,
      id,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
