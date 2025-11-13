drop function if exists "public"."create_pre_auth_snapshot"();

drop function if exists "public"."log_auth_event"(p_user_id uuid, p_action text, p_status text, p_metadata jsonb);

drop function if exists "public"."log_database_operation"(p_user_id uuid, p_action text, p_resource_type text, p_resource_id uuid, p_status text, p_error_message text, p_metadata jsonb);

drop index if exists "public"."idx_analyses_analysis_date";

drop index if exists "public"."idx_analyses_client_id";

drop index if exists "public"."idx_clients_email";

drop index if exists "public"."idx_clients_full_name";

drop index if exists "public"."idx_custom_benchmarks_is_active";

drop index if exists "public"."idx_analyses_lab_test_date";

alter table "public"."analyses" alter column "analysis_date" drop not null;

alter table "public"."analyses" alter column "client_id" drop not null;

alter table "public"."analyses" alter column "created_at" drop not null;

alter table "public"."analyses" alter column "results" set not null;

alter table "public"."analyses" alter column "updated_at" drop not null;

alter table "public"."analyses" enable row level security;

alter table "public"."clients" alter column "created_at" drop not null;

alter table "public"."clients" alter column "status" drop not null;

alter table "public"."clients" alter column "updated_at" drop not null;

alter table "public"."clients" enable row level security;

alter table "public"."custom_benchmarks" alter column "created_at" drop not null;

alter table "public"."custom_benchmarks" alter column "is_active" drop not null;

alter table "public"."custom_benchmarks" alter column "updated_at" drop not null;

alter table "public"."custom_benchmarks" enable row level security;

CREATE UNIQUE INDEX custom_benchmarks_name_key ON public.custom_benchmarks USING btree (name);

CREATE INDEX idx_analyses_client ON public.analyses USING btree (client_id);

CREATE INDEX idx_analyses_date ON public.analyses USING btree (analysis_date DESC);

CREATE INDEX idx_clients_name ON public.clients USING btree (full_name);

CREATE INDEX idx_custom_benchmarks_active ON public.custom_benchmarks USING btree (is_active);

CREATE INDEX idx_analyses_lab_test_date ON public.analyses USING btree (lab_test_date DESC);

alter table "public"."custom_benchmarks" add constraint "custom_benchmarks_name_key" UNIQUE using index "custom_benchmarks_name_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.assign_data_to_practitioner(practitioner_email text, include_null_only boolean DEFAULT true)
 RETURNS TABLE(operation text, rows_affected bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  practitioner_user_id UUID;
  clients_updated BIGINT;
  analyses_updated BIGINT;
  benchmarks_updated BIGINT;
  settings_created BIGINT;  -- Changed from BOOLEAN to BIGINT
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
  SELECT 'settings_ensured'::TEXT, settings_created;

  RAISE NOTICE 'Data assignment completed for %', practitioner_email;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.audit_analysis_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.audit_client_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  -- Insert default settings for new user
  INSERT INTO public.settings (user_id, theme, language)
  VALUES (NEW.id, 'light', 'en')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't block user creation
  RAISE WARNING 'Failed to create settings for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.safely_enable_rls()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.verify_auth_migration()
 RETURNS TABLE(check_name text, status text, details text)
 LANGUAGE plpgsql
AS $function$
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
$function$
;


