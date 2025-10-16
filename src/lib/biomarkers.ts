export interface Biomarker {
  name: string;
  maleRange: string;
  femaleRange: string;
  units: string[];
  category?: string;
  aliases?: string[]; // Alternative names for this biomarker
}

export interface ExtractedBiomarker {
  name: string;
  value: string;
  unit: string;
  testDate?: string; // YYYY-MM-DD format
}

export interface AnalysisResult {
  biomarkerName: string;
  hisValue: string;
  unit: string;
  optimalRange: string;
  testDate?: string; // YYYY-MM-DD format
}

/**
 * Core 54 biomarkers for Mito Labs analysis
 * These are the ONLY biomarkers that will be shown in the main analysis report
 */
export const BIOMARKERS: Biomarker[] = [
  {
    name: "ALP",
    maleRange: "65-100 IU/L",
    femaleRange: "65-100 IU/L",
    units: ["IU/L", "U/L"],
    category: "Liver Function",
    aliases: ["Alkaline Phosphatase", "Alk Phos", "ALKP"]
  },
  {
    name: "ALT",
    maleRange: "13-23 IU/L",
    femaleRange: "9-19 IU/L",
    units: ["IU/L", "U/L"],
    category: "Liver Function",
    aliases: ["Alanine Aminotransferase", "SGPT", "ALT/SGPT"]
  },
  {
    name: "AST",
    maleRange: "15-25 IU/L",
    femaleRange: "12-22 IU/L",
    units: ["IU/L", "U/L"],
    category: "Liver Function",
    aliases: ["Aspartate Aminotransferase", "SGOT", "AST/SGOT"]
  },
  {
    name: "Albumin",
    maleRange: "40-50 g/L (4.0-5.0 g/dL)",
    femaleRange: "40-50 g/L (4.0-5.0 g/dL)",
    units: ["g/L", "g/dL"],
    category: "Protein",
    aliases: ["Serum Albumin"]
  },
  {
    name: "BUN",
    maleRange: "4.0-6.9 mmol/L (11.2-19.3 mg/dL)",
    femaleRange: "4.0-6.9 mmol/L (11.2-19.3 mg/dL)",
    units: ["mmol/L", "mg/dL"],
    category: "Kidney Function",
    aliases: ["Blood Urea Nitrogen", "Urea Nitrogen", "Urea"]
  },
  {
    name: "Basophils",
    maleRange: "0-1 % (≤ 0.09 ×10³/µL)",
    femaleRange: "0-1 % (≤ 0.09 ×10³/µL)",
    units: ["%", "×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "White Blood Cells",
    aliases: ["Baso", "Basophil Count", "Absolute Basophils"]
  },
  {
    name: "Bicarbonate",
    maleRange: "25-30 mmol/L",
    femaleRange: "25-30 mmol/L",
    units: ["mmol/L", "mEq/L"],
    category: "Electrolytes",
    aliases: ["Carbon Dioxide", "CO2", "Total CO2", "HCO3", "Bicarb"]
  },
  {
    name: "Calcium",
    maleRange: "2.3-2.45 mmol/L (9.22-9.8 mg/dL)",
    femaleRange: "2.3-2.45 mmol/L (9.22-9.8 mg/dL)",
    units: ["mmol/L", "mg/dL"],
    category: "Minerals",
    aliases: ["Serum Calcium", "Total Calcium", "Ca"]
  },
  {
    name: "Chloride",
    maleRange: "100-105 mmol/L",
    femaleRange: "100-105 mmol/L",
    units: ["mmol/L", "mEq/L"],
    category: "Electrolytes",
    aliases: ["Cl", "Serum Chloride"]
  },
  {
    name: "Creatinine",
    maleRange: "60-100 µmol/L (0.68-1.13 mg/dL)",
    femaleRange: "60-100 µmol/L (0.68-1.13 mg/dL)",
    units: ["µmol/L", "umol/L", "mg/dL"],
    category: "Kidney Function",
    aliases: ["Serum Creatinine", "Creat"]
  },
  {
    name: "Eosinophils",
    maleRange: "1-4 % (0.0-0.3 ×10³/µL)",
    femaleRange: "1-4 % (0.0-0.3 ×10³/µL)",
    units: ["%", "×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "White Blood Cells",
    aliases: ["Eos", "Eosinophil Count", "Absolute Eosinophils"]
  },
  {
    name: "Fasting Glucose",
    maleRange: "4.44-5.0 mmol/L (80-90 mg/dL)",
    femaleRange: "4.44-5.0 mmol/L (80-90 mg/dL)",
    units: ["mmol/L", "mg/dL"],
    category: "Metabolic",
    aliases: ["Glucose", "Glucose Fasting", "FBG", "Fasting Blood Glucose", "Blood Glucose"]
  },
  {
    name: "Fasting Insulin",
    maleRange: "13-40 pmol/L (2-6 µIU/mL)",
    femaleRange: "13-40 pmol/L (2-6 µIU/mL)",
    units: ["pmol/L", "µIU/mL", "uIU/mL", "mIU/L"],
    category: "Metabolic",
    aliases: ["Insulin", "Insulin Fasting", "Serum Insulin"]
  },
  {
    name: "Ferritin",
    maleRange: "50-150 µg/L",
    femaleRange: "50-150 µg/L",
    units: ["µg/L", "ug/L", "ng/mL"],
    category: "Iron Studies",
    aliases: ["Serum Ferritin"]
  },
  {
    name: "Free T3",
    maleRange: "3.0-4.5 pg/mL (4.6-6.9 pmol/L)",
    femaleRange: "3.0-4.5 pg/mL (4.6-6.9 pmol/L)",
    units: ["pg/mL", "pmol/L"],
    category: "Thyroid",
    aliases: ["FT3", "Free Triiodothyronine", "Triiodothyronine Free"]
  },
  {
    name: "Free T4",
    maleRange: "1.0-1.55 ng/dL (13-20 pmol/L)",
    femaleRange: "1.0-1.55 ng/dL (13-20 pmol/L)",
    units: ["ng/dL", "pmol/L"],
    category: "Thyroid",
    aliases: ["FT4", "Free Thyroxine", "Thyroxine Free"]
  },
  {
    name: "GGT",
    maleRange: "12-24 IU/L",
    femaleRange: "12-24 IU/L",
    units: ["IU/L", "U/L"],
    category: "Liver Function",
    aliases: ["Gamma-Glutamyl Transferase", "Gamma GT", "Gamma Glutamyl Transpeptidase", "GGTP"]
  },
  {
    name: "Globulin",
    maleRange: "22-28 g/L (2.2-2.8 g/dL)",
    femaleRange: "22-28 g/L (2.2-2.8 g/dL)",
    units: ["g/L", "g/dL"],
    category: "Protein",
    aliases: ["Serum Globulin", "Calculated Globulin"]
  },
  {
    name: "HbA1C",
    maleRange: "5.0-5.3 % (31-34 mmol/mol)",
    femaleRange: "5.0-5.3 % (31-34 mmol/mol)",
    units: ["%", "mmol/mol"],
    category: "Metabolic",
    aliases: ["HbA1c", "Hemoglobin A1C", "A1C", "Glycated Hemoglobin", "Glycohemoglobin"]
  },
  {
    name: "HCT",
    maleRange: "38-48 %",
    femaleRange: "38-48 %",
    units: ["%", "L/L"],
    category: "Red Blood Cells",
    aliases: ["Hematocrit", "HCT", "Hct"]
  },
  {
    name: "HDL Cholesterol",
    maleRange: "1.29-2.2 mmol/L (50-85 mg/dL)",
    femaleRange: "1.29-2.2 mmol/L (50-85 mg/dL)",
    units: ["mmol/L", "mg/dL"],
    category: "Lipids",
    aliases: ["HDL", "HDL-C", "High Density Lipoprotein"]
  },
  {
    name: "Hemoglobin",
    maleRange: "145-155 g/L (14.5-15.5 g/dL)",
    femaleRange: "135-145 g/L (13.5-14.5 g/dL)",
    units: ["g/L", "g/dL"],
    category: "Red Blood Cells",
    aliases: ["Hgb", "Hb", "Haemoglobin"]
  },
  {
    name: "Homocysteine",
    maleRange: "6-10 µmol/L",
    femaleRange: "6-10 µmol/L",
    units: ["µmol/L", "umol/L"],
    category: "Cardiovascular",
    aliases: ["Homocystine", "Plasma Homocysteine"]
  },
  {
    name: "LDH",
    maleRange: "140-200 IU/L",
    femaleRange: "140-200 IU/L",
    units: ["IU/L", "U/L"],
    category: "Enzymes",
    aliases: ["Lactate Dehydrogenase", "LD", "LDH Total"]
  },
  {
    name: "LDL Cholesterol",
    maleRange: "2.07-4.4 mmol/L (80-170 mg/dL)",
    femaleRange: "2.07-4.4 mmol/L (80-170 mg/dL)",
    units: ["mmol/L", "mg/dL"],
    category: "Lipids",
    aliases: ["LDL", "LDL-C", "Low Density Lipoprotein", "LDL Calculated"]
  },
  {
    name: "Lymphocytes",
    maleRange: "20-40 % (1.1-3.1 ×10³/µL)",
    femaleRange: "20-40 % (1.1-3.1 ×10³/µL)",
    units: ["%", "×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "White Blood Cells",
    aliases: ["Lymph", "Lymphocyte Count", "Absolute Lymphocytes"]
  },
  {
    name: "MCH",
    maleRange: "28-32 pg",
    femaleRange: "28-32 pg",
    units: ["pg"],
    category: "Red Blood Cells",
    aliases: ["Mean Corpuscular Hemoglobin", "Mean Cell Hemoglobin"]
  },
  {
    name: "MCHC",
    maleRange: "32-35 g/dL (320-350 g/L)",
    femaleRange: "32-35 g/dL (320-350 g/L)",
    units: ["g/dL", "g/L"],
    category: "Red Blood Cells",
    aliases: ["Mean Corpuscular Hemoglobin Concentration", "Mean Cell Hemoglobin Concentration"]
  },
  {
    name: "MCV",
    maleRange: "82-89 fL",
    femaleRange: "82-89 fL",
    units: ["fL"],
    category: "Red Blood Cells",
    aliases: ["Mean Corpuscular Volume", "Mean Cell Volume"]
  },
  {
    name: "Monocytes",
    maleRange: "2-8 % (0.3-0.5 ×10³/µL)",
    femaleRange: "2-8 % (0.3-0.5 ×10³/µL)",
    units: ["%", "×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "White Blood Cells",
    aliases: ["Mono", "Monocyte Count", "Absolute Monocytes"]
  },
  {
    name: "Neutrophils",
    maleRange: "40-70 % (3.0-4.5 ×10³/µL)",
    femaleRange: "40-70 % (3.0-4.5 ×10³/µL)",
    units: ["%", "×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "White Blood Cells",
    aliases: ["Neut", "Neutrophil Count", "Absolute Neutrophils", "Segmented Neutrophils"]
  },
  {
    name: "Phosphorus",
    maleRange: "3.0-4.0 mg/dL (0.97-1.29 mmol/L)",
    femaleRange: "3.0-4.0 mg/dL (0.97-1.29 mmol/L)",
    units: ["mg/dL", "mmol/L"],
    category: "Minerals",
    aliases: ["Phosphate", "Inorganic Phosphorus", "Serum Phosphorus", "P"]
  },
  {
    name: "Platelets",
    maleRange: "200-300 ×10³/µL",
    femaleRange: "200-300 ×10³/µL",
    units: ["×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "Blood Cells",
    aliases: ["PLT", "Platelet Count", "Thrombocytes"]
  },
  {
    name: "Potassium",
    maleRange: "4.0-4.5 mmol/L",
    femaleRange: "4.0-4.5 mmol/L",
    units: ["mmol/L", "mEq/L"],
    category: "Electrolytes",
    aliases: ["K", "Serum Potassium"]
  },
  {
    name: "RBC",
    maleRange: "4.2-4.9 ×10¹²/L",
    femaleRange: "3.9-4.5 ×10¹²/L",
    units: ["×10¹²/L", "×10^12/L", "M/µL", "M/uL"],
    category: "Red Blood Cells",
    aliases: ["Red Blood Cell Count", "RBC Count", "Erythrocytes"]
  },
  {
    name: "RDW",
    maleRange: "< 13 %",
    femaleRange: "< 13 %",
    units: ["%"],
    category: "Red Blood Cells",
    aliases: ["Red Cell Distribution Width", "RDW-CV", "RDW-SD"]
  },
  {
    name: "Serum Folate",
    maleRange: "34-59 nmol/L (15-26 ng/mL)",
    femaleRange: "34-59 nmol/L (15-26 ng/mL)",
    units: ["nmol/L", "ng/mL"],
    category: "Vitamins",
    aliases: ["Folate", "Folic Acid", "Folate Serum", "Vitamin B9"]
  },
  {
    name: "Serum Iron",
    maleRange: "14.3-23.2 µmol/L (80-130 µg/dL)",
    femaleRange: "14.3-23.2 µmol/L (80-130 µg/dL)",
    units: ["µmol/L", "umol/L", "µg/dL", "ug/dL"],
    category: "Iron Studies",
    aliases: ["Iron", "Fe", "Iron Total"]
  },
  {
    name: "Serum Magnesium",
    maleRange: "0.9-1.0 mmol/L (2.19-2.43 mg/dL)",
    femaleRange: "0.9-1.0 mmol/L (2.19-2.43 mg/dL)",
    units: ["mmol/L", "mg/dL"],
    category: "Minerals",
    aliases: ["Magnesium", "Mg", "Mag"]
  },
  {
    name: "SHBG",
    maleRange: "40-50 nmol/L",
    femaleRange: "50-80 nmol/L",
    units: ["nmol/L"],
    category: "Hormones",
    aliases: ["Sex Hormone Binding Globulin", "Sex Hormone-Binding Globulin"]
  },
  {
    name: "Sodium",
    maleRange: "137-143 mmol/L",
    femaleRange: "137-143 mmol/L",
    units: ["mmol/L", "mEq/L"],
    category: "Electrolytes",
    aliases: ["Na", "Serum Sodium"]
  },
  {
    name: "TIBC",
    maleRange: "44-62 µmol/L (250-350 mg/dL)",
    femaleRange: "44-62 µmol/L (250-350 mg/dL)",
    units: ["µmol/L", "umol/L", "mg/dL", "µg/dL", "ug/dL"],
    category: "Iron Studies",
    aliases: ["Total Iron Binding Capacity", "Iron Binding Capacity"]
  },
  {
    name: "TPO Antibodies",
    maleRange: "Refer to lab specific range",
    femaleRange: "Refer to lab specific range",
    units: ["IU/mL", "U/mL"],
    category: "Thyroid",
    aliases: ["Thyroid Peroxidase Antibodies", "Anti-TPO", "TPO Ab", "Thyroid Peroxidase Ab"]
  },
  {
    name: "TSH",
    maleRange: "1.0-2.5 mIU/L",
    femaleRange: "1.0-2.5 mIU/L",
    units: ["mIU/L", "µIU/mL", "uIU/mL"],
    category: "Thyroid",
    aliases: ["Thyroid Stimulating Hormone", "Thyrotropin"]
  },
  {
    name: "Thyroglobulin Antibodies",
    maleRange: "Refer to lab specific range",
    femaleRange: "Refer to lab specific range",
    units: ["IU/mL", "U/mL"],
    category: "Thyroid",
    aliases: ["Anti-Thyroglobulin", "TgAb", "Thyroglobulin Ab", "Anti-Tg"]
  },
  {
    name: "Total Bilirubin",
    maleRange: "5-13.6 µmol/L (0.29-0.8 mg/dL)",
    femaleRange: "5-13.6 µmol/L (0.29-0.8 mg/dL)",
    units: ["µmol/L", "umol/L", "mg/dL"],
    category: "Liver Function",
    aliases: ["Bilirubin", "Bilirubin Total", "T Bili"]
  },
  {
    name: "Total Cholesterol",
    maleRange: "4.2-6.4 mmol/L (162-240 mg/dL)",
    femaleRange: "4.2-6.4 mmol/L (162-240 mg/dL)",
    units: ["mmol/L", "mg/dL"],
    category: "Lipids",
    aliases: ["Cholesterol", "Cholesterol Total", "Total Chol"]
  },
  {
    name: "Total Protein",
    maleRange: "62-78 g/L (6.2-7.8 g/dL)",
    femaleRange: "62-78 g/L (6.2-7.8 g/dL)",
    units: ["g/L", "g/dL"],
    category: "Protein",
    aliases: ["Protein Total", "Serum Protein"]
  },
  {
    name: "Transferrin Saturation %",
    maleRange: "20-35 %",
    femaleRange: "20-35 %",
    units: ["%"],
    category: "Iron Studies",
    aliases: ["Transferrin Saturation", "TSAT", "Iron Saturation", "Sat %"]
  },
  {
    name: "Triglycerides",
    maleRange: "0.6-1.0 mmol/L (53-88.5 mg/dL)",
    femaleRange: "0.6-1.0 mmol/L (53-88.5 mg/dL)",
    units: ["mmol/L", "mg/dL"],
    category: "Lipids",
    aliases: ["Trig", "TG", "Triglyceride"]
  },
  {
    name: "Vitamin B12",
    maleRange: "350-650 pmol/L (474-880 pg/mL)",
    femaleRange: "350-650 pmol/L (474-880 pg/mL)",
    units: ["pmol/L", "pg/mL"],
    category: "Vitamins",
    aliases: ["B12", "Cobalamin", "Vitamin B-12"]
  },
  {
    name: "Vitamin D (25-Hydroxy D)",
    maleRange: "125-225 nmol/L (50-90 ng/mL)",
    femaleRange: "125-225 nmol/L (50-90 ng/mL)",
    units: ["nmol/L", "ng/mL"],
    category: "Vitamins",
    aliases: ["Vitamin D", "25-Hydroxy Vitamin D", "25-OH Vitamin D", "25(OH)D", "Vitamin D 25-Hydroxy"]
  },
  {
    name: "WBC",
    maleRange: "5.5-7.5 ×10³/µL",
    femaleRange: "5.5-7.5 ×10³/µL",
    units: ["×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "White Blood Cells",
    aliases: ["White Blood Cell Count", "WBC Count", "Leukocytes"]
  },
  {
    name: "eGFR",
    maleRange: "> 90 mL/min/m² (> 60 if high muscle mass)",
    femaleRange: "> 90 mL/min/m² (> 60 if high muscle mass)",
    units: ["mL/min/m²", "mL/min/1.73m2"],
    category: "Kidney Function",
    aliases: ["Estimated GFR", "GFR", "Glomerular Filtration Rate"]
  }
];

// Get unique list of primary biomarkers (just the names)
export const PRIMARY_BIOMARKERS = BIOMARKERS.map(b => b.name);
