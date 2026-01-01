import mongoose, { Schema, Document, Types } from 'mongoose';

// Interface for influencer profile data (cached from ScrapCreators)
export interface IInfluencerProfile {
  username: string;
  displayName: string;
  bio: string;
  profileImage: string;
  profileUrl: string;
  followers: number;
  following: number;
  postsCount: number;
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
  verified: boolean;
  location?: string;
  language?: string;
  niches: string[];
}

// Interface for audience data
export interface IAudienceData {
  demographics?: {
    age?: Record<string, number>;
    gender?: { male: number; female: number; other: number };
  };
  topLocations?: { country: string; city?: string; percentage: number }[];
  topInterests?: { interest: string; percentage: number }[];
  authenticityScore?: number;
  reachability?: number;
}

// Interface for custom fields
export interface ICustomFields {
  contactEmail?: string;
  ratePerPost?: number;
  preferredContact?: string;
  [key: string]: string | number | boolean | undefined;
}

// Main SavedInfluencer interface
export interface ISavedInfluencer extends Document {
  _id: Types.ObjectId;
  userId: string; // PostgreSQL user UUID

  // ScrapCreators reference
  scrapcreatorsId: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';

  // Cached profile data
  profile: IInfluencerProfile;

  // Cached audience data
  audience?: IAudienceData;

  // User's custom data
  notes: string;
  tags: string[];
  customFields: ICustomFields;

  // Status
  isFavorite: boolean;
  lists: Types.ObjectId[];

  // Timestamps
  lastSynced: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SavedInfluencerSchema = new Schema<ISavedInfluencer>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    scrapcreatorsId: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      enum: ['instagram', 'tiktok', 'youtube', 'twitter'],
      required: true,
    },
    profile: {
      username: { type: String, required: true },
      displayName: { type: String, required: true },
      bio: { type: String, default: '' },
      profileImage: { type: String, default: '' },
      profileUrl: { type: String, default: '' },
      followers: { type: Number, default: 0 },
      following: { type: Number, default: 0 },
      postsCount: { type: Number, default: 0 },
      engagementRate: { type: Number, default: 0 },
      avgLikes: { type: Number, default: 0 },
      avgComments: { type: Number, default: 0 },
      verified: { type: Boolean, default: false },
      location: { type: String },
      language: { type: String },
      niches: [{ type: String }],
    },
    audience: {
      demographics: {
        age: { type: Map, of: Number },
        gender: {
          male: { type: Number },
          female: { type: Number },
          other: { type: Number },
        },
      },
      topLocations: [{
        country: { type: String },
        city: { type: String },
        percentage: { type: Number },
      }],
      topInterests: [{
        interest: { type: String },
        percentage: { type: Number },
      }],
      authenticityScore: { type: Number },
      reachability: { type: Number },
    },
    notes: {
      type: String,
      default: '',
    },
    tags: [{
      type: String,
    }],
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    isFavorite: {
      type: Boolean,
      default: true,
    },
    lists: [{
      type: Schema.Types.ObjectId,
      ref: 'InfluencerList',
    }],
    lastSynced: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique influencer per user per platform
SavedInfluencerSchema.index(
  { userId: 1, scrapcreatorsId: 1, platform: 1 },
  { unique: true }
);

// Text index for search
SavedInfluencerSchema.index({
  'profile.username': 'text',
  'profile.displayName': 'text',
  'profile.bio': 'text',
  notes: 'text',
  tags: 'text',
});

export const SavedInfluencer = mongoose.model<ISavedInfluencer>('SavedInfluencer', SavedInfluencerSchema);
