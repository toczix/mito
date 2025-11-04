/**
 * Biomarker Information Service
 * Provides access to biomarker high/low reasons from markdown files
 */

import type { Biomarker } from './biomarkers';

export interface BiomarkerInfo {
  name: string;
  description?: string;
  optimalValues?: string;
  lowReasons?: string[];
  highReasons?: string[];
  whatNext?: string[];
}

/**
 * Biomarker information database
 * This is a curated subset of biomarkers with detailed information
 * Data extracted from /rawbiomarkers/RAWBIOMARKERS/ markdown files
 */
const BIOMARKER_INFO_DB: Record<string, BiomarkerInfo> = {
  'ALT': {
    name: 'ALT',
    description: 'ALT (Alanine Aminotransferase) is a liver enzyme found predominantly in the liver (however also in skeletal muscle, heart, and kidney). ALT has a half life of around 47 hours, and when it is elevated it is typically associated with liver damage. ALT is involved in metabolism and is B6 dependant, so when it is decreased it can be a sign of low B6 status.',
    optimalValues: '13-23 IU/L (male), 9-19 IU/L (female)',
    lowReasons: [
      'Low B6'
    ],
    highReasons: [
      'Liver damage',
      'Infection (e.g. viral)',
      'Fatty liver',
      'Excessive muscle breakdown',
      'Biliary issues',
      'Pancreatitis'
    ],
    whatNext: [
      'ALT should always be assessed against other liver enzymes',
      'If ALT is low + AST is low, consider B6 deficiency',
      'If ALT and AST are slightly elevated + elevated GGT + elevated Triglycerides, consider fatty liver'
    ]
  },
  'AST': {
    name: 'AST',
    description: 'AST (Aspartate Aminotransferase) is an enzyme found in the liver, heart, skeletal muscle, kidneys, brain, and red blood cells. AST is involved in metabolism and is B6 dependent.',
    optimalValues: '13-23 IU/L (male), 9-19 IU/L (female)',
    lowReasons: [
      'Low B6'
    ],
    highReasons: [
      'Liver damage',
      'Heart damage (e.g. heart attack)',
      'Muscle damage',
      'Hemolysis (breakdown of red blood cells)',
      'Infection'
    ],
    whatNext: [
      'AST should always be assessed against other liver enzymes',
      'If AST is low + ALT is low, consider B6 deficiency'
    ]
  },
  'ALP': {
    name: 'ALP',
    description: 'Alkaline Phosphatase is an enzyme found in the liver, bones, kidneys, and digestive system.',
    optimalValues: '50-90 IU/L',
    lowReasons: [
      'Zinc deficiency',
      'Protein deficiency',
      'Magnesium deficiency',
      'Hypothyroidism',
      'Pernicious anemia',
      'Scurvy (vitamin C deficiency)'
    ],
    highReasons: [
      'Bone disorders (e.g. Paget\'s disease)',
      'Liver disease',
      'Biliary obstruction',
      'Vitamin D deficiency',
      'Hyperparathyroidism',
      'Growing children (normal)',
      'Pregnancy (normal in third trimester)'
    ]
  },
  'TSH': {
    name: 'TSH',
    description: 'TSH is a hormone produced by the pituitary gland (not the thyroid) that stimulates the thyroid gland to produce thyroid hormones. High TSH suggests the body is wanting more thyroid hormone to be secreted.',
    optimalValues: '1.0-2.5 mIU/L (acceptable: 0.5-4.5 mIU/L)',
    lowReasons: [
      'Primary Hyperthyroidism (e.g. Grave\'s Disease)',
      'Secondary Hypothyroidism (pituitary gland dysfunction)',
      'Tertiary Hypothyroidism (hypothalamus dysfunction)',
      'Dopamine agonists',
      'Recent COVID infection',
      'Exogenous Thyroid Hormone use',
      'Pregnancy',
      'HPA axis dysfunction'
    ],
    highReasons: [
      'Primary Hypothyroidism (e.g. Hashimoto\'s)',
      'Lithium or fluoride exposure',
      'Excess iodine supplementation',
      'Older age (may be normal in elderly)',
      'Acute illness'
    ],
    whatNext: [
      'Assess other thyroid markers (e.g. FT4 and FT3)',
      'If TSH is high and FT4/FT3 are low, assess thyroid antibodies (e.g. TPO antibodies)'
    ]
  },
  'Eosinophils': {
    name: 'Eosinophils',
    description: 'Eosinophils are a type of white blood cell that respond to antibodies that are produced in response to an antigen entering the body (foreign substances). They are likely to be elevated alongside allergies and are found largely in the intestines and the lungs.',
    optimalValues: '0.0-0.3 ×10³/µL',
    lowReasons: [
      'Not usually a concern',
      'May occur due to elevated cortisol'
    ],
    highReasons: [
      'Allergies (e.g food or environmental)',
      'Asthma',
      'Low cortisol',
      'Parasitic infections (e.g. worms)',
      'Some medication use'
    ],
    whatNext: [
      'High eosinophils + high monocytes + low neutrophils + high basophils + high ALP + high or low globulin + low iron may indicate parasitic infections',
      'High eosinophils + high hemoglobin + high RBC + high HCT may indicate asthma'
    ]
  },
  'Basophils': {
    name: 'Basophils',
    description: 'Basophils are a type of white blood cell that make up a very small percentage of white blood cells. These cells contain histamine and heparin and are associated with inflammation. When basophils are in tissue (not blood) they are referred to as \'mast cells\'.',
    optimalValues: '0.0-0.09 ×10³/µL',
    lowReasons: [
      'Not usually a concern',
      'Pregnancy',
      'Hyperthyroidism',
      'Corticosteroid medications'
    ],
    highReasons: [
      'Allergies',
      'Inflammation',
      'Intestinal permeability',
      'Thyroid hypofunction',
      'Parasitic infections',
      'Chronic hemolytic anemia',
      'Influenza'
    ],
    whatNext: [
      'High basophils + high eosinophils + high monocytes + low neutrophils + high ALP + high or low globulin + low iron may indicate parasitic infections',
      'High basophils + high CRP + high ESR + high fibrinogen + high LDH + high ferritin + high iron + high or low globulin + high potassium may indicate inflammation'
    ]
  },
  'Neutrophils': {
    name: 'Neutrophils',
    description: 'Neutrophils are the most abundant type of white blood cell and are the first responders to infection. They are part of the innate immune system.',
    optimalValues: '3.0-4.5 ×10³/µL',
    lowReasons: [
      'Viral infections',
      'Severe bacterial infections (sepsis)',
      'Bone marrow disorders',
      'Autoimmune conditions',
      'Nutritional deficiencies (B12, folate, copper)',
      'Medications (chemotherapy, antibiotics)',
      'Radiation exposure'
    ],
    highReasons: [
      'Bacterial infections',
      'Inflammation',
      'Physical or emotional stress',
      'Smoking',
      'Pregnancy',
      'Recent exercise',
      'Medications (corticosteroids)',
      'Tissue damage (burns, heart attack)'
    ]
  },
  'Lymphocytes': {
    name: 'Lymphocytes',
    description: 'Lymphocytes are white blood cells that are part of the adaptive immune system. They include T cells, B cells, and Natural Killer cells.',
    optimalValues: '1.1-3.1 ×10³/µL',
    lowReasons: [
      'Immunodeficiency disorders',
      'Autoimmune conditions',
      'Infections (HIV, TB)',
      'Medications (immunosuppressants, chemotherapy)',
      'Radiation therapy',
      'Severe stress',
      'Malnutrition'
    ],
    highReasons: [
      'Viral infections (common)',
      'Bacterial infections (some types)',
      'Chronic inflammatory conditions',
      'Leukemia or lymphoma',
      'Recovery from acute infection',
      'Smoking cessation'
    ]
  },
  'Monocytes': {
    name: 'Monocytes',
    description: 'Monocytes are white blood cells that differentiate into macrophages and dendritic cells. They play a role in both innate and adaptive immunity.',
    optimalValues: '0.3-0.5 ×10³/µL',
    lowReasons: [
      'Bone marrow disorders',
      'Severe infections',
      'Medications (chemotherapy)',
      'Hairy cell leukemia'
    ],
    highReasons: [
      'Chronic infections',
      'Inflammatory conditions',
      'Recovery from acute infection',
      'Autoimmune disorders',
      'Blood disorders',
      'Some cancers'
    ]
  },
  'Glucose': {
    name: 'Glucose',
    description: 'Blood glucose is the amount of sugar in your blood. It is the primary source of energy for your cells.',
    optimalValues: '75-95 mg/dL (fasting)',
    lowReasons: [
      'Insulin excess',
      'Medications (especially diabetes medications)',
      'Excessive alcohol consumption',
      'Liver disease',
      'Kidney disorders',
      'Adrenal insufficiency',
      'Prolonged fasting or malnutrition',
      'Intense exercise'
    ],
    highReasons: [
      'Prediabetes or diabetes',
      'Stress',
      'Medications (corticosteroids)',
      'Pancreatic disorders',
      'Cushing\'s syndrome',
      'Hyperthyroidism',
      'Recent meal (if not fasting)'
    ]
  },
  'HbA1C': {
    name: 'HbA1C',
    description: 'Glycated Hemoglobin provides an average of blood glucose levels over the past 2-3 months.',
    optimalValues: '< 5.3% (ideally < 5.0%)',
    lowReasons: [
      'Recent blood loss or transfusion',
      'Hemolytic anemia',
      'Kidney disease (advanced)',
      'Pregnancy'
    ],
    highReasons: [
      'Prediabetes (5.7-6.4%)',
      'Diabetes (≥ 6.5%)',
      'Poor glycemic control',
      'Iron deficiency anemia',
      'Vitamin B12 or folate deficiency'
    ],
    whatNext: [
      'If elevated, assess fasting glucose and insulin',
      'Consider glucose tolerance test',
      'Evaluate diet and lifestyle factors'
    ]
  },
  'Creatinine': {
    name: 'Creatinine',
    description: 'Creatinine is a waste product from muscle metabolism that is filtered by the kidneys. It is used to assess kidney function.',
    optimalValues: '0.8-1.1 mg/dL (male), 0.6-0.9 mg/dL (female)',
    lowReasons: [
      'Low muscle mass',
      'Malnutrition',
      'Severe liver disease',
      'Pregnancy'
    ],
    highReasons: [
      'Kidney dysfunction',
      'Dehydration',
      'High protein diet',
      'Intense exercise',
      'Muscle breakdown (rhabdomyolysis)',
      'Certain medications (e.g. cimetidine)'
    ]
  },
  'BUN': {
    name: 'BUN',
    description: 'Blood Urea Nitrogen is a waste product from protein metabolism. It is filtered by the kidneys and used to assess kidney function and hydration status.',
    optimalValues: '10-16 mg/dL',
    lowReasons: [
      'Low protein diet',
      'Malnutrition',
      'Liver disease',
      'Overhydration',
      'Pregnancy'
    ],
    highReasons: [
      'Kidney dysfunction',
      'Dehydration',
      'High protein diet',
      'Gastrointestinal bleeding',
      'Heart failure',
      'Certain medications (corticosteroids)'
    ]
  },
  'eGFR': {
    name: 'eGFR',
    description: 'Estimated Glomerular Filtration Rate is a calculated measure of kidney function based on creatinine, age, sex, and race.',
    optimalValues: '> 90 mL/min/1.73m² (> 60 if high muscle mass)',
    lowReasons: [
      'Chronic kidney disease',
      'Acute kidney injury',
      'Dehydration',
      'Heart failure',
      'Diabetes complications',
      'Hypertension complications',
      'Medications (NSAIDs, certain antibiotics)'
    ],
    highReasons: [
      'Usually indicates good kidney function',
      'Pregnancy (can increase GFR)',
      'High protein diet'
    ]
  },
  'Calcium': {
    name: 'Calcium',
    description: 'Around 99% of calcium is found within bones. Calcium levels are mostly regulated by parathyroid hormone (PTH) and by Vitamin D. Serum calcium levels are primarily a reflection of calcium metabolism rather than dietary calcium intake.',
    optimalValues: '2.3-2.45 mmol/L (9.22-9.8 mg/dL)',
    lowReasons: [
      'Low intake or absorption',
      'Intestinal damage (e.g. IBD)',
      'Parathyroid hypofunction',
      'Vitamin D deficiency',
      'Low magnesium'
    ],
    highReasons: [
      'Parathyroid hyperfunction',
      'Excess vitamin D',
      'Adrenal hypofunction'
    ],
    whatNext: [
      'If calcium is high or low, assess factors that could influence absorption (e.g. Vitamin D levels, medical conditions like Crohn\'s disease, thyroid dysfunction)',
      'If consistently or significantly out of range, consider testing Parathyroid Hormone levels (PTH)'
    ]
  },
  'MCV': {
    name: 'MCV',
    description: 'Mean Corpuscular Volume measures the average volume of red blood cells and can indicate whether red blood cells are small, normal, or large. It is a helpful anemia marker.',
    optimalValues: '82-89 fL',
    lowReasons: [
      'Anemia (caused by low iron, B6, blood loss, heavy metal toxicity, parasites, or genetic disorder - Thalassemia)'
    ],
    highReasons: [
      'Anemia (caused by low B12 or B9)',
      'Low stomach acid',
      'Heavy metals',
      'Bacterial overgrowth',
      'Hypothyroidism'
    ],
    whatNext: [
      'Low MCV + low ALT, low AST, high Homocysteine could suggest B6 deficiency',
      'Low MCV + low RBC, low Hemoglobin, low Iron, low Ferritin, low Transferrin Saturation, high RDW could suggest iron deficiency',
      'High MCV + high MCH, high MCHC, high LDH, high RDW, low Serum B12, low Serum Folate could suggest B12/B9 deficiency'
    ]
  },
  'Bicarbonate': {
    name: 'Bicarbonate',
    description: 'Bicarbonate is a negatively charged ion which neutralises acids and helps maintain the acid-base balance in the body. It is a good indicator of serum pH unless a respiratory dysfunction exists.',
    optimalValues: '25-30 mmol/L',
    lowReasons: [
      'Metabolic acidosis',
      'Respiratory alkalosis (e.g. hyperventilating / shallow breathing)'
    ],
    highReasons: [
      'Vomiting',
      'Metabolic alkalosis',
      'Respiratory acidosis (e.g. inability to properly breathe out CO2)',
      'Hypochlorhydria (low stomach acid)'
    ],
    whatNext: [
      'Low bicarbonate + high chloride may suggest metabolic acidosis',
      'High bicarbonate + low chloride + low calcium + low potassium may suggest metabolic alkalosis'
    ]
  }
};

