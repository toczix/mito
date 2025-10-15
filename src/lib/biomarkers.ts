export interface Biomarker {
  name: string;
  optimalRange: string;
  units: string[];
  category?: string;
}

export interface ExtractedBiomarker {
  name: string;
  value: string;
  unit: string;
}

export interface AnalysisResult {
  biomarkerName: string;
  hisValue: string;
  unit: string;
  optimalRange: string;
}

export const BIOMARKERS: Biomarker[] = [
  {
    name: "ALP",
    optimalRange: "65-100 IU/L",
    units: ["IU/L", "U/L"],
    category: "Liver Function"
  },
  {
    name: "ALT",
    optimalRange: "13-23 IU/L (Male)",
    units: ["IU/L", "U/L"],
    category: "Liver Function"
  },
  {
    name: "AST",
    optimalRange: "15-25 IU/L (Male)",
    units: ["IU/L", "U/L"],
    category: "Liver Function"
  },
  {
    name: "Albumin",
    optimalRange: "40-50 g/L or 4.0-5.0 g/dL",
    units: ["g/L", "g/dL"],
    category: "Protein"
  },
  {
    name: "BUN",
    optimalRange: "4.0-6.9 mmol/L or 11.2-19.3 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Kidney Function"
  },
  {
    name: "Basophils",
    optimalRange: "0.0×10³/μL (up to around 0.09)",
    units: ["×10³/μL", "×10^3/μL", "K/μL"],
    category: "White Blood Cells"
  },
  {
    name: "Bicarbonate",
    optimalRange: "25-30 mmol/L",
    units: ["mmol/L", "mEq/L"],
    category: "Electrolytes"
  },
  {
    name: "CO2",
    optimalRange: "25-30 mmol/L",
    units: ["mmol/L", "mEq/L"],
    category: "Electrolytes"
  },
  {
    name: "Calcium",
    optimalRange: "2.3-2.45 mmol/L or 9.22-9.8 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Minerals"
  },
  {
    name: "Chloride",
    optimalRange: "100-105 mmol/L",
    units: ["mmol/L", "mEq/L"],
    category: "Electrolytes"
  },
  {
    name: "Cortisol",
    optimalRange: "400-600 nmol/L or 14.5-22.0 μg/dL (AM)",
    units: ["nmol/L", "μg/dL", "ug/dL"],
    category: "Hormones"
  },
  {
    name: "Creatinine",
    optimalRange: "60-100 μmol/L or 0.68-1.13 mg/dL",
    units: ["μmol/L", "umol/L", "mg/dL"],
    category: "Kidney Function"
  },
  {
    name: "C-Reactive Protein",
    optimalRange: "<1.0 mg/L (Low Risk)",
    units: ["mg/L", "mg/dL"],
    category: "Inflammation"
  },
  {
    name: "hsCRP",
    optimalRange: "<1.0 mg/L (Low Risk)",
    units: ["mg/L", "mg/dL"],
    category: "Inflammation"
  },
  {
    name: "DHEA-S",
    optimalRange: "5.5-8.0 μmol/L or 200-300 μg/dL",
    units: ["μmol/L", "umol/L", "μg/dL", "ug/dL"],
    category: "Hormones"
  },
  {
    name: "Eosinophils",
    optimalRange: "0.0-0.2×10³/μL",
    units: ["×10³/μL", "×10^3/μL", "K/μL"],
    category: "White Blood Cells"
  },
  {
    name: "FAI",
    optimalRange: "40-80%",
    units: ["%"],
    category: "Hormones"
  },
  {
    name: "Free Androgen Index",
    optimalRange: "40-80%",
    units: ["%"],
    category: "Hormones"
  },
  {
    name: "Fasting Glucose",
    optimalRange: "4.44-5.0 mmol/L or 80-90 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Metabolic"
  },
  {
    name: "Glucose",
    optimalRange: "4.44-5.0 mmol/L or 80-90 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Metabolic"
  },
  {
    name: "Fasting Insulin",
    optimalRange: "13-40 pmol/L or 2-6 μg/dL",
    units: ["pmol/L", "μg/dL", "ug/dL", "mIU/L"],
    category: "Metabolic"
  },
  {
    name: "Insulin",
    optimalRange: "13-40 pmol/L or 2-6 μg/dL",
    units: ["pmol/L", "μg/dL", "ug/dL", "mIU/L"],
    category: "Metabolic"
  },
  {
    name: "Ferritin",
    optimalRange: "50-150 μg/L or 50-150 ng/mL",
    units: ["μg/L", "ug/L", "ng/mL"],
    category: "Iron Studies"
  },
  {
    name: "FSH",
    optimalRange: "2.0-5.0 IU/L",
    units: ["IU/L", "mIU/mL"],
    category: "Hormones"
  },
  {
    name: "Follicle Stimulating Hormone",
    optimalRange: "2.0-5.0 IU/L",
    units: ["IU/L", "mIU/mL"],
    category: "Hormones"
  },
  {
    name: "Free T3",
    optimalRange: "4.6-6.9 pmol/L or 3.0-4.5 pg/mL",
    units: ["pmol/L", "pg/mL"],
    category: "Thyroid"
  },
  {
    name: "FT3",
    optimalRange: "4.6-6.9 pmol/L or 3.0-4.5 pg/mL",
    units: ["pmol/L", "pg/mL"],
    category: "Thyroid"
  },
  {
    name: "Free T4",
    optimalRange: "13.0-20.0 pmol/L or 1.0-1.55 ng/dL",
    units: ["pmol/L", "ng/dL"],
    category: "Thyroid"
  },
  {
    name: "FT4",
    optimalRange: "13.0-20.0 pmol/L or 1.0-1.55 ng/dL",
    units: ["pmol/L", "ng/dL"],
    category: "Thyroid"
  },
  {
    name: "GGT",
    optimalRange: "10-20 IU/L",
    units: ["IU/L", "U/L"],
    category: "Liver Function"
  },
  {
    name: "Gamma-Glutamyl Transferase",
    optimalRange: "10-20 IU/L",
    units: ["IU/L", "U/L"],
    category: "Liver Function"
  },
  {
    name: "Globulin",
    optimalRange: "22-28 g/L or 2.2-2.8 g/dL",
    units: ["g/L", "g/dL"],
    category: "Protein"
  },
  {
    name: "HBA1C",
    optimalRange: "5.0-5.3% or 31-34 mmol/mol",
    units: ["%", "mmol/mol"],
    category: "Metabolic"
  },
  {
    name: "HbA1c",
    optimalRange: "5.0-5.3% or 31-34 mmol/mol",
    units: ["%", "mmol/mol"],
    category: "Metabolic"
  },
  {
    name: "HCT",
    optimalRange: "0.40-0.54",
    units: ["", "L/L", "%"],
    category: "Red Blood Cells"
  },
  {
    name: "Hematocrit",
    optimalRange: "0.40-0.54",
    units: ["", "L/L", "%"],
    category: "Red Blood Cells"
  },
  {
    name: "HDL Cholesterol",
    optimalRange: "1.29-2.2 mmol/L or 50-85 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Lipids"
  },
  {
    name: "HDL",
    optimalRange: "1.29-2.2 mmol/L or 50-85 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Lipids"
  },
  {
    name: "Hemoglobin",
    optimalRange: "145-155 g/L or 14.5-15.5 g/dL",
    units: ["g/L", "g/dL"],
    category: "Red Blood Cells"
  },
  {
    name: "Haemoglobin",
    optimalRange: "145-155 g/L or 14.5-15.5 g/dL",
    units: ["g/L", "g/dL"],
    category: "Red Blood Cells"
  },
  {
    name: "Homocysteine",
    optimalRange: "6-10 μmol/L",
    units: ["μmol/L", "umol/L"],
    category: "Cardiovascular"
  },
  {
    name: "Lactate Dehydrogenase",
    optimalRange: "120-180 IU/L",
    units: ["IU/L", "U/L"],
    category: "Enzymes"
  },
  {
    name: "LDH",
    optimalRange: "120-180 IU/L",
    units: ["IU/L", "U/L"],
    category: "Enzymes"
  },
  {
    name: "LDL Cholesterol",
    optimalRange: "2.07-4.4 mmol/L or 80-170 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Lipids"
  },
  {
    name: "LDL",
    optimalRange: "2.07-4.4 mmol/L or 80-170 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Lipids"
  },
  {
    name: "LH",
    optimalRange: "2.0-5.0 IU/L",
    units: ["IU/L", "mIU/mL"],
    category: "Hormones"
  },
  {
    name: "Luteinizing Hormone",
    optimalRange: "2.0-5.0 IU/L",
    units: ["IU/L", "mIU/mL"],
    category: "Hormones"
  },
  {
    name: "Lymphocytes",
    optimalRange: "1.5-2.8×10³/μL",
    units: ["×10³/μL", "×10^3/μL", "K/μL"],
    category: "White Blood Cells"
  },
  {
    name: "Magnesium",
    optimalRange: "0.85-1.0 mmol/L or 2.0-2.4 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Minerals"
  },
  {
    name: "MCH",
    optimalRange: "27-34 pg",
    units: ["pg"],
    category: "Red Blood Cells"
  },
  {
    name: "MCHC",
    optimalRange: "320-360 g/L",
    units: ["g/L", "g/dL"],
    category: "Red Blood Cells"
  },
  {
    name: "MCV",
    optimalRange: "82-89 fL",
    units: ["fL"],
    category: "Red Blood Cells"
  },
  {
    name: "Neutrophils",
    optimalRange: "2.0-4.0×10³/μL",
    units: ["×10³/μL", "×10^3/μL", "K/μL"],
    category: "White Blood Cells"
  },
  {
    name: "Phosphate",
    optimalRange: "0.9-1.3 mmol/L or 2.7-4.0 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Minerals"
  },
  {
    name: "Potassium",
    optimalRange: "4.0-4.5 mmol/L",
    units: ["mmol/L", "mEq/L"],
    category: "Electrolytes"
  },
  {
    name: "Prolactin",
    optimalRange: "100-250 mIU/L or 4.7-11.8 ng/mL",
    units: ["mIU/L", "ng/mL"],
    category: "Hormones"
  },
  {
    name: "RBC",
    optimalRange: "4.2-4.9×10¹²/L",
    units: ["×10¹²/L", "×10^12/L", "M/μL"],
    category: "Red Blood Cells"
  },
  {
    name: "Red Blood Cell Count",
    optimalRange: "4.2-4.9×10¹²/L",
    units: ["×10¹²/L", "×10^12/L", "M/μL"],
    category: "Red Blood Cells"
  },
  {
    name: "RDW",
    optimalRange: "10.0-17.0%",
    units: ["%"],
    category: "Red Blood Cells"
  },
  {
    name: "SHBG",
    optimalRange: "40-50 nmol/L (Male)",
    units: ["nmol/L"],
    category: "Hormones"
  },
  {
    name: "Sex Hormone Binding Globulin",
    optimalRange: "40-50 nmol/L (Male)",
    units: ["nmol/L"],
    category: "Hormones"
  },
  {
    name: "Sodium",
    optimalRange: "137-143 mmol/L",
    units: ["mmol/L", "mEq/L"],
    category: "Electrolytes"
  },
  {
    name: "Serum Iron",
    optimalRange: "14.3-23.2 μmol/L",
    units: ["μmol/L", "umol/L", "μg/dL", "ug/dL"],
    category: "Iron Studies"
  },
  {
    name: "Iron",
    optimalRange: "14.3-23.2 μmol/L",
    units: ["μmol/L", "umol/L", "μg/dL", "ug/dL"],
    category: "Iron Studies"
  },
  {
    name: "TIBC",
    optimalRange: "44-62 μmol/L or 250-350 mg/dL",
    units: ["μmol/L", "umol/L", "mg/dL"],
    category: "Iron Studies"
  },
  {
    name: "Total Iron Binding Capacity",
    optimalRange: "44-62 μmol/L or 250-350 mg/dL",
    units: ["μmol/L", "umol/L", "mg/dL"],
    category: "Iron Studies"
  },
  {
    name: "Testosterone",
    optimalRange: "22-30 nmol/L or 635-865 ng/dL",
    units: ["nmol/L", "ng/dL"],
    category: "Hormones"
  },
  {
    name: "Total Testosterone",
    optimalRange: "22-30 nmol/L or 635-865 ng/dL",
    units: ["nmol/L", "ng/dL"],
    category: "Hormones"
  },
  {
    name: "Total Bilirubin",
    optimalRange: "5-13.6 μmol/L or 0.29-0.8 mg/dL",
    units: ["μmol/L", "umol/L", "mg/dL"],
    category: "Liver Function"
  },
  {
    name: "Bilirubin",
    optimalRange: "5-13.6 μmol/L or 0.29-0.8 mg/dL",
    units: ["μmol/L", "umol/L", "mg/dL"],
    category: "Liver Function"
  },
  {
    name: "Total Cholesterol",
    optimalRange: "4.2-6.4 mmol/L or 162-240 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Lipids"
  },
  {
    name: "Cholesterol",
    optimalRange: "4.2-6.4 mmol/L or 162-240 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Lipids"
  },
  {
    name: "Total Protein",
    optimalRange: "62-78 g/L or 6.2-7.8 g/dL",
    units: ["g/L", "g/dL"],
    category: "Protein"
  },
  {
    name: "TPO Antibodies",
    optimalRange: "Refer to lab specific reference range",
    units: ["IU/mL", "U/mL"],
    category: "Thyroid"
  },
  {
    name: "Thyroid Peroxidase Antibodies",
    optimalRange: "Refer to lab specific reference range",
    units: ["IU/mL", "U/mL"],
    category: "Thyroid"
  },
  {
    name: "Transferrin Saturation",
    optimalRange: "20-35%",
    units: ["%"],
    category: "Iron Studies"
  },
  {
    name: "Triglycerides",
    optimalRange: "0.6-1.0 mmol/L or 53-88.5 mg/dL",
    units: ["mmol/L", "mg/dL"],
    category: "Lipids"
  },
  {
    name: "TSH",
    optimalRange: "1.0-2.5 mIU/L",
    units: ["mIU/L", "μIU/mL"],
    category: "Thyroid"
  },
  {
    name: "Thyroid Stimulating Hormone",
    optimalRange: "1.0-2.5 mIU/L",
    units: ["mIU/L", "μIU/mL"],
    category: "Thyroid"
  },
  {
    name: "Thyroglobulin Antibodies",
    optimalRange: "Refer to lab specific reference range",
    units: ["IU/mL", "U/mL"],
    category: "Thyroid"
  },
  {
    name: "Uric Acid",
    optimalRange: "200-300 μmol/L or 3.3-5.0 mg/dL",
    units: ["μmol/L", "umol/L", "mg/dL"],
    category: "Metabolic"
  },
  {
    name: "Vitamin D",
    optimalRange: "125-225 nmol/L or 50-90 ng/mL",
    units: ["nmol/L", "ng/mL"],
    category: "Vitamins"
  },
  {
    name: "25 Hydroxy D",
    optimalRange: "125-225 nmol/L or 50-90 ng/mL",
    units: ["nmol/L", "ng/mL"],
    category: "Vitamins"
  },
  {
    name: "Vitamin B12",
    optimalRange: "400-800 pmol/L or 540-1085 pg/mL",
    units: ["pmol/L", "pg/mL"],
    category: "Vitamins"
  },
  {
    name: "WBC",
    optimalRange: "5.5-7.5×10³/μL",
    units: ["×10³/μL", "×10^3/μL", "K/μL"],
    category: "White Blood Cells"
  },
  {
    name: "White Blood Cell Count",
    optimalRange: "5.5-7.5×10³/μL",
    units: ["×10³/μL", "×10^3/μL", "K/μL"],
    category: "White Blood Cells"
  }
];

// Get unique list of primary biomarkers (removing aliases)
export const PRIMARY_BIOMARKERS = [
  "ALP", "ALT", "AST", "Albumin", "BUN", "Basophils", "Bicarbonate", 
  "Calcium", "Chloride", "Cortisol", "Creatinine", "C-Reactive Protein",
  "DHEA-S", "Eosinophils", "FAI", "Fasting Glucose", "Fasting Insulin",
  "Ferritin", "FSH", "Free T3", "Free T4", "GGT", "Globulin", "HBA1C",
  "HCT", "HDL Cholesterol", "Hemoglobin", "Homocysteine", 
  "Lactate Dehydrogenase", "LDL Cholesterol", "LH", "Lymphocytes",
  "Magnesium", "MCH", "MCHC", "MCV", "Neutrophils", "Phosphate",
  "Potassium", "Prolactin", "RBC", "RDW", "SHBG", "Sodium", "Serum Iron",
  "TIBC", "Testosterone", "Total Bilirubin", "Total Cholesterol",
  "Total Protein", "TPO Antibodies", "Transferrin Saturation",
  "Triglycerides", "TSH", "Thyroglobulin Antibodies", "Uric Acid",
  "Vitamin D", "Vitamin B12", "WBC"
];

