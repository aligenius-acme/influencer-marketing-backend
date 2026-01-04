import { Types } from 'mongoose';
import { SavedInfluencer, ISavedInfluencer, IInfluencerProfile, IAudienceData } from '../models/SavedInfluencer.js';
import { InfluencerList, IInfluencerList } from '../models/InfluencerList.js';

// Types for service inputs
export interface SaveInfluencerInput {
  userId: string;
  scrapcreatorsId: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  profile: IInfluencerProfile;
  audience?: IAudienceData;
  notes?: string;
  tags?: string[];
  isFavorite?: boolean;
  listIds?: string[];
  customFields?: Record<string, string | number | boolean>;
}

export interface UpdateInfluencerInput {
  notes?: string;
  tags?: string[];
  customFields?: Record<string, string | number | boolean>;
  isFavorite?: boolean;
}

export interface SearchFilters {
  platform?: string;
  query?: string;
  tags?: string[];
  isFavorite?: boolean;
  listId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'followers' | 'engagement' | 'displayName';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateListInput {
  userId: string;
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateListInput {
  name?: string;
  description?: string;
  color?: string;
}

class SavedInfluencerService {
  // ==================== Saved Influencer Methods ====================

  async saveInfluencer(input: SaveInfluencerInput): Promise<ISavedInfluencer> {
    const { userId, scrapcreatorsId, platform, profile, audience, notes, tags, isFavorite, listIds, customFields } = input;

    // Check if already saved
    const existing = await SavedInfluencer.findOne({
      userId,
      scrapcreatorsId,
      platform,
    });

    if (existing) {
      // Update existing record
      existing.profile = profile;
      if (audience) existing.audience = audience;
      if (notes !== undefined) existing.notes = notes;
      if (tags) existing.tags = tags;
      if (isFavorite !== undefined) existing.isFavorite = isFavorite;
      if (listIds) {
        existing.lists = listIds.map(id => new Types.ObjectId(id));
      }
      existing.lastSynced = new Date();

      await existing.save();
      return existing;
    }

    // Create new saved influencer
    const savedInfluencer = new SavedInfluencer({
      userId,
      scrapcreatorsId,
      platform,
      profile,
      audience,
      notes: notes || '',
      tags: tags || [],
      customFields: customFields || {},
      isFavorite: isFavorite ?? true,
      lists: listIds?.map(id => new Types.ObjectId(id)) || [],
      lastSynced: new Date(),
    });

    await savedInfluencer.save();

    // Update list counts
    if (listIds && listIds.length > 0) {
      await this.updateListCounts(listIds);
    }

    return savedInfluencer;
  }

  async getSavedInfluencer(userId: string, id: string): Promise<ISavedInfluencer | null> {
    return SavedInfluencer.findOne({
      _id: new Types.ObjectId(id),
      userId,
    }).populate('lists');
  }

  async getSavedInfluencerByPlatformId(
    userId: string,
    platform: string,
    scrapcreatorsId: string
  ): Promise<ISavedInfluencer | null> {
    return SavedInfluencer.findOne({
      userId,
      platform,
      scrapcreatorsId,
    }).populate('lists');
  }

  async updateSavedInfluencer(
    userId: string,
    id: string,
    input: UpdateInfluencerInput
  ): Promise<ISavedInfluencer | null> {
    const updateData: Record<string, unknown> = {};

    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.isFavorite !== undefined) updateData.isFavorite = input.isFavorite;
    if (input.customFields !== undefined) {
      // Merge custom fields
      updateData['$set'] = Object.entries(input.customFields).reduce((acc, [key, value]) => {
        acc[`customFields.${key}`] = value;
        return acc;
      }, {} as Record<string, unknown>);
    }

    return SavedInfluencer.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId },
      updateData,
      { new: true }
    ).populate('lists');
  }

  async removeSavedInfluencer(userId: string, id: string): Promise<boolean> {
    const influencer = await SavedInfluencer.findOne({
      _id: new Types.ObjectId(id),
      userId,
    });

    if (!influencer) return false;

    // Get list IDs before deletion
    const listIds = influencer.lists.map(l => l.toString());

    await influencer.deleteOne();

    // Update list counts
    if (listIds.length > 0) {
      await this.updateListCounts(listIds);
    }

    return true;
  }

  async searchSavedInfluencers(userId: string, filters: SearchFilters) {
    const {
      platform,
      query,
      tags,
      isFavorite,
      listId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const matchQuery: Record<string, unknown> = { userId };

    if (platform) matchQuery.platform = platform;
    if (isFavorite !== undefined) matchQuery.isFavorite = isFavorite;
    if (listId) matchQuery.lists = new Types.ObjectId(listId);
    if (tags && tags.length > 0) matchQuery.tags = { $in: tags };

    if (query) {
      matchQuery.$or = [
        { 'profile.username': { $regex: query, $options: 'i' } },
        { 'profile.displayName': { $regex: query, $options: 'i' } },
        { 'profile.bio': { $regex: query, $options: 'i' } },
        { notes: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } },
      ];
    }

    // Build sort object
    const sortField = sortBy === 'followers'
      ? 'profile.followers'
      : sortBy === 'engagement'
        ? 'profile.engagementRate'
        : sortBy === 'displayName'
          ? 'profile.displayName'
          : 'createdAt';

    const sortObj: Record<string, 1 | -1> = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

    const skip = (page - 1) * limit;

    const [influencers, total] = await Promise.all([
      SavedInfluencer.find(matchQuery)
        .populate('lists')
        .sort(sortObj)
        .skip(skip)
        .limit(limit),
      SavedInfluencer.countDocuments(matchQuery),
    ]);

    return {
      influencers,
      total,
      page,
      limit,
      hasMore: skip + influencers.length < total,
    };
  }

  async getFavorites(userId: string, page = 1, limit = 20) {
    return this.searchSavedInfluencers(userId, { isFavorite: true, page, limit });
  }

  async toggleFavorite(userId: string, id: string): Promise<ISavedInfluencer | null> {
    const influencer = await SavedInfluencer.findOne({
      _id: new Types.ObjectId(id),
      userId,
    });

    if (!influencer) return null;

    influencer.isFavorite = !influencer.isFavorite;
    await influencer.save();

    return influencer;
  }

  // ==================== List Methods ====================

  async createList(input: CreateListInput): Promise<IInfluencerList> {
    const list = new InfluencerList({
      userId: input.userId,
      name: input.name,
      description: input.description || '',
      color: input.color || '#8B5CF6',
      influencerCount: 0,
    });

    await list.save();
    return list;
  }

  async getList(userId: string, listId: string): Promise<IInfluencerList | null> {
    return InfluencerList.findOne({
      _id: new Types.ObjectId(listId),
      userId,
    });
  }

  async getLists(userId: string): Promise<IInfluencerList[]> {
    return InfluencerList.find({ userId }).sort({ createdAt: -1 });
  }

  async updateList(userId: string, listId: string, input: UpdateListInput): Promise<IInfluencerList | null> {
    return InfluencerList.findOneAndUpdate(
      { _id: new Types.ObjectId(listId), userId },
      { $set: input },
      { new: true }
    );
  }

  async deleteList(userId: string, listId: string): Promise<boolean> {
    const list = await InfluencerList.findOne({
      _id: new Types.ObjectId(listId),
      userId,
    });

    if (!list) return false;

    // Remove this list from all influencers
    await SavedInfluencer.updateMany(
      { userId, lists: list._id },
      { $pull: { lists: list._id } }
    );

    await list.deleteOne();
    return true;
  }

  async addInfluencerToList(userId: string, listId: string, influencerId: string): Promise<boolean> {
    const [list, influencer] = await Promise.all([
      InfluencerList.findOne({ _id: new Types.ObjectId(listId), userId }),
      SavedInfluencer.findOne({ _id: new Types.ObjectId(influencerId), userId }),
    ]);

    if (!list || !influencer) return false;

    // Check if already in list
    if (influencer.lists.some(l => l.toString() === listId)) {
      return true; // Already in list
    }

    influencer.lists.push(list._id);
    await influencer.save();

    await this.updateListCount(listId);
    return true;
  }

  async removeInfluencerFromList(userId: string, listId: string, influencerId: string): Promise<boolean> {
    const result = await SavedInfluencer.updateOne(
      { _id: new Types.ObjectId(influencerId), userId },
      { $pull: { lists: new Types.ObjectId(listId) } }
    );

    if (result.modifiedCount > 0) {
      await this.updateListCount(listId);
      return true;
    }

    return false;
  }

  async getInfluencersInList(userId: string, listId: string, page = 1, limit = 20) {
    return this.searchSavedInfluencers(userId, { listId, page, limit });
  }

  // ==================== Helper Methods ====================

  private async updateListCount(listId: string): Promise<void> {
    const count = await SavedInfluencer.countDocuments({
      lists: new Types.ObjectId(listId),
    });

    await InfluencerList.updateOne(
      { _id: new Types.ObjectId(listId) },
      { influencerCount: count }
    );
  }

  private async updateListCounts(listIds: string[]): Promise<void> {
    await Promise.all(listIds.map(id => this.updateListCount(id)));
  }

  async getStats(userId: string) {
    const [
      totalSaved,
      totalFavorites,
      totalLists,
      platformCounts,
    ] = await Promise.all([
      SavedInfluencer.countDocuments({ userId }),
      SavedInfluencer.countDocuments({ userId, isFavorite: true }),
      InfluencerList.countDocuments({ userId }),
      SavedInfluencer.aggregate([
        { $match: { userId } },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      totalSaved,
      totalFavorites,
      totalLists,
      byPlatform: platformCounts.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async checkIfSaved(userId: string, platform: string, scrapcreatorsId: string): Promise<{ saved: boolean; id?: string; isFavorite?: boolean }> {
    const influencer = await SavedInfluencer.findOne({
      userId,
      platform,
      scrapcreatorsId,
    });

    if (influencer) {
      return {
        saved: true,
        id: influencer._id.toString(),
        isFavorite: influencer.isFavorite,
      };
    }

    return { saved: false };
  }

  async bulkCheckIfSaved(
    userId: string,
    influencers: { platform: string; scrapcreatorsId: string }[]
  ): Promise<Map<string, { saved: boolean; id?: string; isFavorite?: boolean }>> {
    const saved = await SavedInfluencer.find({
      userId,
      $or: influencers.map(inf => ({
        platform: inf.platform,
        scrapcreatorsId: inf.scrapcreatorsId,
      })),
    });

    const result = new Map<string, { saved: boolean; id?: string; isFavorite?: boolean }>();

    // Initialize all as not saved
    influencers.forEach(inf => {
      result.set(`${inf.platform}:${inf.scrapcreatorsId}`, { saved: false });
    });

    // Mark saved ones
    saved.forEach(inf => {
      result.set(`${inf.platform}:${inf.scrapcreatorsId}`, {
        saved: true,
        id: inf._id.toString(),
        isFavorite: inf.isFavorite,
      });
    });

    return result;
  }
}

export const savedInfluencerService = new SavedInfluencerService();
