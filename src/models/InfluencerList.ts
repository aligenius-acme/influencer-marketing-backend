import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IInfluencerList extends Document {
  _id: Types.ObjectId;
  userId: string; // PostgreSQL user UUID
  name: string;
  description: string;
  color: string;
  influencerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const InfluencerListSchema = new Schema<IInfluencerList>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    color: {
      type: String,
      default: '#8B5CF6', // Default purple color
      match: /^#[0-9A-Fa-f]{6}$/,
    },
    influencerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique list name per user
InfluencerListSchema.index({ userId: 1, name: 1 }, { unique: true });

export const InfluencerList = mongoose.model<IInfluencerList>('InfluencerList', InfluencerListSchema);
