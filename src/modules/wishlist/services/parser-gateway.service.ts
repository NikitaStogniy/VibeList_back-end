import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { PARSER_QUEUE, ParserJobData, ParserJobResult } from '../../../config/queue.config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { normalizeCurrency } from '../../../common/utils/currency-converter.util';

export interface ParseStatusResponse {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress?: number;
  result?: ParserJobResult;
  error?: string;
}

@Injectable()
export class ParserGatewayService {
  private readonly logger = new Logger(ParserGatewayService.name);

  constructor(
    @InjectQueue(PARSER_QUEUE) private parserQueue: Queue,
    private eventEmitter: EventEmitter2,
  ) {
    this.setupJobEventHandlers();
  }

  /**
   * Start parsing a URL asynchronously
   * Returns job ID for status checking
   */
  async parseUrl(url: string, userId: string): Promise<string> {
    this.logger.log(`Initiating parsing for URL: ${url}, User: ${userId}`);

    const jobData: ParserJobData = {
      url,
      userId,
    };

    const job = await this.parserQueue.add('parse', jobData, {
      attempts: 1,
      timeout: 30000, // 30 seconds max
      priority: 1,
    });

    this.logger.log(`Created parser job ${job.id}`);
    return job.id.toString();
  }

  /**
   * Get current status of a parsing job
   */
  async getParseStatus(jobId: string): Promise<ParseStatusResponse> {
    const job = await this.parserQueue.getJob(jobId);

    if (!job) {
      throw new Error('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress();

    const response: ParseStatusResponse = {
      jobId,
      status: state as any,
      progress: typeof progress === 'number' ? progress : undefined,
    };

    if (state === 'completed') {
      response.result = job.returnvalue;
    } else if (state === 'failed') {
      response.error = job.failedReason;
    }

    return response;
  }

  /**
   * Setup event handlers for job lifecycle
   */
  private setupJobEventHandlers() {
    // When job completes successfully
    this.parserQueue.on('completed', async (job: Job<ParserJobData>, result: ParserJobResult) => {
      this.logger.log(`Job ${job.id} completed, duration: ${result.duration}ms`);

      // Emit event for real-time updates (WebSocket, etc.)
      this.eventEmitter.emit('parser.completed', {
        jobId: job.id,
        userId: job.data.userId,
        url: job.data.url,
        result,
      });
    });

    // When job fails
    this.parserQueue.on('failed', async (job: Job<ParserJobData>, err: Error) => {
      this.logger.error(`Job ${job.id} failed: ${err.message}`);
    });

    // When job is active
    this.parserQueue.on('active', (job: Job<ParserJobData>) => {
      this.logger.log(`Job ${job.id} is now active`);
    });
  }

  /**
   * Cancel a parsing job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await this.parserQueue.getJob(jobId);

    if (job) {
      await job.remove();
      this.logger.log(`Job ${jobId} cancelled`);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.parserQueue.getWaitingCount(),
      this.parserQueue.getActiveCount(),
      this.parserQueue.getCompletedCount(),
      this.parserQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  /**
   * Synchronous URL parsing with timeout
   * Waits for parsing to complete and returns the result
   * Used when creating wishlist items from URL
   */
  async parseUrlSync(url: string, userId: string, timeout: number = 30000): Promise<ParserJobResult> {
    this.logger.log(`Starting synchronous parsing for URL: ${url}`);

    const jobId = await this.parseUrl(url, userId);

    // Poll for completion
    const startTime = Date.now();
    const pollInterval = 500; // Check every 500ms

    while (Date.now() - startTime < timeout) {
      const status = await this.getParseStatus(jobId);

      if (status.status === 'completed' && status.result) {
        // Normalize currency if price exists
        if (status.result.data?.price && status.result.data?.currency) {
          const { price, currency } = normalizeCurrency(
            status.result.data.price,
            status.result.data.currency
          );
          status.result.data.price = price;
          status.result.data.currency = currency;
        }

        // Generate warnings for missing fields
        const warnings: string[] = [];
        if (!status.result.data?.title) warnings.push('Title not found');
        if (!status.result.data?.description) warnings.push('Description not found');
        if (!status.result.data?.price) warnings.push('Price not found');
        if (!status.result.data?.imageUrl) warnings.push('Image not found');

        status.result.warnings = warnings.length > 0 ? warnings : undefined;

        return status.result;
      }

      if (status.status === 'failed') {
        this.logger.error(`Job ${jobId} failed: ${status.error}`);
        throw new Error(status.error || 'Parsing failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout reached
    throw new Error('Parsing timeout exceeded');
  }
}
