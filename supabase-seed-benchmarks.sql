-- ============================================
-- SEED DEFAULT BIOMARKER BENCHMARKS
-- ============================================
-- Run this AFTER supabase-setup.sql
-- This populates the custom_benchmarks table with default values
-- ============================================

-- Clear existing data (optional - uncomment if you want a fresh start)
-- TRUNCATE TABLE custom_benchmarks CASCADE;

-- Insert all default biomarkers
INSERT INTO custom_benchmarks (name, male_range, female_range, units, category, is_active) VALUES
  ('ALP', '65-100 IU/L', '65-100 IU/L', ARRAY['IU/L', 'U/L'], 'Liver Function', true),
  ('ALT', '13-23 IU/L', '13-23 IU/L', ARRAY['IU/L', 'U/L'], 'Liver Function', true),
  ('AST', '15-25 IU/L', '15-25 IU/L', ARRAY['IU/L', 'U/L'], 'Liver Function', true),
  ('Albumin', '40-50 g/L or 4.0-5.0 g/dL', '40-50 g/L or 4.0-5.0 g/dL', ARRAY['g/L', 'g/dL'], 'Protein', true),
  ('BUN', '4.0-6.9 mmol/L or 11.2-19.3 mg/dL', '4.0-6.9 mmol/L or 11.2-19.3 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Kidney Function', true),
  ('Basophils', '0.0×10³/μL (up to around 0.09)', '0.0×10³/μL (up to around 0.09)', ARRAY['×10³/μL', '×10^3/μL', 'K/μL'], 'White Blood Cells', true),
  ('Bicarbonate', '25-30 mmol/L', '25-30 mmol/L', ARRAY['mmol/L', 'mEq/L'], 'Electrolytes', true),
  ('CO2', '25-30 mmol/L', '25-30 mmol/L', ARRAY['mmol/L', 'mEq/L'], 'Electrolytes', true),
  ('Calcium', '2.3-2.45 mmol/L or 9.22-9.8 mg/dL', '2.3-2.45 mmol/L or 9.22-9.8 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Minerals', true),
  ('Chloride', '100-105 mmol/L', '100-105 mmol/L', ARRAY['mmol/L', 'mEq/L'], 'Electrolytes', true),
  ('Cortisol', '400-600 nmol/L or 14.5-22.0 μg/dL (AM)', '400-600 nmol/L or 14.5-22.0 μg/dL (AM)', ARRAY['nmol/L', 'μg/dL', 'ug/dL'], 'Hormones', true),
  ('Creatinine', '60-100 μmol/L or 0.68-1.13 mg/dL', '60-100 μmol/L or 0.68-1.13 mg/dL', ARRAY['μmol/L', 'umol/L', 'mg/dL'], 'Kidney Function', true),
  ('C-Reactive Protein', '<1.0 mg/L (Low Risk)', '<1.0 mg/L (Low Risk)', ARRAY['mg/L', 'mg/dL'], 'Inflammation', true),
  ('hsCRP', '<1.0 mg/L (Low Risk)', '<1.0 mg/L (Low Risk)', ARRAY['mg/L', 'mg/dL'], 'Inflammation', true),
  ('DHEA-S', '5.5-8.0 μmol/L or 200-300 μg/dL', '5.5-8.0 μmol/L or 200-300 μg/dL', ARRAY['μmol/L', 'umol/L', 'μg/dL', 'ug/dL'], 'Hormones', true),
  ('Eosinophils', '0.0-0.2×10³/μL', '0.0-0.2×10³/μL', ARRAY['×10³/μL', '×10^3/μL', 'K/μL'], 'White Blood Cells', true),
  ('FAI', '40-80%', '40-80%', ARRAY['%'], 'Hormones', true),
  ('Free Androgen Index', '40-80%', '40-80%', ARRAY['%'], 'Hormones', true),
  ('Fasting Glucose', '4.44-5.0 mmol/L or 80-90 mg/dL', '4.44-5.0 mmol/L or 80-90 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Metabolic', true),
  ('Glucose', '4.44-5.0 mmol/L or 80-90 mg/dL', '4.44-5.0 mmol/L or 80-90 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Metabolic', true),
  ('Fasting Insulin', '13-40 pmol/L or 2-6 μg/dL', '13-40 pmol/L or 2-6 μg/dL', ARRAY['pmol/L', 'μg/dL', 'ug/dL', 'mIU/L'], 'Metabolic', true),
  ('Insulin', '13-40 pmol/L or 2-6 μg/dL', '13-40 pmol/L or 2-6 μg/dL', ARRAY['pmol/L', 'μg/dL', 'ug/dL', 'mIU/L'], 'Metabolic', true),
  ('Ferritin', '50-150 μg/L or 50-150 ng/mL', '50-150 μg/L or 50-150 ng/mL', ARRAY['μg/L', 'ug/L', 'ng/mL'], 'Iron Studies', true),
  ('FSH', '2.0-5.0 IU/L', '2.0-5.0 IU/L', ARRAY['IU/L', 'mIU/mL'], 'Hormones', true),
  ('Follicle Stimulating Hormone', '2.0-5.0 IU/L', '2.0-5.0 IU/L', ARRAY['IU/L', 'mIU/mL'], 'Hormones', true),
  ('Free T3', '4.6-6.9 pmol/L or 3.0-4.5 pg/mL', '4.6-6.9 pmol/L or 3.0-4.5 pg/mL', ARRAY['pmol/L', 'pg/mL'], 'Thyroid', true),
  ('FT3', '4.6-6.9 pmol/L or 3.0-4.5 pg/mL', '4.6-6.9 pmol/L or 3.0-4.5 pg/mL', ARRAY['pmol/L', 'pg/mL'], 'Thyroid', true),
  ('Free T4', '13.0-20.0 pmol/L or 1.0-1.55 ng/dL', '13.0-20.0 pmol/L or 1.0-1.55 ng/dL', ARRAY['pmol/L', 'ng/dL'], 'Thyroid', true),
  ('FT4', '13.0-20.0 pmol/L or 1.0-1.55 ng/dL', '13.0-20.0 pmol/L or 1.0-1.55 ng/dL', ARRAY['pmol/L', 'ng/dL'], 'Thyroid', true),
  ('GGT', '10-20 IU/L', '10-20 IU/L', ARRAY['IU/L', 'U/L'], 'Liver Function', true),
  ('Gamma-Glutamyl Transferase', '10-20 IU/L', '10-20 IU/L', ARRAY['IU/L', 'U/L'], 'Liver Function', true),
  ('Globulin', '22-28 g/L or 2.2-2.8 g/dL', '22-28 g/L or 2.2-2.8 g/dL', ARRAY['g/L', 'g/dL'], 'Protein', true),
  ('HBA1C', '5.0-5.3% or 31-34 mmol/mol', '5.0-5.3% or 31-34 mmol/mol', ARRAY['%', 'mmol/mol'], 'Metabolic', true),
  ('HbA1c', '5.0-5.3% or 31-34 mmol/mol', '5.0-5.3% or 31-34 mmol/mol', ARRAY['%', 'mmol/mol'], 'Metabolic', true),
  ('HCT', '0.40-0.54', '0.40-0.54', ARRAY['', 'L/L', '%'], 'Red Blood Cells', true),
  ('Hematocrit', '0.40-0.54', '0.40-0.54', ARRAY['', 'L/L', '%'], 'Red Blood Cells', true),
  ('HDL Cholesterol', '1.29-2.2 mmol/L or 50-85 mg/dL', '1.29-2.2 mmol/L or 50-85 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Lipids', true),
  ('HDL', '1.29-2.2 mmol/L or 50-85 mg/dL', '1.29-2.2 mmol/L or 50-85 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Lipids', true),
  ('Hemoglobin', '145-155 g/L or 14.5-15.5 g/dL', '145-155 g/L or 14.5-15.5 g/dL', ARRAY['g/L', 'g/dL'], 'Red Blood Cells', true),
  ('Haemoglobin', '145-155 g/L or 14.5-15.5 g/dL', '145-155 g/L or 14.5-15.5 g/dL', ARRAY['g/L', 'g/dL'], 'Red Blood Cells', true),
  ('Homocysteine', '6-10 μmol/L', '6-10 μmol/L', ARRAY['μmol/L', 'umol/L'], 'Cardiovascular', true),
  ('Lactate Dehydrogenase', '120-180 IU/L', '120-180 IU/L', ARRAY['IU/L', 'U/L'], 'Enzymes', true),
  ('LDH', '120-180 IU/L', '120-180 IU/L', ARRAY['IU/L', 'U/L'], 'Enzymes', true),
  ('LDL Cholesterol', '2.07-4.4 mmol/L or 80-170 mg/dL', '2.07-4.4 mmol/L or 80-170 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Lipids', true),
  ('LDL', '2.07-4.4 mmol/L or 80-170 mg/dL', '2.07-4.4 mmol/L or 80-170 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Lipids', true),
  ('LH', '2.0-5.0 IU/L', '2.0-5.0 IU/L', ARRAY['IU/L', 'mIU/mL'], 'Hormones', true),
  ('Luteinizing Hormone', '2.0-5.0 IU/L', '2.0-5.0 IU/L', ARRAY['IU/L', 'mIU/mL'], 'Hormones', true),
  ('Lymphocytes', '1.5-2.8×10³/μL', '1.5-2.8×10³/μL', ARRAY['×10³/μL', '×10^3/μL', 'K/μL'], 'White Blood Cells', true),
  ('Magnesium', '0.85-1.0 mmol/L or 2.0-2.4 mg/dL', '0.85-1.0 mmol/L or 2.0-2.4 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Minerals', true),
  ('MCH', '27-34 pg', '27-34 pg', ARRAY['pg'], 'Red Blood Cells', true),
  ('MCHC', '320-360 g/L', '320-360 g/L', ARRAY['g/L', 'g/dL'], 'Red Blood Cells', true),
  ('MCV', '82-89 fL', '82-89 fL', ARRAY['fL'], 'Red Blood Cells', true),
  ('Neutrophils', '2.0-4.0×10³/μL', '2.0-4.0×10³/μL', ARRAY['×10³/μL', '×10^3/μL', 'K/μL'], 'White Blood Cells', true),
  ('Phosphate', '0.9-1.3 mmol/L or 2.7-4.0 mg/dL', '0.9-1.3 mmol/L or 2.7-4.0 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Minerals', true),
  ('Potassium', '4.0-4.5 mmol/L', '4.0-4.5 mmol/L', ARRAY['mmol/L', 'mEq/L'], 'Electrolytes', true),
  ('Prolactin', '100-250 mIU/L or 4.7-11.8 ng/mL', '100-250 mIU/L or 4.7-11.8 ng/mL', ARRAY['mIU/L', 'ng/mL'], 'Hormones', true),
  ('RBC', '4.2-4.9×10¹²/L', '4.2-4.9×10¹²/L', ARRAY['×10¹²/L', '×10^12/L', 'M/μL'], 'Red Blood Cells', true),
  ('Red Blood Cell Count', '4.2-4.9×10¹²/L', '4.2-4.9×10¹²/L', ARRAY['×10¹²/L', '×10^12/L', 'M/μL'], 'Red Blood Cells', true),
  ('RDW', '10.0-17.0%', '10.0-17.0%', ARRAY['%'], 'Red Blood Cells', true),
  ('SHBG', '40-50 nmol/L', '40-50 nmol/L', ARRAY['nmol/L'], 'Hormones', true),
  ('Sex Hormone Binding Globulin', '40-50 nmol/L', '40-50 nmol/L', ARRAY['nmol/L'], 'Hormones', true),
  ('Sodium', '137-143 mmol/L', '137-143 mmol/L', ARRAY['mmol/L', 'mEq/L'], 'Electrolytes', true),
  ('Serum Iron', '14.3-23.2 μmol/L', '14.3-23.2 μmol/L', ARRAY['μmol/L', 'umol/L', 'μg/dL', 'ug/dL'], 'Iron Studies', true),
  ('Iron', '14.3-23.2 μmol/L', '14.3-23.2 μmol/L', ARRAY['μmol/L', 'umol/L', 'μg/dL', 'ug/dL'], 'Iron Studies', true),
  ('TIBC', '44-62 μmol/L or 250-350 mg/dL', '44-62 μmol/L or 250-350 mg/dL', ARRAY['μmol/L', 'umol/L', 'mg/dL'], 'Iron Studies', true),
  ('Total Iron Binding Capacity', '44-62 μmol/L or 250-350 mg/dL', '44-62 μmol/L or 250-350 mg/dL', ARRAY['μmol/L', 'umol/L', 'mg/dL'], 'Iron Studies', true),
  ('Testosterone', '22-30 nmol/L or 635-865 ng/dL', '22-30 nmol/L or 635-865 ng/dL', ARRAY['nmol/L', 'ng/dL'], 'Hormones', true),
  ('Total Testosterone', '22-30 nmol/L or 635-865 ng/dL', '22-30 nmol/L or 635-865 ng/dL', ARRAY['nmol/L', 'ng/dL'], 'Hormones', true),
  ('Total Bilirubin', '5-13.6 μmol/L or 0.29-0.8 mg/dL', '5-13.6 μmol/L or 0.29-0.8 mg/dL', ARRAY['μmol/L', 'umol/L', 'mg/dL'], 'Liver Function', true),
  ('Bilirubin', '5-13.6 μmol/L or 0.29-0.8 mg/dL', '5-13.6 μmol/L or 0.29-0.8 mg/dL', ARRAY['μmol/L', 'umol/L', 'mg/dL'], 'Liver Function', true),
  ('Total Cholesterol', '4.2-6.4 mmol/L or 162-240 mg/dL', '4.2-6.4 mmol/L or 162-240 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Lipids', true),
  ('Cholesterol', '4.2-6.4 mmol/L or 162-240 mg/dL', '4.2-6.4 mmol/L or 162-240 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Lipids', true),
  ('Total Protein', '62-78 g/L or 6.2-7.8 g/dL', '62-78 g/L or 6.2-7.8 g/dL', ARRAY['g/L', 'g/dL'], 'Protein', true),
  ('TPO Antibodies', 'Refer to lab specific reference range', 'Refer to lab specific reference range', ARRAY['IU/mL', 'U/mL'], 'Thyroid', true),
  ('Thyroid Peroxidase Antibodies', 'Refer to lab specific reference range', 'Refer to lab specific reference range', ARRAY['IU/mL', 'U/mL'], 'Thyroid', true),
  ('Transferrin Saturation', '20-35%', '20-35%', ARRAY['%'], 'Iron Studies', true),
  ('Triglycerides', '0.6-1.0 mmol/L or 53-88.5 mg/dL', '0.6-1.0 mmol/L or 53-88.5 mg/dL', ARRAY['mmol/L', 'mg/dL'], 'Lipids', true),
  ('TSH', '1.0-2.5 mIU/L', '1.0-2.5 mIU/L', ARRAY['mIU/L', 'μIU/mL'], 'Thyroid', true),
  ('Thyroid Stimulating Hormone', '1.0-2.5 mIU/L', '1.0-2.5 mIU/L', ARRAY['mIU/L', 'μIU/mL'], 'Thyroid', true),
  ('Thyroglobulin Antibodies', 'Refer to lab specific reference range', 'Refer to lab specific reference range', ARRAY['IU/mL', 'U/mL'], 'Thyroid', true),
  ('Uric Acid', '200-300 μmol/L or 3.3-5.0 mg/dL', '200-300 μmol/L or 3.3-5.0 mg/dL', ARRAY['μmol/L', 'umol/L', 'mg/dL'], 'Metabolic', true),
  ('Vitamin D', '125-225 nmol/L or 50-90 ng/mL', '125-225 nmol/L or 50-90 ng/mL', ARRAY['nmol/L', 'ng/mL'], 'Vitamins', true),
  ('25 Hydroxy D', '125-225 nmol/L or 50-90 ng/mL', '125-225 nmol/L or 50-90 ng/mL', ARRAY['nmol/L', 'ng/mL'], 'Vitamins', true),
  ('Vitamin B12', '400-800 pmol/L or 540-1085 pg/mL', '400-800 pmol/L or 540-1085 pg/mL', ARRAY['pmol/L', 'pg/mL'], 'Vitamins', true),
  ('WBC', '5.5-7.5×10³/μL', '5.5-7.5×10³/μL', ARRAY['×10³/μL', '×10^3/μL', 'K/μL'], 'White Blood Cells', true),
  ('White Blood Cell Count', '5.5-7.5×10³/μL', '5.5-7.5×10³/μL', ARRAY['×10³/μL', '×10^3/μL', 'K/μL'], 'White Blood Cells', true);

-- ============================================
-- ✅ SEEDING COMPLETE!
-- ============================================
-- You should now see all default biomarkers in custom_benchmarks table
-- Total: 96 biomarker entries (including aliases)
-- ============================================


