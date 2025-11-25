import { Router } from 'express';
import { storage } from './storage';
import { stripeService } from './stripeService';
import { getStripePublishableKey, getUncachableStripeClient } from './stripeClient';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

// Middleware to verify Supabase auth token
async function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = user;
  next();
}

// Get Stripe publishable key
router.get('/api/stripe/config', async (req, res) => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's subscription
router.get('/api/subscription', requireAuth, async (req: any, res) => {
  try {
    const subscription = await storage.getUserSubscription(req.user.id);

    if (!subscription) {
      return res.json({ subscription: null });
    }

    // If has Stripe subscription ID, get details from Stripe
    let stripeSubscription = null;
    if (subscription.stripe_subscription_id) {
      stripeSubscription = await storage.getStripeSubscription(subscription.stripe_subscription_id);
    }

    res.json({
      subscription: {
        ...subscription,
        stripe_details: stripeSubscription,
      },
    });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create checkout session
router.post('/api/checkout', requireAuth, async (req: any, res) => {
  try {
    const user = req.user;
    const { priceId: requestedPriceId } = req.body;

    // Use provided price ID or get from config
    let priceId = requestedPriceId;
    if (!priceId) {
      priceId = await storage.getStripePriceId();
      if (!priceId) {
        return res.status(400).json({ error: 'No price ID configured' });
      }
    }

    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;

    const session = await stripeService.createCheckoutSession(
      user.id,
      user.email!,
      priceId,
      `${origin}/settings?success=true`,
      `${origin}/settings?canceled=true`
    );

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create customer portal session
router.post('/api/portal', requireAuth, async (req: any, res) => {
  try {
    const subscription = await storage.getUserSubscription(req.user.id);

    if (!subscription?.stripe_customer_id) {
      return res.status(404).json({ error: 'No customer found' });
    }

    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;

    const session = await stripeService.createCustomerPortalSession(
      subscription.stripe_customer_id,
      `${origin}/settings`
    );

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get products (for displaying pricing plans)
router.get('/api/products', async (req, res) => {
  try {
    const products = await storage.listProductsWithPrices();

    // Group prices by product
    const productsMap = new Map();
    for (const row of products) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          active: row.product_active,
          metadata: row.product_metadata,
          prices: [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
          active: row.price_active,
          metadata: row.price_metadata,
        });
      }
    }

    res.json({ data: Array.from(productsMap.values()) });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if user can analyze a specific client
router.post('/api/can-analyze', requireAuth, async (req: any, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: req.headers.authorization },
      },
    });

    // Call the database function
    const { data, error } = await supabase.rpc('can_analyze_client', {
      p_client_id: clientId,
    });

    if (error) {
      console.error('Error checking analysis limit:', error);
      return res.status(500).json({ error: error.message });
    }

    // Get current count
    const { data: countData, error: countError } = await supabase.rpc('get_client_analysis_count', {
      p_client_id: clientId,
    });

    const currentCount = countError ? 0 : (countData || 0);
    const subscription = await storage.getUserSubscription(req.user.id);
    const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';

    res.json({
      allowed: data === true,
      currentCount,
      limit: isPro ? null : 3,
      isPro,
    });
  } catch (error: any) {
    console.error('Error checking can analyze:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual subscription sync from Stripe
router.post('/api/sync-subscription', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;

    // Get current subscription from database
    const currentSub = await storage.getUserSubscription(userId);

    if (!currentSub) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    // If they have a Stripe customer ID, fetch from Stripe
    if (currentSub.stripe_customer_id) {
      const stripe = await getUncachableStripeClient();
      const customer = await stripe.customers.retrieve(currentSub.stripe_customer_id, {
        expand: ['subscriptions'],
      });

      if ('deleted' in customer) {
        return res.status(404).json({ error: 'Customer deleted' });
      }

      const subscriptions = customer.subscriptions?.data || [];
      
      if (subscriptions.length > 0) {
        const stripeSub = subscriptions[0];
        
        // Update via Supabase
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: stripeSub.id,
            status: stripeSub.status === 'active' ? 'active' : stripeSub.status,
            plan: stripeSub.status === 'active' ? 'pro' : 'free',
            current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: stripeSub.cancel_at_period_end || false,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        return res.json({ 
          message: 'Subscription synced successfully', 
          plan: stripeSub.status === 'active' ? 'pro' : 'free',
          status: stripeSub.status,
        });
      }
    }

    res.json({ message: 'No active Stripe subscription found', currentSub });
  } catch (error: any) {
    console.error('Error syncing subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
