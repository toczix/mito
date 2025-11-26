import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
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
    .from('subscriptions')
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
    const userId = user.id;
    const currentSub = await getUserSubscription(userId);

    if (!currentSub) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    if (currentSub.stripe_customer_id) {
      const customer = await stripe.customers.retrieve(currentSub.stripe_customer_id, {
        expand: ['subscriptions'],
      });

      if ('deleted' in customer) {
        return res.status(404).json({ error: 'Customer deleted' });
      }

      const subscriptions = customer.subscriptions?.data || [];
      
      if (subscriptions.length > 0) {
        const stripeSub = subscriptions[0] as any;
        
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

        return res.status(200).json({ 
          message: 'Subscription synced successfully', 
          plan: stripeSub.status === 'active' ? 'pro' : 'free',
          status: stripeSub.status,
        });
      }
    }

    return res.status(200).json({ message: 'No active Stripe subscription found', currentSub });
  } catch (error: any) {
    console.error('Error syncing subscription:', error);
    return res.status(500).json({ error: error.message });
  }
}
