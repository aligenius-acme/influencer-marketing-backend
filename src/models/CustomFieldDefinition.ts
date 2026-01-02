import mongoose, { Schema, Document, Types } from 'mongoose';

export type FieldType = 'text' | 'number' | 'email' | 'url' | 'date' | 'select' | 'multi-select' | 'boolean' | 'textarea';

export interface ISelectOption {
  value: string;
  label: string;
  color?: string;
}

export interface ICustomFieldDefinition extends Document {
  _id: Types.ObjectId;
  userId: string; // PostgreSQL user UUID
  fieldName: string; // Internal name (snake_case)
  fieldLabel: string; // Display label
  fieldType: FieldType;
  options: ISelectOption[]; // For select/multi-select types
  defaultValue?: string | number | boolean;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SelectOptionSchema = new Schema({
  value: { type: String, required: true },
  label: { type: String, required: true },
  color: { type: String },
}, { _id: false });

const CustomFieldDefinitionSchema = new Schema<ICustomFieldDefinition>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    fieldName: {
      type: String,
      required: true,
    },
    fieldLabel: {
      type: String,
      required: true,
    },
    fieldType: {
      type: String,
      enum: ['text', 'number', 'email', 'url', 'date', 'select', 'multi-select', 'boolean', 'textarea'],
      required: true,
    },
    options: {
      type: [SelectOptionSchema],
      default: [],
    },
    defaultValue: {
      type: Schema.Types.Mixed,
    },
    required: {
      type: Boolean,
      default: false,
    },
    placeholder: {
      type: String,
    },
    helpText: {
      type: String,
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

// Ensure unique field names per user
CustomFieldDefinitionSchema.index(
  { userId: 1, fieldName: 1 },
  { unique: true }
);

export const CustomFieldDefinition = mongoose.model<ICustomFieldDefinition>(
  'CustomFieldDefinition',
  CustomFieldDefinitionSchema
);
