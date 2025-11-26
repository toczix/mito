import { Router } from 'express';
import { storage } from './storage';
import { stripeService } from './stripeService';
import { getStripePublishableKey, getStripeClient } from './stripeClient';
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
router.get('/api/stripe/config', (_req, res) => {
  try {
    const publishableKey = getStripePublishableKey();
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
router.get('/api/products', async (_req, res) => {
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
      const stripe = getStripeClient();
      const customer = await stripe.customers.retrieve(currentSub.stripe_customer_id, {
        expand: ['subscriptions'],
      });

      if ('deleted' in customer) {
        return res.status(404).json({ error: 'Customer deleted' });
      }

      const subscriptions = customer.subscriptions?.data || [];
      
      if (subscriptions.length > 0) {
        const stripeSub = subscriptions[0] as any;
        
        // Update via Supabase
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: stripeSub.id,
            status: stripeSub.status === 'active' ? 'active' : stripeSub.status,
            plan: stripeSub.status === 'active' ? 'pro' : 'free',
            current_period_start: stripeSub.current_period_start ? new Date(stripeSub.current_period_start * 1000).toISOString() : null,
            current_period_end: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
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
router.get('/api/admin/users', requireAuth, requireAdmin, async (_req: any, res) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Fetch users one by one to handle corrupted records gracefully
    const allUsers: any[] = [];
    let skippedCount = 0;
    
    for (let page = 1; page <= 100; page++) {
      try {
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
          page,
          perPage: 1
        });
        
        if (authError) {
          // Skip corrupted user record
          skippedCount++;
          continue;
        }
        
        if (!authData?.users || authData.users.length === 0) {
          break;
        }
        
        allUsers.push(authData.users[0]);
      } catch (e) {
        // Skip on error
        skippedCount++;
        continue;
      }
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
    const users = allUsers.map((user: any) => {
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
          stripe_subscription_id: subscription.stripe_subscription_id,
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

    res.json({ 
      users,
      _meta: skippedCount > 0 ? { skippedCorruptedUsers: skippedCount } : undefined
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: `Database error: ${error.message}` });
  }
});

// Grant or revoke Pro access for a user (admin only)
// New endpoint that accepts userId in body (for Vercel serverless compatibility)
router.post('/api/admin/subscription', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId, plan, override, overrideUntil } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

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

// Get admin stats (usage and revenue)
router.get('/api/admin/stats', requireAuth, requireAdmin, async (_req: any, res) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get overall usage stats with error handling
    let analyses: any[] = [];
    let clients: any[] = [];
    let subscriptions: any[] = [];

    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('id, user_id, client_id, created_at, analysis_date');
      if (!error && data) analyses = data;
    } catch (e) {
      console.error('Error fetching analyses:', e);
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, user_id, created_at');
      if (!error && data) clients = data;
    } catch (e) {
      console.error('Error fetching clients:', e);
    }

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, pro_override, pro_override_until');
      if (!error && data) subscriptions = data;
    } catch (e) {
      console.error('Error fetching subscriptions:', e);
    }

    // Group analyses by user
    const analysesByUser: Record<string, any[]> = {};
    analyses.forEach(a => {
      if (a.user_id) {
        if (!analysesByUser[a.user_id]) analysesByUser[a.user_id] = [];
        analysesByUser[a.user_id].push(a);
      }
    });

    // Group clients by user
    const clientsByUser: Record<string, any[]> = {};
    clients.forEach(c => {
      if (c.user_id) {
        if (!clientsByUser[c.user_id]) clientsByUser[c.user_id] = [];
        clientsByUser[c.user_id].push(c);
      }
    });

    // Map subscriptions by user
    const subsByUser: Record<string, any> = {};
    subscriptions.forEach(s => {
      if (s.user_id) {
        subsByUser[s.user_id] = s;
      }
    });

    // Combine into user usage
    const allUserIds = new Set([
      ...Object.keys(analysesByUser),
      ...Object.keys(clientsByUser),
      ...Object.keys(subsByUser)
    ]);

    const userUsage: Record<string, any> = {};
    allUserIds.forEach(userId => {
      const userAnalyses = analysesByUser[userId] || [];
      const userClients = clientsByUser[userId] || [];
      const lastAnalysis = userAnalyses.length > 0
        ? userAnalyses.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0].created_at
        : null;

      userUsage[userId] = {
        analysisCount: userAnalyses.length,
        clientCount: userClients.length,
        lastAnalysis,
        subscription: subsByUser[userId] || null
      };
    });

    // Calculate time-based stats
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const analysesLast30Days = analyses.filter(
      a => new Date(a.created_at) >= thirtyDaysAgo
    ).length;

    const analysesLast7Days = analyses.filter(
      a => new Date(a.created_at) >= sevenDaysAgo
    ).length;

    // Get Stripe revenue data
    let revenueData = {
      mrr: 0,
      totalRevenue: 0,
      activeSubscriptions: 0,
      charges: [] as any[]
    };

    const stripe = getStripeClient();
    if (stripe) {
      try {
        // Get active subscriptions
        const stripeSubscriptions = await stripe.subscriptions.list({
          status: 'active',
          limit: 100
        });

        revenueData.activeSubscriptions = stripeSubscriptions.data.length;
        
        // Calculate MRR from active subscriptions
        revenueData.mrr = stripeSubscriptions.data.reduce((sum: number, sub: any) => {
          const item = sub.items.data[0];
          if (item?.price?.unit_amount) {
            return sum + (item.price.unit_amount / 100);
          }
          return sum;
        }, 0);

        // Get recent charges for revenue tracking
        const charges = await stripe.charges.list({
          limit: 50,
          created: {
            gte: Math.floor(thirtyDaysAgo.getTime() / 1000)
          }
        });

        revenueData.charges = charges.data
          .filter((c: any) => c.status === 'succeeded')
          .map((c: any) => ({
            id: c.id,
            amount: c.amount / 100,
            currency: c.currency,
            created: new Date(c.created * 1000).toISOString(),
            customerEmail: c.billing_details?.email || c.receipt_email
          }));

        revenueData.totalRevenue = revenueData.charges.reduce(
          (sum: number, c: any) => sum + c.amount, 0
        );

      } catch (stripeError: any) {
        console.error('Stripe error:', stripeError.message);
      }
    }

    // Get Claude API usage stats
    let apiUsage = {
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostCents: 0,
      last30DaysCalls: 0,
      last30DaysCostCents: 0,
      last7DaysCalls: 0,
      last7DaysCostCents: 0,
      perUser: {} as Record<string, { calls: number; inputTokens: number; outputTokens: number; costCents: number }>
    };

    try {
      const { data: claudeUsage, error: usageError } = await supabase
        .from('claude_usage')
        .select('user_id, input_tokens, output_tokens, total_cost_cents, created_at');
      
      if (!usageError && claudeUsage) {
        claudeUsage.forEach((u: any) => {
          apiUsage.totalCalls++;
          apiUsage.totalInputTokens += u.input_tokens || 0;
          apiUsage.totalOutputTokens += u.output_tokens || 0;
          apiUsage.totalCostCents += parseFloat(u.total_cost_cents) || 0;

          const createdAt = new Date(u.created_at);
          if (createdAt >= thirtyDaysAgo) {
            apiUsage.last30DaysCalls++;
            apiUsage.last30DaysCostCents += parseFloat(u.total_cost_cents) || 0;
          }
          if (createdAt >= sevenDaysAgo) {
            apiUsage.last7DaysCalls++;
            apiUsage.last7DaysCostCents += parseFloat(u.total_cost_cents) || 0;
          }

          if (u.user_id) {
            if (!apiUsage.perUser[u.user_id]) {
              apiUsage.perUser[u.user_id] = { calls: 0, inputTokens: 0, outputTokens: 0, costCents: 0 };
            }
            apiUsage.perUser[u.user_id].calls++;
            apiUsage.perUser[u.user_id].inputTokens += u.input_tokens || 0;
            apiUsage.perUser[u.user_id].outputTokens += u.output_tokens || 0;
            apiUsage.perUser[u.user_id].costCents += parseFloat(u.total_cost_cents) || 0;
          }
        });
      }
    } catch (e) {
      console.error('Error fetching claude usage:', e);
    }

    // Overall stats
    const stats = {
      overall: {
        totalAnalyses: analyses.length,
        totalClients: clients.length,
        totalUsers: allUserIds.size,
        analysesLast7Days,
        analysesLast30Days,
        proUsers: subscriptions.filter(s => s.plan === 'pro' && s.status === 'active').length,
        freeUsers: subscriptions.filter(s => s.plan === 'free' || !s.plan).length,
        overrideUsers: subscriptions.filter(s => s.pro_override).length
      },
      revenue: revenueData,
      apiUsage,
      perUser: userUsage
    };

    res.json(stats);

  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin subscription actions (pause, cancel, etc)
router.post('/api/admin/subscription-action', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId, action } = req.body;

    if (!userId || !action) {
      return res.status(400).json({ error: 'User ID and action required' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get user's subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      return res.status(500).json({ error: subError.message });
    }

    const stripe = getStripeClient();

    switch (action) {
      case 'pause': {
        if (subscription?.stripe_subscription_id) {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            pause_collection: { behavior: 'void' }
          });
        }
        await supabase
          .from('subscriptions')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('user_id', userId);
        return res.json({ message: 'Subscription paused' });
      }

      case 'resume': {
        if (subscription?.stripe_subscription_id) {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            pause_collection: null
          });
        }
        await supabase
          .from('subscriptions')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('user_id', userId);
        return res.json({ message: 'Subscription resumed' });
      }

      case 'cancel': {
        if (subscription?.stripe_subscription_id) {
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        }
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            plan: 'free',
            stripe_subscription_id: null,
            pro_override: false,
            pro_override_until: null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        return res.json({ message: 'Subscription canceled' });
      }

      case 'cancel_at_period_end': {
        if (subscription?.stripe_subscription_id) {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true
          });
        }
        await supabase
          .from('subscriptions')
          .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
        return res.json({ message: 'Subscription will cancel at period end' });
      }

      case 'reactivate': {
        if (subscription?.stripe_subscription_id) {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: false
          });
        }
        await supabase
          .from('subscriptions')
          .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
        return res.json({ message: 'Subscription reactivated' });
      }

      case 'refund_last': {
        if (!subscription?.stripe_customer_id) {
          return res.status(400).json({ error: 'No Stripe customer found' });
        }
        const charges = await stripe.charges.list({
          customer: subscription.stripe_customer_id,
          limit: 1
        });
        if (charges.data.length === 0) {
          return res.status(400).json({ error: 'No charges found to refund' });
        }
        const lastCharge = charges.data[0];
        if (lastCharge.refunded) {
          return res.status(400).json({ error: 'Last charge already refunded' });
        }
        await stripe.refunds.create({ charge: lastCharge.id });
        return res.json({ 
          message: 'Refund issued',
          amount: lastCharge.amount / 100,
          currency: lastCharge.currency
        });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

  } catch (error: any) {
    console.error('Error performing subscription action:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
