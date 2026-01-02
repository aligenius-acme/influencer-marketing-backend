import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITag {
  name: string;
  color: string;
  description?: string;
}

export interface ITagGroup extends Document {
  _id: Types.ObjectId;
  userId: string; // PostgreSQL user UUID
  name: string;
  description?: string;
  color: string;
  tags: ITag[];
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema = new Schema({
  name: { type: String, required: true },
  color: { type: String, required: true, default: '#6366F1' },
  description: { type: String },
}, { _id: true });

const TagGroupSchema = new Schema<ITagGroup>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    color: {
      type: String,
      required: true,
      default: '#6366F1',
    },
    tags: {
      type: [TagSchema],
      default: [],
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique group name per user
TagGroupSchema.index(
  { userId: 1, name: 1 },
  { unique: true }
);

// Default tag groups that can be created for new users
export const DEFAULT_TAG_GROUPS = [
  {
    name: 'Status',
    color: '#10B981',
    tags: [
      { name: 'Active', color: '#10B981' },
      { name: 'Inactive', color: '#6B7280' },
      { name: 'Prospect', color: '#3B82F6' },
      { name: 'VIP', color: '#F59E0B' },
    ],
  },
  {
    name: 'Niche',
    color: '#8B5CF6',
    tags: [
      { name: 'Fashion', color: '#EC4899' },
      { name: 'Beauty', color: '#F43F5E' },
      { name: 'Fitness', color: '#10B981' },
      { name: 'Travel', color: '#0EA5E9' },
      { name: 'Food', color: '#F97316' },
      { name: 'Tech', color: '#6366F1' },
      { name: 'Lifestyle', color: '#8B5CF6' },
    ],
  },
  {
    name: 'Priority',
    color: '#EF4444',
    tags: [
      { name: 'High', color: '#EF4444' },
      { name: 'Medium', color: '#F59E0B' },
      { name: 'Low', color: '#6B7280' },
    ],
  },
];

export const TagGroup = mongoose.model<ITagGroup>('TagGroup', TagGroupSchema);
