import { Processor, Process, OnQueueError, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ParserService } from '../../parser/services/parser.service';
import { ParserJobData, ParserJobResult } from '../../../config/queue.config';

@Processor('parser-jobs')
export class ParserProcessor {
  private readonly logger = new Logger(ParserProcessor.name);

  constructor(private readonly parserService: ParserService) {}

  @Process('parse')
  async handleParse(job: Job<ParserJobData>): Promise<ParserJobResult> {
    const { url, userId } = job.data;

    this.logger.log(`Processing job ${job.id} for URL: ${url} (User: ${userId})`);

    const startTime = Date.now();

    try {
      // Update job progress
      await job.progress(10);

      // Parse the URL
      const result = await this.parserService.parse(url);

      await job.progress(100);

      const duration = Date.now() - startTime;

      this.logger.log(`Job ${job.id} completed successfully in ${duration}ms`);

      return {
        success: true,
        data: result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(
        `Job ${job.id} failed after ${duration}ms: ${error.message}`,
        error.stack
      );

      // Throw error to mark job as failed
      throw error;
    }
  }

  @OnQueueError()
  onError(error: Error) {
    this.logger.error(`Queue error: ${error.message}`, error.stack);
  }

  @OnQueueFailed()
  async onFailed(job: Job<ParserJobData>, error: Error) {
    this.logger.error(
      `Job ${job.id} failed: ${error.message}`,
      error.stack
    );
  }
}
