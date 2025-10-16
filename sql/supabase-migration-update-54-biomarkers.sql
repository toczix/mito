-- ============================================
-- MIGRATION: UPDATE TO 54 CORE BIOMARKERS
-- ============================================
-- This migration updates the custom_benchmarks table with the exact 54 core biomarkers
-- Run this to update your existing database
-- ============================================

-- First, add a unique constraint on name if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'custom_benchmarks_name_key'
    ) THEN
        ALTER TABLE custom_benchmarks ADD CONSTRAINT custom_benchmarks_name_key UNIQUE (name);
    END IF;
END $$;

-- Clear out old biomarkers that are not in the core 54
-- Comment this out if you want to keep any custom biomarkers you've added
DELETE FROM custom_benchmarks 
WHERE name NOT IN (
  'ALP', 'ALT', 'AST', 'Albumin', 'BUN', 'Basophils', 'Bicarbonate', 'Calcium',
  'Chloride', 'Creatinine', 'Eosinophils', 'Fasting Glucose', 'Fasting Insulin',
  'Ferritin', 'Free T3', 'Free T4', 'GGT', 'Globulin', 'HbA1C', 'HCT',
  'HDL Cholesterol', 'Hemoglobin', 'Homocysteine', 'LDH', 'LDL Cholesterol',
  'Lymphocytes', 'MCH', 'MCHC', 'MCV', 'Monocytes', 'Neutrophils', 'Phosphorus',
  'Platelets', 'Potassium', 'RBC', 'RDW', 'Serum Folate', 'Serum Iron',
  'Serum Magnesium', 'SHBG', 'Sodium', 'TIBC', 'TPO Antibodies', 'TSH',
  'Thyroglobulin Antibodies', 'Total Bilirubin', 'Total Cholesterol', 'Total Protein',
  'Transferrin Saturation %', 'Triglycerides', 'Vitamin B12', 'Vitamin D (25-Hydroxy D)',
  'WBC', 'eGFR'
);

