-- =====================================================
-- DISABLE RLS WHEN AUTH IS DISABLED
-- =====================================================
-- This migration disables Row-Level Security policies
-- to allow the app to work when VITE_AUTH_DISABLED=true
--
-- This runs AFTER the policy migrations, ensuring RLS
-- is completely disabled for development.

BEGIN;

-- Drop all RLS policies on clients table
DROP POLICY IF EXISTS "Users can read own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

-- Drop all RLS policies on analyses table
DROP POLICY IF EXISTS "Users can read own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can insert own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can update own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can delete own analyses" ON analyses;

-- Drop all RLS policies on custom_benchmarks table
DROP POLICY IF EXISTS "Users can read own custom_benchmarks" ON custom_benchmarks;
DROP POLICY IF EXISTS "Users can insert own custom_benchmarks" ON custom_benchmarks;
DROP POLICY IF EXISTS "Users can update own custom_benchmarks" ON custom_benchmarks;
DROP POLICY IF EXISTS "Users can delete own custom_benchmarks" ON custom_benchmarks;

-- Drop all RLS policies on settings table
DROP POLICY IF EXISTS "Users can read own settings" ON settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON settings;
DROP POLICY IF EXISTS "Users can update own settings" ON settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON settings;

-- Disable RLS on all tables
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE analyses DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_benchmarks DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- Make user_id nullable on tables where it's not a primary key
-- (settings table uses user_id as primary key, so we can't make it nullable)
ALTER TABLE clients ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE analyses ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE custom_benchmarks ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  clients_rls_enabled BOOLEAN;
  analyses_rls_enabled BOOLEAN;
  custom_benchmarks_rls_enabled BOOLEAN;
  settings_rls_enabled BOOLEAN;
BEGIN
  -- Check RLS status
  SELECT relrowsecurity INTO clients_rls_enabled
  FROM pg_class WHERE relname = 'clients';

  SELECT relrowsecurity INTO analyses_rls_enabled
  FROM pg_class WHERE relname = 'analyses';

  SELECT relrowsecurity INTO custom_benchmarks_rls_enabled
  FROM pg_class WHERE relname = 'custom_benchmarks';

  SELECT relrowsecurity INTO settings_rls_enabled
  FROM pg_class WHERE relname = 'settings';

  IF clients_rls_enabled OR analyses_rls_enabled OR custom_benchmarks_rls_enabled OR settings_rls_enabled THEN
    RAISE EXCEPTION 'RLS disable failed: one or more tables still have RLS enabled';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS DISABLED FOR AUTH-DISABLED MODE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS Status:';
  RAISE NOTICE '  ✓ clients: DISABLED';
  RAISE NOTICE '  ✓ analyses: DISABLED';
  RAISE NOTICE '  ✓ custom_benchmarks: DISABLED';
  RAISE NOTICE '  ✓ settings: DISABLED';
  RAISE NOTICE '';
  RAISE NOTICE 'user_id columns are now nullable';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
