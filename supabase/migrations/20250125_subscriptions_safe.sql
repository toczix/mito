-- ============================================================
-- Subscription Management Schema (SAFE VERSION - NO TRIGGER)
-- ============================================================
-- This migration adds subscription tracking WITHOUT enforcement
-- Safe to run in production - won't block any existing functionality

-- ============================================================
-- 1. Subscriptions Table
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'canceled', 'past_due')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);

-- ============================================================
-- 2. Updated At Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. Auto-create Subscription for New Users
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, status, plan)
  VALUES (NEW.id, 'trialing', 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_subscription();

-- ============================================================
-- 4. Row Level Security Policies
-- ============================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
  ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own stripe_customer_id" ON subscriptions;
CREATE POLICY "Users can update own stripe_customer_id"
  ON subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 5. Helper Functions (Pure SQL - for backend use)
-- ============================================================

-- Get analysis count for a client
CREATE OR REPLACE FUNCTION get_client_analysis_count(p_client_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_user_id UUID;
  v_count INT;
  v_client_owner UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;
  
  SELECT user_id INTO v_client_owner
  FROM clients
  WHERE id = p_client_id;
  
  IF v_client_owner IS NULL OR v_client_owner != v_user_id THEN
    RETURN 0;
  END IF;
  
  SELECT COUNT(*) INTO v_count
  FROM analyses
  WHERE client_id = p_client_id
    AND user_id = v_user_id;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can analyze a client
CREATE OR REPLACE FUNCTION can_analyze_client(p_client_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_plan TEXT;
  v_status TEXT;
  v_count INT;
  v_client_owner UUID;
  FREE_TRIAL_LIMIT CONSTANT INT := 3;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT user_id INTO v_client_owner
  FROM clients
  WHERE id = p_client_id;
  
  IF v_client_owner IS NULL OR v_client_owner != v_user_id THEN
    RETURN FALSE;
  END IF;
  
  SELECT plan, status INTO v_plan, v_status
  FROM subscriptions 
  WHERE user_id = v_user_id;
  
  IF v_plan = 'pro' AND v_status = 'active' THEN
    RETURN TRUE;
  END IF;
  
  SELECT COUNT(*) INTO v_count
  FROM analyses
  WHERE client_id = p_client_id
    AND user_id = v_user_id;
  
  RETURN v_count < FREE_TRIAL_LIMIT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. Stripe Configuration Table
-- ============================================================

CREATE TABLE IF NOT EXISTS stripe_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert default price ID placeholder
INSERT INTO stripe_config (key, value, description)
VALUES ('pro_monthly_price_id', 'price_PLACEHOLDER', 'Stripe Price ID for Pro Plan Monthly Subscription')
ON CONFLICT (key) DO NOTHING;

-- RLS for config
ALTER TABLE stripe_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read config" ON stripe_config;
CREATE POLICY "Authenticated users can read config"
  ON stripe_config
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage config" ON stripe_config;
CREATE POLICY "Service role can manage config"
  ON stripe_config
  FOR ALL
  USING (auth.role() = 'service_role');

-- Updated at trigger for config
DROP TRIGGER IF EXISTS stripe_config_updated_at ON stripe_config;
CREATE TRIGGER stripe_config_updated_at
  BEFORE UPDATE ON stripe_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE subscriptions IS 
  'SAFE VERSION: Tracks user subscriptions without enforcement. The BEFORE INSERT trigger is NOT included in this migration for safety. Enforcement can be added later after testing.';

COMMENT ON FUNCTION can_analyze_client(UUID) IS 
  'Returns TRUE if user can analyze a client (Pro or under limit). Used by backend API, not enforced at DB level yet.';

COMMENT ON FUNCTION get_client_analysis_count(UUID) IS 
  'Returns analysis count for a client. Cross-tenant safe.';
