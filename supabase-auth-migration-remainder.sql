-- =====================================================
-- MITO AUTH MIGRATION - REMAINDER
-- Completes the authentication migration (safe to re-run)
-- =====================================================

-- Step 1: Add user_id columns (using IF NOT EXISTS-like pattern)
DO $$
BEGIN
  -- Add user_id to analyses if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='analyses' AND column_name='user_id') THEN
    ALTER TABLE analyses ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;

  -- Add user_id to custom_benchmarks if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custom_benchmarks' AND column_name='user_id') THEN
    ALTER TABLE custom_benchmarks ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;

  -- Add user_id to settings if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='user_id') THEN
    ALTER TABLE settings ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Step 2: Create indexes for performance (skip if exists)
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_benchmarks_user_id ON custom_benchmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- Step 3: Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

DROP POLICY IF EXISTS "Users can view own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can insert own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can update own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can delete own analyses" ON analyses;

DROP POLICY IF EXISTS "Users can view own benchmarks" ON custom_benchmarks;
DROP POLICY IF EXISTS "Users can insert own benchmarks" ON custom_benchmarks;
DROP POLICY IF EXISTS "Users can update own benchmarks" ON custom_benchmarks;
DROP POLICY IF EXISTS "Users can delete own benchmarks" ON custom_benchmarks;

DROP POLICY IF EXISTS "Users can view own settings" ON settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON settings;
DROP POLICY IF EXISTS "Users can update own settings" ON settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON settings;

-- Step 5: Create RLS Policies

-- Clients: Users can only see their own clients
CREATE POLICY "Users can view own clients" ON clients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients" ON clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients" ON clients
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients" ON clients
  FOR DELETE USING (auth.uid() = user_id);

-- Analyses: Users can only see analyses for their own clients
CREATE POLICY "Users can view own analyses" ON analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses" ON analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses" ON analyses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses" ON analyses
  FOR DELETE USING (auth.uid() = user_id);

-- Custom Benchmarks: Users can only see their own benchmarks
CREATE POLICY "Users can view own benchmarks" ON custom_benchmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own benchmarks" ON custom_benchmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own benchmarks" ON custom_benchmarks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own benchmarks" ON custom_benchmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Settings: Each user has their own settings
CREATE POLICY "Users can view own settings" ON settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings" ON settings
  FOR DELETE USING (auth.uid() = user_id);

-- Step 6: Create a function to initialize user data on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default settings for new user
  INSERT INTO public.settings (id, user_id, claude_api_key, updated_at)
  VALUES (gen_random_uuid(), NEW.id, NULL, NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create trigger to auto-create settings on user signup (drop first if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Migration complete!
-- =====================================================
