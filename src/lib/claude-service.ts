import { supabase } from './supabase';
import type { ProcessedPDF } from './pdf-processor';
import type { ExtractedBiomarker } from './biomarkers';

export interface PatientInfo {
  name: string | null;
  dateOfBirth: string | null;  // YYYY-MM-DD format
  gender: 'male' | 'female' | 'other' | null;
  testDate: string | null;  // YYYY-MM-DD format
}

export interface ClaudeResponse {
  biomarkers: ExtractedBiomarker[];
  patientInfo: PatientInfo;
  panelName: string;  // AI-generated summary of what this panel tests
  raw?: string;
}

export interface ClaudeResponseBatch extends Array<ClaudeResponse> {
  _failedFiles?: Array<{ fileName: string; error: string }>;
}

/**
 * NOTE: This function is now in the Edge Function (supabase/functions/analyze-biomarkers/index.ts)
 * Kept here for reference only
 */
/*
function createExtractionPrompt(): string {
  return `You are an expert health data analyst specializing in clinical pathology and nutritional biochemistry.

Your task is to extract PATIENT INFORMATION and ALL biomarker values from the provided laboratory result PDFs or images.

🌍 MULTILINGUAL SUPPORT: This system supports lab reports in ANY LANGUAGE. Lab reports may be in English, Spanish, Portuguese, French, German, Italian, Chinese, Japanese, Korean, Arabic, Russian, Dutch, Polish, Turkish, or any other language. You MUST accurately extract biomarkers regardless of the language used in the document.

⚠️ CRITICAL: You MUST extract EVERY SINGLE biomarker visible in the document. Do NOT skip any values, even if they seem like duplicates or are in unusual formats.

INSTRUCTIONS:
1. THOROUGHLY scan EVERY page of the provided document(s) - look at ALL sections, tables, and data
2. Extract PATIENT DEMOGRAPHIC INFORMATION:
   - Patient's full name (as shown on the lab report, in any language/script)
   - Patient's date of birth (convert to YYYY-MM-DD format, regardless of original date format)
   - Patient's gender/sex (normalize to: male, female, or other - recognize terms like: masculino/femenino, homme/femme, männlich/weiblich, мужской/женский, etc.)
   - Test/collection date (the most recent date if multiple reports, in YYYY-MM-DD format)

3. Extract EVERY biomarker name, its numerical value, and unit of measurement that you can find
4. If a biomarker appears multiple times, use the MOST RECENT value (check dates on the reports)
5. Include ALL of these 54 core biomarkers if present - lab reports use MANY different name variations across languages, so look carefully:

   ⚠️ IMPORTANT MULTILINGUAL PATTERN RECOGNITION:
   - Lab reports vary significantly across countries, languages, scripts, and institutions
   - Be EXTREMELY flexible with word order: "B12 Vitamin" vs "Vitamin B12", "D Vitamin" vs "Vitamin D"
   - Look for variations with/without hyphens, spaces, and punctuation: "B12", "B-12", "B 12"
   - Recognize biomarker names in ALL major languages:
     * English: Glucose, Cholesterol, Vitamin
     * Spanish: Glucosa, Colesterol, Vitamina
     * Portuguese: Glicose, Colesterol, Vitamina
     * French: Glucose, Cholestérol, Vitamine
     * German: Glukose, Cholesterin, Vitamin
     * Italian: Glucosio, Colesterolo, Vitamina
     * Chinese: 葡萄糖 (glucose), 胆固醇 (cholesterol), 维生素 (vitamin)
     * Japanese: グルコース (glucose), コレステロール (cholesterol), ビタミン (vitamin)
     * Korean: 포도당 (glucose), 콜레스테롤 (cholesterol), 비타민 (vitamin)
     * Arabic: الجلوكوز (glucose), الكوليسترول (cholesterol), فيتامين (vitamin)
     * Russian: Глюкоза (glucose), Холестерин (cholesterol), Витамин (vitamin)
     * Dutch: Glucose, Cholesterol, Vitamine
     * Polish: Glukoza, Cholesterol, Witamina
     * Turkish: Glikoz, Kolesterol, Vitamin
   - Common abbreviations may vary: FT3/fT3/F.T.3, HbA1C/HbA1c/HBA1C, etc.
   - Some biomarkers have scientific names: Cobalamin (B12), Calcidiol (Vitamin D), Triiodothyronine (T3)
   - Date formats vary: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD.MM.YYYY, etc. - always convert to YYYY-MM-DD

   LIVER FUNCTION (4):
   - ALP (may appear as: Alkaline Phosphatase, Alk Phos)
   - ALT (may appear as: Alanine Aminotransferase, SGPT)
   - AST (may appear as: Aspartate Aminotransferase, SGOT)
   - GGT (may appear as: Gamma-Glutamyl Transferase, Gamma GT)
   - Total Bilirubin (may appear as: Bilirubin, T Bili)

   KIDNEY FUNCTION (3):
   - BUN (may appear as: Blood Urea Nitrogen, Urea)
   - Creatinine (may appear as: Serum Creatinine, Creat)
   - eGFR (may appear as: Estimated GFR, GFR)

   PROTEINS (3):
   - Albumin (may appear as: Serum Albumin, ALB)
   - Globulin (may appear as: Serum Globulin, Calculated Globulin, Total Globulin)
     Note: Sometimes calculated as Total Protein - Albumin, but extract if shown
   - Total Protein (may appear as: Protein Total, Serum Protein)

   ELECTROLYTES (4):
   - Sodium (may appear as: Na, Serum Sodium)
   - Potassium (may appear as: K, Serum Potassium)
   - Chloride (may appear as: Cl, Serum Chloride)
   - Bicarbonate (may appear as: Carbon Dioxide, CO2, Total CO2, HCO3)

   MINERALS (3):
   - Calcium (may appear as: Serum Calcium, Total Calcium, Ca)
   - Phosphorus (may appear as: Phosphate, Inorganic Phosphorus, P)
   - Serum Magnesium (may appear as: Magnesium, Mg)

   RED BLOOD CELLS (8):
   - RBC (may appear as: Red Blood Cell Count, Erythrocytes)
   - Hemoglobin (may appear as: Hgb, Hb, Haemoglobin)
   - HCT (may appear as: Hematocrit)
   - MCV (may appear as: Mean Corpuscular Volume, Mean Cell Volume)
   - MCH (may appear as: Mean Corpuscular Hemoglobin, Mean Cell Hemoglobin)
   - MCHC (may appear as: Mean Corpuscular Hemoglobin Concentration)
   - RDW (may appear as: Red Cell Distribution Width, RDW-CV)
   - Platelets (may appear as: PLT, Platelet Count, Thrombocytes)

   WHITE BLOOD CELLS (6):
   - WBC (may appear as: White Blood Cell Count, Leukocytes)
   - Neutrophils - IMPORTANT: Extract ONLY the ABSOLUTE COUNT (×10³/µL, K/µL units), NOT the percentage (%)
     (may appear as: Neut, Absolute Neutrophils, Segmented Neutrophils, Segs, Polys, PMN)
   - Lymphocytes - IMPORTANT: Extract ONLY the ABSOLUTE COUNT (×10³/µL, K/µL units), NOT the percentage (%)
     (may appear as: Lymph, Absolute Lymphocytes, Lymphs)
   - Monocytes - IMPORTANT: Extract ONLY the ABSOLUTE COUNT (×10³/µL, K/µL units), NOT the percentage (%)
     (may appear as: Mono, Absolute Monocytes, Monos)
   - Eosinophils - IMPORTANT: Extract ONLY the ABSOLUTE COUNT (×10³/µL, K/µL units), NOT the percentage (%)
     (may appear as: Eos, Absolute Eosinophils, Eosin)
   - Basophils - IMPORTANT: Extract ONLY the ABSOLUTE COUNT (×10³/µL, K/µL units), NOT the percentage (%)
     (may appear as: Baso, Absolute Basophils, Basos)

   LIPIDS (4):
   - Total Cholesterol (may appear as: Cholesterol, Chol, CHOL, Total Cholesterol, Cholesterol Total, Colesterol [Spanish/Portuguese/Italian], Cholestérol [French], Cholesterin [German], Холестерин [Russian], コレステロール [Japanese], 胆固醇 [Chinese], 콜레스테롤 [Korean], الكوليسترول [Arabic], Kolesterol [Turkish/Dutch], Cholesterol [Polish])
   - HDL Cholesterol (may appear as: HDL, HDL-C, HDL C, HDL Cholesterol, Cholesterol HDL, HDL Chol, Colesterol HDL [Spanish/Portuguese], Cholestérol HDL [French], HDL-Cholesterin [German])
   - LDL Cholesterol (may appear as: LDL, LDL-C, LDL C, LDL Cholesterol, Cholesterol LDL, LDL Calculated, LDL Calc, LDL Direct, Colesterol LDL [Spanish/Portuguese], Cholestérol LDL [French], LDL-Cholesterin [German])
   - Triglycerides (may appear as: Trig, TG, TRIG, Triglyceride, Triglycérides [French], Triglicéridos [Spanish/Portuguese], Triglyceride [German], Триглицериды [Russian], トリグリセリド [Japanese], 甘油三酯 [Chinese], 중성지방 [Korean], الدهون الثلاثية [Arabic], Trigliserit [Turkish])

   METABOLIC (3):
   - Fasting Glucose (may appear as: Glucose, Gluc, GLU, Glucose Fasting, FBG, FBS, Blood Glucose, Blood Sugar, Glucosa [Spanish], Glicose [Portuguese], Glycémie [French], Glukose [German], Glucosio [Italian], Глюкоза [Russian], グルコース [Japanese], 葡萄糖 [Chinese], 포도당 [Korean], الجلوكوز [Arabic], Glikoz [Turkish], Glukoza [Polish])
   - HbA1C (may appear as: HbA1c, HbA1C, HBA1C, Hb A1C, A1C, A1c, Hemoglobin A1C, Glycated Hemoglobin, Glycosylated Hemoglobin, Hemoglobina Glicada [Spanish/Portuguese], Hémoglobine Glyquée [French], Glykiertes Hämoglobin [German], 糖化血红蛋白 [Chinese], 糖化ヘモグロビン [Japanese])
   - Fasting Insulin (may appear as: Insulin, Insulin Fasting, Serum Insulin, Insulina [Spanish/Portuguese/Italian], Insuline [French], Инсулин [Russian], インスリン [Japanese], 胰岛素 [Chinese], 인슐린 [Korean])

   THYROID (5):
   - TSH (may appear as: TSH, T.S.H., Thyroid Stimulating Hormone, Thyroid-Stimulating Hormone, Thyrotropin, Tirotropina [Spanish/Italian], Tireotropina [Portuguese], Thyréostimuline [French], Тиреотропный гормон [Russian], 甲状腺刺激ホルモン [Japanese], 促甲状腺激素 [Chinese], 갑상선자극호르몬 [Korean])
   - Free T3 (may appear as: Free T3, FT3, F T3, fT3, F.T.3, T3 Free, T3 Libre [Spanish/French], T3 Livre [Portuguese], Freies T3 [German], T3 Libero [Italian], Свободный T3 [Russian], 遊離T3 [Japanese], 游离T3 [Chinese], 유리T3 [Korean])
   - Free T4 (may appear as: Free T4, FT4, F T4, fT4, F.T.4, T4 Free, T4 Libre [Spanish/French], T4 Livre [Portuguese], Freies T4 [German], T4 Libero [Italian], Свободный T4 [Russian], 遊離T4 [Japanese], 游离T4 [Chinese], 유리T4 [Korean])
   - TPO Antibodies (may appear as: TPO Antibodies, TPO Ab, Thyroid Peroxidase Antibodies, Anti-TPO, Thyroid Peroxidase Ab, Anticuerpos anti-TPO [Spanish], Anticorpos anti-TPO [Portuguese], Anticorps anti-TPO [French])
   - Thyroglobulin Antibodies (may appear as: Thyroglobulin Antibodies, TgAb, Anti-Thyroglobulin, Anti-Tg, Thyroglobulin Ab, Anticuerpos antitiroglobulina [Spanish], Anticorpos antitiroglobulina [Portuguese])

   HORMONES (1):
   - SHBG (may appear as: Sex Hormone Binding Globulin)

   IRON STUDIES (4):
   - Serum Iron (may appear as: Iron, Fe, Iron Total)
   - Ferritin (may appear as: Serum Ferritin)
   - TIBC (may appear as: Total Iron Binding Capacity)
   - Transferrin Saturation % (may appear as: Transferrin Saturation, TSAT, Iron Saturation)

   VITAMINS (3):
   - Vitamin D (25-Hydroxy D) (may appear as: Vitamin D, D Vitamin, 25-Hydroxy Vitamin D, 25-OH Vitamin D, 25(OH)D, Calcidiol, Vitamina D [Spanish/Portuguese/Italian], Vitamine D [French], Vitamin D [German], Витамин D [Russian], ビタミンD [Japanese], 维生素D [Chinese], 비타민D [Korean], فيتامين د [Arabic], D Vitamini [Turkish], Witamina D [Polish])
   - Vitamin B12 (may appear as: B12, B-12, B 12, Vitamin B12, B12 Vitamin, Cobalamin, Vitamin B-12, VitB12, Vit B12, Vitamin B 12, B12 Vitamina [Spanish], Vitamina B12 [Spanish/Portuguese/Italian], B12 Vitamine [French], Vitamine B12 [French], Vitamin B12 [German], Витамин B12 [Russian], ビタミンB12 [Japanese], 维生素B12 [Chinese], 비타민B12 [Korean], فيتامين ب12 [Arabic], B12 Vitamini [Turkish], Witamina B12 [Polish])
     IMPORTANT: This is a critical biomarker - look carefully for it in all sections and check for various word orders (e.g., "B12 Vitamin" vs "Vitamin B12" vs "Vitamina B12")
   - Serum Folate (may appear as: Folate, Folic Acid, Vitamin B9, B9, Folato [Spanish/Italian], Acido Folico [Spanish/Italian], Folato [Portuguese], Acide Folique [French], Folsäure [German], Фолиевая кислота [Russian], 葉酸 [Japanese], 叶酸 [Chinese], 엽산 [Korean], حمض الفوليك [Arabic], Folik Asit [Turkish])

   OTHER (3):
   - Homocysteine (may appear as: Homocystine, Plasma Homocysteine)
   - LDH (may appear as: Lactate Dehydrogenase, LD, LDH Total)

6. ⚠️ CRITICAL RULE FOR WHITE BLOOD CELL DIFFERENTIALS:
   For Neutrophils, Lymphocytes, Monocytes, Eosinophils, and Basophils:
   - ONLY extract the ABSOLUTE COUNT values (units: ×10³/µL, K/µL, K/uL, ×10^3/µL)
   - DO NOT extract percentage (%) values for these markers
   - Lab reports often show BOTH percentage and absolute count - you MUST choose the absolute count
   - Example: If you see "Neutrophils: 55% | 3.2 K/µL" → extract "3.2" with unit "K/µL", NOT "55" with "%"

7. Return ONLY a valid JSON object with this EXACT structure:
{
  "patientInfo": {
    "name": "Patient Full Name or null if not found",
    "dateOfBirth": "YYYY-MM-DD or null if not found",
    "gender": "male, female, other, or null if not found",
    "testDate": "YYYY-MM-DD or null if not found"
  },
  "biomarkers": [
    {
      "name": "Biomarker Name",
      "value": "numerical value only",
      "unit": "unit of measurement"
    }
  ]
}

⚠️ CRITICAL: Your response MUST be ONLY the JSON object - no explanations, no comments, no additional text before or after the JSON.

IMPORTANT RULES:
- Use the PRIMARY biomarker names (e.g., "ALP" not "Alkaline Phosphatase", "Bicarbonate" not "CO2")
- Extract ONLY numerical values for biomarkers (no text descriptions)
- Include the unit exactly as shown
- ⚠️ CRITICAL: For WBC differentials (Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils), extract ONLY absolute counts (×10³/µL, K/µL), NEVER percentages (%)
- If a value is marked as "<0.1" or similar, extract "0.1" and note in the unit
- For dates, always convert to YYYY-MM-DD format
- For gender, normalize to: "male", "female", or "other"
- If patient info is not found, use null
- Do NOT include any explanatory text, only the JSON object
- Ensure the JSON is valid and parseable
- ⚠️ BE EXTREMELY FLEXIBLE with biomarker name matching - check for ALL possible variations including:
  * Different word orders (e.g., "B12 Vitamin" vs "Vitamin B12")
  * With/without hyphens and spaces (e.g., "B12", "B-12", "B 12")
  * Abbreviations and full names (e.g., "TSH" vs "Thyroid Stimulating Hormone")
  * International language variations (Spanish, Portuguese, French, German, Italian)
  * Scientific names (e.g., Cobalamin for B12, Calcidiol for Vitamin D)

⚠️ EXTRACTION REQUIREMENT: 
You should aim to extract AT LEAST 30-40 biomarkers from a typical comprehensive lab report. If you're only extracting a few biomarkers, you're likely missing data - go back and look more carefully at ALL sections of the document, including:
- Complete Blood Count (CBC) sections
- Comprehensive Metabolic Panel (CMP) sections  
- Lipid Panel sections
- Thyroid Panel sections
- Vitamin/Mineral sections
- Any other numerical lab values

Look for values in tables, lists, and anywhere else they might appear. BE THOROUGH!

⚠️ REMINDER: Return ONLY valid JSON - no text before or after. Start your response with { and end with }

🌍 MULTILINGUAL EXTRACTION REMINDER:
- Documents can be in ANY language or mix of languages
- Patient names can use ANY script (Latin, Cyrillic, Arabic, CJK, etc.)
- Biomarker names should be normalized to the PRIMARY English names in your JSON output (e.g., always use "Glucose" not "Glucosa" or "Glicose")
- Units should be preserved exactly as shown in the document
- Dates should always be converted to YYYY-MM-DD format
- Gender should always be normalized to: "male", "female", or "other"

Return your response now:`;
}
*/

