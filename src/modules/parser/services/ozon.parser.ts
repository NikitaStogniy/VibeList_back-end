import { Injectable, Logger } from '@nestjs/common';
import { SiteParser, ParsedProductData } from '../interfaces/parsed-product.interface';
import { ScrapflyService } from './scrapfly.service';

interface OzonLayoutComponent {
  component: string;
  [key: string]: any;
}

interface OzonApiResponse {
  layout?: OzonLayoutComponent[];
  widgetStates?: Record<string, string>; // JSON-encoded strings
  [key: string]: any;
}

@Injectable()
export class OzonParser implements SiteParser {
  private readonly logger = new Logger(OzonParser.name);

  constructor(private readonly scrapflyService: ScrapflyService) {}

  canHandle(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('ozon.ru');
    } catch {
      return false;
    }
  }

  async parse(url: string): Promise<ParsedProductData> {
    this.logger.log(`Parsing Ozon URL: ${url}`);

    try {
      // Step 1: Extract product slug from URL
      const slug = this.extractSlugFromUrl(url);
      if (!slug) {
        throw new Error('Could not extract product slug from URL');
      }

      this.logger.log(`Extracted slug: ${slug}`);

      // Step 2: Build API URL
      // For short URLs (starting with 't/'), use the path as-is
      // For regular product slugs, wrap in /product/
      const apiUrl = slug.startsWith('t/')
        ? `https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=/${slug}/`
        : `https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=/product/${slug}/`;
      this.logger.log(`API URL: ${apiUrl}`);

      // Step 3: Fetch JSON data from API
      // Note: Don't use format conversion for JSON APIs - get raw content
      // Use render_js to execute JavaScript and bypass some protections
      const scrapeResult = await this.scrapflyService.scrapeWithRetry(apiUrl, 3, {
        country: 'ru',
        lang: 'ru',
        asp: true,
        render_js: true,
        headers: {
          'Accept': 'application/json',
          'Referer': 'https://www.ozon.ru/',
        },
      });

      // Step 4: Parse JSON response
      let jsonData: OzonApiResponse;
      try {
        // ScrapFly returns HTML even when format is 'json', so we need to parse it
        const jsonText = typeof scrapeResult.html === 'string'
          ? scrapeResult.html
          : JSON.stringify(scrapeResult.html);
        jsonData = JSON.parse(jsonText);

        // Log layout structure for debugging
        if (jsonData.layout && Array.isArray(jsonData.layout)) {
          const components = jsonData.layout.map(item => item.component).filter(Boolean);
          this.logger.log(`Found ${jsonData.layout.length} layout items with components: ${components.join(', ')}`);
        } else {
          this.logger.warn('No layout array found in response');
          this.logger.debug(`Response keys: ${Object.keys(jsonData).join(', ')}`);
        }
      } catch (error) {
        this.logger.error(`Failed to parse JSON response: ${error.message}`);
        throw new Error('Invalid JSON response from Ozon API');
      }

      // Step 5: Extract product data from layout components
      const productData = this.extractProductData(jsonData, url);

      this.logger.log(`Successfully parsed Ozon product: ${productData.title}`);
      return productData;

    } catch (error) {
      this.logger.error(`Failed to parse Ozon URL: ${error.message}`, error.stack);
      throw error;
    }
  }

  private extractSlugFromUrl(url: string): string | null {
    try {
      // Remove query parameters (everything after ?)
      const cleanUrl = url.split('?')[0];
      const urlObj = new URL(cleanUrl);
      const pathname = urlObj.pathname;

      // Extract slug from full product URLs:
      // /product/termonoski-empire-socks-12-par-2208892170/
      // /product/termonoski-empire-socks-12-par-2208892170
      const productMatch = pathname.match(/\/product\/([^\/]+)/);
      if (productMatch && productMatch[1]) {
        // Return just the slug without /product/ prefix
        return productMatch[1];
      }

      // Extract code from short URLs:
      // /t/T86F05A
      // /t/T86F05A/
      const shortMatch = pathname.match(/\/t\/([^\/]+)/);
      if (shortMatch && shortMatch[1]) {
        // Return with 't/' prefix to indicate it's a short URL
        return `t/${shortMatch[1]}`;
      }

      return null;
    } catch {
      return null;
    }
  }

  private extractProductData(jsonData: OzonApiResponse, originalUrl: string): ParsedProductData {
    const result: ParsedProductData = {
      url: originalUrl,
    };

    if (!jsonData.layout || !Array.isArray(jsonData.layout)) {
      this.logger.warn('No layout array found in Ozon API response');
      return result;
    }

    if (!jsonData.widgetStates) {
      this.logger.warn('No widgetStates found in Ozon API response');
      return result;
    }

    // Find all components recursively (they may be nested)
    const allComponents = this.findComponentsRecursively(jsonData.layout);
    this.logger.log(`Found ${allComponents.length} total components (including nested)`);

    // Log all unique component types for debugging
    const componentTypes = [...new Set(allComponents.map(c => c.component))];
    this.logger.debug(`Component types: ${componentTypes.join(', ')}`);

    // Extract data from found components by looking up their state in widgetStates
    for (const component of allComponents) {
      // Get the widget state for this component if it has a stateId
      const widgetState = component.stateId
        ? this.parseWidgetState(component.stateId, jsonData.widgetStates)
        : null;

      switch (component.component) {
        case 'webProductHeading':
          if (!result.title && widgetState) {
            result.title = this.extractTitle(component, widgetState);
            if (result.title) this.logger.log(`Extracted title: ${result.title.substring(0, 50)}...`);
          }
          break;
        case 'webPrice':
          if (!result.price && widgetState) {
            const priceData = this.extractPrice(component, widgetState);
            result.price = priceData.price;
            result.currency = priceData.currency;
            if (result.price) this.logger.log(`Extracted price: ${result.price} ${result.currency}`);
          }
          break;
        case 'webGallery':
          if (!result.imageUrl && widgetState) {
            result.imageUrl = this.extractImage(component, widgetState);
            if (result.imageUrl) this.logger.log(`Extracted image URL`);
          }
          break;
        case 'webSingleProductScore':
        case 'webReviewProductScore':
          if (!result.description && widgetState) {
            result.description = this.extractRatingAndReviews(component, widgetState);
            if (result.description) this.logger.log(`Extracted rating: ${result.description}`);
          }
          break;
        case 'textBlock':
          // Keep as fallback if webSingleProductScore is not found
          if (!result.description && widgetState) {
            result.description = this.extractDescription(component, widgetState);
            if (result.description) this.logger.log(`Extracted description: ${result.description.substring(0, 50)}...`);
          }
          break;
      }
    }

    return result;
  }

  private parseWidgetState(stateId: string, widgetStates: Record<string, string>): any | null {
    try {
      const stateJson = widgetStates[stateId];
      if (!stateJson) {
        this.logger.debug(`No widget state found for stateId: ${stateId}`);
        return null;
      }

      // Parse the JSON-encoded string (double parsing)
      const parsed = JSON.parse(stateJson);
      return parsed;
    } catch (error) {
      this.logger.warn(`Failed to parse widget state for ${stateId}: ${error.message}`);
      return null;
    }
  }

  private findComponentsRecursively(items: any[]): OzonLayoutComponent[] {
    const components: OzonLayoutComponent[] = [];

    for (const item of items) {
      if (item && typeof item === 'object') {
        // Add current item if it has a component property
        if (item.component) {
          components.push(item);
        }

        // Recursively search in all properties that are arrays or objects
        for (const key of Object.keys(item)) {
          const value = item[key];
          if (Array.isArray(value)) {
            components.push(...this.findComponentsRecursively(value));
          } else if (value && typeof value === 'object' && key !== 'component') {
            // Check if this object itself has nested arrays
            for (const nestedKey of Object.keys(value)) {
              if (Array.isArray(value[nestedKey])) {
                components.push(...this.findComponentsRecursively(value[nestedKey]));
              }
            }
          }
        }
      }
    }

    return components;
  }

  private extractTitle(component: OzonLayoutComponent, widgetState: any): string | undefined {
    try {
      // Try different possible paths in the widget state
      if (widgetState.title) {
        return typeof widgetState.title === 'string' ? widgetState.title : widgetState.title.text;
      }
      if (widgetState.text) {
        return widgetState.text;
      }
      if (widgetState.header?.title) {
        return widgetState.header.title;
      }
      if (widgetState.textAtom?.text) {
        return widgetState.textAtom.text;
      }
      if (widgetState.name) {
        return widgetState.name;
      }

      // Try to find title in nested structures
      const findTitle = (obj: any): string | undefined => {
        if (!obj || typeof obj !== 'object') return undefined;

        if (obj.title && typeof obj.title === 'string') return obj.title;
        if (obj.text && typeof obj.text === 'string') return obj.text;
        if (obj.name && typeof obj.name === 'string') return obj.name;

        for (const key of Object.keys(obj)) {
          const result = findTitle(obj[key]);
          if (result) return result;
        }
        return undefined;
      };

      const foundTitle = findTitle(widgetState);
      if (foundTitle) return foundTitle;

      this.logger.warn('Could not extract title from webProductHeading widget state');
      this.logger.debug(`Widget state keys: ${Object.keys(widgetState).join(', ')}`);
      return undefined;
    } catch (error) {
      this.logger.error(`Error extracting title: ${error.message}`);
      return undefined;
    }
  }

  private extractPrice(_component: OzonLayoutComponent, widgetState: any): { price?: number; currency?: string } {
    try {
      let price: number | undefined;
      let currency: string = 'RUB'; // Default to RUB for Ozon

      // Try to extract from priceV2 structure (common in Ozon API)
      if (widgetState.priceV2?.price) {
        const priceArray = widgetState.priceV2.price;
        if (Array.isArray(priceArray) && priceArray.length > 0) {
          const priceText = priceArray[0].text;
          if (priceText) {
            // Extract numeric value from text like "1 246 ₽" or "7 430 ₽"
            const match = priceText.match(/[\d\s]+/);
            if (match) {
              const priceValue = parseFloat(match[0].replace(/\s/g, ''));
              if (!isNaN(priceValue)) {
                price = priceValue;
              }
            }
          }
        }
      }

      // Try other possible price paths
      if (!price && widgetState.price) {
        const priceValue = typeof widgetState.price === 'number'
          ? widgetState.price
          : parseFloat(String(widgetState.price).replace(/\s/g, '').replace(/[^\d.]/g, ''));
        if (!isNaN(priceValue)) {
          price = priceValue;
        }
      }

      if (!price && widgetState.currentPrice) {
        const priceValue = parseFloat(String(widgetState.currentPrice).replace(/\s/g, '').replace(/[^\d.]/g, ''));
        if (!isNaN(priceValue)) {
          price = priceValue;
        }
      }

      // Try to extract currency
      if (widgetState.currency) {
        currency = widgetState.currency;
      } else if (widgetState.priceV2?.currency) {
        currency = widgetState.priceV2.currency;
      }

      if (!price) {
        this.logger.warn('Could not extract price from webPrice widget state');
        this.logger.debug(`Widget state keys: ${Object.keys(widgetState).join(', ')}`);
      }

      return { price, currency };
    } catch (error) {
      this.logger.error(`Error extracting price: ${error.message}`);
      return { currency: 'RUB' };
    }
  }

  private extractImage(_component: OzonLayoutComponent, widgetState: any): string | undefined {
    try {
      // Try different possible paths for images in widget state
      if (widgetState.images && Array.isArray(widgetState.images) && widgetState.images.length > 0) {
        const firstImage = widgetState.images[0];
        return typeof firstImage === 'string' ? firstImage : firstImage.url || firstImage.src || firstImage.link;
      }

      if (widgetState.gallery && Array.isArray(widgetState.gallery) && widgetState.gallery.length > 0) {
        const firstImage = widgetState.gallery[0];
        return typeof firstImage === 'string' ? firstImage : firstImage.url || firstImage.src || firstImage.link;
      }

      if (widgetState.image) {
        const img = widgetState.image;
        return typeof img === 'string' ? img : img.url || img.src || img.link;
      }

      // Try to find image URL in nested items
      if (widgetState.items && Array.isArray(widgetState.items)) {
        for (const item of widgetState.items) {
          if (item.type === 'image' && item.image?.link) {
            return item.image.link;
          }
        }
      }

      this.logger.warn('Could not extract image from webGallery widget state');
      this.logger.debug(`Widget state keys: ${Object.keys(widgetState).join(', ')}`);
      return undefined;
    } catch (error) {
      this.logger.error(`Error extracting image: ${error.message}`);
      return undefined;
    }
  }

  private extractRatingAndReviews(_component: OzonLayoutComponent, widgetState: any): string | undefined {
    try {
      let rating: string | undefined;
      let reviewCount: string | undefined;

      // Log full widget state for debugging
      this.logger.debug(`Rating widget state sample: ${JSON.stringify(widgetState).substring(0, 500)}`);

      // Strategy 1: Look for labelList structure (common pattern)
      const labelList = widgetState.labelList || widgetState;
      if (labelList.items && Array.isArray(labelList.items)) {
        for (const item of labelList.items) {
          // Find rating by icon
          if (item.icon?.image === 'ic_s_star_filled_compact' && item.title) {
            rating = item.title.trim();
          }
          // Find review count by icon
          if (item.icon?.image === 'ic_s_dialog_filled_compact' && item.title) {
            reviewCount = item.title.trim();
          }
        }
      }

      // Strategy 2: Check if text field contains rating
      if (!rating && widgetState.text) {
        // text might be something like "4.9" or "Рейтинг: 4.9"
        rating = widgetState.text;
      }

      // Strategy 3: Look for review count in link text
      if (!reviewCount && widgetState.link?.text) {
        reviewCount = widgetState.link.text;
      }

      // If we found both rating and reviews, format them
      if (rating && reviewCount) {
        return `Рейтинг: ${rating} (${reviewCount})`;
      }

      // If only rating found
      if (rating) {
        return `Рейтинг: ${rating}`;
      }

      // If only reviews found
      if (reviewCount) {
        return reviewCount;
      }

      this.logger.warn('Could not extract rating and reviews from rating widget state');
      this.logger.debug(`Widget state keys: ${Object.keys(widgetState).join(', ')}`);
      return undefined;
    } catch (error) {
      this.logger.error(`Error extracting rating and reviews: ${error.message}`);
      return undefined;
    }
  }

  private extractDescription(_component: OzonLayoutComponent, widgetState: any): string | undefined {
    try {
      // Try different possible paths for description in widget state
      if (widgetState.text && typeof widgetState.text === 'string') {
        return widgetState.text;
      }
      if (widgetState.description && typeof widgetState.description === 'string') {
        return widgetState.description;
      }
      if (widgetState.content && typeof widgetState.content === 'string') {
        return widgetState.content;
      }
      if (widgetState.textAtom?.text) {
        return widgetState.textAtom.text;
      }

      // Try to find text in body array (common in Ozon textBlock widgets)
      if (widgetState.body && Array.isArray(widgetState.body)) {
        const textParts: string[] = [];
        for (const item of widgetState.body) {
          if (item.type === 'textAtom' && item.textAtom?.text) {
            textParts.push(item.textAtom.text);
          }
        }
        if (textParts.length > 0) {
          return textParts.join(' ');
        }
      }

      this.logger.warn('Could not extract description from textBlock widget state');
      this.logger.debug(`Widget state keys: ${Object.keys(widgetState).join(', ')}`);
      return undefined;
    } catch (error) {
      this.logger.error(`Error extracting description: ${error.message}`);
      return undefined;
    }
  }
}
