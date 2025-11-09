import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';

export interface ProductData {
  title: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  description?: string;
  brand?: string;
  category?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'pre_order' | 'unknown';
  originalUrl: string;
  confidence: number;
}

@Injectable()
export class UniversalParser {
  private readonly logger = new Logger(UniversalParser.name);
  private anthropic: Anthropic;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not configured, AI extraction disabled');
    } else {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  async parseProductFromHtml(html: string, url: string): Promise<ProductData> {
    this.logger.log(`Parsing product from URL: ${url}`);

    // Try simple extraction first (faster, cheaper)
    const simpleResult = this.extractWithCheerio(html, url);

    // If simple extraction got good results, return them
    if (simpleResult.confidence > 0.7) {
      this.logger.log(`Simple extraction succeeded with confidence ${simpleResult.confidence}`);
      return simpleResult;
    }

    // Otherwise, use AI for better extraction
    if (this.anthropic) {
      this.logger.log('Using AI extraction for better results');
      return await this.extractWithAI(html, url, simpleResult);
    }

    // Fallback to simple result if AI is not available
    this.logger.warn('AI extraction not available, using simple extraction');
    return simpleResult;
  }

  private extractWithCheerio(html: string, url: string): ProductData {
    const $ = cheerio.load(html);
    let confidence = 0;

    // Extract title
    let title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('h1').first().text().trim() ||
      $('title').text().trim();

    if (title) confidence += 0.3;

    // Extract price
    let price: number | undefined;
    let currency = 'RUB';

    const priceText =
      $('meta[property="og:price:amount"]').attr('content') ||
      $('[itemprop="price"]').attr('content') ||
      $('.price').first().text() ||
      $('[class*="price"]').first().text();

    if (priceText) {
      const priceMatch = priceText.match(/[\d\s]+/);
      if (priceMatch) {
        price = parseFloat(priceMatch[0].replace(/\s/g, ''));
        confidence += 0.3;
      }
    }

    // Extract currency
    const currencyText =
      $('meta[property="og:price:currency"]').attr('content') ||
      $('[itemprop="priceCurrency"]').attr('content');

    if (currencyText) {
      currency = currencyText;
    }

    // Extract image
    let imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('[itemprop="image"]').attr('src') ||
      $('img').first().attr('src');

    if (imageUrl) {
      // Make absolute URL if relative
      if (imageUrl.startsWith('/')) {
        const urlObj = new URL(url);
        imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
      }
      confidence += 0.2;
    }

    // Extract description
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('[itemprop="description"]').text().trim();

    if (description) confidence += 0.1;

    // Extract brand
    const brand =
      $('meta[property="og:brand"]').attr('content') ||
      $('[itemprop="brand"]').text().trim();

    if (brand) confidence += 0.1;

    return {
      title,
      price,
      currency,
      imageUrl,
      description,
      brand,
      originalUrl: url,
      confidence,
    };
  }

  private async extractWithAI(
    html: string,
    url: string,
    fallback: ProductData
  ): Promise<ProductData> {
    try {
      // Clean HTML - remove scripts, styles, keep only relevant content
      const $ = cheerio.load(html);
      $('script, style, noscript, iframe').remove();
      const cleanHtml = $.html();

      // Truncate if too long (Claude has context limits)
      const maxLength = 50000;
      const truncatedHtml = cleanHtml.length > maxLength
        ? cleanHtml.substring(0, maxLength) + '\n... [truncated]'
        : cleanHtml;

      const prompt = `Extract product information from this HTML page.

URL: ${url}

Return ONLY a valid JSON object with these fields:
{
  "title": "product title",
  "price": numeric price value (number, no currency symbols),
  "currency": "currency code like RUB, USD, EUR",
  "imageUrl": "main product image URL (full URL)",
  "description": "product description",
  "brand": "brand name",
  "category": "product category",
  "availability": "in_stock" | "out_of_stock" | "pre_order" | "unknown"
}

If you cannot find a field, use null. Be accurate and extract exactly what's on the page.

HTML:
${truncatedHtml}`;

      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('AI did not return valid JSON, using fallback');
        return fallback;
      }

      const extracted = JSON.parse(jsonMatch[0]);

      return {
        title: extracted.title || fallback.title,
        price: extracted.price || fallback.price,
        currency: extracted.currency || fallback.currency || 'RUB',
        imageUrl: extracted.imageUrl || fallback.imageUrl,
        description: extracted.description || fallback.description,
        brand: extracted.brand || fallback.brand,
        category: extracted.category,
        availability: extracted.availability || 'unknown',
        originalUrl: url,
        confidence: 0.9, // High confidence for AI extraction
      };

    } catch (error) {
      this.logger.error(`AI extraction failed: ${error.message}`, error.stack);
      return fallback;
    }
  }
}
