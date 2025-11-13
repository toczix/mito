export interface Biomarker {
  name: string;
  maleRange: string;
  femaleRange: string;
  units: string[];
  category?: string;
  aliases?: string[]; // Alternative names for this biomarker
  lowReasons?: string; // Reasons for low values (comma-separated or newline-separated)
  highReasons?: string; // Reasons for high values (comma-separated or newline-separated)
}

export interface ExtractedBiomarker {
  name: string;
  value: string;
  unit: string;
  testDate?: string; // YYYY-MM-DD format

  // ✅ Optional normalization metadata (preserved through pipeline)
  _normalization?: {
    originalName?: string;
    originalValue?: string;
    originalUnit?: string;
    confidence?: number;
    conversionApplied?: boolean;
    isNumeric?: boolean;
  };
}

export interface AnalysisResult {
  biomarkerName: string;
  hisValue: string;
  unit: string;
  optimalRange: string;
  testDate?: string; // YYYY-MM-DD format

  // ✅ Optional normalization metadata (backward compatible)
  _normalization?: {
    originalName?: string;      // Name as extracted by Claude
    originalValue?: string;     // Value before normalization
    originalUnit?: string;      // Unit before conversion
    confidence?: number;        // 0.0-1.0 confidence in name normalization
    conversionApplied?: boolean; // Whether unit conversion was applied
    isNumeric?: boolean;        // Whether value is numeric (false for "N/A", "<0.1")
  };
}

