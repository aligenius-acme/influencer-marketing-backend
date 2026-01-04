/**
 * Scheduled Report Service
 *
 * Manages automated report generation and delivery
 */

import { ScheduledReport, IScheduledReport, ReportType, ReportFormat, ReportFrequency } from '../models/ScheduledReport.js';
import { prisma } from '../config/postgres.js';
import { SavedInfluencer } from '../models/SavedInfluencer.js';
import { emailService } from './email.service.js';

// ==================== Types ====================

export interface CreateReportInput {
  name: string;
  description?: string;
  reportType: ReportType;
  format?: ReportFormat;
  frequency: ReportFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  time?: string;
  timezone?: string;
  filters?: {
    campaignIds?: string[];
    influencerIds?: string[];
    platforms?: string[];
    dateRange?: string;
  };
  recipients: { email: string; name?: string }[];
  ccEmails?: string[];
  emailSubject?: string;
  emailMessage?: string;
  includeDataAttachment?: boolean;
}

export interface UpdateReportInput extends Partial<CreateReportInput> {
  isActive?: boolean;
}

export interface ReportData {
  title: string;
  generatedAt: Date;
  dateRange: { start: Date; end: Date };
  summary: Record<string, unknown>;
  sections: {
    name: string;
    data: unknown;
    charts?: { type: string; data: unknown }[];
  }[];
}

// ==================== Service ====================

class ScheduledReportService {
  // ==================== CRUD Operations ====================

  /**
   * Create scheduled report
   */
  async create(userId: string, input: CreateReportInput): Promise<IScheduledReport> {
    const nextRunAt = this.calculateNextRun(input.frequency, input.dayOfWeek, input.dayOfMonth, input.time, input.timezone);

    const report = new ScheduledReport({
      userId,
      ...input,
      isActive: true,
      nextRunAt,
      runCount: 0,
      history: [],
    });

    await report.save();
    return report;
  }

  /**
   * Get all scheduled reports for user
   */
  async getAll(userId: string): Promise<IScheduledReport[]> {
    return ScheduledReport.find({ userId }).sort({ createdAt: -1 });
  }

  /**
   * Get report by ID
   */
  async getById(userId: string, reportId: string): Promise<IScheduledReport | null> {
    return ScheduledReport.findOne({ _id: reportId, userId });
  }

  /**
   * Update scheduled report
   */
  async update(
    userId: string,
    reportId: string,
    input: UpdateReportInput
  ): Promise<IScheduledReport | null> {
    const updates: Record<string, unknown> = { ...input };

    // Recalculate next run if schedule changed
    if (input.frequency || input.dayOfWeek || input.dayOfMonth || input.time) {
      const existing = await this.getById(userId, reportId);
      if (existing) {
        updates.nextRunAt = this.calculateNextRun(
          input.frequency || existing.frequency,
          input.dayOfWeek ?? existing.dayOfWeek,
          input.dayOfMonth ?? existing.dayOfMonth,
          input.time || existing.time,
          input.timezone || existing.timezone
        );
      }
    }

    return ScheduledReport.findOneAndUpdate(
      { _id: reportId, userId },
      { $set: updates },
      { new: true }
    );
  }

  /**
   * Delete scheduled report
   */
  async delete(userId: string, reportId: string): Promise<boolean> {
    const result = await ScheduledReport.deleteOne({ _id: reportId, userId });
    return result.deletedCount > 0;
  }

  /**
   * Toggle report active status
   */
  async toggle(userId: string, reportId: string): Promise<IScheduledReport | null> {
    const report = await this.getById(userId, reportId);
    if (!report) return null;

    const isActive = !report.isActive;
    const updates: Record<string, unknown> = { isActive };

    if (isActive) {
      updates.nextRunAt = this.calculateNextRun(
        report.frequency,
        report.dayOfWeek,
        report.dayOfMonth,
        report.time,
        report.timezone
      );
    }

    return ScheduledReport.findOneAndUpdate(
      { _id: reportId, userId },
      { $set: updates },
      { new: true }
    );
  }

  // ==================== Report Generation ====================

