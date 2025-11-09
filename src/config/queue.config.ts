import { BullModuleOptions } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

export const getQueueConfig = (configService: ConfigService): BullModuleOptions => ({
  redis: {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: configService.get('REDIS_PORT', 6379),
    password: configService.get('REDIS_PASSWORD', ''),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500, // Keep last 500 failed jobs
  },
});

// Queue names
export const PARSER_QUEUE = 'parser-jobs';
export const PRICE_CHECK_QUEUE = 'price-check-jobs';

// Job data interfaces
export interface ParserJobData {
  url: string;
  userId: string;
}

export interface ParserJobResult {
  success: boolean;
  data?: {
    title?: string;
    description?: string;
    price?: number;
    currency?: string;
    imageUrl?: string;
    category?: string;
  };
  warnings?: string[]; // List of missing fields
  error?: string;
  duration: number; // milliseconds
}

// Price check job interfaces
export interface PriceCheckJobData {
  itemId: string;
  url: string;
  currentPrice: number;
  currentCurrency: string;
}

export interface PriceCheckJobResult {
  success: boolean;
  priceChanged: boolean;
  priceDropped?: boolean;
  oldPrice?: number;
  newPrice?: number;
  currency?: string;
  error?: string;
}
