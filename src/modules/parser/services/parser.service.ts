import { Injectable, Logger } from '@nestjs/common';
import { ParsedProductData } from '../interfaces/parsed-product.interface';
import { ScrapflyService } from './scrapfly.service';
import { UniversalParser } from './universal.parser';
import { OzonParser } from './ozon.parser';

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);

  constructor(
    private readonly scrapflyService: ScrapflyService,
    private readonly universalParser: UniversalParser,
    private readonly ozonParser: OzonParser,
  ) {
    this.logger.log('ParserService initialized with Scrapfly + Site-specific parsers + Universal Parser');
  }

  async parse(url: string): Promise<ParsedProductData> {
    const startTime = Date.now();
    this.logger.log(`Parsing URL: ${url}`);

    try {
      // Check if we have a site-specific parser
      if (this.ozonParser.canHandle(url)) {
        this.logger.log('Using Ozon-specific parser');
        const result = await this.ozonParser.parse(url);
        const duration = Date.now() - startTime;
        this.logger.log(`Successfully parsed with Ozon parser in ${duration}ms: ${result.title}`);
        return this.sanitizeResult(result);
      }

      // Fallback to universal parser
      this.logger.log('Using universal parser');

      // Step 1: Scrape the page using Scrapfly
      this.logger.log('Fetching page with Scrapfly...');
      const scrapeResult = await this.scrapflyService.scrapeWithRetry(url, 3, {
        format: 'clean_html',
        country: 'ru',
        lang: 'ru',
        asp: true,
      });

      this.logger.log(`Page fetched successfully (status: ${scrapeResult.status}, cost: ${scrapeResult.metadata.cost})`);

      // Step 2: Parse the HTML using Universal Parser
      this.logger.log('Extracting product data from HTML...');
      const productData = await this.universalParser.parseProductFromHtml(
        scrapeResult.html,
        scrapeResult.url
      );

      if (!this.isValidResult(productData)) {
        throw new Error('No usable product data extracted from page');
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Successfully parsed in ${duration}ms (confidence: ${productData.confidence}): ${productData.title}`
      );

      // Convert to ParsedProductData format
      const result: ParsedProductData = {
        title: productData.title,
        price: productData.price,
        currency: productData.currency,
        imageUrl: productData.imageUrl,
        description: productData.description,
        url: productData.originalUrl,
      };

      return this.sanitizeResult(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to parse URL after ${duration}ms: ${error.message}`);
      throw error;
    }
  }

  private isValidResult(result: any): boolean {
    // At least title must be present
    return !!(result.title && result.title.trim().length > 0);
  }

  private sanitizeResult(result: ParsedProductData): ParsedProductData {
    // Truncate long fields
    if (result.title && result.title.length > 255) {
      result.title = result.title.substring(0, 255);
    }
    if (result.description && result.description.length > 2000) {
      result.description = result.description.substring(0, 2000);
    }
    return result;
  }
}
