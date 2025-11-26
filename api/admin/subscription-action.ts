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
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      return res.status(500).json({ error: subError.message });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    switch (action) {
      case 'pause': {
        // Pause subscription in Stripe if exists
        if (subscription?.stripe_subscription_id) {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            pause_collection: {
              behavior: 'void'
            }
          });
        }

        // Update local status
        await supabase
          .from('user_subscriptions')
          .update({
            status: 'paused',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        return res.status(200).json({ message: 'Subscription paused' });
      }

      case 'resume': {
        // Resume subscription in Stripe if exists
        if (subscription?.stripe_subscription_id) {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            pause_collection: null
          });
        }

        // Update local status
        await supabase
          .from('user_subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        return res.status(200).json({ message: 'Subscription resumed' });
      }

      case 'cancel': {
        // Cancel subscription in Stripe immediately
        if (subscription?.stripe_subscription_id) {
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        }

        // Update local status
        await supabase
          .from('user_subscriptions')
          .update({
            status: 'canceled',
            plan: 'free',
            stripe_subscription_id: null,
            pro_override: false,
            pro_override_until: null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        return res.status(200).json({ message: 'Subscription canceled' });
      }

      case 'cancel_at_period_end': {
        // Cancel at end of billing period
        if (subscription?.stripe_subscription_id) {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true
          });
        }

        await supabase
          .from('user_subscriptions')
          .update({
            cancel_at_period_end: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        return res.status(200).json({ message: 'Subscription will cancel at period end' });
      }

      case 'reactivate': {
        // Undo cancel at period end
        if (subscription?.stripe_subscription_id) {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: false
          });
        }

        await supabase
          .from('user_subscriptions')
          .update({
            cancel_at_period_end: false,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        return res.status(200).json({ message: 'Subscription reactivated' });
      }

      case 'refund_last': {
        // Refund the last charge
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

        await stripe.refunds.create({
          charge: lastCharge.id
        });

        return res.status(200).json({ 
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
    return res.status(500).json({ error: error.message });
  }
}
