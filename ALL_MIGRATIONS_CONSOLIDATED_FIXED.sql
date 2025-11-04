-- ============================================================================
-- CONSOLIDATED AUTHENTICATION MIGRATIONS
-- Run this entire file in Supabase SQL Editor
-- ============================================================================
-- Project: Mito Analysis
-- Purpose: Enable authentication with safety checks
-- Date: 2025-11-04
-- ============================================================================

-- MIGRATION 1: Fix Settings Schema
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS settings CASCADE;

CREATE TABLE settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  language TEXT DEFAULT 'en',
  claude_api_key TEXT,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settings_user_id ON settings(user_id);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON settings FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO settings (user_id, theme, language)
  VALUES (NEW.id, 'light', 'en')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Migration 1 of 3 complete: Settings table fixed';
END $$;

-- MIGRATION 2: Safe Authentication Enablement
-- ============================================================================

BEGIN;

-- Pre-flight checks
DO $$
DECLARE
  null_user_clients INTEGER;
  null_user_analyses INTEGER;
  null_user_benchmarks INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_user_clients FROM clients WHERE user_id IS NULL;
  SELECT COUNT(*) INTO null_user_analyses FROM analyses WHERE user_id IS NULL;
  SELECT COUNT(*) INTO null_user_benchmarks FROM custom_benchmarks WHERE user_id IS NULL;

  RAISE NOTICE 'Pre-migration state:';
  RAISE NOTICE '  Clients with NULL user_id: %', null_user_clients;
  RAISE NOTICE '  Analyses with NULL user_id: %', null_user_analyses;
  RAISE NOTICE '  Benchmarks with NULL user_id: %', null_user_benchmarks;
END $$;

-- Helper function to safely enable RLS
CREATE OR REPLACE FUNCTION safely_enable_rls()
RETURNS TEXT AS $$
DECLARE
  null_clients INTEGER;
  null_analyses INTEGER;
  null_benchmarks INTEGER;
  result TEXT := '';
BEGIN
  SELECT COUNT(*) INTO null_clients FROM clients WHERE user_id IS NULL;
  SELECT COUNT(*) INTO null_analyses FROM analyses WHERE user_id IS NULL;
  SELECT COUNT(*) INTO null_benchmarks FROM custom_benchmarks WHERE user_id IS NULL;

  IF null_clients > 0 OR null_analyses > 0 OR null_benchmarks > 0 THEN
    result := format(
      'ABORT: Cannot enable RLS - found NULL user_ids: clients=%s, analyses=%s, benchmarks=%s. ' ||
      'Please assign all data to users first using assign_data_to_practitioner() function.',
      null_clients, null_analyses, null_benchmarks
    );
    RAISE WARNING '%', result;
    RETURN result;
  END IF;

  ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
  ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
  ALTER TABLE custom_benchmarks ENABLE ROW LEVEL SECURITY;

  result := 'SUCCESS: RLS enabled on all tables. Data isolation is now active.';
  RAISE NOTICE '%', result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Helper function to assign data to practitioner
CREATE OR REPLACE FUNCTION assign_data_to_practitioner(
  practitioner_email TEXT,
  include_null_only BOOLEAN DEFAULT true
)
RETURNS TABLE (
  operation TEXT,
  rows_affected BIGINT
) AS $$
DECLARE
  practitioner_user_id UUID;
  clients_updated BIGINT;
  analyses_updated BIGINT;
  benchmarks_updated BIGINT;
  settings_created BOOLEAN;
BEGIN
  SELECT id INTO practitioner_user_id
  FROM auth.users
  WHERE email = practitioner_email;

  IF practitioner_user_id IS NULL THEN
    RAISE EXCEPTION 'Practitioner with email % not found. Please ensure they have signed up first.', practitioner_email;
  END IF;

  RAISE NOTICE 'Found practitioner: % (user_id: %)', practitioner_email, practitioner_user_id;

  IF include_null_only THEN
    UPDATE clients SET user_id = practitioner_user_id WHERE user_id IS NULL;
  ELSE
    UPDATE clients SET user_id = practitioner_user_id;
  END IF;
  GET DIAGNOSTICS clients_updated = ROW_COUNT;

  IF include_null_only THEN
    UPDATE analyses SET user_id = practitioner_user_id WHERE user_id IS NULL;
  ELSE
    UPDATE analyses SET user_id = practitioner_user_id;
  END IF;
  GET DIAGNOSTICS analyses_updated = ROW_COUNT;

  IF include_null_only THEN
    UPDATE custom_benchmarks SET user_id = practitioner_user_id WHERE user_id IS NULL;
  ELSE
    UPDATE custom_benchmarks SET user_id = practitioner_user_id;
  END IF;
  GET DIAGNOSTICS benchmarks_updated = ROW_COUNT;

  INSERT INTO settings (user_id, theme, language)
  VALUES (practitioner_user_id, 'light', 'en')
  ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS settings_created = ROW_COUNT;

  RETURN QUERY
  SELECT 'clients_assigned'::TEXT, clients_updated
  UNION ALL
  SELECT 'analyses_assigned'::TEXT, analyses_updated
  UNION ALL
  SELECT 'benchmarks_assigned'::TEXT, benchmarks_updated
  UNION ALL
  SELECT 'settings_ensured'::TEXT, CASE WHEN settings_created > 0 THEN 1::BIGINT ELSE 0::BIGINT END;

  RAISE NOTICE 'Data assignment completed for %', practitioner_email;
