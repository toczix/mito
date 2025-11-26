-- Add pro_override columns to subscriptions table
-- This allows admins to grant free Pro access to users

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS pro_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pro_override_until TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN subscriptions.pro_override IS 'When true, user has free Pro access granted by admin';
COMMENT ON COLUMN subscriptions.pro_override_until IS 'Expiration date for the free Pro access override';