-- Now insert/update all 54 core biomarkers with correct ranges
INSERT INTO custom_benchmarks (name, male_range, female_range, units, category, is_active) VALUES
  ('ALP', '65-100 IU/L', '65-100 IU/L', ARRAY['IU/L', 'U/L'], 'Liver Function', true),
  ('ALT', '13-23 IU/L', '9-19 IU/L', ARRAY['IU/L', 'U/L'], 'Liver Function', true),
  ('AST', '15-25 IU/L', '12-22 IU/L', ARRAY['IU/L', 'U/L'], 'Liver Function', true),
  ('Albumin', '40-50 g/L (4.0-5.0 g/dL)', '40-50 g/L (4.0-5.0 g/dL)', ARRAY['g/L', 'g/dL'], 'Protein', true),
  ('BUN', '4.0-6.9 mmol/L (11.2-19.3 mg/dL)', '4.0-6.9 mmol/L (11.2-19.3 mg/dL)', ARRAY['mmol/L', 'mg/dL'], 'Kidney Function', true),
  ('Basophils', '≤ 0.09 ×10³/µL', '≤ 0.09 ×10³/µL', ARRAY['×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'], 'White Blood Cells', true),
  ('Bicarbonate', '25-30 mmol/L', '25-30 mmol/L', ARRAY['mmol/L', 'mEq/L'], 'Electrolytes', true),
  ('Calcium', '2.3-2.45 mmol/L (9.22-9.8 mg/dL)', '2.3-2.45 mmol/L (9.22-9.8 mg/dL)', ARRAY['mmol/L', 'mg/dL'], 'Minerals', true),
  ('Chloride', '100-105 mmol/L', '100-105 mmol/L', ARRAY['mmol/L', 'mEq/L'], 'Electrolytes', true),
  ('Creatinine', '60-100 µmol/L (0.68-1.13 mg/dL)', '60-100 µmol/L (0.68-1.13 mg/dL)', ARRAY['µmol/L', 'umol/L', 'mg/dL'], 'Kidney Function', true),
  ('Eosinophils', '0.0-0.3 ×10³/µL', '0.0-0.3 ×10³/µL', ARRAY['×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'], 'White Blood Cells', true),
  ('Fasting Glucose', '4.44-5.0 mmol/L (80-90 mg/dL)', '4.44-5.0 mmol/L (80-90 mg/dL)', ARRAY['mmol/L', 'mg/dL'], 'Metabolic', true),
  ('Fasting Insulin', '13-40 pmol/L (2-6 µIU/mL)', '13-40 pmol/L (2-6 µIU/mL)', ARRAY['pmol/L', 'µIU/mL', 'uIU/mL', 'mIU/L'], 'Metabolic', true),
  ('Ferritin', '50-150 µg/L', '50-150 µg/L', ARRAY['µg/L', 'ug/L', 'ng/mL'], 'Iron Studies', true),
  ('Free T3', '3.0-4.5 pg/mL (4.6-6.9 pmol/L)', '3.0-4.5 pg/mL (4.6-6.9 pmol/L)', ARRAY['pg/mL', 'pmol/L'], 'Thyroid', true),
  ('Free T4', '1.0-1.55 ng/dL (13-20 pmol/L)', '1.0-1.55 ng/dL (13-20 pmol/L)', ARRAY['ng/dL', 'pmol/L'], 'Thyroid', true),
  ('GGT', '12-24 IU/L', '12-24 IU/L', ARRAY['IU/L', 'U/L'], 'Liver Function', true),
  ('Globulin', '22-28 g/L (2.2-2.8 g/dL)', '22-28 g/L (2.2-2.8 g/dL)', ARRAY['g/L', 'g/dL'], 'Protein', true),
  ('HbA1C', '5.0-5.3 % (31-34 mmol/mol)', '5.0-5.3 % (31-34 mmol/mol)', ARRAY['%', 'mmol/mol'], 'Metabolic', true),
  ('HCT', '38-48 %', '38-48 %', ARRAY['%', 'L/L'], 'Red Blood Cells', true),
  ('HDL Cholesterol', '1.29-2.2 mmol/L (50-85 mg/dL)', '1.29-2.2 mmol/L (50-85 mg/dL)', ARRAY['mmol/L', 'mg/dL'], 'Lipids', true),
  ('Hemoglobin', '145-155 g/L (14.5-15.5 g/dL)', '135-145 g/L (13.5-14.5 g/dL)', ARRAY['g/L', 'g/dL'], 'Red Blood Cells', true),
  ('Homocysteine', '6-10 µmol/L', '6-10 µmol/L', ARRAY['µmol/L', 'umol/L'], 'Cardiovascular', true),
  ('LDH', '140-200 IU/L', '140-200 IU/L', ARRAY['IU/L', 'U/L'], 'Enzymes', true),
  ('LDL Cholesterol', '2.07-4.4 mmol/L (80-170 mg/dL)', '2.07-4.4 mmol/L (80-170 mg/dL)', ARRAY['mmol/L', 'mg/dL'], 'Lipids', true),
  ('Lymphocytes', '1.1-3.1 ×10³/µL', '1.1-3.1 ×10³/µL', ARRAY['×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'], 'White Blood Cells', true),
  ('MCH', '28-32 pg', '28-32 pg', ARRAY['pg'], 'Red Blood Cells', true),
  ('MCHC', '32-35 g/dL (320-350 g/L)', '32-35 g/dL (320-350 g/L)', ARRAY['g/dL', 'g/L'], 'Red Blood Cells', true),
  ('MCV', '82-89 fL', '82-89 fL', ARRAY['fL'], 'Red Blood Cells', true),
  ('Monocytes', '0.3-0.5 ×10³/µL', '0.3-0.5 ×10³/µL', ARRAY['×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'], 'White Blood Cells', true),
  ('Neutrophils', '3.0-4.5 ×10³/µL', '3.0-4.5 ×10³/µL', ARRAY['×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'], 'White Blood Cells', true),
  ('Phosphorus', '3.0-4.0 mg/dL (0.97-1.29 mmol/L)', '3.0-4.0 mg/dL (0.97-1.29 mmol/L)', ARRAY['mg/dL', 'mmol/L'], 'Minerals', true),
  ('Platelets', '200-300 ×10³/µL', '200-300 ×10³/µL', ARRAY['×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'], 'Blood Cells', true),
  ('Potassium', '4.0-4.5 mmol/L', '4.0-4.5 mmol/L', ARRAY['mmol/L', 'mEq/L'], 'Electrolytes', true),
  ('RBC', '4.2-4.9 ×10¹²/L', '3.9-4.5 ×10¹²/L', ARRAY['×10¹²/L', '×10^12/L', 'M/µL', 'M/uL'], 'Red Blood Cells', true),
  ('RDW', '< 13 %', '< 13 %', ARRAY['%'], 'Red Blood Cells', true),
  ('Serum Folate', '34-59 nmol/L (15-26 ng/mL)', '34-59 nmol/L (15-26 ng/mL)', ARRAY['nmol/L', 'ng/mL'], 'Vitamins', true),
  ('Serum Iron', '14.3-23.2 µmol/L (80-130 µg/dL)', '14.3-23.2 µmol/L (80-130 µg/dL)', ARRAY['µmol/L', 'umol/L', 'µg/dL', 'ug/dL'], 'Iron Studies', true),
  ('Serum Magnesium', '0.9-1.0 mmol/L (2.19-2.43 mg/dL)', '0.9-1.0 mmol/L (2.19-2.43 mg/dL)', ARRAY['mmol/L', 'mg/dL'], 'Minerals', true),
  ('SHBG', '40-50 nmol/L', '50-80 nmol/L', ARRAY['nmol/L'], 'Hormones', true),
  ('Sodium', '137-143 mmol/L', '137-143 mmol/L', ARRAY['mmol/L', 'mEq/L'], 'Electrolytes', true),
  ('TIBC', '44-62 µmol/L (250-350 mg/dL)', '44-62 µmol/L (250-350 mg/dL)', ARRAY['µmol/L', 'umol/L', 'mg/dL', 'µg/dL', 'ug/dL'], 'Iron Studies', true),
  ('TPO Antibodies', 'Refer to lab specific range', 'Refer to lab specific range', ARRAY['IU/mL', 'U/mL'], 'Thyroid', true),
  ('TSH', '1.0-2.5 mIU/L', '1.0-2.5 mIU/L', ARRAY['mIU/L', 'µIU/mL', 'uIU/mL'], 'Thyroid', true),
  ('Thyroglobulin Antibodies', 'Refer to lab specific range', 'Refer to lab specific range', ARRAY['IU/mL', 'U/mL'], 'Thyroid', true),
  ('Total Bilirubin', '5-13.6 µmol/L (0.29-0.8 mg/dL)', '5-13.6 µmol/L (0.29-0.8 mg/dL)', ARRAY['µmol/L', 'umol/L', 'mg/dL'], 'Liver Function', true),
  ('Total Cholesterol', '4.2-6.4 mmol/L (162-240 mg/dL)', '4.2-6.4 mmol/L (162-240 mg/dL)', ARRAY['mmol/L', 'mg/dL'], 'Lipids', true),
  ('Total Protein', '62-78 g/L (6.2-7.8 g/dL)', '62-78 g/L (6.2-7.8 g/dL)', ARRAY['g/L', 'g/dL'], 'Protein', true),
  ('Transferrin Saturation %', '20-35 %', '20-35 %', ARRAY['%'], 'Iron Studies', true),
  ('Triglycerides', '0.6-1.0 mmol/L (53-88.5 mg/dL)', '0.6-1.0 mmol/L (53-88.5 mg/dL)', ARRAY['mmol/L', 'mg/dL'], 'Lipids', true),
  ('Vitamin B12', '350-650 pmol/L (474-880 pg/mL)', '350-650 pmol/L (474-880 pg/mL)', ARRAY['pmol/L', 'pg/mL'], 'Vitamins', true),
  ('Vitamin D (25-Hydroxy D)', '125-225 nmol/L (50-90 ng/mL)', '125-225 nmol/L (50-90 ng/mL)', ARRAY['nmol/L', 'ng/mL'], 'Vitamins', true),
  ('WBC', '5.5-7.5 ×10³/µL', '5.5-7.5 ×10³/µL', ARRAY['×10³/µL', '×10^3/µL', 'K/µL', 'K/uL'], 'White Blood Cells', true),
  ('eGFR', '> 90 mL/min/m² (> 60 if high muscle mass)', '> 90 mL/min/m² (> 60 if high muscle mass)', ARRAY['mL/min/m²', 'mL/min/1.73m2'], 'Kidney Function', true)
ON CONFLICT (name) DO UPDATE SET
  male_range = EXCLUDED.male_range,
  female_range = EXCLUDED.female_range,
  units = EXCLUDED.units,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================
-- ✅ MIGRATION COMPLETE!
-- ============================================
-- Your database now has exactly 54 core biomarkers
-- All gender-specific ranges have been updated
-- Key fixes:
-- - ALT: Male 13-23 IU/L, Female 9-19 IU/L
-- - AST: Male 15-25 IU/L, Female 12-22 IU/L  
-- - GGT: 12-24 IU/L (was 10-20)
-- - Hemoglobin: Male 145-155 g/L, Female 135-145 g/L
-- - RBC: Male 4.2-4.9, Female 3.9-4.5
-- - SHBG: Male 40-50 nmol/L, Female 50-80 nmol/L
-- - Eosinophils: 0.0-0.3 (was 0.0-0.2)
-- - Lymphocytes: 1.1-3.1 (was 1.5-2.8)
-- - Neutrophils: 3.0-4.5 (was 2.0-4.0)
-- - LDH: 140-200 IU/L (was 120-180)
-- - Monocytes: 0.3-0.5 (was different)
-- ============================================

