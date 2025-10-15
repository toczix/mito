-- ============================================
-- MITO ANALYSIS - SUPABASE SETUP
-- ============================================
-- Run this ONCE in your Supabase SQL Editor
-- Safe to run multiple times (won't break anything)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. SETTINGS TABLE (API keys, config)
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  claude_api_key TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings row (if not exists)
INSERT INTO settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. CUSTOM BENCHMARKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS custom_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  male_range TEXT,
  female_range TEXT,
  units TEXT[] DEFAULT '{}',
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. CLIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past')),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. ANALYSES TABLE (biomarker results)
-- ============================================
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  results JSONB NOT NULL,
  summary JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. INDEXES (for performance)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_custom_benchmarks_name ON custom_benchmarks(name);
CREATE INDEX IF NOT EXISTS idx_custom_benchmarks_active ON custom_benchmarks(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(full_name);
CREATE INDEX IF NOT EXISTS idx_analyses_client ON analyses(client_id);
CREATE INDEX IF NOT EXISTS idx_analyses_date ON analyses(analysis_date DESC);

-- ============================================
-- 6. AUTO-UPDATE TIMESTAMPS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_benchmarks_updated_at ON custom_benchmarks;
CREATE TRIGGER update_custom_benchmarks_updated_at BEFORE UPDATE ON custom_benchmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_analyses_updated_at ON analyses;
CREATE TRIGGER update_analyses_updated_at BEFORE UPDATE ON analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. DISABLE ROW LEVEL SECURITY (passwordless)
-- ============================================
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_benchmarks DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE analyses DISABLE ROW LEVEL SECURITY;

-- ============================================
-- ✅ SETUP COMPLETE!
-- ============================================
-- You should see 4 tables in Table Editor:
-- ✓ settings
-- ✓ custom_benchmarks
-- ✓ clients
-- ✓ analyses
-- ============================================

