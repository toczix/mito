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

async function getUserSubscription(userId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
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

  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID required' });
    }

    const authHeader = req.headers.authorization as string;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: canAnalyze, error } = await supabase.rpc('can_analyze_client', {
      p_client_id: clientId,
    });

    if (error) {
      console.error('Error checking analysis limit:', error);
      return res.status(500).json({ error: error.message });
    }

    const { data: countData, error: countError } = await supabase.rpc('get_client_analysis_count', {
      p_client_id: clientId,
    });

    const currentCount = countError ? 0 : (countData || 0);
    const subscription = await getUserSubscription(user.id);
    
    // Check if user has Pro access via paid subscription OR admin override
    const hasPaidPro = subscription?.plan === 'pro' && subscription?.status === 'active';
    const hasProOverride = subscription?.pro_override && 
      subscription?.pro_override_until && 
      new Date(subscription.pro_override_until) > new Date();
    const isPro = hasPaidPro || hasProOverride;

    return res.status(200).json({
      allowed: canAnalyze === true,
      currentCount,
      limit: isPro ? null : 3,
      isPro,
    });
  } catch (error: any) {
    console.error('Error checking can analyze:', error);
    return res.status(500).json({ error: error.message });
  }
}
