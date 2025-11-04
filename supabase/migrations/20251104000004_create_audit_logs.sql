-- Create Audit Logging System
-- Tracks important user actions and system events for security and compliance

BEGIN;

-- ============================================================================
-- CREATE AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who performed the action
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,

  -- What action was performed
  action TEXT NOT NULL, -- e.g., 'login', 'logout', 'create_client', 'update_analysis'
  resource_type TEXT, -- e.g., 'client', 'analysis', 'benchmark', 'settings'
  resource_id UUID, -- ID of the affected resource

  -- Action details
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'error')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context (IP, user agent, etc.)

  -- When it happened
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Indexes for performance
  CONSTRAINT audit_logs_action_check CHECK (char_length(action) > 0)
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);

-- ============================================================================
-- ENABLE RLS ON AUDIT LOGS
-- ============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only allow users to view their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert audit logs (application does the logging)
-- This policy allows inserts from authenticated users for their own actions
CREATE POLICY "Users can insert own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE allowed (audit logs are immutable)
-- This ensures audit trail integrity

COMMENT ON TABLE audit_logs IS 'Immutable audit trail of user actions and system events';
COMMENT ON COLUMN audit_logs.action IS 'Action performed (e.g., login, create_client, update_analysis)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected (client, analysis, etc.)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the affected resource';
COMMENT ON COLUMN audit_logs.status IS 'Outcome of the action (success, failure, error)';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context like IP address, user agent, changes made, etc.';

-- ============================================================================
-- CREATE AUDIT LOG FUNCTIONS
-- ============================================================================

-- Function to log authentication events
CREATE OR REPLACE FUNCTION log_auth_event(
  p_user_id UUID,
  p_action TEXT,
  p_status TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
  user_email_val TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email_val
  FROM auth.users
  WHERE id = p_user_id;

  -- Insert audit log
  INSERT INTO audit_logs (
    user_id,
    user_email,
    action,
    resource_type,
    status,
    metadata
  ) VALUES (
    p_user_id,
    user_email_val,
    p_action,
    'auth',
    p_status,
    p_metadata
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log database operations
CREATE OR REPLACE FUNCTION log_database_operation(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
  user_email_val TEXT;
BEGIN
  -- Get user email
  SELECT email INTO user_email_val
  FROM auth.users
  WHERE id = p_user_id;

  -- Insert audit log
  INSERT INTO audit_logs (
    user_id,
    user_email,
    action,
    resource_type,
    resource_id,
    status,
    error_message,
    metadata
  ) VALUES (
    p_user_id,
    user_email_val,
    p_action,
    p_resource_type,
    p_resource_id,
    p_status,
    p_error_message,
    p_metadata
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGERS FOR AUTOMATIC AUDIT LOGGING
-- ============================================================================

-- Function to automatically log client changes
CREATE OR REPLACE FUNCTION audit_client_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();

  IF (TG_OP = 'INSERT') THEN
    PERFORM log_database_operation(
      current_user_id,
      'create_client',
      'client',
      NEW.id,
      'success',
      NULL,
      jsonb_build_object('client_name', NEW.full_name)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM log_database_operation(
      current_user_id,
      'update_client',
      'client',
      NEW.id,
      'success',
      NULL,
      jsonb_build_object(
        'client_name', NEW.full_name,
        'changes', jsonb_build_object(
          'status', CASE WHEN OLD.status != NEW.status THEN jsonb_build_object('old', OLD.status, 'new', NEW.status) ELSE NULL END
        )
      )
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM log_database_operation(
      current_user_id,
      'delete_client',
      'client',
      OLD.id,
      'success',
      NULL,
      jsonb_build_object('client_name', OLD.full_name)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for client table
CREATE TRIGGER audit_clients_changes
  AFTER INSERT OR UPDATE OR DELETE ON clients
  FOR EACH ROW EXECUTE FUNCTION audit_client_changes();

-- Function to automatically log analysis changes
CREATE OR REPLACE FUNCTION audit_analysis_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();

  IF (TG_OP = 'INSERT') THEN
    PERFORM log_database_operation(
      current_user_id,
      'create_analysis',
      'analysis',
      NEW.id,
      'success',
      NULL,
      jsonb_build_object('client_id', NEW.client_id, 'analysis_date', NEW.analysis_date)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM log_database_operation(
      current_user_id,
      'update_analysis',
      'analysis',
      NEW.id,
      'success',
      NULL,
      jsonb_build_object('client_id', NEW.client_id, 'analysis_date', NEW.analysis_date)
    );
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM log_database_operation(
      current_user_id,
      'delete_analysis',
      'analysis',
      OLD.id,
      'success',
      NULL,
      jsonb_build_object('client_id', OLD.client_id)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for analyses table
CREATE TRIGGER audit_analyses_changes
  AFTER INSERT OR UPDATE OR DELETE ON analyses
  FOR EACH ROW EXECUTE FUNCTION audit_analysis_changes();

-- ============================================================================
-- CREATE HELPER VIEWS FOR AUDIT LOG ANALYSIS
-- ============================================================================

-- View for recent audit activity
CREATE OR REPLACE VIEW recent_audit_activity AS
SELECT
  id,
  user_email,
  action,
  resource_type,
  resource_id,
  status,
  created_at,
  metadata
FROM audit_logs
ORDER BY created_at DESC
LIMIT 100;

-- View for failed actions (security monitoring)
CREATE OR REPLACE VIEW failed_audit_actions AS
SELECT
  id,
  user_email,
  action,
  resource_type,
  status,
  error_message,
  created_at,
  metadata
FROM audit_logs
WHERE status IN ('failure', 'error')
ORDER BY created_at DESC;

COMMENT ON VIEW recent_audit_activity IS 'Most recent 100 audit log entries';
COMMENT ON VIEW failed_audit_actions IS 'Failed or errored actions for security monitoring';

COMMIT;

-- ============================================================================
-- POST-MIGRATION SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AUDIT LOGGING SYSTEM CREATED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '  - audit_logs table with RLS policies';
  RAISE NOTICE '  - Indexes for efficient querying';
  RAISE NOTICE '  - Functions for logging auth and DB operations';
  RAISE NOTICE '  - Automatic triggers for clients and analyses';
  RAISE NOTICE '  - Helper views for audit analysis';
  RAISE NOTICE '';
  RAISE NOTICE 'Audit logging will now automatically track:';
  RAISE NOTICE '  - Client creation, updates, deletions';
  RAISE NOTICE '  - Analysis creation, updates, deletions';
  RAISE NOTICE '  - Authentication events (when integrated)';
  RAISE NOTICE '';
  RAISE NOTICE 'Views available:';
  RAISE NOTICE '  - recent_audit_activity (last 100 events)';
  RAISE NOTICE '  - failed_audit_actions (security monitoring)';
  RAISE NOTICE '========================================';
END $$;
