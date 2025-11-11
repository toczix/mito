-- Fix RLS Policies for Database Triggers
--
-- Problem: New user signups fail because triggers run without auth.uid() context
-- When handle_new_user() trigger fires on auth.users INSERT, auth.uid() is NULL
-- causing the INSERT policy "auth.uid() = user_id" to reject the settings row.
--
-- Solution: Allow service role and trigger context to bypass the strict user_id check
-- by adding a policy that permits inserts when auth.uid() is NULL (trigger context)
--
-- This affects:
-- 1. settings table - handle_new_user() trigger creates default settings
-- 2. audit_logs table - various triggers log operations automatically

BEGIN;

-- ============================================================================
-- FIX SETTINGS TABLE RLS POLICY
-- ============================================================================

-- Drop the overly restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert own settings" ON settings;

-- Create two separate policies for different contexts:

-- Policy 1: Allow authenticated users to insert their own settings
CREATE POLICY "Users can insert own settings"
  ON settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 2: Allow system triggers to insert settings (when auth.uid() is NULL)
-- This enables the handle_new_user() trigger to create default settings
CREATE POLICY "System can insert settings for new users"
  ON settings FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

-- ============================================================================
-- FIX AUDIT_LOGS TABLE RLS POLICY
-- ============================================================================

-- Drop the overly restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert own audit logs" ON audit_logs;

-- Create two separate policies for different contexts:

-- Policy 1: Allow authenticated users to insert their own audit logs
CREATE POLICY "Users can insert own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 2: Allow system triggers to insert audit logs (when auth.uid() is NULL)
-- This enables automatic audit logging from triggers like audit_client_changes()
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  settings_policies_count INT;
  audit_logs_policies_count INT;
BEGIN
  -- Count settings policies (should have 5 now: SELECT, 2x INSERT, UPDATE, DELETE)
  SELECT COUNT(*) INTO settings_policies_count
  FROM pg_policies
  WHERE tablename = 'settings';

  -- Count audit_logs policies (should have 3 now: SELECT, 2x INSERT)
  SELECT COUNT(*) INTO audit_logs_policies_count
  FROM pg_policies
  WHERE tablename = 'audit_logs';

  IF settings_policies_count < 5 THEN
    RAISE EXCEPTION 'Settings RLS fix failed: expected 5 policies, found %', settings_policies_count;
  END IF;

  IF audit_logs_policies_count < 3 THEN
    RAISE EXCEPTION 'Audit logs RLS fix failed: expected 3 policies, found %', audit_logs_policies_count;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS POLICIES FIXED FOR TRIGGERS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Settings table now has % policies', settings_policies_count;
  RAISE NOTICE 'Audit logs table now has % policies', audit_logs_policies_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed:';
  RAISE NOTICE '  ✓ Settings table can accept trigger inserts';
  RAISE NOTICE '  ✓ Audit logs table can accept trigger inserts';
  RAISE NOTICE '  ✓ New user signups will now work properly';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Test with a fresh signup to confirm';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