/**
 * Parse reasons string (comma-separated or newline-separated) into array
 */
function parseReasons(reasonsStr?: string): string[] {
  if (!reasonsStr) return [];

  // Split by newlines first, then by commas
  const items = reasonsStr.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  return items;
}

/**
 * Get biomarker information including high/low reasons
 * Merges default reasons from database with custom reasons from biomarker config
 */
export function getBiomarkerInfo(biomarkerName: string, customBiomarker?: Biomarker): BiomarkerInfo | null {
  // Try exact match first
  let info = BIOMARKER_INFO_DB[biomarkerName];

  // Try case-insensitive match if no exact match
  if (!info) {
    const normalizedName = biomarkerName.toLowerCase();
    for (const [key, value] of Object.entries(BIOMARKER_INFO_DB)) {
      if (key.toLowerCase() === normalizedName) {
        info = value;
        break;
      }
    }
  }

  // If we have custom reasons from the biomarker config, merge them
  if (customBiomarker && (customBiomarker.lowReasons || customBiomarker.highReasons)) {
    const customLowReasons = parseReasons(customBiomarker.lowReasons);
    const customHighReasons = parseReasons(customBiomarker.highReasons);

    // Create info object if it doesn't exist
    if (!info) {
      return {
        name: biomarkerName,
        lowReasons: customLowReasons,
        highReasons: customHighReasons,
      };
    }

    // Merge custom reasons with default ones
    return {
      ...info,
      lowReasons: [...(info.lowReasons || []), ...customLowReasons],
      highReasons: [...(info.highReasons || []), ...customHighReasons],
    };
  }

  return info;
}

/**
 * Check if biomarker has detailed information available
 */
export function hasBiomarkerInfo(biomarkerName: string, customBiomarker?: Biomarker): boolean {
  return getBiomarkerInfo(biomarkerName, customBiomarker) !== null;
}

/**
 * Get list of all biomarkers with detailed information
 */
export function getAllBiomarkerNames(): string[] {
  return Object.keys(BIOMARKER_INFO_DB);
}
