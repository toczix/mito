-- Mito Analysis - Supabase Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (practitioners)
CREATE TABLE IF NOT EXISTS practitioners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys table (encrypted storage)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL DEFAULT 'claude',
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(practitioner_id, service_name)
);

-- Custom Benchmarks table
CREATE TABLE IF NOT EXISTS custom_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  male_range TEXT,
  female_range TEXT,
  units TEXT[] DEFAULT '{}',
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analyses table (biomarker results)
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  results JSONB NOT NULL,
  pdf_files TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_practitioner ON api_keys(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_custom_benchmarks_practitioner ON custom_benchmarks(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_clients_practitioner ON clients(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_analyses_practitioner ON analyses(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_analyses_client ON analyses(client_id);
CREATE INDEX IF NOT EXISTS idx_analyses_date ON analyses(analysis_date DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Practitioners: Users can only see their own data
CREATE POLICY "Users can view own practitioner data"
  ON practitioners FOR SELECT
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own practitioner data"
  ON practitioners FOR UPDATE
  USING (auth.uid()::text = id::text);

-- API Keys: Users can only access their own API keys
CREATE POLICY "Users can view own API keys"
  ON api_keys FOR SELECT
  USING (practitioner_id::text = auth.uid()::text);

CREATE POLICY "Users can insert own API keys"
  ON api_keys FOR INSERT
  WITH CHECK (practitioner_id::text = auth.uid()::text);

CREATE POLICY "Users can update own API keys"
  ON api_keys FOR UPDATE
  USING (practitioner_id::text = auth.uid()::text);

CREATE POLICY "Users can delete own API keys"
  ON api_keys FOR DELETE
  USING (practitioner_id::text = auth.uid()::text);

-- Custom Benchmarks: Users can only access their own benchmarks
CREATE POLICY "Users can view own benchmarks"
  ON custom_benchmarks FOR SELECT
  USING (practitioner_id::text = auth.uid()::text);

CREATE POLICY "Users can insert own benchmarks"
  ON custom_benchmarks FOR INSERT
  WITH CHECK (practitioner_id::text = auth.uid()::text);

CREATE POLICY "Users can update own benchmarks"
  ON custom_benchmarks FOR UPDATE
  USING (practitioner_id::text = auth.uid()::text);

CREATE POLICY "Users can delete own benchmarks"
  ON custom_benchmarks FOR DELETE
  USING (practitioner_id::text = auth.uid()::text);

-- Clients: Users can only access their own clients
CREATE POLICY "Users can view own clients"
  ON clients FOR SELECT
  USING (practitioner_id::text = auth.uid()::text);

CREATE POLICY "Users can insert own clients"
  ON clients FOR INSERT
  WITH CHECK (practitioner_id::text = auth.uid()::text);

CREATE POLICY "Users can update own clients"
  ON clients FOR UPDATE
  USING (practitioner_id::text = auth.uid()::text);

CREATE POLICY "Users can delete own clients"
  ON clients FOR DELETE
  USING (practitioner_id::text = auth.uid()::text);

-- Analyses: Users can only access their own analyses
CREATE POLICY "Users can view own analyses"
  ON analyses FOR SELECT
  USING (practitioner_id::text = auth.uid()::text);

CREATE POLICY "Users can insert own analyses"
  ON analyses FOR INSERT
  WITH CHECK (practitioner_id::text = auth.uid()::text);

CREATE POLICY "Users can update own analyses"
  ON analyses FOR UPDATE
  USING (practitioner_id::text = auth.uid()::text);

CREATE POLICY "Users can delete own analyses"
  ON analyses FOR DELETE
  USING (practitioner_id::text = auth.uid()::text);

-- Function to automatically create practitioner on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO practitioners (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create practitioner on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_practitioners_updated_at BEFORE UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_benchmarks_updated_at BEFORE UPDATE ON custom_benchmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analyses_updated_at BEFORE UPDATE ON analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

