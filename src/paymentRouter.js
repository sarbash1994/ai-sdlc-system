const SUPPORTED_CURRENCIES_PAYPAL = ['EUR', 'GBP', 'CHF'];
const SUPPORTED_CURRENCIES_STRIPE = ['USD', 'CAD', 'AUD', 'JPY'];

const REGION_EUROPE = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'GR', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR', 'BG', 'RO', 'EE', 'LV', 'LT', 'LU', 'MT', 'CY'];

class PaymentRouter {
  /**
   * Routes payment to the correct provider based on currency and region
   * @param {string} currency - ISO currency code, e.g. 'EUR', 'USD'
   * @param {string} region - User region code, e.g. 'DE', 'US'
   * @returns {string} - 'PayPal' or 'Stripe'
   * @throws {Error} - if currency is not supported by any provider
   */
  static routePayment(currency, region) {
    const isEurope = REGION_EUROPE.includes(region.toUpperCase());

    if (isEurope) {
      if (SUPPORTED_CURRENCIES_PAYPAL.includes(currency.toUpperCase())) {
        return 'PayPal';
      }
    } else {
      if (SUPPORTED_CURRENCIES_STRIPE.includes(currency.toUpperCase())) {
        return 'Stripe';
      }
    }

    // If currency not supported by region-specific provider, check if other provider supports it
    if (SUPPORTED_CURRENCIES_PAYPAL.includes(currency.toUpperCase())) {
      return 'PayPal';
    }
    if (SUPPORTED_CURRENCIES_STRIPE.includes(currency.toUpperCase())) {
      return 'Stripe';
    }

    throw new Error(`Currency ${currency} is not supported by any payment provider.`);
  }
}

module.exports = PaymentRouter;
