import mongoose, { Document, Schema } from 'mongoose';

export interface IContentFile {
  _id: mongoose.Types.ObjectId;
  type: 'image' | 'video' | 'document' | 'link';
  url: string;
  filename: string;
  mimeType?: string;
  size?: number;
  thumbnailUrl?: string;
  uploadedAt: Date;
}

export interface IFeedback {
  _id: mongoose.Types.ObjectId;
  authorId: string;
  authorType: 'brand' | 'influencer';
  content: string;
  attachments?: Array<{
    type: 'image' | 'document';
    url: string;
    filename: string;
  }>;
  createdAt: Date;
}

export interface IContentSubmission extends Document {
  userId: string; // Brand user ID
  campaignId: string; // Campaign this content is for
  influencerId: string; // SavedInfluencer ID
  influencerDetails: {
    username: string;
    displayName: string;
    platform: string;
    profileImage?: string;
  };
  title: string;
  description?: string;
  contentType: 'post' | 'story' | 'reel' | 'video' | 'blog' | 'other';
  status: 'draft' | 'submitted' | 'in_review' | 'revision_requested' | 'approved' | 'rejected' | 'published';
  files: IContentFile[];
  externalLinks?: Array<{
    platform: string;
    url: string;
    label?: string;
  }>;
  feedback: IFeedback[];
  dueDate?: Date;
  submittedAt?: Date;
  reviewedAt?: Date;
  approvedAt?: Date;
  publishedAt?: Date;
  publishedUrl?: string;
  revisionNumber: number;
  metadata?: {
    hashtags?: string[];
    mentions?: string[];
    caption?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ContentFileSchema = new Schema<IContentFile>({
  type: {
    type: String,
    enum: ['image', 'video', 'document', 'link'],
    required: true,
  },
  url: { type: String, required: true },
  filename: { type: String, required: true },
  mimeType: { type: String },
  size: { type: Number },
  thumbnailUrl: { type: String },
  uploadedAt: { type: Date, default: Date.now },
});

const FeedbackSchema = new Schema<IFeedback>({
  authorId: { type: String, required: true },
  authorType: {
    type: String,
    enum: ['brand', 'influencer'],
    required: true,
  },
  content: { type: String, required: true },
  attachments: [{
    type: { type: String, enum: ['image', 'document'] },
    url: { type: String },
    filename: { type: String },
  }],
  createdAt: { type: Date, default: Date.now },
});

const ContentSubmissionSchema = new Schema<IContentSubmission>(
  {
    userId: { type: String, required: true, index: true },
    campaignId: { type: String, required: true, index: true },
    influencerId: { type: String, required: true, index: true },
    influencerDetails: {
      username: { type: String, required: true },
      displayName: { type: String, required: true },
      platform: { type: String, required: true },
      profileImage: { type: String },
    },
    title: { type: String, required: true },
    description: { type: String },
    contentType: {
      type: String,
      enum: ['post', 'story', 'reel', 'video', 'blog', 'other'],
      default: 'post',
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'in_review', 'revision_requested', 'approved', 'rejected', 'published'],
      default: 'draft',
    },
    files: [ContentFileSchema],
    externalLinks: [{
      platform: { type: String },
      url: { type: String },
      label: { type: String },
    }],
    feedback: [FeedbackSchema],
    dueDate: { type: Date },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    approvedAt: { type: Date },
    publishedAt: { type: Date },
    publishedUrl: { type: String },
    revisionNumber: { type: Number, default: 1 },
    metadata: {
      hashtags: [{ type: String }],
      mentions: [{ type: String }],
      caption: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
ContentSubmissionSchema.index({ userId: 1, campaignId: 1 });
ContentSubmissionSchema.index({ userId: 1, status: 1 });
ContentSubmissionSchema.index({ userId: 1, influencerId: 1 });
ContentSubmissionSchema.index({ campaignId: 1, status: 1 });

export const ContentSubmission = mongoose.model<IContentSubmission>('ContentSubmission', ContentSubmissionSchema);
