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

  // ==================== Duplicate Detection ====================

  /**
   * Find potential duplicates for a new influencer
   */
  async findPotentialDuplicates(
    userId: string,
    profile: {
      username?: string;
      displayName?: string;
      email?: string;
      platform?: string;
    }
  ): Promise<{ influencer: ISavedInfluencer; matchType: string; confidence: number }[]> {
    const duplicates: { influencer: ISavedInfluencer; matchType: string; confidence: number }[] = [];
    const seenIds = new Set<string>();

    // 1. Exact username match (highest confidence)
    if (profile.username) {
      const usernameMatches = await SavedInfluencer.find({
        userId,
        'profile.username': { $regex: `^${this.escapeRegex(profile.username)}$`, $options: 'i' },
      });

      for (const match of usernameMatches) {
        if (!seenIds.has(match._id.toString())) {
          seenIds.add(match._id.toString());
          duplicates.push({
            influencer: match,
            matchType: 'exact_username',
            confidence: 95,
          });
        }
      }
    }

    // 2. Email match in custom fields (high confidence)
    if (profile.email) {
      const emailMatches = await SavedInfluencer.find({
        userId,
        $or: [
          { 'customFields.email': { $regex: `^${this.escapeRegex(profile.email)}$`, $options: 'i' } },
          { 'customFields.contactEmail': { $regex: `^${this.escapeRegex(profile.email)}$`, $options: 'i' } },
        ],
      });

      for (const match of emailMatches) {
        if (!seenIds.has(match._id.toString())) {
          seenIds.add(match._id.toString());
          duplicates.push({
            influencer: match,
            matchType: 'email_match',
            confidence: 90,
          });
        }
      }
    }

    // 3. Similar display name (medium confidence)
    if (profile.displayName) {
      const nameMatches = await SavedInfluencer.find({
        userId,
        'profile.displayName': { $regex: this.escapeRegex(profile.displayName), $options: 'i' },
      });

      for (const match of nameMatches) {
        if (!seenIds.has(match._id.toString())) {
          seenIds.add(match._id.toString());
          const similarity = this.calculateSimilarity(
            profile.displayName.toLowerCase(),
            match.profile.displayName?.toLowerCase() || ''
          );
          if (similarity > 0.7) {
            duplicates.push({
              influencer: match,
              matchType: 'similar_name',
              confidence: Math.round(similarity * 80),
            });
          }
        }
      }
    }

    // 4. Username pattern match across platforms (lower confidence)
    if (profile.username) {
      const baseUsername = profile.username.replace(/^@/, '').toLowerCase();
      const crossPlatformMatches = await SavedInfluencer.find({
        userId,
        platform: { $ne: profile.platform },
        'profile.username': { $regex: this.escapeRegex(baseUsername), $options: 'i' },
      });

      for (const match of crossPlatformMatches) {
        if (!seenIds.has(match._id.toString())) {
          const matchUsername = (match.profile.username || '').replace(/^@/, '').toLowerCase();
          const similarity = this.calculateSimilarity(baseUsername, matchUsername);
          if (similarity > 0.8) {
            seenIds.add(match._id.toString());
            duplicates.push({
              influencer: match,
              matchType: 'cross_platform',
              confidence: Math.round(similarity * 70),
            });
          }
        }
      }
    }

    // Sort by confidence (highest first)
    return duplicates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get all potential duplicates in the user's database
   */
  async findAllDuplicates(userId: string): Promise<{
    groups: {
      key: string;
      influencers: ISavedInfluencer[];
      matchType: string;
    }[];
    totalDuplicates: number;
  }> {
    const influencers = await SavedInfluencer.find({ userId });
    const groups: Map<string, { influencers: ISavedInfluencer[]; matchType: string }> = new Map();

    // Group by normalized username
    const usernameGroups = new Map<string, ISavedInfluencer[]>();
    for (const inf of influencers) {
      const normalizedUsername = (inf.profile.username || '').replace(/^@/, '').toLowerCase();
      if (normalizedUsername) {
        if (!usernameGroups.has(normalizedUsername)) {
          usernameGroups.set(normalizedUsername, []);
        }
        usernameGroups.get(normalizedUsername)!.push(inf);
      }
    }

    // Find username duplicates
    for (const [username, infs] of usernameGroups) {
      if (infs.length > 1) {
        groups.set(`username:${username}`, {
          influencers: infs,
          matchType: 'same_username',
        });
      }
    }

    // Group by email in custom fields
    const emailGroups = new Map<string, ISavedInfluencer[]>();
    for (const inf of influencers) {
      const email = (
        (inf.customFields?.email as string) ||
        (inf.customFields?.contactEmail as string) ||
        ''
      ).toLowerCase();
      if (email) {
        if (!emailGroups.has(email)) {
          emailGroups.set(email, []);
        }
        emailGroups.get(email)!.push(inf);
      }
    }

    // Find email duplicates
    for (const [email, infs] of emailGroups) {
      if (infs.length > 1) {
        const key = `email:${email}`;
        if (!groups.has(key)) {
          groups.set(key, {
            influencers: infs,
            matchType: 'same_email',
          });
        }
      }
    }

    const result = Array.from(groups.entries()).map(([key, value]) => ({
      key,
      ...value,
    }));

    return {
      groups: result,
      totalDuplicates: result.reduce((sum, g) => sum + g.influencers.length - 1, 0),
    };
  }

  /**
   * Merge duplicate influencers
   */
  async mergeDuplicates(
    userId: string,
    primaryId: string,
    duplicateIds: string[]
  ): Promise<ISavedInfluencer | null> {
    const primary = await SavedInfluencer.findOne({
      _id: new Types.ObjectId(primaryId),
      userId,
    });

    if (!primary) return null;

    const duplicates = await SavedInfluencer.find({
      _id: { $in: duplicateIds.map(id => new Types.ObjectId(id)) },
      userId,
    });

    // Merge data from duplicates into primary
    for (const dup of duplicates) {
      // Merge tags
      const allTags = new Set([...primary.tags, ...dup.tags]);
      primary.tags = Array.from(allTags);

      // Merge lists
      const allLists = new Set([
        ...primary.lists.map(l => l.toString()),
        ...dup.lists.map(l => l.toString()),
      ]);
      primary.lists = Array.from(allLists).map(id => new Types.ObjectId(id));

      // Merge notes (append)
      if (dup.notes && dup.notes !== primary.notes) {
        primary.notes = primary.notes
          ? `${primary.notes}\n\n---\nMerged from ${dup.platform}:\n${dup.notes}`
          : dup.notes;
      }

      // Merge custom fields (don't overwrite existing)
      if (dup.customFields) {
        for (const [key, value] of Object.entries(dup.customFields)) {
          if (!primary.customFields[key]) {
            primary.customFields[key] = value;
          }
        }
      }

      // Keep favorite status if any is favorite
      if (dup.isFavorite) {
        primary.isFavorite = true;
      }
    }

    await primary.save();

    // Delete duplicates
    await SavedInfluencer.deleteMany({
      _id: { $in: duplicateIds.map(id => new Types.ObjectId(id)) },
      userId,
    });

    // Update list counts
    const allListIds = primary.lists.map(l => l.toString());
    if (allListIds.length > 0) {
      await this.updateListCounts(allListIds);
    }

    return primary;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }
}

export const savedInfluencerService = new SavedInfluencerService();
