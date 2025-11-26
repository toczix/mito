-- Claude API Usage Tracking Table
-- Tracks token usage and costs for each API call

CREATE TABLE IF NOT EXISTS claude_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Request info
  model TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  request_type TEXT DEFAULT 'biomarker_extraction',
  
  -- Token usage (from Claude API response)
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  
  -- Cost calculation (in USD cents for precision)
  -- Claude Haiku 4.5: $1.00/M input, $5.00/M output
  input_cost_cents NUMERIC(10,4) GENERATED ALWAYS AS (input_tokens * 0.0001) STORED,
  output_cost_cents NUMERIC(10,4) GENERATED ALWAYS AS (output_tokens * 0.0005) STORED,
  total_cost_cents NUMERIC(10,4) GENERATED ALWAYS AS (input_tokens * 0.0001 + output_tokens * 0.0005) STORED,
  
  -- Context
  file_count INTEGER DEFAULT 1,
  page_count INTEGER DEFAULT 0,
  processing_type TEXT CHECK (processing_type IN ('text', 'vision', 'mixed')),
  
  -- Performance
  duration_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_claude_usage_user_id ON claude_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_claude_usage_created_at ON claude_usage(created_at DESC);

-- RLS policies
ALTER TABLE claude_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own usage" ON claude_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert (for Edge Functions)
CREATE POLICY "Service can insert usage" ON claude_usage
  FOR INSERT WITH CHECK (true);

-- Admins can view all usage
CREATE POLICY "Admins can view all usage" ON claude_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

COMMENT ON TABLE claude_usage IS 'Tracks Claude API token usage and costs for billing and analytics';
