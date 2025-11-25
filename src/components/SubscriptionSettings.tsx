import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, CreditCard, Loader2, ExternalLink, Crown } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { createCheckoutSession, createPortalSession } from '@/lib/subscription-service';
import { supabase } from '@/lib/supabase';

export function SubscriptionSettings() {
  const { subscription, loading, isPro } = useSubscription();
  const [loadingAction, setLoadingAction] = useState<'checkout' | 'portal' | null>(null);
  const [totalAnalyses, setTotalAnalyses] = useState<number | null>(null);

  // Load total analyses count
  useState(() => {
    const client = supabase;
    if (!client) return;
    
    client.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      
      // Count total analyses across all clients
      client
        .from('analyses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count }) => {
          setTotalAnalyses(count || 0);
        });
    });
  });

  const handleUpgrade = async () => {
    setLoadingAction('checkout');
    try {
      const url = await createCheckoutSession();
      if (url) {
        window.location.href = url;
      } else {
        alert('Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoadingAction('portal');
    try {
      const url = await createPortalSession();
      if (url) {
        window.location.href = url;
      } else {
        alert('Failed to open subscription portal. Please try again.');
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      alert('Failed to open subscription portal. Please try again.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleForceProUpdate = async () => {
    try {
      const client = supabase;
      if (!client) return;

      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch('/api/admin/force-pro', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('Subscription updated to Pro! Refreshing...');
        window.location.reload();
      } else {
        alert(data.error || 'Failed to update subscription');
      }
    } catch (error) {
      console.error('Error updating to Pro:', error);
      alert('Failed to update subscription');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">Loading subscription...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Subscription
        </CardTitle>
        <CardDescription>
          Manage your subscription and billing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">Current Plan</span>
                {isPro && <Crown className="h-4 w-4 text-yellow-500" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {subscription?.plan === 'pro' ? 'Pro' : 'Free Trial'}
                </span>
                <Badge variant={subscription?.status === 'active' ? 'default' : 'secondary'}>
                  {subscription?.status || 'trialing'}
                </Badge>
              </div>
            </div>
            {subscription?.plan === 'pro' && subscription?.status === 'active' && (
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">$29</div>
                <div className="text-xs text-muted-foreground">per month</div>
              </div>
            )}
          </div>

          {/* Cancel at period end warning */}
          {subscription?.cancelAtPeriodEnd && subscription?.currentPeriodEnd && (
            <div className="text-sm text-amber-600 dark:text-amber-500">
              Your subscription will end on{' '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Usage Stats */}
        {subscription?.plan === 'free' && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="text-sm font-medium">Free Trial Limits</div>
            <div className="text-sm text-muted-foreground">
              3 analyses per patient
            </div>
            {totalAnalyses !== null && (
              <div className="text-xs text-muted-foreground">
                Total analyses created: {totalAnalyses}
              </div>
            )}
          </div>
        )}

        {isPro && (
          <div className="p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 rounded-lg border border-violet-500/20 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Crown className="h-4 w-4 text-yellow-500" />
              Pro Benefits Active
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Unlimited analyses per patient</li>
              <li>✓ Full biomarker history & trends</li>
              <li>✓ Priority processing</li>
            </ul>
            {totalAnalyses !== null && (
              <div className="text-xs text-muted-foreground pt-2 border-t border-violet-500/20">
                Total analyses created: {totalAnalyses}
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-4 border-t">
          {subscription?.plan === 'free' ? (
            <Button
              onClick={handleUpgrade}
              className="w-full gap-2"
              size="lg"
              disabled={loadingAction === 'checkout'}
            >
              {loadingAction === 'checkout' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting to checkout...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Upgrade to Pro
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleManageSubscription}
              variant="outline"
              className="w-full gap-2"
              disabled={loadingAction === 'portal'}
            >
              {loadingAction === 'portal' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Opening portal...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Manage Subscription
                  <ExternalLink className="h-3 w-3 ml-auto" />
                </>
              )}
            </Button>
          )}
        </div>

        {/* Billing Portal Link */}
        {isPro && (
          <div className="text-xs text-muted-foreground text-center">
            Update payment method, view invoices, or cancel subscription
          </div>
        )}

        {/* Free trial info */}
        {subscription?.plan === 'free' && (
          <div className="text-xs text-muted-foreground text-center">
            Cancel anytime. Secure payment powered by Stripe.
          </div>
        )}

        {/* TESTING ONLY: Force Pro Update */}
        {subscription?.plan === 'free' && (
          <div className="pt-4 border-t border-dashed border-amber-500/50">
            <div className="text-xs text-amber-600 dark:text-amber-500 mb-2 text-center">
              ⚠️ Testing Tool - Remove Before Production
            </div>
            <Button
              onClick={handleForceProUpdate}
              variant="outline"
              size="sm"
              className="w-full border-amber-500/50 hover:bg-amber-500/10"
            >
              🔧 Force Update to Pro (Testing Only)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
