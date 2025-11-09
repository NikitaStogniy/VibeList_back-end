export interface ParsedProductData {
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  category?: string;
  url?: string;
}

export interface SiteParser {
  parse(url: string): Promise<ParsedProductData>;
  canHandle(url: string): boolean;
}
