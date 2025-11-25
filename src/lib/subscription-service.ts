import { supabase } from './supabase';

const FREE_TRIAL_LIMIT = 3;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export interface AnalysisLimit {
  allowed: boolean;
  currentCount: number;
  limit: number | null;
  isPro: boolean;
}

/**
 * Get the current analysis count for a specific client
 */
export async function getClientAnalysisCount(clientId: string): Promise<number> {
  // Check if auth is disabled
  const authDisabled = import.meta.env.VITE_AUTH_DISABLED === 'true';
  if (authDisabled || !supabase) {
    return 0;
  }

  try {
    const { count, error } = await supabase
      .from('analyses')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId);

    if (error) {
      console.error('Error counting analyses:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getClientAnalysisCount:', error);
    return 0;
  }
}

/**
 * Check if user can analyze a specific client
 * This calls the backend API which uses the database function
 */
export async function canAnalyzeClient(clientId: string): Promise<AnalysisLimit> {
  // Check if auth is disabled
  const authDisabled = import.meta.env.VITE_AUTH_DISABLED === 'true';
  if (authDisabled) {
    // When explicitly disabled, allow unlimited (single-user mode)
    return {
      allowed: true,
      currentCount: 0,
      limit: null,
      isPro: true,
    };
  }

  // If Supabase is not available, fail closed (don't allow)
  if (!supabase) {
    console.error('Supabase not available - cannot check analysis limits');
    return {
      allowed: false,
      currentCount: 0,
      limit: FREE_TRIAL_LIMIT,
      isPro: false,
    };
  }

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return {
        allowed: false,
        currentCount: 0,
        limit: FREE_TRIAL_LIMIT,
        isPro: false,
      };
    }

    const response = await fetch(`${BACKEND_URL}/api/can-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ clientId }),
    });

    if (!response.ok) {
      console.error('Backend error checking analysis limit');
      // Fallback to local check
      return await canAnalyzeClientLocal(clientId);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in canAnalyzeClient:', error);
    // Fallback to local check
    return await canAnalyzeClientLocal(clientId);
  }
}

/**
 * Local fallback for checking if user can analyze (when backend is unavailable)
 */
async function canAnalyzeClientLocal(clientId: string): Promise<AnalysisLimit> {
  if (!supabase) {
    // Fail closed if Supabase not available
    console.error('Supabase not available - cannot check analysis limits locally');
    return {
      allowed: false,
      currentCount: 0,
      limit: FREE_TRIAL_LIMIT,
      isPro: false,
    };
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        allowed: false,
        currentCount: 0,
        limit: FREE_TRIAL_LIMIT,
        isPro: false,
      };
    }

    // Get subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single();

    if (subError) {
      console.error('Error fetching subscription:', subError);
    }

    const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';

    if (isPro) {
      return {
        allowed: true,
        currentCount: 0,
        limit: null,
        isPro: true,
      };
    }

    // Count analyses for this client
    const currentCount = await getClientAnalysisCount(clientId);

    return {
      allowed: currentCount < FREE_TRIAL_LIMIT,
      currentCount,
      limit: FREE_TRIAL_LIMIT,
      isPro: false,
    };
  } catch (error) {
    console.error('Error in canAnalyzeClientLocal:', error);
    return {
      allowed: false,
      currentCount: 0,
      limit: FREE_TRIAL_LIMIT,
      isPro: false,
    };
  }
}

/**
 * Create a Stripe checkout session
 */
export async function createCheckoutSession(priceId?: string): Promise<string | null> {
  const authDisabled = import.meta.env.VITE_AUTH_DISABLED === 'true';
  if (authDisabled || !supabase) {
    return null;
  }

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('No active session');
      return null;
    }

    const response = await fetch(`${BACKEND_URL}/api/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ priceId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error creating checkout session:', error);
      return null;
    }

    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error('Error in createCheckoutSession:', error);
    return null;
  }
}

/**
 * Create a Stripe customer portal session
 */
export async function createPortalSession(): Promise<string | null> {
  const authDisabled = import.meta.env.VITE_AUTH_DISABLED === 'true';
  if (authDisabled || !supabase) {
    return null;
  }

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('No active session');
      return null;
    }

    const response = await fetch(`${BACKEND_URL}/api/portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error creating portal session:', error);
      return null;
    }

    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error('Error in createPortalSession:', error);
    return null;
  }
}