// ✅ NEW: Normalized biomarker type (used during processing)
export interface NormalizedBiomarker {
  name: string;              // Canonical name
  value: string;             // Normalized value
  unit: string;              // Normalized unit
  originalName: string;      // Original from Claude
  originalValue: string;     // Original value
  originalUnit: string;      // Original unit
  confidence: number;        // 0.0-1.0
  conversionApplied: boolean;
  isNumeric: boolean;
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
    aliases: ["Serum Albumin", "ALB", "S-Albumin", "Albumina"]
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
    maleRange: "≤ 0.09 ×10³/µL",
    femaleRange: "≤ 0.09 ×10³/µL",
    units: ["×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "White Blood Cells",
    aliases: ["Baso", "Basophil Count", "Absolute Basophils", "Basos", "Basophil Absolute", "Abs Basophils"]
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
    aliases: ["Serum Calcium", "Total Calcium", "Ca", "Calcium Total", "S-Calcium", "Calcio"]
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
    aliases: [
      // English variations
      "Creatinine", "Creat", "CREA", "Cre", "CR",
      "Serum Creatinine", "Creatinine Serum", "S-Creatinine",
      "Blood Creatinine", "Creatinine Level",
      // Spanish
      "Creatinina", "Creatinina Sérica",
      // Portuguese
      "Creatinina", "Creatinina Sérica",
      // French
      "Créatinine", "Créatinine Sérique",
      // German
      "Kreatinin", "Serum-Kreatinin",
      // Italian
      "Creatinina", "Creatinina Sierica"
    ]
  },
  {
    name: "Eosinophils",
    maleRange: "0.0-0.3 ×10³/µL",
    femaleRange: "0.0-0.3 ×10³/µL",
    units: ["×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "White Blood Cells",
    aliases: ["Eos", "Eosinophil Count", "Absolute Eosinophils", "Eosin", "Eosinophil Absolute", "Abs Eosinophils"]
  },
  {
    name: "Fasting Glucose",
    maleRange: "4.44-5.0 mmol/L (80-90 mg/dL)",
    femaleRange: "4.44-5.0 mmol/L (80-90 mg/dL)",
    units: ["mmol/L", "mg/dL"],
    category: "Metabolic",
    aliases: [
      // English variations
      "Glucose", "Gluc", "GLU", "Glu",
      "Fasting Glucose", "Glucose Fasting", "Glucose (Fasting)", "Glucose, Fasting",
      "FBG", "FBS", "Fasting Blood Glucose", "Fasting Blood Sugar",
      "Blood Glucose", "Blood Sugar", "Blood Glucose Level", "Blood Sugar Level",
      "Serum Glucose", "Plasma Glucose", "Glucose Serum", "Glucose Plasma",
      "Glucose Level", "Sugar Level",
      // Spanish
      "Glucosa", "Glucosa en Ayunas", "Glucosa Sanguínea", "Azúcar en Sangre", "Glicemia",
      // Portuguese
      "Glicose", "Glicose em Jejum", "Glicose Sanguínea", "Glicemia",
      // French
      "Glucose", "Glycémie", "Glycémie à Jeun", "Glucose à Jeun",
      // German
      "Glukose", "Nüchtern-Glukose", "Blutzucker",
      // Italian
      "Glucosio", "Glicemia", "Glucosio a Digiuno"
    ]
  },
  {
    name: "Fasting Insulin",
    maleRange: "13-40 pmol/L (2-6 µIU/mL/mU/L/mIU/L)",
    femaleRange: "13-40 pmol/L (2-6 µIU/mL/mU/L/mIU/L)",
    units: ["pmol/L", "µIU/mL", "uIU/mL", "mIU/L", "mU/L"],
    category: "Metabolic",
    aliases: ["Insulin", "Insulin Fasting", "Serum Insulin"]
  },
  {
    name: "Ferritin",
    maleRange: "50-150 µg/L",
    femaleRange: "50-150 µg/L",
    units: ["µg/L", "ug/L", "ng/mL"],
    category: "Iron Studies",
    aliases: [
      // English variations
      "Ferritin", "Ferr", "FER",
      "Serum Ferritin", "Ferritin Serum", "S-Ferritin",
      "Ferritin Level",
      // Spanish
      "Ferritina", "Ferritina Sérica",
      // Portuguese
      "Ferritina", "Ferritina Sérica",
      // French
      "Ferritine", "Ferritine Sérique",
      // German
      "Ferritin", "Serum-Ferritin",
      // Italian
      "Ferritina", "Ferritina Sierica"
    ]
  },
  {
    name: "Free T3",
    maleRange: "3.0-4.5 pg/mL (4.6-6.9 pmol/L)",
    femaleRange: "3.0-4.5 pg/mL (4.6-6.9 pmol/L)",
    units: ["pg/mL", "pmol/L"],
    category: "Thyroid",
    aliases: [
      // English variations
      "Free T3", "FT3", "F T3", "F.T.3", "fT3",
      "T3 Free", "T3, Free", "Free T 3",
      "Free Triiodothyronine", "Triiodothyronine Free", "Triiodothyronine, Free",
      "Free Tri-iodothyronine",
      // Spanish
      "T3 Libre", "FT3", "Triyodotironina Libre",
      // Portuguese
      "T3 Livre", "FT3", "Triiodotironina Livre",
      // French
      "T3 Libre", "FT3", "Triiodothyronine Libre",
      // German
      "Freies T3", "FT3", "Freies Triiodthyronin",
      // Italian
      "T3 Libero", "FT3", "Triiodotironina Libera"
    ]
  },
  {
    name: "Free T4",
    maleRange: "1.0-1.55 ng/dL (13-20 pmol/L)",
    femaleRange: "1.0-1.55 ng/dL (13-20 pmol/L)",
    units: ["ng/dL", "pmol/L"],
    category: "Thyroid",
    aliases: [
      // English variations
      "Free T4", "FT4", "F T4", "F.T.4", "fT4",
      "T4 Free", "T4, Free", "Free T 4",
      "Free Thyroxine", "Thyroxine Free", "Thyroxine, Free",
      "Free Tetraiodothyronine",
      // Spanish
      "T4 Libre", "FT4", "Tiroxina Libre",
      // Portuguese
      "T4 Livre", "FT4", "Tiroxina Livre",
      // French
      "T4 Libre", "FT4", "Thyroxine Libre",
      // German
      "Freies T4", "FT4", "Freies Thyroxin",
      // Italian
      "T4 Libero", "FT4", "Tiroxina Libera"
    ]
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
    aliases: ["Serum Globulin", "Calculated Globulin", "Total Globulin", "Glob", "Globulina"]
  },
  {
    name: "HbA1C",
    maleRange: "5.0-5.3 % (31-34 mmol/mol)",
    femaleRange: "5.0-5.3 % (31-34 mmol/mol)",
    units: ["%", "mmol/mol"],
    category: "Metabolic",
    aliases: [
      // English variations
      "HbA1C", "HbA1c", "Hb A1C", "Hb A1c", "HBA1C", "HBA1c",
      "A1C", "A1c", "Hemoglobin A1C", "Hemoglobin A1c",
      "Glycated Hemoglobin", "Glycosylated Hemoglobin", "Glycohemoglobin",
      "Haemoglobin A1C", "Haemoglobin A1c",
      "Hgb A1C", "Hgb A1c", "HGB A1C",
      "Glycated Hb", "Glycated HGB", "GHb",
      // Spanish
      "Hemoglobina Glicosilada", "Hemoglobina Glicada", "HbA1c", "A1C",
      // Portuguese
      "Hemoglobina Glicada", "HbA1c", "A1C",
      // French
      "Hémoglobine Glyquée", "HbA1c", "A1C",
      // German
      "Glykiertes Hämoglobin", "HbA1c", "A1C",
      // Italian
      "Emoglobina Glicata", "HbA1c", "A1C"
    ]
  },
  {
    name: "HCT",
    maleRange: "38-48 %",
    femaleRange: "38-48 %",
    units: ["%", "L/L"],
    category: "Red Blood Cells",
    aliases: ["Hematocrit", "HCT", "Hct", "Haematocrit", "Hematocrit Level"]
  },
  {
    name: "HDL Cholesterol",
    maleRange: "1.29-2.2 mmol/L (50-85 mg/dL)",
    femaleRange: "1.29-2.2 mmol/L (50-85 mg/dL)",
    units: ["mmol/L", "mg/dL"],
    category: "Lipids",
    aliases: [
      // English variations
      "HDL", "HDL-C", "HDL C", "HDLC",
      "HDL Cholesterol", "HDL-Cholesterol", "Cholesterol HDL",
      "HDL Chol", "HDL-Chol", "Chol HDL",
      "High Density Lipoprotein", "High-Density Lipoprotein",
      // Spanish
      "HDL", "Colesterol HDL", "HDL Colesterol", "HDL-Colesterol",
      // Portuguese
      "HDL", "Colesterol HDL", "HDL Colesterol",
      // French
      "HDL", "Cholestérol HDL", "HDL Cholestérol",
      // German
      "HDL", "HDL Cholesterin", "HDL-Cholesterin",
      // Italian
      "HDL", "Colesterolo HDL", "HDL Colesterolo"
    ]
  },
  {
    name: "Hemoglobin",
    maleRange: "145-155 g/L (14.5-15.5 g/dL)",
    femaleRange: "135-145 g/L (13.5-14.5 g/dL)",
    units: ["g/L", "g/dL"],
    category: "Red Blood Cells",
    aliases: ["Hgb", "Hb", "Haemoglobin", "HGB", "Hemoglobin Level"]
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
    aliases: [
      // English variations
      "LDL", "LDL-C", "LDL C", "LDLC",
      "LDL Cholesterol", "LDL-Cholesterol", "Cholesterol LDL",
      "LDL Chol", "LDL-Chol", "Chol LDL",
      "Low Density Lipoprotein", "Low-Density Lipoprotein",
      "LDL Calculated", "LDL Calc", "Calculated LDL",
      "LDL Direct", "Direct LDL",
      // Spanish
      "LDL", "Colesterol LDL", "LDL Colesterol", "LDL-Colesterol",
      // Portuguese
      "LDL", "Colesterol LDL", "LDL Colesterol",
      // French
      "LDL", "Cholestérol LDL", "LDL Cholestérol",
      // German
      "LDL", "LDL Cholesterin", "LDL-Cholesterin",
      // Italian
      "LDL", "Colesterolo LDL", "LDL Colesterolo"
    ]
  },
  {
    name: "Lymphocytes",
    maleRange: "1.1-3.1 ×10³/µL",
    femaleRange: "1.1-3.1 ×10³/µL",
    units: ["×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "White Blood Cells",
    aliases: ["Lymph", "Lymphocyte Count", "Absolute Lymphocytes", "Lymphs", "Lymphocyte Absolute", "Abs Lymphocytes"]
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
    maleRange: "0.3-0.5 ×10³/µL",
    femaleRange: "0.3-0.5 ×10³/µL",
    units: ["×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "White Blood Cells",
    aliases: ["Mono", "Monocyte Count", "Absolute Monocytes", "Monos", "Monocyte Absolute", "Abs Monocytes"]
  },
  {
    name: "Neutrophils",
    maleRange: "3.0-4.5 ×10³/µL",
    femaleRange: "3.0-4.5 ×10³/µL",
    units: ["×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "White Blood Cells",
    aliases: ["Neut", "Neutrophil Count", "Absolute Neutrophils", "Segmented Neutrophils", "Segs", "Polys", "PMN", "Neutrophil Absolute", "Abs Neutrophils"]
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
    aliases: ["PLT", "Platelet Count", "Thrombocytes", "Platelet", "Thrombocyte Count"]
  },
  {
    name: "Potassium",
    maleRange: "4.0-4.5 mmol/L",
    femaleRange: "4.0-4.5 mmol/L",
    units: ["mmol/L", "mEq/L"],
    category: "Electrolytes",
    aliases: ["K", "Serum Potassium", "S-Potassium", "Potasio", "K+"]
  },
  {
    name: "RBC",
    maleRange: "4.2-4.9 ×10¹²/L",
    femaleRange: "3.9-4.5 ×10¹²/L",
    units: ["×10¹²/L", "×10^12/L", "M/µL", "M/uL"],
    category: "Red Blood Cells",
    aliases: ["Red Blood Cell Count", "RBC Count", "Erythrocytes", "Red Cell Count", "Erythrocyte Count"]
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
    aliases: [
      // English variations
      "Folate", "Folic Acid", "Serum Folate", "Folate Serum",
      "Vitamin B9", "Vitamin B-9", "B9", "B-9",
      "Folate Level", "Folic Acid Level",
      // Spanish
      "Folato", "Ácido Fólico", "Vitamina B9", "Folato Sérico",
      // Portuguese
      "Folato", "Ácido Fólico", "Vitamina B9", "Folato Sérico",
      // French
      "Folate", "Acide Folique", "Vitamine B9",
      // German
      "Folsäure", "Folat", "Vitamin B9",
      // Italian
      "Folato", "Acido Folico", "Vitamina B9"
    ]
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
    aliases: ["Na", "Serum Sodium", "S-Sodium", "Sodio", "Na+"]
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
    maleRange: "1.0-2.5 mIU/L/µIU/mL/mU/L",
    femaleRange: "1.0-2.5 mIU/L/µIU/mL/mU/L",
    units: ["mIU/L", "µIU/mL", "uIU/mL", "mU/L"],
    category: "Thyroid",
    aliases: [
      // English variations
      "TSH", "T.S.H.", "T S H",
      "Thyroid Stimulating Hormone", "Thyroid-Stimulating Hormone",
      "Thyrotropin", "Thyrotropic Hormone",
      "Serum TSH", "TSH Serum",
      // Spanish
      "TSH", "Hormona Estimulante de Tiroides", "Tirotropina",
      // Portuguese
      "TSH", "Hormônio Estimulante da Tireoide", "Tireotropina",
      // French
      "TSH", "Thyréostimuline", "Hormone Thyréotrope",
      // German
      "TSH", "Thyreoidea-stimulierendes Hormon", "Thyreotropin",
      // Italian
      "TSH", "Ormone Tireostimolante", "Tireotropina"
    ]
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
    aliases: [
      // English variations
      "Cholesterol", "Chol", "CHOL",
      "Total Cholesterol", "Cholesterol Total", "Total Chol", "Chol Total",
      "Serum Cholesterol", "Cholesterol Serum",
      "T-CHOL", "T-Chol", "T Chol",
      // Spanish
      "Colesterol", "Colesterol Total", "Total Colesterol",
      // Portuguese
      "Colesterol", "Colesterol Total",
      // French
      "Cholestérol", "Cholestérol Total",
      // German
      "Cholesterin", "Gesamtcholesterin",
      // Italian
      "Colesterolo", "Colesterolo Totale"
    ]
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
    aliases: ["Trig", "TG", "Triglyceride", "Triglycérides", "Triglyceridos", "TRIG"]
  },
  {
    name: "Vitamin B12",
    maleRange: "350-650 pmol/L (474-880 pg/mL)",
    femaleRange: "350-650 pmol/L (474-880 pg/mL)",
    units: ["pmol/L", "pg/mL"],
    category: "Vitamins",
    aliases: [
      // English variations
      "B12", "B-12", "B 12",
      "Vitamin B12", "Vitamin B-12", "Vitamin B 12",
      "B12 Vitamin", "B-12 Vitamin", "B 12 Vitamin",
      "VitB12", "Vit B12", "Vit B-12", "Vit B 12",
      "Cobalamin", "Cyanocobalamin", "Methylcobalamin",
      "Serum B12", "Serum Cobalamin",
      // Spanish
      "Vitamina B12", "Vitamina B-12", "Vitamina B 12", "B12 Vitamina", "Cobalamina",
      // Portuguese
      "Vitamina B12", "B12 Vitamina", "Cobalamina",
      // French
      "Vitamine B12", "B12 Vitamine",
      // German
      "Vitamin B12",
      // Italian
      "Vitamina B12", "B12 Vitamina"
    ]
  },
  {
    name: "Vitamin D (25-Hydroxy D)",
    maleRange: "125-225 nmol/L (50-90 ng/mL)",
    femaleRange: "125-225 nmol/L (50-90 ng/mL)",
    units: ["nmol/L", "ng/mL"],
    category: "Vitamins",
    aliases: [
      // English variations
      "Vitamin D", "Vit D", "VitD", "Vit. D",
      "25-Hydroxy Vitamin D", "25-OH Vitamin D", "25(OH)D", "25 OH D", "25-OH-D",
      "Vitamin D 25-Hydroxy", "Vitamin D 25 Hydroxy", "Vitamin D, 25-Hydroxy",
      "25-Hydroxyvitamin D", "25 Hydroxyvitamin D", "25-OH-D3", "25-OH D3",
      "Calcidiol", "Cholecalciferol", "25-Hydroxycholecalciferol",
      "Serum Vitamin D", "Total Vitamin D", "Vitamin D Total",
      "D Vitamin", "D-Vitamin",
      // Spanish
      "Vitamina D", "25-Hidroxi Vitamina D", "Vitamina D 25-Hidroxi", "D Vitamina",
      // Portuguese  
      "Vitamina D", "25-Hidroxi Vitamina D", "D Vitamina",
      // French
      "Vitamine D", "25-Hydroxy Vitamine D", "D Vitamine",
      // German
      "Vitamin D", "25-Hydroxy Vitamin D",
      // Italian
      "Vitamina D", "25-Idrossi Vitamina D", "D Vitamina"
    ]
  },
  {
    name: "WBC",
    maleRange: "5.5-7.5 ×10³/µL",
    femaleRange: "5.5-7.5 ×10³/µL",
    units: ["×10³/µL", "×10^3/µL", "K/µL", "K/uL"],
    category: "White Blood Cells",
    aliases: ["White Blood Cell Count", "WBC Count", "Leukocytes", "White Cell Count", "Leukocyte Count", "Total WBC"]
  },
  {
    name: "eGFR",
    maleRange: "> 90 mL/min/m² (> 60 if high muscle mass)",
    femaleRange: "> 90 mL/min/m² (> 60 if high muscle mass)",
    units: ["mL/min/m²", "mL/min/1.73m2"],
    category: "Kidney Function",
    aliases: ["Estimated GFR", "GFR", "Glomerular Filtration Rate", "eGFR (CKD-EPI)", "eGFR (MDRD)", "Estimated Glomerular Filtration Rate"]
  }
];

// Get unique list of primary biomarkers (just the names)
export const PRIMARY_BIOMARKERS = BIOMARKERS.map(b => b.name);

/**
 * Full name mapping for biomarkers with abbreviations
 * Maps abbreviated biomarker names to their full descriptive names
 */
export const BIOMARKER_FULL_NAMES: Record<string, string> = {
  // Liver Function
  'ALP': 'Alkaline Phosphatase',
  'ALT': 'Alanine Aminotransferase',
  'AST': 'Aspartate Aminotransferase',
  'GGT': 'Gamma-Glutamyl Transferase',

  // Kidney Function
  'BUN': 'Blood Urea Nitrogen',
  'eGFR': 'Estimated Glomerular Filtration Rate',

  // White Blood Cells - Differentials (Absolute Counts)
  'WBC': 'White Blood Cell Count',
  'Neutrophils': 'Absolute Neutrophil Count',
  'Lymphocytes': 'Absolute Lymphocyte Count',
  'Monocytes': 'Absolute Monocyte Count',
  'Eosinophils': 'Absolute Eosinophil Count',
  'Basophils': 'Absolute Basophil Count',

  // Red Blood Cells
  'RBC': 'Red Blood Cell Count',
  'HCT': 'Hematocrit',
  'MCH': 'Mean Corpuscular Hemoglobin',
  'MCHC': 'Mean Corpuscular Hemoglobin Concentration',
  'MCV': 'Mean Corpuscular Volume',
  'RDW': 'Red Cell Distribution Width',

  // Lipids
  'HDL Cholesterol': 'High-Density Lipoprotein Cholesterol',
  'LDL Cholesterol': 'Low-Density Lipoprotein Cholesterol',

  // Metabolic
  'HbA1C': 'Glycated Hemoglobin',

  // Thyroid
  'TSH': 'Thyroid Stimulating Hormone',
  'TPO Antibodies': 'Thyroid Peroxidase Antibodies',

  // Hormones
  'SHBG': 'Sex Hormone Binding Globulin',

  // Iron Studies
  'TIBC': 'Total Iron Binding Capacity',

  // Enzymes
  'LDH': 'Lactate Dehydrogenase',
};

/**
 * Get the full descriptive name for a biomarker abbreviation
 * Returns null if no full name exists (biomarker is already fully named)
 */
export function getBiomarkerFullName(name: string): string | null {
  return BIOMARKER_FULL_NAMES[name] || null;
}

/**
 * Get the display name for a biomarker (combines abbreviation and full name if available)
 * Examples:
 *   "TSH" -> "TSH (Thyroid Stimulating Hormone)"
 *   "Calcium" -> "Calcium" (no change, already full name)
 */
export function getBiomarkerDisplayName(name: string): string {
  const fullName = getBiomarkerFullName(name);
  if (fullName && fullName !== name) {
    return `${name} (${fullName})`;
  }
  return name;
}
