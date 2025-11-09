import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PriceMonitorService } from '../services/price-monitor.service';

@Injectable()
export class NightlyPriceCheckTask {
  private readonly logger = new Logger(NightlyPriceCheckTask.name);

  constructor(private priceMonitorService: PriceMonitorService) {}

  /**
   * Run nightly price check at 3:00 AM every day
   * Cron expression: '0 3 * * *' = At 03:00
   */
  @Cron('0 3 * * *', {
    name: 'nightly-price-check',
    timeZone: 'UTC',
  })
  async handleNightlyPriceCheck(): Promise<void> {
    this.logger.log('Starting nightly price check task...');

    try {
      await this.priceMonitorService.processNightlyPriceChecks(50);
      this.logger.log('Nightly price check task completed successfully');
    } catch (error) {
      this.logger.error(`Nightly price check task failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Optional: Run every 6 hours for testing/more frequent updates
   * Uncomment if you want more frequent checks
   */
  // @Cron('0 */6 * * *', {
  //   name: 'price-check-6h',
  //   timeZone: 'UTC',
  // })
  // async handleFrequentPriceCheck(): Promise<void> {
  //   this.logger.log('Starting 6-hour price check task...');
  //   try {
  //     await this.priceMonitorService.processNightlyPriceChecks(30);
  //     this.logger.log('6-hour price check task completed successfully');
  //   } catch (error) {
  //     this.logger.error(`6-hour price check task failed: ${error.message}`, error.stack);
  //   }
  // }
}
