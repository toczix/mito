import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing env vars:', { 
        hasUrl: !!SUPABASE_URL, 
        hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY 
      });
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('Fetching users with admin API...');
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Auth admin error:', authError);
      return res.status(500).json({ error: `Auth error: ${authError.message}` });
    }

    console.log(`Found ${authData?.users?.length || 0} users`);

    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('user_id, plan, status, stripe_customer_id, current_period_end, cancel_at_period_end, pro_override, pro_override_until');

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      // Continue without subscriptions data rather than failing
    }

    const subMap = new Map(
      (subscriptions || []).map((s: any) => [s.user_id, s])
    );

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

    users.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return res.status(200).json({ users });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: `Database error: ${error.message}` });
  }
}
