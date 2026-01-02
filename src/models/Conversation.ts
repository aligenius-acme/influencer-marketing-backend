import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  _id: mongoose.Types.ObjectId;
  senderId: string; // Either the userId (brand) or 'influencer'
  senderType: 'brand' | 'influencer';
  content: string;
  messageType: 'text' | 'template' | 'attachment';
  templateId?: string;
  attachments?: Array<{
    type: 'image' | 'document' | 'link';
    url: string;
    name?: string;
  }>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface IConversation extends Document {
  userId: string; // Brand user ID
  influencerId: string; // SavedInfluencer ID
  influencerDetails: {
    username: string;
    displayName: string;
    platform: string;
    profileImage?: string;
    profileUrl?: string;
  };
  campaignId?: string; // Optional campaign association
  status: 'active' | 'archived' | 'blocked';
  lastMessage?: {
    content: string;
    senderType: 'brand' | 'influencer';
    createdAt: Date;
  };
  unreadCount: number;
  messages: IMessage[];
  labels: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  senderId: { type: String, required: true },
  senderType: {
    type: String,
    enum: ['brand', 'influencer'],
    required: true
  },
  content: { type: String, required: true },
  messageType: {
    type: String,
    enum: ['text', 'template', 'attachment'],
    default: 'text'
  },
  templateId: { type: String },
  attachments: [{
    type: { type: String, enum: ['image', 'document', 'link'] },
    url: { type: String },
    name: { type: String },
  }],
  read: { type: Boolean, default: false },
  readAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

const ConversationSchema = new Schema<IConversation>(
  {
    userId: { type: String, required: true, index: true },
    influencerId: { type: String, required: true, index: true },
    influencerDetails: {
      username: { type: String, required: true },
      displayName: { type: String, required: true },
      platform: { type: String, required: true },
      profileImage: { type: String },
      profileUrl: { type: String },
    },
    campaignId: { type: String, index: true },
    status: {
      type: String,
      enum: ['active', 'archived', 'blocked'],
      default: 'active'
    },
    lastMessage: {
      content: { type: String },
      senderType: { type: String, enum: ['brand', 'influencer'] },
      createdAt: { type: Date },
    },
    unreadCount: { type: Number, default: 0 },
    messages: [MessageSchema],
    labels: [{ type: String }],
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

// Compound index for finding conversations
ConversationSchema.index({ userId: 1, influencerId: 1 }, { unique: true });
ConversationSchema.index({ userId: 1, status: 1, updatedAt: -1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