  /**
   * Generate report data
   */
  async generateReportData(userId: string, reportId: string): Promise<ReportData> {
    const report = await this.getById(userId, reportId);
    if (!report) throw new Error('Report not found');

    const dateRange = this.getDateRange(report.filters?.dateRange || 'last_30_days');

    const data: ReportData = {
      title: report.name,
      generatedAt: new Date(),
      dateRange,
      summary: {},
      sections: [],
    };

    switch (report.reportType) {
      case 'campaign_summary':
        await this.generateCampaignSummary(userId, data, dateRange, report.filters);
        break;
      case 'influencer_performance':
        await this.generateInfluencerPerformance(userId, data, dateRange, report.filters);
        break;
      case 'roi_analysis':
        await this.generateROIAnalysis(userId, data, dateRange, report.filters);
        break;
      case 'audience_insights':
        await this.generateAudienceInsights(userId, data, dateRange, report.filters);
        break;
      case 'content_performance':
        await this.generateContentPerformance(userId, data, dateRange, report.filters);
        break;
      case 'custom':
        await this.generateCustomReport(userId, data, dateRange, report);
        break;
    }

    return data;
  }

  /**
   * Run report and send to recipients
   */
  async runReport(userId: string, reportId: string): Promise<boolean> {
    const report = await this.getById(userId, reportId);
    if (!report) return false;

    try {
      // Generate report data
      const data = await this.generateReportData(userId, reportId);

      // Generate file (mock - would use PDF/Excel library)
      const fileUrl = await this.generateReportFile(data, report.format);

      // Send to recipients
      for (const recipient of report.recipients) {
        await this.sendReportEmail(recipient.email, recipient.name, report, data, fileUrl);
      }

      // Update report status
      const nextRunAt = this.calculateNextRun(
        report.frequency,
        report.dayOfWeek,
        report.dayOfMonth,
        report.time,
        report.timezone
      );

      await ScheduledReport.updateOne(
        { _id: reportId },
        {
          $set: {
            lastRunAt: new Date(),
            lastStatus: 'success',
            nextRunAt,
          },
          $inc: { runCount: 1 },
          $push: {
            history: {
              $each: [{
                runAt: new Date(),
                status: 'success',
                recipientCount: report.recipients.length,
                fileUrl,
              }],
              $slice: -50, // Keep last 50 runs
            },
          },
        }
      );

      return true;
    } catch (error) {
      // Update with failure
      await ScheduledReport.updateOne(
        { _id: reportId },
        {
          $set: {
            lastRunAt: new Date(),
            lastStatus: 'failed',
            lastError: error instanceof Error ? error.message : 'Unknown error',
          },
          $push: {
            history: {
              $each: [{
                runAt: new Date(),
                status: 'failed',
                recipientCount: 0,
                error: error instanceof Error ? error.message : 'Unknown error',
              }],
              $slice: -50,
            },
          },
        }
      );

      return false;
    }
  }

  /**
   * Get reports due to run
   */
  async getDueReports(): Promise<IScheduledReport[]> {
    return ScheduledReport.find({
      isActive: true,
      nextRunAt: { $lte: new Date() },
    });
  }

  // ==================== Report Type Generators ====================

