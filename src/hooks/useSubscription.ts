import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Subscription {
  plan: 'free' | 'pro';
  status: 'trialing' | 'active' | 'canceled' | 'past_due';
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  loading: boolean;
  isPro: boolean;
  isTrialing: boolean;
  refetch: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    // Check if auth is disabled
    const authDisabled = import.meta.env.VITE_AUTH_DISABLED === 'true';
    
    if (authDisabled || !supabase) {
      // When auth is disabled, treat as free trial (NOT auto-upgrade to Pro)
      // This prevents bypassing paywall by disabling Supabase
      setSubscription({
        plan: 'free',
        status: 'trialing',
      });
      setLoading(false);
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setSubscription(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No subscription found - create default
          const { data: newSub, error: insertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: user.id,
              status: 'trialing',
              plan: 'free',
            })
            .select()
            .single();

          if (!insertError && newSub) {
            setSubscription({
              plan: newSub.plan,
              status: newSub.status,
              currentPeriodEnd: newSub.current_period_end ? new Date(newSub.current_period_end) : undefined,
              cancelAtPeriodEnd: newSub.cancel_at_period_end,
              stripeCustomerId: newSub.stripe_customer_id,
              stripeSubscriptionId: newSub.stripe_subscription_id,
            });
          }
        } else {
          console.error('Error fetching subscription:', error);
        }
        setLoading(false);
        return;
      }

      if (data) {
        setSubscription({
          plan: data.plan,
          status: data.status,
          currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : undefined,
          cancelAtPeriodEnd: data.cancel_at_period_end,
          stripeCustomerId: data.stripe_customer_id,
          stripeSubscriptionId: data.stripe_subscription_id,
        });
      }
    } catch (error) {
      console.error('Error in fetchSubscription:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();

    // Skip realtime subscription if auth is disabled or supabase not configured
    const authDisabled = import.meta.env.VITE_AUTH_DISABLED === 'true';
    if (authDisabled || !supabase) {
      return;
    }

    // Subscribe to realtime updates
    // supabase is guaranteed non-null here due to check above
    const supabaseClient = supabase!;
    const channel = supabaseClient
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
        },
        (payload) => {
          // Only update if it's the current user's subscription
          supabaseClient.auth.getUser().then(({ data: { user } }) => {
            if (user && payload.new && (payload.new as any).user_id === user.id) {
              fetchSubscription();
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, []);

  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';
  const isTrialing = subscription?.status === 'trialing' || subscription?.plan === 'free';

  return {
    subscription,
    loading,
    isPro,
    isTrialing,
    refetch: fetchSubscription,
  };
}
