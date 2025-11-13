-- Safe Authentication Enablement Migration
-- This migration enables authentication with comprehensive safety checks

BEGIN;

-- ============================================================================
-- PRE-FLIGHT CHECKS
-- ============================================================================

DO $$
DECLARE
  null_user_clients INTEGER;
  null_user_analyses INTEGER;
  null_user_benchmarks INTEGER;
BEGIN
  -- Check for NULL user_ids in clients
  SELECT COUNT(*) INTO null_user_clients FROM clients WHERE user_id IS NULL;
  IF null_user_clients > 0 THEN
    RAISE WARNING 'Found % clients without user_id - will need assignment', null_user_clients;
  END IF;

  -- Check for NULL user_ids in analyses
  SELECT COUNT(*) INTO null_user_analyses FROM analyses WHERE user_id IS NULL;
  IF null_user_analyses > 0 THEN
    RAISE WARNING 'Found % analyses without user_id - will need assignment', null_user_analyses;
  END IF;

  -- Check for NULL user_ids in custom_benchmarks
  SELECT COUNT(*) INTO null_user_benchmarks FROM custom_benchmarks WHERE user_id IS NULL;
  IF null_user_benchmarks > 0 THEN
    RAISE WARNING 'Found % benchmarks without user_id - will need assignment', null_user_benchmarks;
  END IF;

  RAISE NOTICE 'Pre-flight checks completed';
END $$;

-- ============================================================================
-- VERIFY RLS POLICIES EXIST
-- ============================================================================

DO $$
DECLARE
  clients_policies INTEGER;
  analyses_policies INTEGER;
  benchmarks_policies INTEGER;
BEGIN
  -- Count RLS policies for each table
  SELECT COUNT(*) INTO clients_policies
  FROM pg_policies WHERE tablename = 'clients';

  SELECT COUNT(*) INTO analyses_policies
  FROM pg_policies WHERE tablename = 'analyses';

  SELECT COUNT(*) INTO benchmarks_policies
  FROM pg_policies WHERE tablename = 'custom_benchmarks';

  -- Each table should have 4 policies (SELECT, INSERT, UPDATE, DELETE)
  IF clients_policies < 4 THEN
    RAISE EXCEPTION 'Missing RLS policies for clients table (found %, need 4)', clients_policies;
  END IF;

  IF analyses_policies < 4 THEN
    RAISE EXCEPTION 'Missing RLS policies for analyses table (found %, need 4)', analyses_policies;
  END IF;

  IF benchmarks_policies < 4 THEN
    RAISE EXCEPTION 'Missing RLS policies for custom_benchmarks table (found %, need 4)', benchmarks_policies;
  END IF;

  RAISE NOTICE 'RLS policies verified: clients=%, analyses=%, benchmarks=%',
    clients_policies, analyses_policies, benchmarks_policies;
END $$;