/**
 * Extract biomarkers from a SINGLE PDF document using Supabase Edge Function
 * This keeps the Claude API key secure on the server-side
 */
export async function extractBiomarkersFromPdf(
  processedPdf: ProcessedPDF
): Promise<ClaudeResponse> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  try {
    console.log(`📄 Processing file: ${processedPdf.fileName}`);
    console.log(`   - Is Image: ${processedPdf.isImage}`);
    console.log(`   - Page Count: ${processedPdf.pageCount}`);
    console.log(`   - Extracted Text Length: ${processedPdf.extractedText?.length || 0} chars`);

    // Get the current session token for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated. Please log in.');
    }

    // Call the Supabase Edge Function (server-side Claude API)
    console.log('🚀 Sending request to Supabase Edge Function...');

    const { data, error } = await supabase.functions.invoke('analyze-biomarkers', {
      body: { processedPdf },
    });

    if (error) {
      console.error('Edge Function error:', error);
      throw new Error(`Server error: ${error.message}`);
    }

    if (!data) {
      throw new Error('No response from server');
    }

    console.log('✅ Received response from Edge Function');

    // The Edge Function already returns the parsed biomarkers
    return {
      biomarkers: data.biomarkers || [],
      patientInfo: data.patientInfo || {
        name: null,
        dateOfBirth: null,
        gender: null,
        testDate: null,
      },
      panelName: data.panelName || 'Lab Results',
      raw: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Biomarker extraction error:', error);

    if (error instanceof Error) {
      if (error.message.includes('Not authenticated')) {
        throw new Error('Session expired. Please log in again.');
      }
      if (error.message.includes('rate_limit') || error.message.includes('overloaded')) {
        throw new Error('API rate limit exceeded or service is overloaded. Please try again in a moment.');
      }
      throw new Error(`Analysis error: ${error.message}`);
    }

    throw new Error('Failed to analyze document');
  }
}

