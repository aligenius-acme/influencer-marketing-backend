import { Conversation, IConversation, IMessage } from '../models/Conversation.js';
import { SavedInfluencer } from '../models/SavedInfluencer.js';
import { BadRequestError, NotFoundError } from '../middlewares/errorHandler.js';
import mongoose from 'mongoose';

interface CreateConversationInput {
  influencerId: string;
  campaignId?: string;
  initialMessage?: string;
}

interface SendMessageInput {
  content: string;
  messageType?: 'text' | 'template' | 'attachment';
  templateId?: string;
  attachments?: Array<{
    type: 'image' | 'document' | 'link';
    url: string;
    name?: string;
  }>;
}

interface ConversationFilters {
  status?: 'active' | 'archived' | 'blocked';
  campaignId?: string;
  platform?: string;
  search?: string;
  hasUnread?: boolean;
  labels?: string[];
}

class MessagingService {
  /**
   * Get or create a conversation with an influencer
   */
  async getOrCreateConversation(
    userId: string,
    input: CreateConversationInput
  ): Promise<IConversation> {
    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      userId,
      influencerId: input.influencerId,
    });

    if (conversation) {
      return conversation;
    }

    // Get influencer details
    const influencer = await SavedInfluencer.findOne({
      _id: input.influencerId,
      userId,
    });

    if (!influencer) {
      throw NotFoundError('Influencer not found in your saved list');
    }

    // Create new conversation
    conversation = new Conversation({
      userId,
      influencerId: input.influencerId,
      influencerDetails: {
        username: influencer.profile.username,
        displayName: influencer.profile.displayName,
        platform: influencer.platform,
        profileImage: influencer.profile.profileImage,
        profileUrl: influencer.profile.profileUrl,
      },
      campaignId: input.campaignId,
      messages: [],
    });

    // Add initial message if provided
    if (input.initialMessage) {
      const message: Partial<IMessage> = {
        _id: new mongoose.Types.ObjectId(),
        senderId: userId,
        senderType: 'brand',
        content: input.initialMessage,
        messageType: 'text',
        read: true,
        createdAt: new Date(),
      };

      conversation.messages.push(message as IMessage);
      conversation.lastMessage = {
        content: input.initialMessage,
        senderType: 'brand',
        createdAt: new Date(),
      };
    }

    await conversation.save();
    return conversation;
  }

  /**
   * Get all conversations for a user
   */
  async getConversations(
    userId: string,
    filters: ConversationFilters = {},
    page = 1,
    limit = 20
  ): Promise<{
    conversations: IConversation[];
    total: number;
    hasMore: boolean;
  }> {
    const query: any = { userId };

    if (filters.status) {
      query.status = filters.status;
    } else {
      // By default, show active conversations
      query.status = { $ne: 'blocked' };
    }

    if (filters.campaignId) {
      query.campaignId = filters.campaignId;
    }

    if (filters.platform) {
      query['influencerDetails.platform'] = filters.platform;
    }

    if (filters.hasUnread) {
      query.unreadCount = { $gt: 0 };
    }

    if (filters.labels?.length) {
      query.labels = { $in: filters.labels };
    }

    if (filters.search) {
      query.$or = [
        { 'influencerDetails.username': { $regex: filters.search, $options: 'i' } },
        { 'influencerDetails.displayName': { $regex: filters.search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      Conversation.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-messages'), // Exclude messages for list view
      Conversation.countDocuments(query),
    ]);

    return {
      conversations,
      total,
      hasMore: skip + conversations.length < total,
    };
  }

  /**
   * Get a single conversation with messages
   */
  async getConversation(
    userId: string,
    conversationId: string
  ): Promise<IConversation> {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });

    if (!conversation) {
      throw NotFoundError('Conversation not found');
    }

    return conversation;
  }

  /**
   * Get messages for a conversation with pagination
   */
  async getMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 50
  ): Promise<{
    messages: IMessage[];
    total: number;
    hasMore: boolean;
  }> {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });

    if (!conversation) {
      throw NotFoundError('Conversation not found');
    }

    const total = conversation.messages.length;
    const start = Math.max(0, total - page * limit);
    const end = total - (page - 1) * limit;

    // Get messages in reverse chronological order (newest first for pagination)
    const messages = conversation.messages.slice(start, end).reverse();

    return {
      messages: messages.reverse(), // Return in chronological order
      total,
      hasMore: start > 0,
    };
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    userId: string,
    conversationId: string,
    input: SendMessageInput
  ): Promise<IMessage> {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });

    if (!conversation) {
      throw NotFoundError('Conversation not found');
    }

    if (conversation.status === 'blocked') {
      throw BadRequestError('Cannot send messages to a blocked conversation');
    }

    const message: Partial<IMessage> = {
      _id: new mongoose.Types.ObjectId(),
      senderId: userId,
      senderType: 'brand',
      content: input.content,
      messageType: input.messageType || 'text',
      templateId: input.templateId,
      attachments: input.attachments,
      read: true, // Brand's own messages are always "read"
      createdAt: new Date(),
    };

    conversation.messages.push(message as IMessage);
    conversation.lastMessage = {
      content: input.content.substring(0, 100),
      senderType: 'brand',
      createdAt: new Date(),
    };

    // Reactivate archived conversations when a new message is sent
    if (conversation.status === 'archived') {
      conversation.status = 'active';
    }

    await conversation.save();

    return message as IMessage;
  }

  /**
   * Simulate receiving a message from an influencer (for demo/testing)
   */
  async simulateInfluencerReply(
    userId: string,
    conversationId: string,
    content: string
  ): Promise<IMessage> {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });

    if (!conversation) {
      throw NotFoundError('Conversation not found');
    }

    const message: Partial<IMessage> = {
      _id: new mongoose.Types.ObjectId(),
      senderId: 'influencer',
      senderType: 'influencer',
      content,
      messageType: 'text',
      read: false,
      createdAt: new Date(),
    };

    conversation.messages.push(message as IMessage);
    conversation.lastMessage = {
      content: content.substring(0, 100),
      senderType: 'influencer',
      createdAt: new Date(),
    };
    conversation.unreadCount += 1;

    await conversation.save();

    return message as IMessage;
  }

  /**
   * Mark messages as read
   */
  async markAsRead(userId: string, conversationId: string): Promise<void> {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });

    if (!conversation) {
      throw NotFoundError('Conversation not found');
    }

    const now = new Date();
    let updated = false;

    conversation.messages.forEach((msg) => {
      if (!msg.read && msg.senderType === 'influencer') {
        msg.read = true;
        msg.readAt = now;
        updated = true;
      }
    });

    if (updated) {
      conversation.unreadCount = 0;
      await conversation.save();
    }
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(userId: string, conversationId: string): Promise<void> {
    const result = await Conversation.updateOne(
      { _id: conversationId, userId },
      { $set: { status: 'archived' } }
    );

    if (result.matchedCount === 0) {
      throw NotFoundError('Conversation not found');
    }
  }

  /**
   * Unarchive a conversation
   */
  async unarchiveConversation(userId: string, conversationId: string): Promise<void> {
    const result = await Conversation.updateOne(
      { _id: conversationId, userId },
      { $set: { status: 'active' } }
    );

    if (result.matchedCount === 0) {
      throw NotFoundError('Conversation not found');
    }
  }

  /**
   * Block a conversation
   */
  async blockConversation(userId: string, conversationId: string): Promise<void> {
    const result = await Conversation.updateOne(
      { _id: conversationId, userId },
      { $set: { status: 'blocked' } }
    );

    if (result.matchedCount === 0) {
      throw NotFoundError('Conversation not found');
    }
  }

  /**
   * Add labels to a conversation
   */
  async updateLabels(
    userId: string,
    conversationId: string,
    labels: string[]
  ): Promise<void> {
    const result = await Conversation.updateOne(
      { _id: conversationId, userId },
      { $set: { labels } }
    );

    if (result.matchedCount === 0) {
      throw NotFoundError('Conversation not found');
    }
  }

  /**
   * Update conversation notes
   */
  async updateNotes(
    userId: string,
    conversationId: string,
    notes: string
  ): Promise<void> {
    const result = await Conversation.updateOne(
      { _id: conversationId, userId },
      { $set: { notes } }
    );

    if (result.matchedCount === 0) {
      throw NotFoundError('Conversation not found');
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const result = await Conversation.deleteOne({
      _id: conversationId,
      userId,
    });

    if (result.deletedCount === 0) {
      throw NotFoundError('Conversation not found');
    }
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await Conversation.aggregate([
      { $match: { userId, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$unreadCount' } } },
    ]);

    return result[0]?.total || 0;
  }

  /**
   * Get messaging stats for a user
   */
  async getStats(userId: string): Promise<{
    totalConversations: number;
    activeConversations: number;
    archivedConversations: number;
    unreadMessages: number;
    messagesSent: number;
  }> {
    const [stats, unreadCount] = await Promise.all([
      Conversation.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            messageCount: { $sum: { $size: '$messages' } },
          },
        },
      ]),
      this.getUnreadCount(userId),
    ]);

    const result = {
      totalConversations: 0,
      activeConversations: 0,
      archivedConversations: 0,
      unreadMessages: unreadCount,
      messagesSent: 0,
    };

    stats.forEach((s) => {
      result.totalConversations += s.count;
      result.messagesSent += s.messageCount;
      if (s._id === 'active') {
        result.activeConversations = s.count;
      } else if (s._id === 'archived') {
        result.archivedConversations = s.count;
      }
    });

    return result;
  }

  /**
   * Search messages across all conversations
   */
  async searchMessages(
    userId: string,
    query: string,
    limit = 20
  ): Promise<Array<{
    conversationId: string;
    influencer: {
      username: string;
      displayName: string;
      platform: string;
    };
    message: IMessage;
  }>> {
    const conversations = await Conversation.find({
      userId,
      'messages.content': { $regex: query, $options: 'i' },
    }).limit(limit);

    const results: Array<{
      conversationId: string;
      influencer: {
        username: string;
        displayName: string;
        platform: string;
      };
      message: IMessage;
    }> = [];

    conversations.forEach((conv) => {
      const matchingMessages = conv.messages.filter((msg) =>
        msg.content.toLowerCase().includes(query.toLowerCase())
      );

      matchingMessages.forEach((msg) => {
        results.push({
          conversationId: conv._id.toString(),
          influencer: {
            username: conv.influencerDetails.username,
            displayName: conv.influencerDetails.displayName,
            platform: conv.influencerDetails.platform,
          },
          message: msg,
        });
      });
    });

    return results.slice(0, limit);
  }
}

export const messagingService = new MessagingService();
