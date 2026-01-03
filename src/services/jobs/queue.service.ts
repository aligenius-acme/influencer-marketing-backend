/**
 * Queue Service - BullMQ Background Job Processing
 *
 * Handles asynchronous tasks like:
 * - Social media metric syncing
 * - AI analysis (fake followers, matching)
 * - Social listening mention scanning
 * - Contract reminders and notifications
 */

import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { config } from '../../config/index.js';
import { prisma } from '../../config/postgres.js';

// ==================== Queue Types ====================

export interface SyncJobData {
  userId: string;
  savedInfluencerId?: string;
  connectionId?: string;
  platform?: string;
}

export interface AnalysisJobData {
  userId: string;
  savedInfluencerId: string;
  analysisType: 'fake_follower' | 'match_score' | 'prediction';
  campaignId?: string;
}

export interface ListeningJobData {
  userId: string;
  ruleId: string;
}

export interface NotificationJobData {
  userId: string;
  type: 'contract_reminder' | 'mention_alert' | 'sync_complete';
  data: Record<string, unknown>;
}

export type QueueName = 'sync' | 'analysis' | 'listening' | 'notification';

// ==================== Queue Service ====================

class QueueService {
  private queues: Map<QueueName, Queue> = new Map();
  private workers: Map<QueueName, Worker> = new Map();
  private connection: ConnectionOptions;
  private isInitialized: boolean = false;

  constructor() {
    // Parse Redis URL for BullMQ connection
    const redisUrl = config.bullmq.redisUrl;

    try {
      const url = new URL(redisUrl);
      this.connection = {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
      };
    } catch {
      // Fallback to localhost
      this.connection = {
        host: 'localhost',
        port: 6379,
      };
    }

    console.log('[QueueService] Initialized with Redis connection');
  }

  // ==================== Initialization ====================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create queues
      this.queues.set('sync', new Queue('sync', { connection: this.connection }));
      this.queues.set('analysis', new Queue('analysis', { connection: this.connection }));
      this.queues.set('listening', new Queue('listening', { connection: this.connection }));
      this.queues.set('notification', new Queue('notification', { connection: this.connection }));

      // Create workers (processing logic in separate files)
      this.createSyncWorker();
      this.createAnalysisWorker();
      this.createListeningWorker();
      this.createNotificationWorker();

