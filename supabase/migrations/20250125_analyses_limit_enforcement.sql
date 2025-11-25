-- ============================================================
-- Server-Side Analysis Limit Enforcement
-- ============================================================
-- This migration adds a BEFORE INSERT trigger on the analyses table
-- to enforce subscription limits server-side, preventing client bypasses.

-- ============================================================
-- BEFORE INSERT Trigger on Analyses
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_analysis_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_can_analyze BOOLEAN;
BEGIN
  -- Check if user can analyze this client
  -- This calls the can_analyze_client function which:
  -- 1. Verifies user owns the client (prevents cross-tenant access)
  -- 2. Checks if user is Pro (unlimited) or has analyses remaining
  SELECT can_analyze_client(NEW.client_id) INTO v_can_analyze;
  
  IF NOT v_can_analyze THEN
    RAISE EXCEPTION 'Analysis limit exceeded for this client. Upgrade to Pro for unlimited analyses.'
      USING HINT = 'Free trial allows 3 analyses per patient. Pro plan ($29/month) provides unlimited analyses.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS check_analysis_limit ON analyses;

CREATE TRIGGER check_analysis_limit
  BEFORE INSERT ON analyses
  FOR EACH ROW
  EXECUTE FUNCTION enforce_analysis_limit();

-- ============================================================
-- Comments for Documentation
-- ============================================================

COMMENT ON FUNCTION enforce_analysis_limit() IS 
  'Enforces subscription-based analysis limits. Free users get 3 analyses per client, Pro users get unlimited. Runs before each analysis insert to prevent limit bypasses.';

COMMENT ON TRIGGER check_analysis_limit ON analyses IS 
  'Server-side enforcement of analysis limits based on subscription tier. Cannot be bypassed by client code.';
