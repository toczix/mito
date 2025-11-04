-- Fix Settings Table Schema for Multi-Tenancy
-- This migration fixes the settings table to properly support multiple users

BEGIN;

-- Step 1: Drop existing constraints and data (safe because settings are just preferences)
DROP TABLE IF EXISTS settings CASCADE;

-- Step 2: Recreate settings table with proper multi-tenant structure
CREATE TABLE settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  language TEXT DEFAULT 'en',
  claude_api_key TEXT,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Add index for faster lookups
CREATE INDEX idx_settings_user_id ON settings(user_id);

-- Step 4: Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
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

-- Step 6: Create function to auto-create settings for new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO settings (user_id, theme, language)
  VALUES (NEW.id, 'light', 'en')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 8: Add updated_at trigger
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

-- Verification
DO $$
BEGIN
  -- Verify table structure
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'Settings table migration failed: user_id column missing';
  END IF;

  -- Verify RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'settings' AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'Settings table migration failed: RLS not enabled';
  END IF;

  -- Verify policies exist
  IF (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'settings') < 4 THEN
    RAISE EXCEPTION 'Settings table migration failed: RLS policies missing';
  END IF;

  RAISE NOTICE 'Settings table migration completed successfully';
END $$;