END;
$$ LANGUAGE plpgsql;

-- Verification function
CREATE OR REPLACE FUNCTION verify_auth_migration()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'RLS Enabled'::TEXT,
    CASE
      WHEN COUNT(*) FILTER (WHERE rowsecurity = true) = 4 THEN 'PASS'
      ELSE 'FAIL'
    END::TEXT,
    format('%s/4 tables have RLS enabled', COUNT(*) FILTER (WHERE rowsecurity = true))::TEXT
  FROM pg_tables
  WHERE tablename IN ('clients', 'analyses', 'custom_benchmarks', 'settings');

  RETURN QUERY
  SELECT
    'RLS Policies'::TEXT,
    CASE
      WHEN COUNT(*) >= 16 THEN 'PASS'
      ELSE 'FAIL'
    END::TEXT,
    format('%s/16 policies exist', COUNT(*))::TEXT
  FROM pg_policies
  WHERE tablename IN ('clients', 'analyses', 'custom_benchmarks', 'settings');

  RETURN QUERY
  SELECT
    'Clients user_id'::TEXT,
    CASE
      WHEN COUNT(*) FILTER (WHERE user_id IS NULL) = 0 THEN 'PASS'
      WHEN COUNT(*) = 0 THEN 'PASS (no data)'
      ELSE 'WARN'
    END::TEXT,
    format('%s clients with NULL user_id', COUNT(*) FILTER (WHERE user_id IS NULL))::TEXT
  FROM clients;

  RETURN QUERY
  SELECT
    'Analyses user_id'::TEXT,
    CASE
      WHEN COUNT(*) FILTER (WHERE user_id IS NULL) = 0 THEN 'PASS'
      WHEN COUNT(*) = 0 THEN 'PASS (no data)'
      ELSE 'WARN'
    END::TEXT,
    format('%s analyses with NULL user_id', COUNT(*) FILTER (WHERE user_id IS NULL))::TEXT
  FROM analyses;
END;
$$ LANGUAGE plpgsql;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Migration 2 of 3 complete: Auth helper functions created';
END $$;

-- MIGRATION 3: Audit Logging System
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'error')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT audit_logs_action_check CHECK (char_length(action) > 0)
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Audit function for client changes
CREATE OR REPLACE FUNCTION audit_client_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  user_email_val TEXT;
BEGIN
  current_user_id := auth.uid();
  SELECT email INTO user_email_val FROM auth.users WHERE id = current_user_id;

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, status, metadata)
    VALUES (current_user_id, user_email_val, 'create_client', 'client', NEW.id, 'success',
            jsonb_build_object('client_name', NEW.full_name));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, status, metadata)
    VALUES (current_user_id, user_email_val, 'update_client', 'client', NEW.id, 'success',
            jsonb_build_object('client_name', NEW.full_name));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, status, metadata)
    VALUES (current_user_id, user_email_val, 'delete_client', 'client', OLD.id, 'success',
            jsonb_build_object('client_name', OLD.full_name));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_clients_changes
  AFTER INSERT OR UPDATE OR DELETE ON clients
  FOR EACH ROW EXECUTE FUNCTION audit_client_changes();

-- Audit function for analysis changes
CREATE OR REPLACE FUNCTION audit_analysis_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  user_email_val TEXT;
BEGIN
  current_user_id := auth.uid();
  SELECT email INTO user_email_val FROM auth.users WHERE id = current_user_id;

  IF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, status, metadata)
    VALUES (current_user_id, user_email_val, 'create_analysis', 'analysis', NEW.id, 'success',
            jsonb_build_object('client_id', NEW.client_id));
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, status, metadata)
    VALUES (current_user_id, user_email_val, 'update_analysis', 'analysis', NEW.id, 'success',
            jsonb_build_object('client_id', NEW.client_id));
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, status, metadata)
    VALUES (current_user_id, user_email_val, 'delete_analysis', 'analysis', OLD.id, 'success',
            jsonb_build_object('client_id', OLD.client_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_analyses_changes
  AFTER INSERT OR UPDATE OR DELETE ON analyses
  FOR EACH ROW EXECUTE FUNCTION audit_analysis_changes();

-- Helper views
CREATE OR REPLACE VIEW recent_audit_activity AS
SELECT id, user_email, action, resource_type, resource_id, status, created_at, metadata
FROM audit_logs
ORDER BY created_at DESC
LIMIT 100;

CREATE OR REPLACE VIEW failed_audit_actions AS
SELECT id, user_email, action, resource_type, status, error_message, created_at, metadata
FROM audit_logs
WHERE status IN ('failure', 'error')
ORDER BY created_at DESC;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Migration 3 of 3 complete: Audit logging system created';
END $$;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ALL MIGRATIONS COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Have practitioner sign up: chris@mitobio.co';
  RAISE NOTICE '2. Run: SELECT * FROM assign_data_to_practitioner(''chris@mitobio.co'');';
  RAISE NOTICE '3. Run: SELECT * FROM verify_auth_migration();';
  RAISE NOTICE '4. Run: SELECT safely_enable_rls();';
  RAISE NOTICE '========================================';
END $$;
