/**
 * Custom Dashboard Model (MongoDB)
 *
 * Stores user-created custom dashboards with configurable widgets
 */

import mongoose, { Schema, Document } from 'mongoose';

export type WidgetType =
  | 'stat_card'
  | 'metric_card'
  | 'line_chart'
  | 'bar_chart'
  | 'pie_chart'
  | 'donut_chart'
  | 'area_chart'
  | 'table'
  | 'list'
  | 'heatmap'
  | 'gauge'
  | 'funnel'
  | 'comparison'
  | 'leaderboard'
  | 'calendar_heatmap'
  | 'text';

export type MetricType =
  | 'campaigns_count'
  | 'active_campaigns'
  | 'total_influencers'
  | 'total_reach'
  | 'total_engagement'
  | 'average_engagement_rate'
  | 'total_spend'
  | 'total_revenue'
  | 'roi'
  | 'cost_per_engagement'
  | 'cost_per_reach'
  | 'conversion_rate'
  | 'contracts_signed'
  | 'content_approved'
  | 'mentions_count'
  | 'sentiment_score'
  | 'custom';

export interface IDashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;

  // Grid position
  x: number;
  y: number;
  width: number;
  height: number;

  // Data configuration
  metric?: MetricType;
  metrics?: MetricType[]; // For multi-metric widgets
  customQuery?: string; // For custom metrics

  // Filters
  filters?: {
    campaignIds?: string[];
    influencerIds?: string[];
    platforms?: string[];
    dateRange?: string;
  };

  // Visualization options
  options?: {
    color?: string;
    colors?: string[];
    showLegend?: boolean;
    showGrid?: boolean;
    showLabels?: boolean;
    stacked?: boolean;
    comparison?: 'previous_period' | 'previous_year' | 'none';
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
    groupBy?: 'day' | 'week' | 'month' | 'platform' | 'campaign';
    limit?: number;
    sortOrder?: 'asc' | 'desc';
    format?: 'number' | 'currency' | 'percentage';
    prefix?: string;
    suffix?: string;
  };

  // For text widgets
  content?: string;

  // Refresh settings
  refreshInterval?: number; // in seconds, 0 = manual only
  lastRefreshedAt?: Date;
}

export interface ICustomDashboard extends Document {
  userId: string;
  workspaceId?: string;

  name: string;
  description?: string;
  icon?: string;

  // Layout
  widgets: IDashboardWidget[];
  gridColumns: number;
  rowHeight: number;

  // Sharing
  isPublic: boolean;
  sharedWith: {
    userId: string;
    permission: 'view' | 'edit';
  }[];
  publicToken?: string;

  // Default filters (apply to all widgets)
  defaultFilters?: {
    dateRange?: string;
    campaignIds?: string[];
    platforms?: string[];
  };

  // Auto-refresh
  autoRefresh: boolean;
  refreshInterval: number; // in seconds

  // Status
  isDefault: boolean;
  isFavorite: boolean;
  lastViewedAt?: Date;
  viewCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const DashboardWidgetSchema = new Schema<IDashboardWidget>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'stat_card', 'metric_card', 'line_chart', 'bar_chart', 'pie_chart', 'donut_chart',
        'area_chart', 'table', 'list', 'heatmap', 'gauge', 'funnel',
        'comparison', 'leaderboard', 'calendar_heatmap', 'text'
      ],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String },

    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },

    metric: { type: String },
    metrics: [{ type: String }],
    customQuery: { type: String },

    filters: {
      campaignIds: [{ type: String }],
      influencerIds: [{ type: String }],
      platforms: [{ type: String }],
      dateRange: { type: String },
    },

    options: {
      color: { type: String },
      colors: [{ type: String }],
      showLegend: { type: Boolean },
      showGrid: { type: Boolean },
      showLabels: { type: Boolean },
      stacked: { type: Boolean },
      comparison: { type: String, enum: ['previous_period', 'previous_year', 'none'] },
      aggregation: { type: String, enum: ['sum', 'avg', 'count', 'min', 'max'] },
      groupBy: { type: String, enum: ['day', 'week', 'month', 'platform', 'campaign'] },
      limit: { type: Number },
      sortOrder: { type: String, enum: ['asc', 'desc'] },
      format: { type: String, enum: ['number', 'currency', 'percentage'] },
      prefix: { type: String },
      suffix: { type: String },
    },

    content: { type: String },
    refreshInterval: { type: Number, default: 0 },
    lastRefreshedAt: { type: Date },
  },
  { _id: false }
);

const CustomDashboardSchema = new Schema<ICustomDashboard>(
  {
    userId: { type: String, required: true, index: true },
    workspaceId: { type: String, index: true },

    name: { type: String, required: true },
    description: { type: String },
    icon: { type: String },

    widgets: [DashboardWidgetSchema],
    gridColumns: { type: Number, default: 12 },
    rowHeight: { type: Number, default: 100 },

    isPublic: { type: Boolean, default: false },
    sharedWith: [
      {
        userId: { type: String },
        permission: { type: String, enum: ['view', 'edit'] },
      },
    ],
    publicToken: { type: String },

    defaultFilters: {
      dateRange: { type: String },
      campaignIds: [{ type: String }],
      platforms: [{ type: String }],
    },

    autoRefresh: { type: Boolean, default: false },
    refreshInterval: { type: Number, default: 300 }, // 5 minutes

    isDefault: { type: Boolean, default: false },
    isFavorite: { type: Boolean, default: false },
    lastViewedAt: { type: Date },
    viewCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

CustomDashboardSchema.index({ userId: 1, isDefault: 1 });
CustomDashboardSchema.index({ publicToken: 1 });

export const CustomDashboard = mongoose.model<ICustomDashboard>('CustomDashboard', CustomDashboardSchema);
