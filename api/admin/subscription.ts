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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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
    const { userId, plan, override, overrideUntil } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: existing } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (override !== undefined) {
      updateData.pro_override = override;
      updateData.pro_override_until = overrideUntil || null;
      if (override) {
        updateData.plan = 'pro';
        updateData.status = 'active';
      } else if (!existing?.stripe_subscription_id) {
        updateData.plan = 'free';
        updateData.status = 'active';
      }
    }

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

      return res.status(200).json({ message: 'Subscription updated', subscription: data?.[0] });
    } else {
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

      return res.status(200).json({ message: 'Subscription created', subscription: data?.[0] });
    }
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