      this.isInitialized = true;
      console.log('[QueueService] All queues and workers initialized');
    } catch (error) {
      console.error('[QueueService] Failed to initialize:', error);
      throw error;
    }
  }

  // ==================== Queue Methods ====================

  /**
   * Queue a social media metrics sync job
   */
  async queueSync(data: SyncJobData): Promise<string> {
    const queue = this.queues.get('sync');
    if (!queue) throw new Error('Sync queue not initialized');

    const job = await queue.add('sync-metrics', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    // Track job in database
    await this.createJobRecord(data.userId, 'sync', { jobId: job.id, ...data });

    return job.id!;
  }

  /**
   * Queue bulk sync for all user's influencers
   */
  async queueBulkSync(userId: string): Promise<string> {
    const queue = this.queues.get('sync');
    if (!queue) throw new Error('Sync queue not initialized');

    const job = await queue.add('bulk-sync', { userId }, {
      attempts: 1,
    });

    await this.createJobRecord(userId, 'bulk_sync', { jobId: job.id });

    return job.id!;
  }

  /**
   * Queue fake follower analysis
   */
  async queueFakeFollowerAnalysis(userId: string, savedInfluencerId: string): Promise<string> {
    const queue = this.queues.get('analysis');
    if (!queue) throw new Error('Analysis queue not initialized');

    const data: AnalysisJobData = {
      userId,
      savedInfluencerId,
      analysisType: 'fake_follower',
    };

    const job = await queue.add('fake-follower', data, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 10000 },
    });

    await this.createJobRecord(userId, 'fake_follower_analysis', { jobId: job.id, savedInfluencerId });

    return job.id!;
  }

  /**
   * Queue match score calculation
   */
  async queueMatchScoreCalculation(userId: string, savedInfluencerId: string, campaignId?: string): Promise<string> {
    const queue = this.queues.get('analysis');
    if (!queue) throw new Error('Analysis queue not initialized');

    const data: AnalysisJobData = {
      userId,
      savedInfluencerId,
      analysisType: 'match_score',
      campaignId,
    };

    const job = await queue.add('match-score', data, {
      attempts: 2,
    });

    await this.createJobRecord(userId, 'match_score', { jobId: job.id, savedInfluencerId, campaignId });

    return job.id!;
  }

  /**
   * Queue campaign prediction
   */
  async queueCampaignPrediction(userId: string, campaignId: string): Promise<string> {
    const queue = this.queues.get('analysis');
    if (!queue) throw new Error('Analysis queue not initialized');

    const data: AnalysisJobData = {
      userId,
      savedInfluencerId: '', // Not needed for campaign prediction
      analysisType: 'prediction',
      campaignId,
    };

    const job = await queue.add('campaign-prediction', data, {
      attempts: 2,
    });

    await this.createJobRecord(userId, 'campaign_prediction', { jobId: job.id, campaignId });

    return job.id!;
  }

  /**
   * Queue mention scan for a monitoring rule
   */
  async queueMentionScan(userId: string, ruleId: string): Promise<string> {
    const queue = this.queues.get('listening');
    if (!queue) throw new Error('Listening queue not initialized');

    const data: ListeningJobData = { userId, ruleId };

    const job = await queue.add('mention-scan', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return job.id!;
  }

  /**
   * Queue trend report generation
   */
  async queueTrendReport(userId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<string> {
    const queue = this.queues.get('listening');
    if (!queue) throw new Error('Listening queue not initialized');

    const job = await queue.add('trend-report', { userId, period }, {
      attempts: 2,
    });

    await this.createJobRecord(userId, 'trend_report', { jobId: job.id, period });

    return job.id!;
  }

  /**
   * Queue contract reminder
   */
  async queueContractReminder(userId: string, contractId: string, reminderType: string): Promise<string> {
    const queue = this.queues.get('notification');
    if (!queue) throw new Error('Notification queue not initialized');

    const data: NotificationJobData = {
      userId,
      type: 'contract_reminder',
      data: { contractId, reminderType },
    };

    const job = await queue.add('contract-reminder', data);

    return job.id!;
  }

  /**
   * Queue mention alert
   */
  async queueMentionAlert(userId: string, mentionData: Record<string, unknown>): Promise<string> {
    const queue = this.queues.get('notification');
    if (!queue) throw new Error('Notification queue not initialized');

    const data: NotificationJobData = {
      userId,
      type: 'mention_alert',
      data: mentionData,
    };

    const job = await queue.add('mention-alert', data);

    return job.id!;
  }

  // ==================== Job Status ====================

  /**
   * Get job status
   */
  async getJobStatus(queueName: QueueName, jobId: string): Promise<{
    status: string;
    progress: number;
    result?: unknown;
    error?: string;
  }> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    const job = await queue.getJob(jobId);
    if (!job) {
      return { status: 'not_found', progress: 0 };
    }

    const state = await job.getState();

    return {
      status: state,
      progress: job.progress as number || 0,
      result: job.returnvalue,
      error: job.failedReason,
    };
  }

  // ==================== Worker Creation ====================

  private createSyncWorker(): void {
    const worker = new Worker('sync', async (job: Job) => {
      console.log(`[SyncWorker] Processing job ${job.id}: ${job.name}`);

      try {
        // Update job record to processing
        await this.updateJobStatus(job.data.userId, job.id!, 'PROCESSING');

        // Placeholder: Actual sync logic will be in separate worker file
        // For now, just simulate work
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update job record to completed
        await this.updateJobStatus(job.data.userId, job.id!, 'COMPLETED');

        return { success: true, message: 'Sync completed' };
      } catch (error) {
        await this.updateJobStatus(job.data.userId, job.id!, 'FAILED', String(error));
        throw error;
      }
    }, { connection: this.connection });

    worker.on('completed', (job) => {
      console.log(`[SyncWorker] Job ${job.id} completed`);
    });

    worker.on('failed', (job, error) => {
      console.error(`[SyncWorker] Job ${job?.id} failed:`, error);
    });

    this.workers.set('sync', worker);
  }

  private createAnalysisWorker(): void {
    const worker = new Worker('analysis', async (job: Job<AnalysisJobData>) => {
      console.log(`[AnalysisWorker] Processing job ${job.id}: ${job.name}`);

      try {
        await this.updateJobStatus(job.data.userId, job.id!, 'PROCESSING');

        // Placeholder: Actual analysis logic will be in separate worker file
        await new Promise(resolve => setTimeout(resolve, 2000));

        await this.updateJobStatus(job.data.userId, job.id!, 'COMPLETED');

        return { success: true, analysisType: job.data.analysisType };
      } catch (error) {
        await this.updateJobStatus(job.data.userId, job.id!, 'FAILED', String(error));
        throw error;
      }
    }, { connection: this.connection });

    worker.on('completed', (job) => {
      console.log(`[AnalysisWorker] Job ${job.id} completed`);
    });

    worker.on('failed', (job, error) => {
      console.error(`[AnalysisWorker] Job ${job?.id} failed:`, error);
    });

    this.workers.set('analysis', worker);
  }

  private createListeningWorker(): void {
    const worker = new Worker('listening', async (job: Job) => {
      console.log(`[ListeningWorker] Processing job ${job.id}: ${job.name}`);

      try {
        // Placeholder: Actual listening logic will be in separate worker file
        await new Promise(resolve => setTimeout(resolve, 1500));

        return { success: true, message: 'Listening job completed' };
      } catch (error) {
        console.error(`[ListeningWorker] Job ${job.id} error:`, error);
        throw error;
      }
    }, { connection: this.connection });

    worker.on('completed', (job) => {
      console.log(`[ListeningWorker] Job ${job.id} completed`);
    });

    worker.on('failed', (job, error) => {
      console.error(`[ListeningWorker] Job ${job?.id} failed:`, error);
    });

    this.workers.set('listening', worker);
  }

  private createNotificationWorker(): void {
    const worker = new Worker('notification', async (job: Job<NotificationJobData>) => {
      console.log(`[NotificationWorker] Processing job ${job.id}: ${job.data.type}`);

      try {
        // Placeholder: Actual notification logic will be in separate worker file
        await new Promise(resolve => setTimeout(resolve, 500));

        return { success: true, notificationType: job.data.type };
      } catch (error) {
        console.error(`[NotificationWorker] Job ${job.id} error:`, error);
        throw error;
      }
    }, { connection: this.connection });

    worker.on('completed', (job) => {
      console.log(`[NotificationWorker] Job ${job.id} completed`);
    });

    worker.on('failed', (job, error) => {
      console.error(`[NotificationWorker] Job ${job?.id} failed:`, error);
    });

    this.workers.set('notification', worker);
  }

  // ==================== Database Helpers ====================

  private async createJobRecord(
    userId: string,
    jobType: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.syncJob.create({
        data: {
          userId,
          jobType,
          status: 'PENDING',
          metadata: metadata as object,
        },
      });
    } catch (error) {
      console.error('[QueueService] Failed to create job record:', error);
    }
  }

  private async updateJobStatus(
    userId: string,
    jobId: string,
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED',
    error?: string
  ): Promise<void> {
    try {
      // Find job by metadata
      const job = await prisma.syncJob.findFirst({
        where: {
          userId,
          metadata: {
            path: ['jobId'],
            equals: jobId,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (job) {
        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status,
            ...(status === 'PROCESSING' ? { startedAt: new Date() } : {}),
            ...(status === 'COMPLETED' || status === 'FAILED' ? { completedAt: new Date() } : {}),
            ...(error ? { error } : {}),
          },
        });
      }
    } catch (err) {
      console.error('[QueueService] Failed to update job status:', err);
    }
  }

  // ==================== Cleanup ====================

  async shutdown(): Promise<void> {
    console.log('[QueueService] Shutting down...');

    // Close all workers
    for (const [name, worker] of this.workers) {
      await worker.close();
      console.log(`[QueueService] Worker ${name} closed`);
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      await queue.close();
      console.log(`[QueueService] Queue ${name} closed`);
    }

    this.isInitialized = false;
    console.log('[QueueService] Shutdown complete');
  }
}

// Export singleton instance
export const queueService = new QueueService();
