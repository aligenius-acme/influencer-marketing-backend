import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRatingBreakdown {
  communication: number; // 1-5
  contentQuality: number; // 1-5
  professionalism: number; // 1-5
  timeliness: number; // 1-5
  valueForMoney: number; // 1-5
}

export interface IInfluencerReview extends Document {
  _id: Types.ObjectId;
  userId: string; // PostgreSQL user UUID
  savedInfluencerId: Types.ObjectId; // Reference to SavedInfluencer
  campaignId?: string; // PostgreSQL campaign UUID

  // Overall rating (calculated from breakdown or manual)
  rating: number; // 1-5

  // Detailed ratings
  ratingBreakdown?: IRatingBreakdown;

  // Review content
  title?: string;
  review: string;
  pros?: string[];
  cons?: string[];

  // Recommendation
  wouldWorkAgain: boolean;
  recommendToOthers: boolean;

  // Visibility
  isPublic: boolean; // Whether other brands can see this review

  // Status
  isVerified: boolean; // Verified purchase/campaign

  createdAt: Date;
  updatedAt: Date;
}

const RatingBreakdownSchema = new Schema({
  communication: { type: Number, min: 1, max: 5, required: true },
  contentQuality: { type: Number, min: 1, max: 5, required: true },
  professionalism: { type: Number, min: 1, max: 5, required: true },
  timeliness: { type: Number, min: 1, max: 5, required: true },
  valueForMoney: { type: Number, min: 1, max: 5, required: true },
}, { _id: false });

const InfluencerReviewSchema = new Schema<IInfluencerReview>(
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    ratingBreakdown: {
      type: RatingBreakdownSchema,
    },
    title: {
      type: String,
      maxlength: 200,
    },
    review: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    pros: [{
      type: String,
      maxlength: 200,
    }],
    cons: [{
      type: String,
      maxlength: 200,
    }],
    wouldWorkAgain: {
      type: Boolean,
      required: true,
    },
    recommendToOthers: {
      type: Boolean,
      default: false,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// One review per user per influencer per campaign
InfluencerReviewSchema.index(
  { userId: 1, savedInfluencerId: 1, campaignId: 1 },
  { unique: true, sparse: true }
);

// Indexes for querying
InfluencerReviewSchema.index({ savedInfluencerId: 1, isPublic: 1, rating: -1 });
InfluencerReviewSchema.index({ userId: 1, createdAt: -1 });

export const InfluencerReview = mongoose.model<IInfluencerReview>(
  'InfluencerReview',
  InfluencerReviewSchema
);
