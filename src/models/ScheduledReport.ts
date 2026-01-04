/**
 * Scheduled Report Model (MongoDB)
 *
 * Manages automated report generation and delivery schedules
 */

import mongoose, { Schema, Document } from 'mongoose';

export type ReportType = 'campaign_summary' | 'campaign_performance' | 'influencer_performance' | 'influencer_analytics' | 'roi_summary' | 'roi_analysis' | 'audience_insights' | 'content_performance' | 'social_listening' | 'payment_summary' | 'custom';
export type ReportFormat = 'pdf' | 'csv' | 'excel' | 'json';
export type ReportFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export interface IScheduledReport extends Document {
  userId: string;
  workspaceId?: string;

  // Report Configuration
  name: string;
  description?: string;
  reportType: ReportType;
  format: ReportFormat;

  // Schedule
  frequency: ReportFrequency;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:mm format
  timezone: string;

  // Filters
  filters: {
    campaignIds?: string[];
    influencerIds?: string[];
    platforms?: string[];
    dateRange?: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'last_year' | 'custom';
    customStartDate?: Date;
    customEndDate?: Date;
  };

  // Custom Report Config (for custom type)
  customConfig?: {
    sections: string[];
    metrics: string[];
    groupBy?: string;
    sortBy?: string;
    includeCharts: boolean;
    includeTables: boolean;
  };

  // Delivery
  recipients: {
    email: string;
    name?: string;
  }[];
  ccEmails?: string[];
  emailSubject?: string;
  emailMessage?: string;
  includeDataAttachment: boolean;

  // Webhook Delivery (optional)
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;

  // Status
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  lastStatus?: 'success' | 'failed' | 'partial';
  lastError?: string;
  runCount: number;

  // History
  history: {
    runAt: Date;
    status: 'success' | 'failed';
    recipientCount: number;
    fileUrl?: string;
    error?: string;
  }[];

  createdAt: Date;
  updatedAt: Date;
}

const ScheduledReportSchema = new Schema<IScheduledReport>(
  {
    userId: { type: String, required: true, index: true },
    workspaceId: { type: String, index: true },

    name: { type: String, required: true },
    description: { type: String },
    reportType: {
      type: String,
      enum: ['campaign_summary', 'campaign_performance', 'influencer_performance', 'influencer_analytics', 'roi_summary', 'roi_analysis', 'audience_insights', 'content_performance', 'social_listening', 'payment_summary', 'custom'],
      required: true,
    },
    format: {
      type: String,
      enum: ['pdf', 'csv', 'excel', 'json'],
      default: 'pdf',
    },

    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly'],
      required: true,
    },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    time: { type: String, default: '09:00' },
    timezone: { type: String, default: 'UTC' },

    filters: {
      campaignIds: [{ type: String }],
      influencerIds: [{ type: String }],
      platforms: [{ type: String }],
      dateRange: {
        type: String,
        enum: ['last_7_days', 'last_30_days', 'last_90_days', 'last_year', 'custom'],
        default: 'last_30_days',
      },
      customStartDate: { type: Date },
      customEndDate: { type: Date },
    },

    customConfig: {
      sections: [{ type: String }],
      metrics: [{ type: String }],
      groupBy: { type: String },
      sortBy: { type: String },
      includeCharts: { type: Boolean, default: true },
      includeTables: { type: Boolean, default: true },
    },

    recipients: [
      {
        email: { type: String, required: true },
        name: { type: String },
      },
    ],
    ccEmails: [{ type: String }],
    emailSubject: { type: String },
    emailMessage: { type: String },
    includeDataAttachment: { type: Boolean, default: true },

    webhookUrl: { type: String },
    webhookHeaders: { type: Map, of: String },

    isActive: { type: Boolean, default: true },
    lastRunAt: { type: Date },
    nextRunAt: { type: Date },
    lastStatus: { type: String, enum: ['success', 'failed', 'partial'] },
    lastError: { type: String },
    runCount: { type: Number, default: 0 },

    history: [
      {
        runAt: { type: Date },
        status: { type: String, enum: ['success', 'failed'] },
        recipientCount: { type: Number },
        fileUrl: { type: String },
        error: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

ScheduledReportSchema.index({ userId: 1, isActive: 1 });
ScheduledReportSchema.index({ nextRunAt: 1, isActive: 1 });

export const ScheduledReport = mongoose.model<IScheduledReport>('ScheduledReport', ScheduledReportSchema);
