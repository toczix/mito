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
  },
  'Chloride': {
    name: 'Chloride',
    description: 'Chloride is a negatively charged ion regulated by the kidneys and involved in the acid-base balance in the body. Chloride is essential in the production of stomach acid so is associated with hypochlorhydria. Chloride and sodium have a reciprocal relationship.',
    optimalValues: '100-105 mmol/L',
    lowReasons: ['Vomiting', 'Metabolic alkalosis', 'Hypochlorhydria (low stomach acid)', 'Adrenal insufficiency'],
    highReasons: ['Acidosis', 'Hyperventilation (respiratory alkalosis)', 'Kidney dysfunction', 'Diarrhea', 'Dehydration'],
    whatNext: ['Low chloride + low sodium + high/normal potassium + low/normal glucose may suggest adrenal insufficiency', 'Low chloride + high CO2 + low calcium + low potassium may suggest metabolic alkalosis', 'High chloride + low CO2 may suggest metabolic acidosis', 'High chloride + low CO2 + high RBC + high hemoglobin + high BUN + high sodium + high potassium + high albumin may suggest dehydration']
  },
  'Total Cholesterol': {
    name: 'Total Cholesterol',
    description: 'Cholesterol is an essential constituent of cell membranes and a precursor for steroidal hormones and bile acids. Total Cholesterol is calculated by adding LDL Cholesterol, HDL Cholesterol, and 20% of triglyceride levels.',
    optimalValues: '4.2-6.4 mmol/L (162-240 mg/dL)',
    lowReasons: ['Liver dysfunction', 'Hyperthyroidism', 'Low fat intake / fat malabsorption', 'Chronic inflammation', 'Some studies show association with low steroidal hormones'],
    highReasons: ['Biliary insufficiency / gallbladder dysfunction', 'Hypothyroidism', 'High Insulin', 'Gene variations', 'Pregnancy'],
    whatNext: ['If Total Cholesterol is high or low, assess thyroid markers (TSH, FT3, FT4), and liver / gallbladder markers (bilirubin, AST, ALT, GGT, ALP) as thyroid dysfunction and gallbladder / biliary dysfunction are two common causes of irregular Total Cholesterol']
  },
  'HDL Cholesterol': {
    name: 'HDL Cholesterol',
    description: 'HDL Cholesterol is generally (and incorrectly) considered the "good" cholesterol because it acts as a cholesterol transporter away from peripheral tissue towards the liver. HDL Cholesterol can be both protective (acting as an antioxidant) and can also increase cardiovascular disease risk (by acting as a pro oxidant).',
    optimalValues: '1.29-2.2 mmol/L (50-85 mg/dL)',
    lowReasons: ['Cholestasis (low bile flow)', 'Insulin resistance / obesity', 'Hyperthyroidism', 'Anabolic steroid use'],
    highReasons: ['Negative gram bacteria overgrowth (high LPS)', 'Intestinal permeability', 'Liver dysfunction', 'Excessive alcohol intake', 'Inflammation / autoimmunity'],
    whatNext: ['If HDL Cholesterol is high or low, assess entire lipid panel (LDL Cholesterol, Triglycerides), inflammation markers (White blood cells, ESR, CRP), thyroid markers (TSH, FT3, FT4), and liver / gallbladder markers (Bilirubin, AST, ALT, GGT, ALP)']
  },
  'LDL Cholesterol': {
    name: 'LDL Cholesterol',
    description: 'Cholesterol is an essential constituent of cell membranes and a precursor for steroidal hormones and bile acids. LDL carries cholesterol from the liver to peripheral tissues.',
    optimalValues: '2.07-4.4 mmol/L (80-170 mg/dL)',
    lowReasons: ['Inflammation / LPS', 'Hyperthyroidism', 'Low fat intake / fat malabsorption'],
    highReasons: ['Biliary insufficiency / gallbladder dysfunction', 'Hypothyroidism', 'High Insulin', 'Gene variations', 'Pregnancy', 'Anabolic steroid use'],
    whatNext: ['If LDL Cholesterol is high or low, assess entire lipid panel (HDL Cholesterol, Triglycerides), inflammation markers (White blood cells, ESR, CRP), thyroid markers (TSH, FT3, FT4), and liver / gallbladder markers (bilirubin, AST, ALT, GGT, ALP)']
  },
  'Fasting Glucose': {
    name: 'Fasting Glucose',
    description: 'Blood glucose is the body\'s primary energy source, and is regulated by the liver and a range of adrenal and gut hormones. An elevated blood glucose is associated with insulin resistance and metabolic dysfunctions, while a decreased blood glucose level is associated with hypoglycemic tendencies.',
    optimalValues: '4.44-5.0 mmol/L (80-90 mg/dL)',
    lowReasons: ['Hypoadrenal function', 'Hypothyroidism', 'Hypoglycemia', 'Nutrient deficiencies'],
    highReasons: ['Insulin resistance', 'Fatty liver', 'Pancreatic dysfunction', 'Hyperadrenal function / acute stress', 'Hyperthyroidism', 'Pregnancy'],
    whatNext: ['If fasting glucose is low and LDH is low, suspect hypoglycemia', 'If fasting glucose is low and sodium is low/normal with a high/normal potassium, suspect hypoadrenal function', 'If fasting glucose is low and Urea or ALT or AST are low, and the person is dieting, under eating, or plant based, consider nutrient deficiencies', 'If fasting glucose is high and GGT, Triglycerides, AST or ALT are high, consider fatty liver / metabolic dysfunction', 'Assess against TSH, FT3, and FT4 for interfering thyroid irregularities']
  },
  'Ferritin': {
    name: 'Ferritin',
    description: 'Ferritin is a storage protein for iron in the body and can be used as a more accurate indication of iron status than a serum iron test alone. Ferritin levels are known to increase in the presence of inflammation or infection and this may not be representative of stored iron levels in these instances.',
    optimalValues: '50-150 ug/L (50-150 ng/mL)',
    lowReasons: ['Low iron intake / iron deficiency', 'Blood loss (e.g internal bleeding, menses)', 'Hypochlorhydria / malabsorption', 'Chronic infection'],
    highReasons: ['Hemochromatosis', 'Inflammation', 'Liver damage / fatty liver', 'Anemia of chronic disease', 'B6 deficiency'],
    whatNext: ['Assess the rest of the iron panel (Iron, Transferrin, TIBC)', 'If low: Assess for high MCV and MCH and low ALP, Chloride, and Gastrin if suspecting hypochlorhydria', 'If low: Assess hemoglobin, serum iron, and transferrin saturation (low) and transferrin / TIBC (high) if suspecting iron deficiency', 'If high: Assess if AST and ALT are low if suspecting B6 deficiency', 'If high: Assess for hemochromatosis', 'If high: Assess for liver burden or fatty liver']
  },
  'Triglycerides': {
    name: 'Triglycerides',
    description: 'Triglycerides are fatty acids that are derived from dietary intake (fats) or created by the liver. Triglycerides are the primary storage form of fatty acids in the body, and are heavily influenced by dietary fat consumption. Elevated triglycerides are strongly associated with metabolic issues, fatty liver, and insulin resistance.',
    optimalValues: '0.6-1.0 mmol/L (53-88.5 mg/dL)',
    lowReasons: ['Autoimmunity / chronic inflammation', 'Low fat intake / vegetarian diet', 'Poor fat absorption'],
    highReasons: ['Insulin resistance', 'Fatty liver', 'Hypothyroidism', 'Excessive alcohol intake', 'Anorexia', 'Poor utilisation of fats'],
    whatNext: ['If triglycerides are low, then assess white blood cells (may be high or low) and high ESR for signs of chronic inflammation', 'If triglycerides are elevated + high GGT, then assess for Fatty Liver']
  },
  'Sodium': {
    name: 'Sodium',
    description: 'Sodium is an electrolyte needed for fluid balance, kidney function, acidity balance, and adrenal function. Sodium and potassium work together to regulate a cellular pump / transportation process.',
    optimalValues: '137-143 mmol/L',
    lowReasons: ['Adrenal insufficiency / low aldosterone', 'Low salt intake', 'Diuretics', 'High blood glucose', 'Hypothyroidism', 'Addison\'s disease', 'Fluid loss (e.g vomiting, diarrhea, excess sweating)'],
    highReasons: ['Dehydration', 'Cushing\'s disease', 'High aldosterone', 'High sodium intake'],
    whatNext: ['Low sodium + high / normal potassium + low / normal glucose may suggest adrenal insufficiency', 'High sodium + low potassium may suggest adrenal stress']
  },
  'Potassium': {
    name: 'Potassium',
    description: 'Potassium is one of the main electrolytes in the body and works together with sodium to regulate a cellular pump / transportation process. Around 95% of our potassium is within cells, so even a small change in serum potassium can be significant.',
    optimalValues: '4.0-4.5 mmol/L',
    lowReasons: ['Adrenal stress / high aldosterone', 'Fluid loss (e.g vomiting, diarrhea, excess sweating)', 'High insulin', 'Low magnesium'],
    highReasons: ['Dehydration / impaired kidney function', 'Acute increase in potassium intake', 'Low aldosterone', 'Cell damage (e.g. excess exercise)'],
    whatNext: ['Low potassium + high sodium may suggest adrenal stress / elevated aldosterone', 'Low potassium + low sodium may suggest excess fluid loss', 'High / normal potassium + low sodium + low / normal glucose may suggest adrenal insufficiency']
  },
  'Total Bilirubin': {
    name: 'Total Bilirubin',
    description: 'Bilirubin is a by-product of broken down red blood cells. Bilirubin is a fat soluble antioxidant and requires zinc to convert the precursor of bilirubin (biliverdin) into bilirubin. Bilirubin mixes with bile once it is conjugated and before it is eliminated.',
    optimalValues: '5-13.6 umol/L (0.29-0.8 mg/dL)',
    lowReasons: ['Oxidative stress', 'Zinc deficiency'],
    highReasons: ['Increased red blood cell breakdown', 'Gilbert\'s Syndrome', 'Bile duct obstruction', 'Small intestinal bacterial overgrowth', 'Liver dysfunction'],
    whatNext: ['If Bilirubin is low + high GGT + low uric acid may suggest oxidative stress', 'Low Bilirubin + low ALP may suggest low zinc', 'High Bilirubin + high AST + high ALT + high GGT + high ALP may suggest gallbladder dysfunction', 'If the lab tested the two individual Bilirubin types (direct / indirect) then assess these to see which is high']
  },
  'Total Protein': {
    name: 'Total Protein',
    description: 'Total Protein is the sum total of Albumin and Globulin. Because Total Protein does not specify which protein marker is low (Albumin or Globulin), this marker is of little clinical relevance and you should always refer to Albumin and Globulin.',
    optimalValues: '62-78 g/L (6.2-7.8 g/dL)',
    lowReasons: ['Assess Albumin and Globulin individually'],
    highReasons: ['Assess Albumin and Globulin individually'],
    whatNext: ['Whether Total Protein is High, Low, or Normal, we must always assess Albumin and Globulin levels']
  },
  'Vitamin B12': {
    name: 'Vitamin B12',
    description: 'Vitamin B12 is an essential nutrient derived from animal products required for the synthesis of DNA, red blood cell maturation, and nerves. A Vitamin B12 blood test measures total circulating B12 (this includes active and inactive forms bound to transport proteins, with most of it being inactive).',
    optimalValues: '350-650 pmol/L (474-880 pg/mL)',
    lowReasons: ['Low animal protein intake', 'Low stomach acid / gastritis', 'Megaloblastic anemia', 'SIBO', 'Dementia', 'Metformin or PPI use', 'Hypothyroidism'],
    highReasons: ['Excess supplementation', 'Functional deficiency (may exhibit deficiency symptoms)', 'Liver or kidney dysfunction', 'High neutrophil activity', 'Cancer'],
    whatNext: ['If Vitamin B12 is low, assess for high MCV to indicate suspected B12 deficiency', 'If Vitamin B12 is high, assess for deficiency symptoms, enquire around supplementation habits, and assess immune markers (e.g. white blood cells)']
  },
  'Vitamin D': {
    name: 'Vitamin D',
    description: '25-hydroxyvitamin D is the primary circulating form of vitamin D in the blood and is used as an indicator of vitamin D status. It is produced in the liver through the hydroxylation of vitamin D3 (cholecalciferol), which is synthesized via exposure to sun, or obtained through diet or supplementation.',
    optimalValues: '125-225 nmol/L (50-90 ng/mL)',
    lowReasons: ['Vitamin D deficiency', 'Correlated with cardiovascular disease, metabolic diseases, and cancer', 'Osteoporosis', 'Inflammation or infection', 'Autoimmunity', 'Genetic mutations (affecting conversion or receptors)', 'Medication use (e.g. cholestyramine)'],
    highReasons: ['Excess supplementation', 'Excess calcium and kidney stone formation', 'Magnesium deficiency'],
    whatNext: ['If low, assess inflammatory markers, metabolic markers, lipid markers, and consider supplementation', 'If high, cease supplementation and assess calcium levels']
  },
  'Vitamin D (25-Hydroxy D)': {
    name: 'Vitamin D (25-Hydroxy D)',
    description: '25-hydroxyvitamin D is the primary circulating form of vitamin D in the blood and is used as an indicator of vitamin D status. It is produced in the liver through the hydroxylation of vitamin D3 (cholecalciferol), which is synthesized via exposure to sun, or obtained through diet or supplementation.',
    optimalValues: '125-225 nmol/L (50-90 ng/mL)',
    lowReasons: ['Vitamin D deficiency', 'Correlated with cardiovascular disease, metabolic diseases, and cancer', 'Osteoporosis', 'Inflammation or infection', 'Autoimmunity', 'Genetic mutations (affecting conversion or receptors)', 'Medication use (e.g. cholestyramine)'],
    highReasons: ['Excess supplementation', 'Excess calcium and kidney stone formation', 'Magnesium deficiency'],
    whatNext: ['If low, assess inflammatory markers, metabolic markers, lipid markers, and consider supplementation', 'If high, cease supplementation and assess calcium levels']
  },
  'Serum Magnesium': {
    name: 'Serum Magnesium',
    description: 'Magnesium is an essential mineral that is involved in hundreds of bodily processes, including nerve and muscle function, cardiovascular health, glucose metabolism, energy production, blood pressure regulation, and bone health. Only about 1-5% of total magnesium is found extra cellularly (this is what is tested on a serum magnesium blood test).',
    optimalValues: '0.9-1.0 mmol/L (2.19-2.43 mg/dL)',
    lowReasons: ['Adrenal hyperfunction', 'Excessive alcohol intake', 'Fluid loss (e.g. diarrhea)', 'Metabolic dysfunction'],
    highReasons: ['Hypothyroid', 'Dehydration / poor kidney clearance', 'Adrenal insufficiency', 'Excess breakdown of red blood cells'],
    whatNext: ['Assess other adrenal markers (e.g. sodium, potassium, glucose)', 'Assess kidney markers (e.g. urea, creatinine, uric acid)', 'Assess lifestyle factors (e.g. alcohol intake, hydration status, dietary / supplemental intake)']
  },
  'Phosphorus': {
    name: 'Phosphorus',
    description: 'A large amount of phosphorus is stored in bone, however it is also a primary component of the phospholipid membrane of all cells in the body. Phosphorus is essential for energy production. Phosphorus (like calcium) is largely regulated by the kidneys.',
    optimalValues: '3.0-4.0 mg/dL (0.97-1.29 mmol/L)',
    lowReasons: ['Poor absorption (e.g. low stomach acid)', 'Low vitamin D', 'High insulin / refined carbohydrate intake'],
    highReasons: ['Excess vitamin D', 'Kidney insufficiency', 'Parathyroid hypofunction', 'Bone growth (e.g. in children)', 'Excess processed foods'],
    whatNext: ['If phosphorus is high or low, assess for factors that could influence absorption (e.g. Vitamin D levels, Parathyroid Hormone, dietary intake of phosphorus or refined sugar)']
  },
  'Homocysteine': {
    name: 'Homocysteine',
    description: 'Homocysteine is an intermediary compound in the conversion of methionine into cysteine (which is a precursor for glutathione). Elevated levels of homocysteine have been associated with an increased risk of cardiovascular and metabolic diseases. The conversion process involves vitamin B6, B12, and B9.',
    optimalValues: '6-10 umol/L',
    lowReasons: ['Glutathione need', 'Low protein intake', 'Pregnancy', 'Insulin resistance', 'Oxidative stress', 'Hyperthyroidism', 'Excessive folate supplementation'],
    highReasons: ['B12/B6/B9 deficiency', 'Vitamin C deficiency', 'MTHFR gene mutation', 'Smoking', 'Hypothyroidism', 'High muscle mass', 'Cardiovascular disease / stroke risk'],
    whatNext: ['If Homocysteine is low assess nutrient intake of sulfur based compounds (e.g. meat) and for signs of oxidative stress (e.g. high or low GGT, high uric acid, high bilirubin)', 'If Homocysteine is high then assess metabolic markers (e.g. glucose, insulin, HBA1C, Cholesterol, Triglycerides) and B vitamin status (e.g. MCV, serum folate and serum B12)']
  },
  'Serum Folate': {
    name: 'Serum Folate',
    description: 'Folate is a B Vitamin (B9) that is required (along with B12) for DNA synthesis, red blood synthesis, homocysteine metabolism, methylation, and maternal health. Serum folate is a sensitive marker of short-term folate intake, responding very quickly to dietary changes or supplementation.',
    optimalValues: '34.09-59 nmol/L (15-25.96 ng/mL)',
    lowReasons: ['Low dietary folate intake', 'Megaloblastic anemia', 'Neural tube defect', 'Medication use (e.g. Metformin, oral contraception)'],
    highReasons: ['Excess supplementation', 'Maternal risks', 'May be associated with bacterial overgrowth'],
    whatNext: ['If Serum Folate is low, assess for low B12, high Homocysteine, and high MCV to indicate suspected B Vitamin deficiencies', 'If Serum Folate is high, assess for excess supplementation']
  },
  'Serum Iron': {
    name: 'Serum Iron',
    description: 'Serum iron measures the iron that is bound to serum proteins (mainly transferrin). Generally around 1/3 of transferrin is saturated with iron. Around 70% of the iron in the body is in the form of hemoglobin, and therefore Red Blood Cell markers and the rest of an iron panel must be assessed together.',
    optimalValues: '14.3-23.2 umol/L (80-130 mcg/dL)',
    lowReasons: ['Infection / inflammation', 'Blood loss (e.g internal bleeding, menses)', 'Liver dysfunction', 'Iron deficiency', 'Hypochlorhydria'],
    highReasons: ['Hemochromatosis', 'Vitamin B6 deficiency', 'Infection / parasitic infection', 'Thalassemia', 'Hemolytic anemia'],
    whatNext: ['Assess the rest of the iron panel (Transferrin, TIBC, Ferritin)', 'If high: Assess if AST and ALT are low if suspecting B6 deficiency', 'If high: Assess for hemochromatosis', 'If low: Assess if AST and ALT are high if suspecting liver dysfunction']
  },
  'TIBC': {
    name: 'TIBC',
    description: 'Total Iron Binding Capacity (TIBC) measures the amount of iron that can be bound to transferrin (an iron binding protein produced by the liver) in the blood. When the body is trying to locate and transport more iron (e.g. iron deficiency anemia) TIBC levels tend to rise, and when there is inflammation or liver damage TIBC levels decrease.',
    optimalValues: '44-62 umol/L (250-350 mg/dL)',
    lowReasons: ['Inflammation', 'Anemia of chronic disease / infection', 'Liver dysfunction', 'Iron overload', 'Thalassemia'],
    highReasons: ['Iron deficiency anemia', 'Pregnancy', 'High estrogen / contraceptive pill'],
    whatNext: ['Assess the rest of the iron panel (Iron, Ferritin, Transferrin Saturation)', 'If low: Assess for irregular white blood cells and elevated CRP / ESR if suspecting inflammation / chronic disease / infection', 'If high: Assess for low ferritin if suspecting iron deficiency']
  },
  'Transferrin Saturation': {
    name: 'Transferrin Saturation',
    description: 'Transferrin Saturation % is a calculated value derived by multiplying serum iron levels by 100 and dividing by the TIBC. This provides an indication of how much iron is bound to the iron transporters. In a state of low iron, the transferrin saturation % will be reduced.',
    optimalValues: '20-35%',
    lowReasons: ['Anemia of iron deficiency', 'Anemia of chronic disease / infection'],
    highReasons: ['Iron overload', 'Hemochromatosis', 'Thalassemia', 'Iron supplementation / infusion', 'Acute inflammation'],
    whatNext: ['Assess the rest of the iron panel (Iron, Ferritin, TIBC)', 'If low: Assess for reduced Ferritin with increased transferrin, suggesting iron deficiency', 'If high: Assess for increased Ferritin and Iron, consider testing for hemochromatosis']
  },
  'Transferrin Saturation %': {
    name: 'Transferrin Saturation %',
    description: 'Transferrin Saturation % is a calculated value derived by multiplying serum iron levels by 100 and dividing by the TIBC. This provides an indication of how much iron is bound to the iron transporters. In a state of low iron, the transferrin saturation % will be reduced.',
    optimalValues: '20-35%',
    lowReasons: ['Anemia of iron deficiency', 'Anemia of chronic disease / infection'],
    highReasons: ['Iron overload', 'Hemochromatosis', 'Thalassemia', 'Iron supplementation / infusion', 'Acute inflammation'],
    whatNext: ['Assess the rest of the iron panel (Iron, Ferritin, TIBC)', 'If low: Assess for reduced Ferritin with increased transferrin, suggesting iron deficiency', 'If high: Assess for increased Ferritin and Iron, consider testing for hemochromatosis']
  },
  'LDH': {
    name: 'LDH',
    description: 'LDH (Lactate dehydrogenase) is a group of enzymes found in muscle, organs, and red blood cells. Because LDH is found in all cells, it is very difficult to ascertain which cells are being broken down when it is elevated. LDH is also involved in carbohydrate metabolism.',
    optimalValues: '140-200 IU/L',
    lowReasons: ['Hypoglycemia (low blood sugar)', 'Ketogenic diet', 'Insulin resistance'],
    highReasons: ['Tissue / bone damage', 'Inflammation / infection', 'Hypothyroid', 'Liver damage', 'Anemia'],
    whatNext: ['If LDH is low assess for evidence of blood sugar dysregulation (e.g. test fasting glucose and fasting insulin and assess for symptoms)', 'If LDH is high assess other liver enzymes (AST, ALT, ALP, GGT) to ascertain where the damage may be occurring. Consider running an isoenzymes test']
  },
  'TPO Antibodies': {
    name: 'TPO Antibodies',
    description: 'TPO (Thyroid Peroxidase) is an enzyme found within the thyroid that is required to form the thyroid hormone T4. An elevation in TPO antibodies suggests that the individual is having an immune response and attacking the TPO enzymes within the thyroid cells.',
    optimalValues: 'Refer to lab-specific reference range (lower is better)',
    lowReasons: ['No clinical significance (low is desirable)'],
    highReasons: ['Hashimoto\'s Thyroiditis (autoimmune hypothyroidism)', 'Grave\'s disease', 'Associated with other autoimmune conditions such as Celiac disease and Autoimmune Gastritis', 'Associated with spontaneous miscarriage and recurrent miscarriage'],
    whatNext: ['Assess full thyroid panel (including TSH, FT4, and FT3)', 'In some cases thyroid replacement may be required']
  },
  'Thyroglobulin Antibodies': {
    name: 'Thyroglobulin Antibodies',
    description: 'Thyroglobulin is produced by follicular cells in the thyroid. An elevation in Thyroglobulin antibodies suggests an immune response attacking the thyroglobulin protein. Present in roughly 3/4 of people with autoimmune thyroid disease.',
    optimalValues: 'Refer to lab-specific reference range (lower is better)',
    lowReasons: ['No clinical significance (low is desirable)'],
    highReasons: ['Hashimoto\'s Thyroiditis (autoimmune hypothyroidism)', 'Grave\'s disease (autoimmune hyperthyroidism)', 'Excess iodine intake may be associated with further increasing Thyroglobulin antibodies'],
    whatNext: ['Assess full thyroid panel (including TSH, FT4, FT3 and TPO antibodies)', 'In some cases thyroid replacement may be required']
  },
  'SHBG': {
    name: 'SHBG',
    description: 'Sex hormone-binding globulin (SHBG) is a binding protein that transports sex hormones (primarily testosterone and estrogen). By binding to these hormones SHBG protects them from being degraded, however reduces their bioavailability.',
    optimalValues: '50-80 nmol/L (female), 40-50 nmol/L (male)',
    lowReasons: ['PCOS', 'Metabolic dysfunction', 'Higher bioavailable testosterone', 'Hypothyroidism'],
    highReasons: ['Low bioavailable testosterone', 'Ageing', 'High estrogen / synthetic estrogens (e.g. contraceptives)', 'Disordered eating', 'Hyperthyroidism'],
    whatNext: ['If SHBG is low, assess metabolic markers (e.g. HBA1C, Glucose, Insulin) and thyroid markers (e.g. TSH, FT3, FT4)', 'If SHBG is high, assess estrogen or contraceptive use and thyroid markers (e.g. TSH, FT3, FT4)']
  },
  'Fasting Insulin': {
    name: 'Fasting Insulin',
    description: 'Insulin is released in response to rising blood glucose, helping reduce blood glucose levels by enabling cells to take in glucose. When someone becomes less sensitive to the action of insulin this is referred to as insulin resistance.',
    optimalValues: '13-40 pmol/L (2-6 mg/dL)',
    lowReasons: ['Type 1 Diabetes', 'Pituitary insufficiency', 'GABA deficiency', 'Low GLP-1'],
    highReasons: ['Insulin resistance', 'Fatty liver', 'Pancreatic growths', 'Obesity', 'Medications', 'Pregnancy', 'Dysbiosis / LPS'],
    whatNext: ['If fasting insulin is high + fasting glucose is high, suspect insulin resistance', 'If fasting insulin is high + fasting glucose is high + triglycerides high + GGT high, suspect metabolic dysfunction / fatty liver']
  },
  'Free T3': {
    name: 'Free T3',
    description: 'FT3 is the most active form of thyroid hormone, with about 80% produced in peripheral cells. It measures the unbound levels of T3 in the blood.',
    optimalValues: '3.0-4.5 pg/mL (4.6-6.9 pmol/L)',
    lowReasons: ['Hypothyroidism (primary)', 'Hypothyroidism (secondary)', 'Hypothyroidism (tertiary)', 'Malnourishment / nutrient deficiencies', 'Chronic inflammation / infection', 'Associated with high cholesterol'],
    highReasons: ['Hyperthyroidism', 'Thyroid medication', 'Pregnancy', 'Excess iodine intake'],
    whatNext: ['Assess other thyroid markers (e.g. TSH and FT4)']
  },
  'Free T4': {
    name: 'Free T4',
    description: 'FT4 is a hormone produced by the thyroid gland, stimulated by the pituitary hormone TSH. It measures the unbound levels of T4 in the blood.',
    optimalValues: '1.0-1.55 ng/dL (13.0-20.0 pmol/L)',
    lowReasons: ['Hypothyroidism (primary)', 'Hypothyroidism (secondary)', 'Hypothyroidism (tertiary)', 'Malnourishment'],
    highReasons: ['Hyperthyroidism', 'Thyroid medication', 'Pregnancy'],
    whatNext: ['Assess other thyroid markers (e.g. TSH and FT3)']
  },
  'Hemoglobin': {
    name: 'Hemoglobin',
    description: 'Hemoglobin is a protein molecule that carries oxygen in your blood. Assessing hemoglobin is key for assessing anemia.',
    optimalValues: 'Females: 135-145 g/L (13.5-14.5 g/dL), Males: 145-155 g/L (14.5-15.5 g/dL)',
    lowReasons: ['Anemia (low iron, B vitamins, copper, magnesium, blood loss, heavy periods, low stomach acid)', 'Pregnancy (increased blood volume)'],
    highReasons: ['Dehydration (low water intake, excess exercise, parasites)', 'Asthma / Emphysema (impaired oxygen levels)'],
    whatNext: ['Assess other red blood cell markers, Ferritin, AST, ALT, Homocysteine', 'Assess Albumin, Urea, Electrolytes to identify dehydration']
  },
  'GGT': {
    name: 'GGT',
    description: 'GGT (Gamma Glutamyl Transferase) is a liver enzyme found predominantly in the liver / biliary tree. It is involved in breaking down and synthesising Glutathione (an antioxidant).',
    optimalValues: '12-24 IU/L',
    lowReasons: ['Low amino acid / glutathione precursors', 'Hypothyroidism', 'Negative gram bacteria overgrowth'],
    highReasons: ['Excess glutathione breakdown', 'Toxin exposure (xenobiotics)', 'Biliary dysfunction', 'Oxidative stress', 'Excess alcohol consumption', 'Fatty liver', 'Magnesium deficiency'],
    whatNext: ['If GGT elevated + ALT and AST slightly elevated + elevated triglycerides, consider fatty liver', 'If GGT elevated + ALP elevated + Bilirubin elevated, consider biliary dysfunction']
  },
  'Albumin': {
    name: 'Albumin',
    description: 'Albumin is a protein made in the liver and is involved in transportation and binding (e.g. of hormones). It helps regulate hydration / osmolarity. It is an acute phase negative reactant (decreases under inflammation).',
    optimalValues: '40-50 g/L (4.0-5.0 g/dL)',
    lowReasons: ['Liver dysfunction', 'Kidney dysfunction', 'Inflammation / infection', 'Pregnancy'],
    highReasons: ['Dehydration'],
    whatNext: ['High Albumin + high BUN + low CO2 + high RBC + high hemoglobin + high chloride + high sodium + high potassium may suggest dehydration']
  },
  'Globulin': {
    name: 'Globulin',
    description: 'Globulin is the total of all the different globulins in the blood (transporters or immune proteins; e.g. IgG, IgA, IgM, IgE, beta and alpha globulins). IgG is the most abundant type.',
    optimalValues: '22-28 g/L (2.2-2.8 g/dL)',
    lowReasons: ['Immune insufficiency', 'Chronic inflammation / intestinal permeability', 'Anemia'],
    highReasons: ['Inflammation / infection / intestinal inflammation', 'Autoimmunity', 'Gallbladder dysfunction', 'Parasites', 'Elevated estrogen (e.g. oral contraceptive pill)', 'Low serotonin'],
    whatNext: ['Low Globulin + low neutrophils + low lymphocytes + low monocytes + low eosinophils may suggest chronic inflammation / immune suppression', 'Assess for use of estrogens if Globulin is elevated']
  },
  'WBC': {
    name: 'WBC',
    description: 'White Blood Cell Count measures the total number of white blood cells in the blood. White blood cells are part of the immune system and help fight infections.',
    optimalValues: '4.5-7.5 x10e3/uL',
    lowReasons: ['Chronic infection / inflammation', 'Immune suppression', 'Bone marrow disorders', 'Autoimmune conditions', 'Nutritional deficiencies'],
    highReasons: ['Acute infection', 'Inflammation', 'Stress', 'Tissue damage', 'Allergic reactions', 'Leukemia (very high)'],
    whatNext: ['Assess individual white blood cell types (neutrophils, lymphocytes, monocytes, eosinophils, basophils) to identify the specific cause']
  },
  'RBC': {
    name: 'RBC',
    description: 'Red Blood Cell Count measures the number of red blood cells in the blood. Red blood cells carry oxygen throughout the body.',
    optimalValues: 'Females: 4.0-5.0 x10e12/L, Males: 4.5-5.5 x10e12/L',
    lowReasons: ['Anemia (iron, B12, folate deficiency)', 'Blood loss', 'Bone marrow disorders', 'Chronic disease', 'Hemolysis'],
    highReasons: ['Dehydration', 'Lung disease', 'Heart disease', 'Kidney tumors', 'Polycythemia', 'Living at high altitude'],
    whatNext: ['Assess hemoglobin, hematocrit, MCV, MCH, MCHC together to determine type of anemia or polycythemia']
  },
  'HCT': {
    name: 'HCT',
    description: 'Hematocrit (HCT) measures the percentage of blood volume that is made up of red blood cells. It is closely related to hemoglobin and RBC count.',
    optimalValues: 'Females: 37-47%, Males: 40-50%',
    lowReasons: ['Anemia', 'Blood loss', 'Bone marrow disorders', 'Nutritional deficiencies', 'Overhydration'],
    highReasons: ['Dehydration', 'Polycythemia', 'Lung disease', 'Heart disease', 'Living at high altitude'],
    whatNext: ['Assess with RBC and hemoglobin to determine cause', 'If low, assess iron studies, B12, and folate', 'If high, assess hydration status and oxygen levels']
  },
  'Platelets': {
    name: 'Platelets',
    description: 'Platelets are small blood cells that help with clotting. They prevent bleeding by clumping together and forming plugs at injury sites.',
    optimalValues: '150-400 x10e3/uL',
    lowReasons: ['Bone marrow disorders', 'Autoimmune destruction', 'Viral infections', 'Medication side effects', 'Liver disease', 'Excessive alcohol consumption'],
    highReasons: ['Inflammation', 'Infection', 'Cancer', 'Iron deficiency', 'Post-splenectomy', 'Bone marrow disorders'],
    whatNext: ['If low, assess for bleeding risk and underlying causes', 'If high, assess inflammatory markers and iron status']
  },
  'MCH': {
    name: 'MCH',
    description: 'Mean Corpuscular Hemoglobin measures the average amount of hemoglobin in each red blood cell.',
    optimalValues: '27-33 pg',
    lowReasons: ['Iron deficiency anemia', 'Thalassemia', 'Chronic disease'],
    highReasons: ['B12 or folate deficiency', 'Liver disease', 'Hypothyroidism', 'Alcoholism'],
    whatNext: ['Low MCH + low MCV suggests iron deficiency', 'High MCH + high MCV suggests B12/folate deficiency']
  },
  'MCHC': {
    name: 'MCHC',
    description: 'Mean Corpuscular Hemoglobin Concentration measures the concentration of hemoglobin in red blood cells.',
    optimalValues: '32-36 g/dL',
    lowReasons: ['Iron deficiency anemia', 'Thalassemia', 'Blood loss'],
    highReasons: ['Hereditary spherocytosis', 'Severe burns', 'Autoimmune hemolytic anemia'],
    whatNext: ['MCHC is most stable RBC index', 'Low MCHC + low MCV + low MCH strongly suggests iron deficiency']
  },
  'RDW': {
    name: 'RDW',
    description: 'Red Cell Distribution Width measures the variation in red blood cell size. Higher values indicate more variation.',
    optimalValues: '11.5-14.5%',
    lowReasons: ['Usually not clinically significant'],
    highReasons: ['Iron deficiency', 'B12 or folate deficiency', 'Hemolysis', 'Blood transfusion', 'Bone marrow disorders'],
    whatNext: ['High RDW + low MCV suggests iron deficiency', 'High RDW + high MCV suggests B12/folate deficiency', 'High RDW + normal MCV suggests mixed deficiency or hemolysis']
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
 * Normalize biomarker name for matching (remove special chars, lowercase, trim)
 */
function normalizeBiomarkerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[%()]/g, '') // Remove %, (, )
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();
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

  // Try normalized match (remove special chars)
  if (!info) {
    const normalizedSearchName = normalizeBiomarkerName(biomarkerName);
    for (const [key, value] of Object.entries(BIOMARKER_INFO_DB)) {
      if (normalizeBiomarkerName(key) === normalizedSearchName) {
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
