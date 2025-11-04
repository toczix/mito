-- =====================================================
-- DISABLE RLS FOR AUTHENTICATION-DISABLED MODE
-- =====================================================
-- This migration disables Row-Level Security to allow
-- the app to work without authentication

-- Disable RLS on all tables
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE analyses DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_benchmarks DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