-- ============================================================================
-- CREATE BACKUP FUNCTION (for emergency rollback)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_pre_auth_snapshot()
RETURNS TABLE (
  table_name TEXT,
  total_rows BIGINT,
  null_user_id_rows BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'clients'::TEXT,
         COUNT(*)::BIGINT,
         COUNT(*) FILTER (WHERE user_id IS NULL)::BIGINT
  FROM clients
  UNION ALL
  SELECT 'analyses'::TEXT,
         COUNT(*)::BIGINT,
         COUNT(*) FILTER (WHERE user_id IS NULL)::BIGINT
  FROM analyses
  UNION ALL
  SELECT 'custom_benchmarks'::TEXT,
         COUNT(*)::BIGINT,
         COUNT(*) FILTER (WHERE user_id IS NULL)::BIGINT
  FROM custom_benchmarks;
END;
$$ LANGUAGE plpgsql;

-- Take snapshot
CREATE TEMP TABLE auth_migration_snapshot AS
SELECT * FROM create_pre_auth_snapshot();

-- Log snapshot
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Pre-migration snapshot:';
  FOR rec IN SELECT * FROM auth_migration_snapshot LOOP
    RAISE NOTICE '  % : total=%, null_user_id=%',
      rec.table_name, rec.total_rows, rec.null_user_id_rows;
  END LOOP;
END $$;

-- ============================================================================
-- WARNING: DO NOT ENABLE RLS YET IF DATA HAS NULL USER_IDS
-- ============================================================================

-- This function can be called after assigning all data to users
CREATE OR REPLACE FUNCTION safely_enable_rls()
RETURNS TEXT AS $$
DECLARE
  null_clients INTEGER;
  null_analyses INTEGER;
  null_benchmarks INTEGER;
  result TEXT := '';
BEGIN
  -- Check for NULL user_ids
  SELECT COUNT(*) INTO null_clients FROM clients WHERE user_id IS NULL;
  SELECT COUNT(*) INTO null_analyses FROM analyses WHERE user_id IS NULL;
  SELECT COUNT(*) INTO null_benchmarks FROM custom_benchmarks WHERE user_id IS NULL;

  -- If any NULL user_ids exist, abort
  IF null_clients > 0 OR null_analyses > 0 OR null_benchmarks > 0 THEN
    result := format(
      'ABORT: Cannot enable RLS - found NULL user_ids: clients=%s, analyses=%s, benchmarks=%s. ' ||
      'Please assign all data to users first using assign_data_to_practitioner() function.',
      null_clients, null_analyses, null_benchmarks
    );
    RAISE WARNING '%', result;
    RETURN result;
  END IF;

  -- All data has user_id, safe to enable RLS
  ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
  ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
  ALTER TABLE custom_benchmarks ENABLE ROW LEVEL SECURITY;

  result := 'SUCCESS: RLS enabled on all tables. Data isolation is now active.';
  RAISE NOTICE '%', result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE HELPER FUNCTION TO ASSIGN DATA TO A PRACTITIONER
-- ============================================================================

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
  -- Find practitioner's user_id
  SELECT id INTO practitioner_user_id
  FROM auth.users
  WHERE email = practitioner_email;

  IF practitioner_user_id IS NULL THEN
    RAISE EXCEPTION 'Practitioner with email % not found. Please ensure they have signed up first.', practitioner_email;
  END IF;

  RAISE NOTICE 'Found practitioner: % (user_id: %)', practitioner_email, practitioner_user_id;

  -- Assign clients
  IF include_null_only THEN
    UPDATE clients
    SET user_id = practitioner_user_id
    WHERE user_id IS NULL;
  ELSE
    UPDATE clients
    SET user_id = practitioner_user_id;
  END IF;
  GET DIAGNOSTICS clients_updated = ROW_COUNT;

  -- Assign analyses
  IF include_null_only THEN
    UPDATE analyses
    SET user_id = practitioner_user_id
    WHERE user_id IS NULL;
  ELSE
    UPDATE analyses
    SET user_id = practitioner_user_id;
  END IF;
  GET DIAGNOSTICS analyses_updated = ROW_COUNT;

  -- Assign custom benchmarks
  IF include_null_only THEN
    UPDATE custom_benchmarks
    SET user_id = practitioner_user_id
    WHERE user_id IS NULL;
  ELSE
    UPDATE custom_benchmarks
    SET user_id = practitioner_user_id;
  END IF;
  GET DIAGNOSTICS benchmarks_updated = ROW_COUNT;

  -- Ensure settings record exists
  INSERT INTO settings (user_id, claude_api_key)
  VALUES (practitioner_user_id, NULL)
  ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS settings_created = ROW_COUNT;

  -- Return results
  RETURN QUERY
  SELECT 'clients_assigned'::TEXT, clients_updated
  UNION ALL
  SELECT 'analyses_assigned'::TEXT, analyses_updated
  UNION ALL
  SELECT 'benchmarks_assigned'::TEXT, benchmarks_updated
  UNION ALL
  SELECT 'settings_ensured'::TEXT, settings_created;

  RAISE NOTICE 'Data assignment completed for %', practitioner_email;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE VERIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_auth_migration()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Check 1: RLS enabled
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

  -- Check 2: RLS policies exist
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

  -- Check 3: No NULL user_ids in clients
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

  -- Check 4: No NULL user_ids in analyses
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

  -- Check 5: Trigger exists
  RETURN QUERY
  SELECT
    'User Creation Trigger'::TEXT,
    CASE
      WHEN COUNT(*) > 0 THEN 'PASS'
      ELSE 'FAIL'
    END::TEXT,
    format('%s trigger(s) found', COUNT(*))::TEXT
  FROM pg_trigger
  WHERE tgname = 'on_auth_user_created';

END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Authentication Migration Completed';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: RLS is NOT YET ENABLED to allow data assignment.';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Have practitioners sign up via the app';
  RAISE NOTICE '2. Run: SELECT * FROM assign_data_to_practitioner(''chris@mitobio.co'');';
  RAISE NOTICE '3. Run: SELECT * FROM verify_auth_migration();';
  RAISE NOTICE '4. Run: SELECT safely_enable_rls();';
  RAISE NOTICE '';
  RAISE NOTICE 'Helper functions available:';
  RAISE NOTICE '  - assign_data_to_practitioner(email, include_null_only)';
  RAISE NOTICE '  - safely_enable_rls()';
  RAISE NOTICE '  - verify_auth_migration()';
  RAISE NOTICE '========================================';
END $$;
