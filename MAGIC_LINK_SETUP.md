# Magic Link Authentication Setup Guide

## ✅ Completed Steps
1. ✅ Supabase project created
2. ✅ Environment variables configured in Replit
3. ✅ Authentication enabled

## 📋 Next Steps - Run This SQL in Supabase

### Step 1: Configure Email Settings (IMPORTANT!)

Before running the SQL, you need to enable email authentication:

1. Go to your Supabase Dashboard: https://dfgadsjqofgkrclpwgkf.supabase.co
2. Navigate to **Authentication → Providers**
3. Find **Email** in the list
4. Click to expand it
5. Toggle **Enable Email provider** to ON
6. Click **Save**

**Email Template Configuration:**
- The default magic link email template works fine
- You can customize it later under **Authentication → Email Templates**

### Step 2: Run the Database Migration

1. In your Supabase Dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy and paste the ENTIRE SQL script below
4. Click **Run** (or press Ctrl/Cmd + Enter)

```sql
-- ============================================================================
-- MITO AUTHENTICATION SETUP
-- This creates all tables and security policies for magic link auth
-- ============================================================================

BEGIN;

-- 1. Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past')),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

-- 2. Create analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  lab_test_date DATE,
  analysis_date TIMESTAMPTZ DEFAULT NOW(),
  results JSONB NOT NULL,
  summary JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_client_id ON analyses(client_id);
CREATE INDEX IF NOT EXISTS idx_analyses_date ON analyses(analysis_date DESC);

-- 3. Create custom_benchmarks table
CREATE TABLE IF NOT EXISTS custom_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  male_range TEXT,
  female_range TEXT,
  units TEXT[] DEFAULT '{}',
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_user_id ON custom_benchmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_active ON custom_benchmarks(is_active);

-- 4. Create settings table
CREATE TABLE IF NOT EXISTS settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  language TEXT DEFAULT 'en',
  claude_api_key TEXT,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- 5. Create audit_logs table
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS Policies for clients
CREATE POLICY "Users can view own clients"
  ON clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients"
  ON clients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients"
  ON clients FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Create RLS Policies for analyses
CREATE POLICY "Users can view own analyses"
  ON analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses"
  ON analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
  ON analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
  ON analyses FOR DELETE
  USING (auth.uid() = user_id);

-- 9. Create RLS Policies for custom_benchmarks
CREATE POLICY "Users can view own benchmarks"
  ON custom_benchmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own benchmarks"
  ON custom_benchmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own benchmarks"
  ON custom_benchmarks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own benchmarks"
  ON custom_benchmarks FOR DELETE
  USING (auth.uid() = user_id);

-- 10. Create RLS Policies for settings
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

-- 11. Create RLS Policies for audit_logs
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 12. Auto-create settings for new users
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

-- 13. Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. Apply updated_at triggers
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_analyses_updated_at ON analyses;
CREATE TRIGGER update_analyses_updated_at
  BEFORE UPDATE ON analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_benchmarks_updated_at ON custom_benchmarks;
CREATE TRIGGER update_benchmarks_updated_at
  BEFORE UPDATE ON custom_benchmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Database setup complete! You can now use magic link authentication.';
END $$;
```

### Step 3: Verify the Setup

After running the SQL, verify everything is working:

1. In the SQL Editor, run this verification query:

```sql
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('clients', 'analyses', 'custom_benchmarks', 'settings', 'audit_logs')
ORDER BY tablename;
```

You should see all 5 tables with `rls_enabled = true`

## 🎉 You're Done!

Magic link authentication is now fully configured! Here's what happens next:

### How to Use Magic Link Login:

1. **Visit your app** (it will show the login page)
2. **Enter your email address** 
3. **Click "Send Magic Link"**
4. **Check your email** for the magic link from Supabase
5. **Click the link** in the email
6. **You'll be automatically logged in!**

### What You Get:

✅ **Passwordless authentication** - No passwords to remember
✅ **Secure sessions** - Auto-refresh tokens, persistent login
✅ **Multi-user support** - Each user sees only their own data
✅ **Data isolation** - Clients, analyses, and benchmarks are private
✅ **Audit logging** - Track all data changes
✅ **Settings sync** - Store your Claude API key securely in the cloud

### Troubleshooting:

**Not receiving emails?**
- Check your spam folder
- In Supabase Dashboard → Authentication → Email Templates, verify SMTP is configured
- For development, check Authentication → Users to see if your account was created

**Login not working?**
- Clear browser cache and cookies
- Make sure you clicked the link from the same browser/device
- Check browser console for errors (F12)

**Need help?**
- Check the Supabase logs: Dashboard → Logs → Auth Logs
- Verify email provider is enabled: Authentication → Providers → Email
