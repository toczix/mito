-- ============================================
-- MIGRATION: Add percentage ranges to WBC differential biomarkers
-- ============================================
-- This migration updates the 5 white blood cell differential biomarkers
-- to include both percentage ranges (primary) and absolute count ranges (secondary)
-- 
-- Run this against your Supabase database to update existing benchmarks
-- ============================================

-- Update Basophils
UPDATE custom_benchmarks 
SET 
  male_range = '0-1 % (≤ 0.09 ×10³/µL)',
  female_range = '0-1 % (≤ 0.09 ×10³/µL)',
  units = ARRAY['%', '×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'],
  updated_at = NOW()
WHERE name = 'Basophils';

-- Update Eosinophils
UPDATE custom_benchmarks 
SET 
  male_range = '1-4 % (0.0-0.3 ×10³/µL)',
  female_range = '1-4 % (0.0-0.3 ×10³/µL)',
  units = ARRAY['%', '×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'],
  updated_at = NOW()
WHERE name = 'Eosinophils';

-- Update Lymphocytes
UPDATE custom_benchmarks 
SET 
  male_range = '20-40 % (1.1-3.1 ×10³/µL)',
  female_range = '20-40 % (1.1-3.1 ×10³/µL)',
  units = ARRAY['%', '×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'],
  updated_at = NOW()
WHERE name = 'Lymphocytes';

-- Update Monocytes
UPDATE custom_benchmarks 
SET 
  male_range = '2-8 % (0.3-0.5 ×10³/µL)',
  female_range = '2-8 % (0.3-0.5 ×10³/µL)',
  units = ARRAY['%', '×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'],
  updated_at = NOW()
WHERE name = 'Monocytes';

-- Update Neutrophils
UPDATE custom_benchmarks 
SET 
  male_range = '40-70 % (3.0-4.5 ×10³/µL)',
  female_range = '40-70 % (3.0-4.5 ×10³/µL)',
  units = ARRAY['%', '×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'],
  updated_at = NOW()
WHERE name = 'Neutrophils';

-- Verify the updates
SELECT name, male_range, female_range, units 
FROM custom_benchmarks 
WHERE name IN ('Basophils', 'Eosinophils', 'Lymphocytes', 'Monocytes', 'Neutrophils')
ORDER BY name;

-- ============================================
-- ✅ MIGRATION COMPLETE!
-- ============================================
-- All 5 WBC differential biomarkers now support both percentage and absolute count ranges
-- Existing analyses will still show old ranges (they are snapshots at analysis time)
-- New analyses will use the updated ranges
-- ============================================

