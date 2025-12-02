import { createClient } from '@supabase/supabase-js';
import { getStripeClient } from './stripeClient';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export class Storage {
  async getProduct(productId: string) {
    try {
      const stripe = getStripeClient();
      const product = await stripe.products.retrieve(productId);
      return product;
    } catch (error) {
      console.error('Error fetching product from Stripe:', error);
      return null;
    }
  }

  async listProducts(active = true, limit = 20) {
    try {
      const stripe = getStripeClient();
      const products = await stripe.products.list({ active, limit });
      return products.data;
    } catch (error) {
      console.error('Error listing products from Stripe:', error);
      return [];
    }
  }

  async listProductsWithPrices(active = true, limit = 20) {
    try {
      const stripe = getStripeClient();
      
      const products = await stripe.products.list({ active, limit });
      const prices = await stripe.prices.list({ active: true, limit: 100 });
      
      const result = [];
      for (const product of products.data) {
        const productPrices = prices.data.filter(p => p.product === product.id);
        for (const price of productPrices) {
          result.push({
            product_id: product.id,
            product_name: product.name,
            product_description: product.description,
            product_active: product.active,
            product_metadata: product.metadata,
            price_id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            recurring: price.recurring,
            price_active: price.active,
            price_metadata: price.metadata,
          });
        }
        if (productPrices.length === 0) {
          result.push({
            product_id: product.id,
            product_name: product.name,
            product_description: product.description,
            product_active: product.active,
            product_metadata: product.metadata,
            price_id: null,
            unit_amount: null,
            currency: null,
            recurring: null,
            price_active: null,
            price_metadata: null,
          });
        }
      }
      return result;
    } catch (error) {
      console.error('Error listing products with prices from Stripe:', error);
      return [];
    }
  }

  async getPrice(priceId: string) {
    try {
      const stripe = getStripeClient();
      const price = await stripe.prices.retrieve(priceId);
      return price;
    } catch (error) {
      console.error('Error fetching price from Stripe:', error);
      return null;
    }
  }

  async listPrices(active = true, limit = 20) {
    try {
      const stripe = getStripeClient();
      const prices = await stripe.prices.list({ active, limit });
      return prices.data;
    } catch (error) {
      console.error('Error listing prices from Stripe:', error);
      return [];
    }
  }

  async getPricesForProduct(productId: string) {
    try {
      const stripe = getStripeClient();
      const prices = await stripe.prices.list({ product: productId, active: true });
      return prices.data;
    } catch (error) {
      console.error('Error fetching prices for product from Stripe:', error);
      return [];
    }
  }

  async getStripeSubscription(subscriptionId: string) {
    try {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Error fetching subscription from Stripe:', error);
      return null;
    }
  }

  async getUserSubscription(userId: string) {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user subscription:', error);
      return null;
    }

    return data;
  }

  async updateUserSubscription(userId: string, updates: any) {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }

    return data;
  }

  async getStripePriceId(planKey = 'pro_monthly_price_id'): Promise<string | null> {
    const { data, error } = await supabase
      .from('stripe_config')
      .select('value')
      .eq('key', planKey)
      .single();

    if (error) {
      console.error('Error fetching price ID:', error);
      return null;
    }

    return data?.value || null;
  }
}

export const storage = new Storage();
