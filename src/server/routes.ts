import { Router } from 'express';
import { storage } from './storage';
import { stripeService } from './stripeService';
import { getStripePublishableKey, getUncachableStripeClient } from './stripeClient';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

// Middleware to require admin role
async function requireAdmin(req: any, res: any, next: any) {
  const user = req.user;
  const userRole = user?.user_metadata?.role;
  
  if (userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}
// @ts-ignore - req is used by Express middleware but TypeScript thinks it's unused

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

// ============================================
// ADMIN ENDPOINTS
// ============================================

// Get all users with subscription info (admin only)
router.get('/api/admin/users', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all users from auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      return res.status(500).json({ error: authError.message });
    }

    // Get all subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*');

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
    }

    // Create a map of subscriptions by user_id
    const subMap = new Map(
      (subscriptions || []).map((s: any) => [s.user_id, s])
    );

    // Combine user data with subscription info
    const users = authData.users.map((user: any) => {
      const subscription = subMap.get(user.id);
      return {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || '',
        role: user.user_metadata?.role || 'practitioner',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        subscription: subscription ? {
          plan: subscription.plan,
          status: subscription.status,
          stripe_customer_id: subscription.stripe_customer_id,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end,
          pro_override: subscription.pro_override || false,
          pro_override_until: subscription.pro_override_until,
        } : null,
      };
    });

    // Sort by created_at descending (newest first)
    users.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.json({ users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Grant or revoke Pro access for a user (admin only)
router.post('/api/admin/users/:userId/subscription', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { plan, override, overrideUntil } = req.body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if subscription exists
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // If override is specified, use it for free Pro access
    if (override !== undefined) {
      updateData.pro_override = override;
      updateData.pro_override_until = overrideUntil || null;
      if (override) {
        updateData.plan = 'pro';
        updateData.status = 'active';
      } else if (!existing?.stripe_subscription_id) {
        // Only reset to free if they don't have a paid subscription
        updateData.plan = 'free';
        updateData.status = 'active';
      }
    }

    // If plan is specified directly
    if (plan) {
      updateData.plan = plan;
      updateData.status = 'active';
    }

    if (existing) {
      const { data, error } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('user_id', userId)
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json({ message: 'Subscription updated', subscription: data?.[0] });
    } else {
      // Create new subscription
      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan: plan || (override ? 'pro' : 'free'),
          status: 'active',
          pro_override: override || false,
          pro_override_until: overrideUntil || null,
          ...updateData,
        })
        .select();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json({ message: 'Subscription created', subscription: data?.[0] });
    }
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
