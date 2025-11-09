import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScrapflyClient, ScrapeConfig } from 'scrapfly-sdk';

export interface ScrapflyOptions {
  retry?: boolean;
  tags?: string;
  format?: 'clean_html' | 'json' | 'markdown';
  timeout?: number;
  country?: string;
  lang?: string;
  asp?: boolean;
  render_js?: boolean;
  headers?: Record<string, string>;
}

@Injectable()
export class ScrapflyService {
  private readonly logger = new Logger(ScrapflyService.name);
  private client: ScrapflyClient;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('SCRAPFLY_API_KEY');
    if (!apiKey) {
      throw new Error('SCRAPFLY_API_KEY is not configured');
    }
    this.client = new ScrapflyClient({ key: apiKey });
    this.logger.log('Scrapfly client initialized');
  }

  async scrapeUrl(url: string, options?: ScrapflyOptions) {
    this.logger.log(`Scraping URL: ${url}`);

    try {
      const configOptions: any = {
        url,
        retry: options?.retry ?? false,
        tags: options?.tags ? [options.tags] : ['parser', 'project:vibelist'],
        timeout: options?.timeout ?? 75000,
        country: options?.country ?? 'ru',
        lang: options?.lang ? [options.lang] : ['ru'],
        asp: options?.asp ?? true,
      };

      // Only add format if explicitly specified (don't default to clean_html)
      if (options?.format) {
        configOptions.format = options.format;
      }

      // Add render_js if specified
      if (options?.render_js !== undefined) {
        configOptions.render_js = options.render_js;
      }

      // Add custom headers if specified
      if (options?.headers) {
        configOptions.headers = options.headers;
      }

      const config = new ScrapeConfig(configOptions);

      const response = await this.client.scrape(config);

      this.logger.log(`Successfully scraped URL: ${url}`);

      return {
        html: response.result.content,
        url: response.result.url,
        status: response.result.status_code,
        metadata: {
          duration: response.result.duration,
          cost: 0, // Cost info may not be available in all responses
        },
      };
    } catch (error) {
      this.logger.error(`Failed to scrape URL ${url}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async scrapeWithRetry(url: string, maxRetries = 3, options?: ScrapflyOptions) {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Scraping attempt ${attempt}/${maxRetries} for URL: ${url}`);
        return await this.scrapeUrl(url, options);
      } catch (error) {
        lastError = error;
        this.logger.warn(`Attempt ${attempt} failed: ${error.message}`);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          this.logger.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}
