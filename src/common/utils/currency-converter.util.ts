import { Logger } from '@nestjs/common';

const logger = new Logger('CurrencyConverter');

// Static exchange rates (fallback, can be replaced with API)
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.09,
  RUB: 0.011,
  GBP: 1.27,
  JPY: 0.0067,
  CNY: 0.14,
  INR: 0.012,
  CAD: 0.74,
  AUD: 0.66,
  CHF: 1.13,
  MXN: 0.059,
  BRL: 0.20,
};

// Supported currencies that we store as-is
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'RUB'];

/**
 * Convert currency to USD or keep if it's a supported currency
 * @param amount Price amount
 * @param fromCurrency Source currency code
 * @returns Object with converted price and currency
 */
export function normalizeCurrency(
  amount: number,
  fromCurrency: string,
): { price: number; currency: string } {
  const currency = fromCurrency.toUpperCase();

  // If it's already a supported currency, return as-is
  if (SUPPORTED_CURRENCIES.includes(currency)) {
    return { price: amount, currency };
  }

  // Convert to USD
  const rate = EXCHANGE_RATES[currency];
  if (rate) {
    const convertedPrice = Math.round(amount * rate * 100) / 100; // Round to 2 decimals
    logger.log(`Converted ${amount} ${currency} to ${convertedPrice} USD`);
    return { price: convertedPrice, currency: 'USD' };
  }

  // If currency is unknown, assume USD
  logger.warn(`Unknown currency: ${currency}, assuming USD`);
  return { price: amount, currency: 'USD' };
}

/**
 * Check if currency should trigger automatic price monitoring
 * @param currency Currency code
 * @returns true if currency is supported for monitoring
 */
export function isCurrencySupported(currency: string | undefined): boolean {
  if (!currency) return false;
  return SUPPORTED_CURRENCIES.includes(currency.toUpperCase()) || !!EXCHANGE_RATES[currency.toUpperCase()];
}