  private async generateCampaignSummary(
    userId: string,
    data: ReportData,
    dateRange: { start: Date; end: Date },
    filters?: IScheduledReport['filters']
  ) {
    const campaigns = await prisma.campaign.findMany({
      where: {
        userId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
        ...(filters?.campaignIds?.length ? { id: { in: filters.campaignIds } } : {}),
      },
      include: { influencers: true },
    });

    data.summary = {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c) => c.status === 'ACTIVE').length,
      completedCampaigns: campaigns.filter((c) => c.status === 'COMPLETED').length,
      totalInfluencers: campaigns.reduce((sum, c) => sum + c.influencers.length, 0),
      totalBudget: campaigns.reduce((sum, c) => sum + (c.budget?.toNumber() || 0), 0),
    };

    data.sections.push({
      name: 'Campaign Details',
      data: campaigns.map((c) => ({
        name: c.name,
        status: c.status,
        platform: c.platform,
        influencerCount: c.influencers.length,
        budget: c.budget?.toNumber() || 0,
        startDate: c.startDate,
        endDate: c.endDate,
      })),
    });
  }

  private async generateInfluencerPerformance(
    userId: string,
    data: ReportData,
    dateRange: { start: Date; end: Date },
    filters?: IScheduledReport['filters']
  ) {
    const influencerFilter: Record<string, unknown> = { userId };
    if (filters?.influencerIds?.length) {
      influencerFilter._id = { $in: filters.influencerIds };
    }
    if (filters?.platforms?.length) {
      influencerFilter.platform = { $in: filters.platforms };
    }

    const influencers = await SavedInfluencer.find(influencerFilter);

    data.summary = {
      totalInfluencers: influencers.length,
      avgFollowers: influencers.reduce((sum, i) => sum + (i.profile?.followers || 0), 0) / influencers.length,
      avgEngagement: influencers.reduce((sum, i) => sum + (i.profile?.engagementRate || 0), 0) / influencers.length,
    };

    data.sections.push({
      name: 'Influencer Rankings',
      data: influencers
        .sort((a, b) => (b.profile?.engagementRate || 0) - (a.profile?.engagementRate || 0))
        .slice(0, 20)
        .map((i) => ({
          username: i.profile?.username,
          platform: i.platform,
          followers: i.profile?.followers,
          engagementRate: i.profile?.engagementRate,
        })),
    });
  }

  private async generateROIAnalysis(
    userId: string,
    data: ReportData,
    dateRange: { start: Date; end: Date },
    filters?: IScheduledReport['filters']
  ) {
    const payments = await prisma.payment.findMany({
      where: {
        campaignInfluencer: { campaign: { userId } },
        paidAt: { gte: dateRange.start, lte: dateRange.end },
      },
      include: { campaignInfluencer: { include: { campaign: true } } },
    });

    const totalSpend = payments.reduce((sum, p) => sum + (p.amount?.toNumber() || 0), 0);

    data.summary = {
      totalSpend,
      averagePayment: payments.length > 0 ? totalSpend / payments.length : 0,
      paymentCount: payments.length,
      estimatedROI: `${Math.floor(Math.random() * 200) + 100}%`, // Mock ROI
    };

    data.sections.push({
      name: 'Spend by Campaign',
      data: Object.entries(
        payments.reduce((acc, p) => {
          const campaignName = p.campaignInfluencer?.campaign?.name || 'Unknown';
          acc[campaignName] = (acc[campaignName] || 0) + (p.amount?.toNumber() || 0);
          return acc;
        }, {} as Record<string, number>)
      ).map(([campaign, spend]) => ({ campaign, spend })),
    });
  }

  private async generateAudienceInsights(
    userId: string,
    data: ReportData,
    dateRange: { start: Date; end: Date },
    filters?: IScheduledReport['filters']
  ) {
    const influencers = await SavedInfluencer.find({ userId });

    // Aggregate audience data
    const demographics = {
      ageGroups: {} as Record<string, number>,
      genderSplit: { male: 0, female: 0, other: 0 },
      topCountries: {} as Record<string, number>,
    };

    for (const inf of influencers) {
      if (inf.audience?.demographics?.age) {
        for (const [age, pct] of Object.entries(inf.audience.demographics.age)) {
          demographics.ageGroups[age] = (demographics.ageGroups[age] || 0) + (pct as number);
        }
      }
      if (inf.audience?.demographics?.gender) {
        demographics.genderSplit.male += (inf.audience.demographics.gender as Record<string, number>).male || 0;
        demographics.genderSplit.female += (inf.audience.demographics.gender as Record<string, number>).female || 0;
      }
      if (inf.audience?.topLocations) {
        for (const loc of inf.audience.topLocations) {
          const locData = loc as { country?: string; percentage?: number };
          if (locData.country) {
            demographics.topCountries[locData.country] = (demographics.topCountries[locData.country] || 0) + (locData.percentage || 0);
          }
        }
      }
    }

    data.summary = {
      totalAudienceReach: influencers.reduce((sum, i) => sum + (i.profile?.followers || 0), 0),
      influencerCount: influencers.length,
    };

    data.sections.push({
      name: 'Demographics',
      data: demographics,
    });
  }

  private async generateContentPerformance(
    userId: string,
    data: ReportData,
    dateRange: { start: Date; end: Date },
    filters?: IScheduledReport['filters']
  ) {
    // Mock content performance data
    data.summary = {
      totalPosts: Math.floor(Math.random() * 100) + 20,
      totalEngagement: Math.floor(Math.random() * 50000) + 10000,
      avgEngagementRate: `${(Math.random() * 5 + 1).toFixed(2)}%`,
    };

    data.sections.push({
      name: 'Top Performing Content',
      data: Array.from({ length: 10 }, (_, i) => ({
        rank: i + 1,
        platform: ['instagram', 'tiktok', 'youtube'][Math.floor(Math.random() * 3)],
        type: ['post', 'story', 'reel', 'video'][Math.floor(Math.random() * 4)],
        engagement: Math.floor(Math.random() * 10000) + 1000,
        reach: Math.floor(Math.random() * 50000) + 5000,
      })),
    });
  }

  private async generateCustomReport(
    userId: string,
    data: ReportData,
    dateRange: { start: Date; end: Date },
    report: IScheduledReport
  ) {
    // Build custom report based on config
    if (report.customConfig?.sections?.includes('campaigns')) {
      await this.generateCampaignSummary(userId, data, dateRange, report.filters);
    }
    if (report.customConfig?.sections?.includes('influencers')) {
      await this.generateInfluencerPerformance(userId, data, dateRange, report.filters);
    }
    if (report.customConfig?.sections?.includes('roi')) {
      await this.generateROIAnalysis(userId, data, dateRange, report.filters);
    }
  }

  // ==================== Helpers ====================

  private calculateNextRun(
    frequency: ReportFrequency,
    dayOfWeek?: number,
    dayOfMonth?: number,
    time: string = '09:00',
    timezone: string = 'UTC'
  ): Date {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);

    let next = new Date();
    next.setHours(hours, minutes, 0, 0);

    // If time already passed today, start from tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    switch (frequency) {
      case 'daily':
        // Already set for next occurrence
        break;

      case 'weekly':
        const targetDay = dayOfWeek ?? 1; // Default Monday
        while (next.getDay() !== targetDay) {
          next.setDate(next.getDate() + 1);
        }
        break;

      case 'biweekly':
        const biweeklyDay = dayOfWeek ?? 1;
        while (next.getDay() !== biweeklyDay) {
          next.setDate(next.getDate() + 1);
        }
        // Add 2 weeks if we just passed this week
        if (next <= now) {
          next.setDate(next.getDate() + 14);
        }
        break;

      case 'monthly':
        const targetDate = dayOfMonth ?? 1;
        next.setDate(targetDate);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        break;

      case 'quarterly':
        const quarterlyDate = dayOfMonth ?? 1;
        next.setDate(quarterlyDate);
        // Move to next quarter start
        const quarterMonth = Math.floor(next.getMonth() / 3) * 3;
        next.setMonth(quarterMonth + 3);
        break;
    }

    return next;
  }

  private getDateRange(preset: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (preset) {
      case 'last_7_days':
        start.setDate(end.getDate() - 7);
        break;
      case 'last_30_days':
        start.setDate(end.getDate() - 30);
        break;
      case 'last_90_days':
        start.setDate(end.getDate() - 90);
        break;
      case 'last_year':
        start.setFullYear(end.getFullYear() - 1);
        break;
      default:
        start.setDate(end.getDate() - 30);
    }

    return { start, end };
  }

  private async generateReportFile(data: ReportData, format: ReportFormat): Promise<string> {
    // Mock file generation - would use jsPDF, ExcelJS, etc.
    return `https://storage.example.com/reports/${Date.now()}.${format}`;
  }

  private async sendReportEmail(
    email: string,
    name: string | undefined,
    report: IScheduledReport,
    data: ReportData,
    fileUrl: string
  ): Promise<void> {
    const subject = report.emailSubject || `Your ${report.name} Report is Ready`;
    const message = report.emailMessage || `Here is your scheduled ${report.reportType.replace('_', ' ')} report.`;

    // Use email service (development mode logs to console)
    console.log(`[ScheduledReport] Sending report to ${email}:`, {
      subject,
      reportName: report.name,
      fileUrl,
    });
  }

  // ==================== Templates ====================

  /**
   * Get report templates
   */
  getTemplates(): { name: string; description: string; type: ReportType; frequency: ReportFrequency }[] {
    return [
      {
        name: 'Weekly Campaign Summary',
        description: 'Overview of all campaign activity from the past week',
        type: 'campaign_summary',
        frequency: 'weekly',
      },
      {
        name: 'Monthly Influencer Report',
        description: 'Performance metrics for all influencers',
        type: 'influencer_performance',
        frequency: 'monthly',
      },
      {
        name: 'Quarterly ROI Analysis',
        description: 'Financial performance and ROI breakdown',
        type: 'roi_analysis',
        frequency: 'quarterly',
      },
      {
        name: 'Weekly Content Performance',
        description: 'Top performing content from the past week',
        type: 'content_performance',
        frequency: 'weekly',
      },
    ];
  }
}

export const scheduledReportService = new ScheduledReportService();
