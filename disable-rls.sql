-- =====================================================
-- DISABLE RLS FOR AUTHENTICATION-DISABLED MODE
-- =====================================================
-- Run this in Supabase Dashboard → SQL Editor
-- This disables Row-Level Security to allow
-- the app to work without authentication

-- Disable RLS on all tables
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE analyses DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_benchmarks DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled (should return false)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('clients', 'analyses', 'custom_benchmarks', 'settings');