/**
 * Extract biomarkers from MULTIPLE PDFs (processes in batches to avoid rate limits)
 * Returns array of results, one per PDF
 */
export async function extractBiomarkersFromPdfs(
  processedPdfs: ProcessedPDF[],
  onProgress?: (current: number, total: number, batchInfo?: string) => void
): Promise<ClaudeResponseBatch> {
  if (processedPdfs.length === 0) {
    throw new Error('No PDFs provided');
  }

  // Process PDFs in batches to avoid rate limits
  const BATCH_SIZE = 3; // Process 3 PDFs at a time
  const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches

  const results: ClaudeResponse[] = [];
  const failedFiles: Array<{ fileName: string; error: string }> = [];
  const totalBatches = Math.ceil(processedPdfs.length / BATCH_SIZE);
  let currentBatch = 0;

  for (let i = 0; i < processedPdfs.length; i += BATCH_SIZE) {
    currentBatch++;
    const batch = processedPdfs.slice(i, i + BATCH_SIZE);

    if (onProgress) {
      const batchInfo = processedPdfs.length > BATCH_SIZE
        ? ` (batch ${currentBatch}/${totalBatches})`
        : '';
      onProgress(i, processedPdfs.length, batchInfo);
    }

    // Process batch in parallel with Promise.allSettled to handle partial failures
    const batchPromises = batch.map(pdf => extractBiomarkersFromPdf(pdf));
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Separate successful results from failures
    batchResults.forEach((result, idx) => {
      const pdf = batch[idx];
      if (result.status === 'fulfilled') {
        results.push(result.value);
        console.log(`✅ Successfully extracted biomarkers from ${pdf.fileName}`);
      } else {
        const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failedFiles.push({ fileName: pdf.fileName, error: errorMessage });
        console.error(`❌ Failed to extract biomarkers from ${pdf.fileName}: ${errorMessage}`);
      }
    });
    
    // Add delay between batches (except for the last batch)
    if (i + BATCH_SIZE < processedPdfs.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  if (onProgress) {
    onProgress(processedPdfs.length, processedPdfs.length, '');
  }

  // If ALL files failed, throw an error
  if (results.length === 0 && failedFiles.length > 0) {
    const errorDetails = failedFiles.map(f => `${f.fileName}: ${f.error}`).join('\n');
    throw new Error(`All files failed to process:\n${errorDetails}`);
  }

  // If some files failed, attach failure info to results
  const batchResults: ClaudeResponseBatch = results as ClaudeResponseBatch;
  if (failedFiles.length > 0) {
    batchResults._failedFiles = failedFiles;
    console.warn(`⚠️ ${failedFiles.length} file(s) failed processing, continuing with ${results.length} successful file(s)`);
  }

  return batchResults;
}

/**
 * Generate a smart panel name based on biomarkers found
 */
/* Unused - panel name now generated in Edge Function
function generatePanelName(biomarkers: ExtractedBiomarker[]): string {
  const biomarkerNames = biomarkers.map(b => b.name.toLowerCase());
  const categories: string[] = [];

  // Check for different panel types
  if (biomarkerNames.some(n => n.includes('wbc') || n.includes('rbc') || n.includes('hemoglobin') || n.includes('hematocrit'))) {
    categories.push('CBC');
  }
  if (biomarkerNames.some(n => n.includes('cholesterol') || n.includes('hdl') || n.includes('ldl') || n.includes('triglyceride'))) {
    categories.push('Lipid Panel');
  }
  if (biomarkerNames.some(n => n.includes('testosterone') || n.includes('estrogen') || n.includes('cortisol') || n.includes('dhea'))) {
    categories.push('Hormone Panel');
  }
  if (biomarkerNames.some(n => n.includes('glucose') || n.includes('sodium') || n.includes('potassium') || n.includes('creatinine'))) {
    categories.push('Metabolic Panel');
  }
  if (biomarkerNames.some(n => n.includes('tsh') || n.includes('t3') || n.includes('t4') || n.includes('thyroid'))) {
    categories.push('Thyroid Panel');
  }
  if (biomarkerNames.some(n => n.includes('iron') || n.includes('ferritin') || n.includes('tibc'))) {
    categories.push('Iron Studies');
  }
  if (biomarkerNames.some(n => n.includes('vitamin') || n.includes('b12') || n.includes('folate'))) {
    categories.push('Vitamin Panel');
  }
  if (biomarkerNames.some(n => n.includes('lead') || n.includes('mercury') || n.includes('arsenic') || n.includes('cadmium'))) {
    categories.push('Heavy Metals');
  }

  // Return combined name or default
  if (categories.length === 0) {
    return `Lab Panel (${biomarkers.length} biomarkers)`;
  } else if (categories.length === 1) {
    return categories[0];
  } else {
    return categories.join(' + ');
  }
}
*/

/**
 * Parse the Claude response and extract biomarker data + patient info
 */
/**
 * NOTE: Parsing is now done in the Edge Function
 * Kept here for reference only
 */
/*
function parseClaudeResponse(text: string): { biomarkers: ExtractedBiomarker[]; patientInfo: PatientInfo; panelName: string } {
  try {
    // Try to extract JSON from markdown code blocks if present
    let jsonText = text.trim();
    
    console.log('Raw response length:', text.length);
    console.log('First 300 chars:', text.substring(0, 300));
    console.log('Last 300 chars:', text.substring(Math.max(0, text.length - 300)));
    
    // Strategy 1: Remove markdown code blocks
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
      console.log('Extracted from code block');
    }

    // Strategy 2: Try to find balanced braces - more robust version
    if (!jsonText.startsWith('{')) {
      const firstBrace = jsonText.indexOf('{');
      if (firstBrace !== -1) {
        let depth = 0;
        let endIndex = firstBrace;
        let inString = false;
        let escapeNext = false;
        
        for (let i = firstBrace; i < jsonText.length; i++) {
          const char = jsonText[i];
          
          // Handle escape sequences
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          // Track if we're inside a string
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          // Only count braces outside of strings
          if (!inString) {
            if (char === '{') depth++;
            if (char === '}') {
              depth--;
              if (depth === 0) {
                endIndex = i + 1;
                break;
              }
            }
          }
        }
        jsonText = jsonText.substring(firstBrace, endIndex);
        console.log('Extracted using balanced braces');
      }
    }

    // Clean up common JSON issues but be more careful
    jsonText = jsonText
      .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
      .trim();

    console.log('Attempting to parse JSON (first 500 chars):', jsonText.substring(0, 500));

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (firstParseError) {
      console.warn('First JSON parse failed, trying alternative approach');
      
      // Try to find and extract just the JSON portion more aggressively
      const jsonPattern = /\{[^{}]*"biomarkers"\s*:\s*\[[^\]]*\][^{}]*\}/;
      const simpleMatch = text.match(jsonPattern);
      
      if (simpleMatch) {
        try {
          parsed = JSON.parse(simpleMatch[0]);
          console.log('Successfully parsed using simple pattern match');
        } catch (secondParseError) {
          console.error('Second parse attempt also failed');
          throw firstParseError; // Throw the original error
        }
      } else {
        // Last resort: try to extract between first { and last }
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          try {
            const lastResort = text.substring(start, end + 1).replace(/,\s*([}\]])/g, '$1');
            parsed = JSON.parse(lastResort);
            console.log('Successfully parsed using last resort method');
          } catch (thirdParseError) {
            console.error('All parse attempts failed');
            throw firstParseError; // Throw the original error
          }
        } else {
          throw firstParseError;
        }
      }
    }
    
    if (!parsed.biomarkers || !Array.isArray(parsed.biomarkers)) {
      console.error('Parsed object:', parsed);
      throw new Error('Invalid response format: missing or invalid biomarkers array');
    }

    if (parsed.biomarkers.length === 0) {
      console.warn('Warning: Claude returned 0 biomarkers');
      throw new Error('No biomarkers were extracted from the document. Please ensure the file contains lab results.');
    }

    // Extract patient info (with defaults if missing)
    const patientInfo: PatientInfo = {
      name: parsed.patientInfo?.name || null,
      dateOfBirth: parsed.patientInfo?.dateOfBirth || null,
      gender: parsed.patientInfo?.gender || null,
      testDate: parsed.patientInfo?.testDate || null,
    };

    const biomarkers = parsed.biomarkers.map((b: any) => ({
      name: String(b.name || '').trim(),
      value: String(b.value || '').trim(),
      unit: String(b.unit || '').trim(),
    }));

    // Generate panel name based on biomarkers (fast, client-side)
    const panelName = generatePanelName(biomarkers);

    console.log(`Successfully parsed ${biomarkers.length} biomarkers`);

    return { biomarkers, patientInfo, panelName };
  } catch (error) {
    console.error('Failed to parse Claude response:', error);
    console.error('Raw response (full):', text);
    console.error('Raw response length:', text.length);
    
    // Store the full response in sessionStorage for debugging
    try {
      sessionStorage.setItem('lastClaudeError', JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        rawResponse: text,
        timestamp: new Date().toISOString()
      }));
      console.log('💡 Full error details saved to sessionStorage.lastClaudeError');
    } catch (storageError) {
      console.warn('Could not save error to sessionStorage:', storageError);
    }
    
    // Provide more specific error messages
    if (error instanceof SyntaxError) {
      throw new Error(`Claude returned invalid JSON. Please check browser console (F12) for full response. Error: ${error.message}`);
    }
    
    if (text.length < 50) {
      throw new Error(`Claude returned an unusually short response (${text.length} chars): "${text}". Please try uploading the file again.`);
    }
    
    if (text.toLowerCase().includes('error') || text.toLowerCase().includes('sorry') || text.toLowerCase().includes('unable')) {
      throw new Error(`Claude encountered an issue processing the document: "${text.substring(0, 200)}...". The document may be unreadable or corrupted.`);
    }
    
    if (!text.includes('{') || !text.includes('}')) {
      throw new Error('Claude did not return JSON data. Response did not contain any JSON objects. Check console for full response.');
    }
    
    throw new Error(`Failed to parse biomarker data from Claude's response. Check browser console (F12 → Console) for the full raw response. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
*/

/**
 * Convert name to proper Title Case
 * Examples:
 *   "ASHLEY LEBEDEV" -> "Ashley Lebedev"
 *   "ashley lebedev" -> "Ashley Lebedev"
 */
function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/\b/)
    .map(word => {
      // Capitalize first letter of each word, preserve spaces/punctuation
      if (word.length > 0 && /[a-z]/.test(word[0])) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join('');
}

/**
 * Consolidate patient info from multiple extractions (batch upload for single client)
 * Picks the most common/complete values and flags discrepancies
 */
export function consolidatePatientInfo(
  patientInfos: PatientInfo[]
): { 
  consolidated: PatientInfo; 
  discrepancies: string[];
  confidence: 'high' | 'medium' | 'low';
} {
  const discrepancies: string[] = [];
  
  // Extract all non-null values
  const names = patientInfos.map(p => p.name).filter((n): n is string => n !== null);
  const dobs = patientInfos.map(p => p.dateOfBirth).filter((d): d is string => d !== null);
  const genders = patientInfos.map(p => p.gender).filter((g): g is 'male' | 'female' | 'other' => g !== null);
  const testDates = patientInfos.map(p => p.testDate).filter((t): t is string => t !== null);
  
  // Consolidate names - pick most common, or longest (likely most complete)
  let consolidatedName: string | null = null;
  if (names.length > 0) {
    // Count occurrences
    const nameCounts = new Map<string, number>();
    names.forEach(name => {
      const normalized = name.toLowerCase().trim();
      nameCounts.set(normalized, (nameCounts.get(normalized) || 0) + 1);
    });
    
    // Find most common
    let maxCount = 0;
    let mostCommonName = names[0];
    nameCounts.forEach((count, name) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonName = names.find(n => n.toLowerCase().trim() === name) || name;
      }
    });
    
    // Convert to Title Case for consistency
    consolidatedName = toTitleCase(mostCommonName);
    
    // Check for discrepancies
    const uniqueNames = Array.from(new Set(names.map(n => n.toLowerCase().trim())));
    if (uniqueNames.length > 1) {
      discrepancies.push(`Name: Found ${uniqueNames.length} variations → Using "${consolidatedName}"`);
    }
  }
  
  // Consolidate DOB - pick most common
  let consolidatedDob: string | null = null;
  if (dobs.length > 0) {
    const dobCounts = new Map<string, number>();
    dobs.forEach(dob => {
      dobCounts.set(dob, (dobCounts.get(dob) || 0) + 1);
    });
    
    let maxCount = 0;
    dobs.forEach(dob => {
      const count = dobCounts.get(dob) || 0;
      if (count > maxCount) {
        maxCount = count;
        consolidatedDob = dob;
      }
    });
    
    // Check for discrepancies
    const uniqueDobs = Array.from(new Set(dobs));
    if (uniqueDobs.length > 1) {
      discrepancies.push(`Date of Birth: Found ${uniqueDobs.length} different dates → Using ${consolidatedDob}`);
    }
  }
  
  // Consolidate gender - pick most common
  let consolidatedGender: 'male' | 'female' | 'other' | null = null;
  if (genders.length > 0) {
    const genderCounts = new Map<string, number>();
    genders.forEach(gender => {
      genderCounts.set(gender, (genderCounts.get(gender) || 0) + 1);
    });
    
    let maxCount = 0;
    genders.forEach(gender => {
      const count = genderCounts.get(gender) || 0;
      if (count > maxCount) {
        maxCount = count;
        consolidatedGender = gender;
      }
    });
  }
  
  // Consolidate test date - pick most recent
  let consolidatedTestDate: string | null = null;
  if (testDates.length > 0) {
    consolidatedTestDate = testDates.reduce((latest, current) => {
      return new Date(current) > new Date(latest) ? current : latest;
    });
    
    // Check if there are multiple dates (multiple lab visits)
    const uniqueDates = Array.from(new Set(testDates));
    if (uniqueDates.length > 1) {
      discrepancies.push(`Test Dates: Found ${uniqueDates.length} different dates (multiple lab visits)`);
    }
  }
  
  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (discrepancies.length > 2) {
    confidence = 'low';
  } else if (discrepancies.length > 0) {
    confidence = 'medium';
  }
  
  return {
    consolidated: {
      name: consolidatedName,
      dateOfBirth: consolidatedDob,
      gender: consolidatedGender,
      testDate: consolidatedTestDate,
    },
    discrepancies,
    confidence,
  };
}

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string): { valid: boolean; error?: string } {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key is required' };
  }

  // Basic format check for Anthropic API keys
  if (!apiKey.startsWith('sk-ant-')) {
    return { valid: false, error: 'API key should start with "sk-ant-"' };
  }

  if (apiKey.length < 40) {
    return { valid: false, error: 'API key appears to be too short' };
  }

  return { valid: true };
}

