-- Migration: Update WBC Differential Ranges to Use ONLY Absolute Counts
-- Date: 2025-10-18
-- Description: Remove percentage ranges from WBC differentials (Neutrophils, Lymphocytes, 
--              Monocytes, Eosinophils, Basophils) and use ONLY absolute cell counts.
--              This ensures consistency with the extraction logic that prioritizes 
--              absolute counts over percentages.

-- =====================================================================
-- UPDATE WBC DIFFERENTIAL RANGES TO USE ABSOLUTE COUNTS ONLY
-- =====================================================================

-- Update Basophils: Remove percentage, use only absolute count
UPDATE custom_benchmarks
SET 
  male_range = '≤ 0.09 ×10³/µL',
  female_range = '≤ 0.09 ×10³/µL',
  units = ARRAY['×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'],
  updated_at = NOW()
WHERE name = 'Basophils';

-- Update Eosinophils: Remove percentage, use only absolute count
UPDATE custom_benchmarks
SET 
  male_range = '0.0-0.3 ×10³/µL',
  female_range = '0.0-0.3 ×10³/µL',
  units = ARRAY['×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'],
  updated_at = NOW()
WHERE name = 'Eosinophils';

-- Update Lymphocytes: Remove percentage, use only absolute count
UPDATE custom_benchmarks
SET 
  male_range = '1.1-3.1 ×10³/µL',
  female_range = '1.1-3.1 ×10³/µL',
  units = ARRAY['×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'],
  updated_at = NOW()
WHERE name = 'Lymphocytes';

-- Update Monocytes: Remove percentage, use only absolute count
UPDATE custom_benchmarks
SET 
  male_range = '0.3-0.5 ×10³/µL',
  female_range = '0.3-0.5 ×10³/µL',
  units = ARRAY['×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'],
  updated_at = NOW()
WHERE name = 'Monocytes';

-- Update Neutrophils: Remove percentage, use only absolute count
UPDATE custom_benchmarks
SET 
  male_range = '3.0-4.5 ×10³/µL',
  female_range = '3.0-4.5 ×10³/µL',
  units = ARRAY['×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'],
  updated_at = NOW()
WHERE name = 'Neutrophils';

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================

-- Verify the updates
SELECT 
  name,
  male_range,
  female_range,
  units,
  category
FROM custom_benchmarks
WHERE name IN ('Basophils', 'Eosinophils', 'Lymphocytes', 'Monocytes', 'Neutrophils')
ORDER BY name;

-- =====================================================================
-- NOTES
-- =====================================================================
-- 
-- This migration addresses the following:
-- 1. Lab reports often show BOTH percentage and absolute counts for WBC differentials
-- 2. We need absolute counts (×10³/µL, K/µL) for proper health analysis
-- 3. Percentage values can be misleading when total WBC count is abnormal
-- 4. Consistent with updated extraction logic that prioritizes absolute counts
--
-- Example from a typical lab report:
--   Neutrophils: 55% | 3.2 K/µL
--   We now extract: 3.2 K/µL (absolute count) and ignore 55% (percentage)
-- 
-- =====================================================================

