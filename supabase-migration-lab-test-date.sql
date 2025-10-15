-- ============================================
-- MIGRATION: Add lab_test_date to analyses table
-- ============================================
-- Run this ONLY if you already have the database set up
-- and want to add the lab_test_date field
-- ============================================

-- Add the lab_test_date column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'analyses' AND column_name = 'lab_test_date'
  ) THEN
    ALTER TABLE analyses ADD COLUMN lab_test_date DATE;
  END IF;
END $$;

-- Add index for lab_test_date
CREATE INDEX IF NOT EXISTS idx_analyses_lab_test_date ON analyses(lab_test_date DESC);

-- ============================================
-- ✅ MIGRATION COMPLETE!
-- ============================================

