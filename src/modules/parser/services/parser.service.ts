import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ParsedProductData } from '../interfaces/parsed-product.interface';
import { OzonParser } from './ozon.parser';

@Injectable()
export class ParserService {
  private readonly logger = new Logger(ParserService.name);
  private readonly supportedSites = ['Ozon.ru'];

  constructor(
    private readonly ozonParser: OzonParser,
  ) {
    this.logger.log(`ParserService initialized. Supported sites: ${this.supportedSites.join(', ')}`);
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

      // No parser available for this site
      this.logger.warn(`Unsupported website: ${url}`);
      throw new BadRequestException(
        `Unsupported website. Currently supported sites: ${this.supportedSites.join(', ')}. ` +
        `To add support for more sites, please contact support.`
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to parse URL after ${duration}ms: ${error.message}`);
      throw error;
    }
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
