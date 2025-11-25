import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// PostgreSQL pool for direct queries to stripe schema
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});

/**
 * Storage: Query Stripe data from PostgreSQL and Supabase
 */
export class Storage {
  // Query Stripe data from stripe.products table
  async getProduct(productId: string) {
    const result = await pool.query(
      'SELECT * FROM stripe.products WHERE id = $1',
      [productId]
    );
    return result.rows[0] || null;
  }

  async listProducts(active = true, limit = 20, offset = 0) {
    const result = await pool.query(
      'SELECT * FROM stripe.products WHERE active = $1 LIMIT $2 OFFSET $3',
      [active, limit, offset]
    );
    return result.rows;
  }

  // Get products with their prices
  async listProductsWithPrices(active = true, limit = 20, offset = 0) {
    const result = await pool.query(
      `
        WITH paginated_products AS (
          SELECT id, name, description, metadata, active
          FROM stripe.products
          WHERE active = $1
          ORDER BY id
          LIMIT $2 OFFSET $3
        )
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.active as product_active,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active as price_active,
          pr.metadata as price_metadata
        FROM paginated_products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        ORDER BY p.id, pr.unit_amount
      `,
      [active, limit, offset]
    );
    return result.rows;
  }

  // Query Stripe data from stripe.prices table
  async getPrice(priceId: string) {
    const result = await pool.query(
      'SELECT * FROM stripe.prices WHERE id = $1',
      [priceId]
    );
    return result.rows[0] || null;
  }

  async listPrices(active = true, limit = 20, offset = 0) {
    const result = await pool.query(
      'SELECT * FROM stripe.prices WHERE active = $1 LIMIT $2 OFFSET $3',
      [active, limit, offset]
    );
    return result.rows;
  }

  // Get prices for a specific product
  async getPricesForProduct(productId: string) {
    const result = await pool.query(
      'SELECT * FROM stripe.prices WHERE product = $1 AND active = true',
      [productId]
    );
    return result.rows;
  }

  // Query subscription from stripe.subscriptions
  async getStripeSubscription(subscriptionId: string) {
    const result = await pool.query(
      'SELECT * FROM stripe.subscriptions WHERE id = $1',
      [subscriptionId]
    );
    return result.rows[0] || null;
  }

  // Get user subscription from our subscriptions table
  async getUserSubscription(userId: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user subscription:', error);
      return null;
    }

    return data;
  }

  // Update user subscription
  async updateUserSubscription(userId: string, updates: any) {
    const { data, error } = await supabase
      .from('subscriptions')
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

  // Get Stripe price ID from config
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
