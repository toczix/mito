import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;

async function getUser(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return null;
  return user;
}

function isAdmin(user: any): boolean {
  return user?.user_metadata?.role === 'admin';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  const user = await getUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!isAdmin(user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

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
        .from('user_subscriptions')
        .select('user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, pro_override, pro_override_until');
      if (!error && data) subscriptions = data;
    } catch (e) {
      console.error('Error fetching subscriptions:', e);
    }

    // Calculate per-user usage
    const userUsage: Record<string, {
      analysisCount: number;
      clientCount: number;
      lastAnalysis: string | null;
      subscription: any;
    }> = {};

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

    if (STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(STRIPE_SECRET_KEY);

        // Get active subscriptions
        const stripeSubscriptions = await stripe.subscriptions.list({
          status: 'active',
          limit: 100
        });

        revenueData.activeSubscriptions = stripeSubscriptions.data.length;
        
        // Calculate MRR from active subscriptions
        revenueData.mrr = stripeSubscriptions.data.reduce((sum, sub) => {
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
          .filter(c => c.status === 'succeeded')
          .map(c => ({
            id: c.id,
            amount: c.amount / 100,
            currency: c.currency,
            created: new Date(c.created * 1000).toISOString(),
            customerEmail: c.billing_details?.email || c.receipt_email
          }));

        revenueData.totalRevenue = revenueData.charges.reduce(
          (sum, c) => sum + c.amount, 0
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

    return res.status(200).json(stats);

  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: error.message });
  }
}
