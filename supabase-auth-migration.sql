-- =====================================================
-- MITO AUTH MIGRATION
-- Adds user authentication and row-level security
-- =====================================================

-- Step 1: Add user_id columns to all tables
ALTER TABLE clients ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE analyses ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE custom_benchmarks ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE settings ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Step 2: Create indexes for performance
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_analyses_user_id ON analyses(user_id);
CREATE INDEX idx_custom_benchmarks_user_id ON custom_benchmarks(user_id);
CREATE INDEX idx_settings_user_id ON settings(user_id);

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policies

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

-- Step 5: Create a function to initialize user data on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default settings for new user
  INSERT INTO public.settings (id, user_id, claude_api_key, updated_at)
  VALUES (gen_random_uuid(), NEW.id, NULL, NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger to auto-create settings on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- NOTES FOR ADMIN:
-- =====================================================
-- After running this migration:
--
-- 1. Have Chris Voutsas sign up using his email
-- 2. Run the assign-clients.sql script to assign existing clients to him
--
-- To assign clients manually:
-- UPDATE clients SET user_id = '<chris-user-id>' WHERE user_id IS NULL;
-- UPDATE analyses SET user_id = '<chris-user-id>' WHERE user_id IS NULL;
-- UPDATE custom_benchmarks SET user_id = '<chris-user-id>' WHERE user_id IS NULL;
-- =====================================================
