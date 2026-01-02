import mongoose, { Schema, Document, Types } from 'mongoose';

export type CommunicationType = 'email' | 'dm' | 'call' | 'meeting' | 'note' | 'other';
export type CommunicationDirection = 'inbound' | 'outbound';
export type CommunicationStatus = 'draft' | 'scheduled' | 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced' | 'failed';

export interface IAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface ICommunicationLog extends Document {
  _id: Types.ObjectId;
  userId: string; // PostgreSQL user UUID
  savedInfluencerId: Types.ObjectId; // Reference to SavedInfluencer
  campaignId?: string; // Optional PostgreSQL campaign UUID

  // Communication details
  type: CommunicationType;
  direction: CommunicationDirection;
  subject?: string;
  content: string;

  // Status tracking
  status: CommunicationStatus;

  // Scheduling
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  repliedAt?: Date;

  // Email-specific fields
  emailFrom?: string;
  emailTo?: string;
  emailCc?: string[];
  emailBcc?: string[];
  threadId?: string; // For email threading

  // Attachments
  attachments: IAttachment[];

  // Metadata
  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: Number, required: true },
}, { _id: false });

const CommunicationLogSchema = new Schema<ICommunicationLog>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    savedInfluencerId: {
      type: Schema.Types.ObjectId,
      ref: 'SavedInfluencer',
      required: true,
      index: true,
    },
    campaignId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: ['email', 'dm', 'call', 'meeting', 'note', 'other'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
    },
    subject: {
      type: String,
    },
    content: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sent', 'delivered', 'opened', 'replied', 'bounced', 'failed'],
      default: 'sent',
    },
    scheduledAt: {
      type: Date,
    },
    sentAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    openedAt: {
      type: Date,
    },
    repliedAt: {
      type: Date,
    },
    emailFrom: {
      type: String,
    },
    emailTo: {
      type: String,
    },
    emailCc: [{
      type: String,
    }],
    emailBcc: [{
      type: String,
    }],
    threadId: {
      type: String,
    },
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
CommunicationLogSchema.index({ userId: 1, savedInfluencerId: 1, createdAt: -1 });
CommunicationLogSchema.index({ userId: 1, campaignId: 1, createdAt: -1 });
CommunicationLogSchema.index({ userId: 1, type: 1, createdAt: -1 });
CommunicationLogSchema.index({ threadId: 1 });

// Text search index
CommunicationLogSchema.index({
  subject: 'text',
  content: 'text',
});

export const CommunicationLog = mongoose.model<ICommunicationLog>(
  'CommunicationLog',
  CommunicationLogSchema
);
