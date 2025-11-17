import { supabase } from './supabase';
import type { ProcessedPDF } from './pdf-processor';
import type { ExtractedBiomarker, NormalizedBiomarker } from './biomarkers';
import { biomarkerNormalizer } from './biomarker-normalizer';
import { createAdaptiveBatches, calculateAdaptiveDelay, validateBatch } from './adaptive-batching';
import { filterDocuments, isFileTooLarge } from './document-filter';
import { generateBatchId, logBatchMetrics } from './batch-telemetry';

export interface PatientInfo {
  name: string | null;
  dateOfBirth: string | null;  // YYYY-MM-DD format
  gender: 'male' | 'female' | 'other' | null;
  testDate: string | null;  // YYYY-MM-DD format
}

export interface ClaudeResponse {
  biomarkers: ExtractedBiomarker[];
  normalizedBiomarkers?: NormalizedBiomarker[]; // ✅ Optional normalized version
  patientInfo: PatientInfo;
  panelName: string;  // AI-generated summary of what this panel tests
  raw?: string;
}

export interface ClaudeResponseBatch extends Array<ClaudeResponse> {
  _failedFiles?: Array<{ fileName: string; error: string }>;
}

/**
 * Configuration constants for API calls
 */
const EDGE_FUNCTION_TIMEOUT = 180000; // 180 seconds (3 minutes) - abort if taking too long (handles 28-page docs)
const MAX_RETRIES = 2; // Reduced from 3 - only retry transient errors
const INITIAL_RETRY_DELAY = 3000; // 3 seconds
const MAX_RETRY_DELAY = 10000; // 10 seconds

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_RETRY_DELAY,
  maxDelay: number = MAX_RETRY_DELAY,
  timeoutMs: number = EDGE_FUNCTION_TIMEOUT
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wrap with timeout
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);
    } catch (error: any) {
      lastError = error;

      // Don't retry client errors (400-499) except rate limits (429)
      const isClientError = error.status >= 400 && error.status < 500 && error.status !== 429;
      if (isClientError) {
        console.warn(`❌ Client error ${error.status} - not retrying:`, error.message);
        throw error;
      }

      // Don't retry processing timeout errors (these are NOT transient)
      // Processing timeouts mean the file takes too long, retrying won't help
      const isProcessingTimeout =
        error.message?.includes('Request timeout after') ||
        error.message?.includes('Claude API timeout') ||
        error.message?.includes('Processing timeout') ||
        error.message?.includes('File too large') ||
        error.status === 413 || // Payload too large
        error.status === 504;   // Gateway timeout (usually processing time)

      if (isProcessingTimeout) {
        console.warn(`❌ Processing timeout - not retrying:`, error.message);
        throw error;
      }

      // Only retry truly transient errors
      const isRetryable =
        error.message?.includes('overloaded') ||
        error.message?.includes('rate_limit') ||
        error.message?.includes('network') ||
        error.message?.includes('fetch failed') ||
        error.message?.includes('ECONNREFUSED') ||
        error.status === 429 || // Rate limit
        error.status === 503;   // Service unavailable

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      console.warn(`⚠️ Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
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
 * Now includes automatic retry with exponential backoff and timeout
 */
export async function extractBiomarkersFromPdf(
  processedPdf: ProcessedPDF
): Promise<ClaudeResponse> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  // Check supabase is available
  const supabaseClient = supabase;
  if (!supabaseClient) {
    throw new Error('Supabase is not configured');
  }

  return retryWithBackoff(async () => {
    const textLength = processedPdf.extractedText?.length || 0;
    const isLargeFile = textLength > 50000 || processedPdf.pageCount > 10;

    console.log(`📄 Processing file: ${processedPdf.fileName}`);
    console.log(`   - Is Image: ${processedPdf.isImage}`);
    console.log(`   - Page Count: ${processedPdf.pageCount}`);
    console.log(`   - Extracted Text Length: ${textLength} chars`);

    if (isLargeFile) {
      console.warn(`⏱️ Large file detected (${textLength} chars, ${processedPdf.pageCount} pages) - may take 30-60 seconds`);
    }

    console.log('📍 Preparing Edge Function call');
    console.log('📍 Supabase client exists:', !!supabaseClient);
    console.log('📍 ProcessedPDF object:', {
      fileName: processedPdf.fileName,
      isImage: processedPdf.isImage,
      pageCount: processedPdf.pageCount,
      hasText: !!processedPdf.extractedText,
      textLength: processedPdf.extractedText?.length,
      hasImagePages: !!processedPdf.imagePages,
      imagePagesCount: processedPdf.imagePages?.length
    });

    // Call the Supabase Edge Function (server-side Claude API)
    const payloadSize = JSON.stringify({ processedPdf }).length;
    console.log('🚀 Sending request to Supabase Edge Function...');
    console.log(`📦 Payload size: ${(payloadSize / 1024).toFixed(2)} KB`);
    const startTime = Date.now();

    // For large files, add progress heartbeat
    let heartbeatInterval: number | null = null;
    if (isLargeFile) {
      let secondsElapsed = 0;
      heartbeatInterval = setInterval(() => {
        secondsElapsed += 5;
        console.log(`   ⏳ Still processing... ${secondsElapsed}s elapsed`);
      }, 5000) as unknown as number; // Log every 5 seconds
    }

    try {
      // Use AbortController to properly cancel request on timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(`❌ Edge Function timeout after ${EDGE_FUNCTION_TIMEOUT / 1000}s - aborting request`);
        abortController.abort();
      }, EDGE_FUNCTION_TIMEOUT);

      let data, error;
      try {
        const result = await supabaseClient.functions.invoke('analyze-biomarkers', {
          body: { processedPdf },
          // @ts-ignore - signal is supported but not in types
          signal: abortController.signal,
        });
        data = result.data;
        error = result.error;
      } catch (abortError: any) {
        if (abortError.name === 'AbortError') {
          throw new Error(`Edge Function timeout after ${EDGE_FUNCTION_TIMEOUT / 1000}s - request aborted`);
        }
        throw abortError;
      } finally {
        clearTimeout(timeoutId);
      }

      // Clear heartbeat if it was set
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      if (error) {
        console.error('Edge Function error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));

        // Try to extract error message from response body
        // The Supabase client may include the response in error.context or error.message
        let errorMessage = error.message || 'Unknown error';
        let errorDetails = '';

        // IMPORTANT: Try to read the actual response body from the fetch error
        // The error.context might be a Response object we need to read
        if (error.context && error.context instanceof Response) {
          try {
            const responseBody = await error.context.json();
            console.error('Response body:', responseBody);
            if (responseBody.error) {
              errorMessage = responseBody.error;
            }
            if (responseBody.details) {
              errorDetails = responseBody.details;
            }
            if (responseBody.errorType) {
              console.error('Error type:', responseBody.errorType);
            }
          } catch (parseError) {
            console.error('Failed to parse error response body:', parseError);
            // Try to read as text instead
            try {
              const responseText = await error.context.text();
              console.error('Response text:', responseText);
              errorMessage = responseText || errorMessage;
            } catch (textError) {
              console.error('Failed to read response as text:', textError);
            }
          }
        } else if (error.context && typeof error.context === 'object') {
          console.error('Error context:', error.context);

        // Try to find error message in context
        if (error.context.error) {
          errorMessage = typeof error.context.error === 'string'
            ? error.context.error
            : (error.context.error?.message || errorMessage);
        } else if (error.context.message) {
          errorMessage = error.context.message;
        }

        // Try to get details
        if (error.context.details) {
          errorDetails = error.context.details;
          console.error('Error details from context:', errorDetails);
        }
      }

      // If error message contains JSON, try to parse it
      try {
        const errorMatch = errorMessage.match(/\{.*\}/);
        if (errorMatch) {
          const parsedError = JSON.parse(errorMatch[0]);
          if (parsedError.error) {
            errorMessage = parsedError.error;
          }
          if (parsedError.details) {
            errorDetails = parsedError.details;
          }
        }
      } catch (e) {
        // If parsing fails, continue with original message
      }

      // Log additional details if available
      if (errorDetails) {
        console.error('Additional error details:', errorDetails);
      }

      // Check for specific error types
      if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        throw new Error('Edge Function authentication failed. The Edge Function may need to be redeployed with authentication disabled.');
      }

      if (errorMessage.includes('Claude API key not configured')) {
        throw new Error('Claude API key is not configured in Supabase. Please set CLAUDE_API_KEY secret.');
      }

      if (errorMessage.includes('Invalid JSON')) {
        throw new Error('Invalid request format sent to Edge Function.');
      }

      // Check for non-retryable errors (422 = not a lab report)
      if ((error as any).status === 422 || errorMessage.includes('No biomarkers found')) {
        const nonRetryableError: any = new Error(
          errorMessage.includes('No biomarkers found')
            ? `"${processedPdf.fileName}" does not appear to contain lab results. Please ensure you upload laboratory test reports.`
            : errorMessage
        );
        nonRetryableError.status = 422; // Mark as non-retryable
        throw nonRetryableError;
      }

      // Add status code to error for retry logic
      const wrappedError: any = new Error(`Server error: ${errorMessage}`);
      wrappedError.status = (error as any).status;
      throw wrappedError;
    }

    if (!data) {
      throw new Error('No response from server');
    }

      const duration = Date.now() - startTime;
      console.log('✅ Received response from Edge Function');
      console.log(`📊 Processing metrics: ${processedPdf.fileName} took ${(duration / 1000).toFixed(1)}s`);

      // The Edge Function already returns the parsed biomarkers
      const rawResponse = {
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

      // ✅ Normalize biomarkers if available
      try {
        const normalizedBiomarkers = await biomarkerNormalizer.normalizeBatch(
          rawResponse.biomarkers
        );

        return {
          ...rawResponse,
          normalizedBiomarkers
        };
      } catch (normError) {
        console.warn('⚠️ Normalization failed, returning raw biomarkers:', normError);
        return rawResponse; // Return without normalization if it fails
      }
    } finally {
      // Always clear heartbeat on exit
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    }
  }, MAX_RETRIES, INITIAL_RETRY_DELAY, MAX_RETRY_DELAY, EDGE_FUNCTION_TIMEOUT).catch(error => {
    console.error('Biomarker extraction error:', error);

    if (error instanceof Error) {
      if (error.message.includes('Not authenticated')) {
        throw new Error('Session expired. Please log in again.');
      }
      if (error.message.includes('timeout')) {
        throw new Error(`File processing timeout: "${processedPdf.fileName}" took too long to process (>90 seconds). The file may be too large or complex. Try splitting it into smaller documents.`);
      }
      if (error.message.includes('rate_limit') || error.message.includes('overloaded')) {
        throw new Error('API rate limit exceeded or service is overloaded. Please try again in a moment.');
      }
      throw error;
    }

    throw new Error('Failed to analyze document');
  });
}

/**
 * Extract biomarkers from a BATCH of PDFs using INTELLIGENT batching
 * - Large PDFs (20+ pages or 30K+ chars): processed sequentially to avoid rate limiting
 * - Small PDFs: processed in parallel for speed
 */
async function extractBiomarkersFromBatch(
  processedPdfs: ProcessedPDF[],
  onFileProgress?: (fileName: string, status: 'processing' | 'completed' | 'failed', error?: string) => void
): Promise<ClaudeResponse[]> {
  // Separate large and small PDFs
  const LARGE_PDF_THRESHOLD_PAGES = 20;
  const LARGE_PDF_THRESHOLD_CHARS = 30000;

  const largePdfs = processedPdfs.filter(pdf =>
    pdf.pageCount >= LARGE_PDF_THRESHOLD_PAGES ||
    pdf.extractedText.length >= LARGE_PDF_THRESHOLD_CHARS
  );

  const smallPdfs = processedPdfs.filter(pdf =>
    pdf.pageCount < LARGE_PDF_THRESHOLD_PAGES &&
    pdf.extractedText.length < LARGE_PDF_THRESHOLD_CHARS
  );

  console.log(`📦 Intelligent batching: ${largePdfs.length} large PDFs (sequential), ${smallPdfs.length} small PDFs (parallel)`);

  const results: ClaudeResponse[] = [];

  // Process large PDFs sequentially to avoid rate limiting
  if (largePdfs.length > 0) {
    console.log(`🔄 Processing ${largePdfs.length} large PDFs sequentially...`);
    for (const pdf of largePdfs) {
      try {
        if (onFileProgress) {
          onFileProgress(pdf.fileName, 'processing');
        }

        // Use parallel page processing for multi-page text PDFs (>3 pages)
        let result: ClaudeResponse;
        if (pdf.pageTexts && pdf.pageTexts.length > 1 && pdf.pageCount > 3 && !pdf.isImage) {
          console.log(`🚀 Using parallel page processing for ${pdf.fileName} (${pdf.pageCount} pages)`);

          // Create progress callback for page-level progress
          const pageProgressCallback = (pagesComplete: number, totalPages: number) => {
            if (onFileProgress) {
              const percentage = Math.round((pagesComplete / totalPages) * 100);
              onFileProgress(pdf.fileName, 'processing', `Processing pages: ${pagesComplete}/${totalPages} (${percentage}%)`);
            }
          };

          result = await extractBiomarkersWithParallelPages(pdf, pageProgressCallback);
        } else {
          result = await extractBiomarkersFromPdf(pdf);
        }

        if (onFileProgress) {
          onFileProgress(pdf.fileName, 'completed');
        }

        results.push(result);
      } catch (error: any) {
        if (onFileProgress) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          onFileProgress(pdf.fileName, 'failed', errorMessage);
        }
        throw error;
      }
    }
  }

  // Process small PDFs in parallel for speed
  if (smallPdfs.length > 0) {
    console.log(`⚡ Processing ${smallPdfs.length} small PDFs in parallel...`);
    const smallResults = await Promise.all(
      smallPdfs.map(async (pdf) => {
        try {
          if (onFileProgress) {
            onFileProgress(pdf.fileName, 'processing');
          }

          const result = await extractBiomarkersFromPdf(pdf);

          if (onFileProgress) {
            onFileProgress(pdf.fileName, 'completed');
          }

          return result;
        } catch (error: any) {
          if (onFileProgress) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            onFileProgress(pdf.fileName, 'failed', errorMessage);
          }
          throw error;
        }
      })
    );

    results.push(...smallResults);
  }

  return results;
}

/**
 * Extract biomarkers from a single PDF using parallel page processing
 * Processes individual pages in parallel (up to 30 at a time) for faster results
 * with large multi-page documents
 */
export async function extractBiomarkersWithParallelPages(
  processedPdf: ProcessedPDF,
  onProgress?: (pagesComplete: number, totalPages: number) => void
): Promise<ClaudeResponse> {
  const startTime = Date.now();
  const { fileName, pageTexts, pageCount } = processedPdf;

  if (!pageTexts || pageTexts.length === 0) {
    throw new Error('No page texts available for parallel processing');
  }

  console.log(`🚀 PARALLEL PROCESSING: ${fileName} (${pageCount} pages)`);
  console.log(`   - Processing up to 30 pages in parallel (respecting rate limits)`);

  const MAX_PARALLEL = 30;
  const allBiomarkers: ExtractedBiomarker[] = [];
  let patientInfo: PatientInfo | null = null;
  let completedPages = 0;

  for (let batchStart = 0; batchStart < pageTexts.length; batchStart += MAX_PARALLEL) {
    const batchEnd = Math.min(batchStart + MAX_PARALLEL, pageTexts.length);
    const batchPages = pageTexts.slice(batchStart, batchEnd);

    console.log(`   📦 Processing batch: pages ${batchStart + 1}-${batchEnd}`);

    // Process all pages in this batch in parallel
    const batchPromises = batchPages.map(async (pageText, idx) => {
      const pageNum = batchStart + idx + 1;
      const pagePdf: ProcessedPDF = {
        fileName: `${fileName} (Page ${pageNum})`,
        extractedText: pageText,
        pageCount: 1,
        isImage: false,
      };

      try {
        const result = await extractBiomarkersFromPdf(pagePdf);
        completedPages++;
        if (onProgress) {
          onProgress(completedPages, pageCount);
        }
        console.log(`   ✅ Page ${pageNum} complete (${result.biomarkers?.length || 0} biomarkers) - ${completedPages}/${pageCount} pages done`);
        return result;
      } catch (error) {
        completedPages++;
        if (onProgress) {
          onProgress(completedPages, pageCount);
        }
        console.error(`   ❌ Page ${pageNum} failed:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // Combine and deduplicate results
    for (const result of batchResults) {
      if (result && result.biomarkers) {
        allBiomarkers.push(...result.biomarkers);
        if (!patientInfo && result.patientInfo) patientInfo = result.patientInfo;
      }
    }
  }

  // Deduplicate biomarkers by name (case-insensitive)
  const uniqueBiomarkers = Array.from(
    new Map(
      allBiomarkers
        .filter(b => b && b.name) // Filter out invalid biomarkers
        .map(b => [b.name.toLowerCase(), b])
    ).values()
  );

  const duration = Date.now() - startTime;
  console.log(`✅ Parallel processing complete: ${uniqueBiomarkers.length} unique biomarkers in ${(duration / 1000).toFixed(1)}s`);

  return {
    biomarkers: uniqueBiomarkers,
    patientInfo: patientInfo || { name: null, dateOfBirth: null, gender: null, testDate: null },
    panelName: '', // Will be populated if found
  };
}

/**
 * Extract biomarkers from MULTIPLE PDFs with adaptive batching
 *
 * New Features:
 * - Pre-filters empty/invalid documents
 * - Creates adaptive batches based on payload size and token estimates
 * - Validates batches before sending
 * - Implements split-on-failure retry strategy
 * - Tracks telemetry metrics
 * - Uses adaptive delays between batches
 */
export async function extractBiomarkersFromPdfs(
  processedPdfs: ProcessedPDF[],
  onProgress?: (current: number, total: number, batchInfo?: string, status?: string) => void
): Promise<ClaudeResponseBatch> {
  if (processedPdfs.length === 0) {
    throw new Error('No PDFs provided');
  }

  console.group('🚀 Starting Adaptive Batch Processing');
  console.log(`Total files: ${processedPdfs.length}`);

  // Step 1: Pre-filter documents (skip empty/invalid files)
  const { processable, skipped } = filterDocuments(processedPdfs);

  if (processable.length === 0) {
    console.groupEnd();
    throw new Error('No valid lab documents to process. All files were filtered out.');
  }

  // Step 2: Check for oversized files
  const oversizedFiles: Array<{ pdf: ProcessedPDF; reason: string }> = [];
  const validFiles: ProcessedPDF[] = [];

  for (const pdf of processable) {
    const sizeCheck = isFileTooLarge(pdf);
    if (sizeCheck.tooLarge) {
      oversizedFiles.push({ pdf, reason: sizeCheck.reason || 'File too large' });
      console.warn(`⚠️ Skipping oversized file: ${pdf.fileName} - ${sizeCheck.reason}`);
      if (onProgress) {
        onProgress(
          skipped.length + oversizedFiles.length,
          processedPdfs.length,
          '',
          `skipped ${pdf.fileName} (too large - max 10 MB per file)`
        );
      }
    } else {
      validFiles.push(pdf);
    }
  }

  if (validFiles.length === 0) {
    console.groupEnd();
    throw new Error('No files within size limits. All files are too large to process.');
  }

  // Step 3: Create adaptive batches
  const adaptiveBatches = createAdaptiveBatches(validFiles);
  console.groupEnd();

  const results: ClaudeResponse[] = [];
  const failedFiles: Array<{ fileName: string; error: string; retryCount: number }> = [];
  let processedCount = skipped.length + oversizedFiles.length; // Already "processed" skipped files
  let lastBatchDurationMs = 0;

  // Process each adaptive batch
  for (let batchIndex = 0; batchIndex < adaptiveBatches.length; batchIndex++) {
    const batch = adaptiveBatches[batchIndex];
    const batchNumber = batchIndex + 1;
    const batchId = generateBatchId();

    const containsVisionFiles = batch.files.some(pdf =>
      pdf.isImage ||
      (pdf.imagePages && pdf.imagePages.length > 0)
    );

    // If the batch mixes scanned/image documents, process them sequentially with Vision
    if (containsVisionFiles && batch.files.length > 1) {
      console.log(`📸 Batch ${batchNumber}/${adaptiveBatches.length} contains scanned images. Processing sequentially via Vision API.`);

      let maxSequentialDuration = 0;

      for (const pdf of batch.files) {
        const singleBatchId = generateBatchId();
        const singleStartTime = Date.now();

        if (onProgress) {
          onProgress(
            processedCount,
            processedPdfs.length,
            ` (batch ${batchNumber}/${adaptiveBatches.length})`,
            `processing ${pdf.fileName}`
          );
        }

        try {
          const singleResult = await extractBiomarkersFromPdf(pdf);
          const singleDuration = Date.now() - singleStartTime;
          maxSequentialDuration = Math.max(maxSequentialDuration, singleDuration);

          logBatchMetrics(singleBatchId, [pdf], singleDuration, true);

          results.push(singleResult);
          processedCount++;
          console.log(`✅ Processed image document via Vision: ${pdf.fileName} (${(singleDuration / 1000).toFixed(1)}s)`);

          if (onProgress) {
            onProgress(
              processedCount,
              processedPdfs.length,
              ` (batch ${batchNumber}/${adaptiveBatches.length})`,
              `completed ${pdf.fileName}`
            );
          }
        } catch (singleError: any) {
          const singleDuration = Date.now() - singleStartTime;
          maxSequentialDuration = Math.max(maxSequentialDuration, singleDuration);

          const errorMessage = singleError instanceof Error ? singleError.message : String(singleError);
          const errorType = getErrorType(singleError);

          logBatchMetrics(
            singleBatchId,
            [pdf],
            singleDuration,
            false,
            singleError.status || singleError.statusCode,
            errorType
          );

          failedFiles.push({
            fileName: pdf.fileName,
            error: errorMessage,
            retryCount: 0
          });
          processedCount++;
          console.error(`❌ Vision processing failed: ${pdf.fileName} - ${errorMessage}`);

          if (onProgress) {
            onProgress(
              processedCount,
              processedPdfs.length,
              ` (batch ${batchNumber}/${adaptiveBatches.length})`,
              `failed ${pdf.fileName}`
            );
          }
        }

        // Small delay between Vision requests to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      lastBatchDurationMs = maxSequentialDuration;

      // Adaptive delay handled at end of loop
      continue;
    }

    // Validate batch before sending (text or non-image batches)
    const validation = validateBatch(batch);
    if (!validation.valid) {
      console.error(`❌ Batch ${batchNumber} validation failed:`, validation.errors);
      for (const pdf of batch.files) {
        failedFiles.push({
          fileName: pdf.fileName,
          error: validation.errors.join('; '),
          retryCount: 0
        });
        processedCount++;
      }
      continue;
    }

    // Log warnings
    if (validation.warnings.length > 0) {
      console.warn(`⚠️ Batch ${batchNumber} warnings:`, validation.warnings);
    }

    // Update progress
    if (onProgress) {
      onProgress(
        processedCount,
        processedPdfs.length,
        ` (batch ${batchNumber}/${adaptiveBatches.length})`,
        `processing ${batch.fileCount} ${batch.batchType} files`
      );
    }

    console.log(`🚀 Processing adaptive batch ${batchNumber}/${adaptiveBatches.length} [${batch.batchType}]`);
    const batchStartTime = Date.now();

    try {
      // Process batch with per-file progress tracking
      const batchResults = await extractBiomarkersFromBatch(
        batch.files,
        (fileName, status, _error) => {
          if (onProgress) {
            onProgress(
              processedCount,
              processedPdfs.length,
              ` (batch ${batchNumber}/${adaptiveBatches.length})`,
              `${status} ${fileName}`
            );
          }
        }
      );
      const batchDuration = Date.now() - batchStartTime;
      lastBatchDurationMs = batchDuration;

      // Log telemetry
      logBatchMetrics(batchId, batch.files, batchDuration, true);

      results.push(...batchResults);
      processedCount += batch.files.length;

      console.log(`✅ Batch ${batchNumber}/${adaptiveBatches.length} completed in ${(batchDuration / 1000).toFixed(1)}s`);

      // Update progress
      if (onProgress) {
        onProgress(
          processedCount,
          processedPdfs.length,
          ` (batch ${batchNumber}/${adaptiveBatches.length})`,
          `completed ${batch.fileCount} files`
        );
      }

    } catch (error: any) {
      const batchDuration = Date.now() - batchStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = getErrorType(error);

      console.error(`❌ Batch ${batchNumber}/${adaptiveBatches.length} failed: ${errorMessage}`);

      // Log failed batch metrics
      logBatchMetrics(
        batchId,
        batch.files,
        batchDuration,
        false,
        error.status || error.statusCode,
        errorType
      );

      // SPLIT-ON-FAILURE RETRY: If batch fails, retry files individually
      if (batch.files.length > 1) {
        console.log(`🔄 Retrying ${batch.files.length} files individually...`);

        for (const pdf of batch.files) {
          try {
            if (onProgress) {
              onProgress(
                processedCount,
                processedPdfs.length,
                ` (batch ${batchNumber}/${adaptiveBatches.length})`,
                `processing ${pdf.fileName}`
              );
            }

            const singleResult = await extractBiomarkersFromPdf(pdf);
            results.push(singleResult);
            processedCount++;
            console.log(`✅ Individual retry succeeded: ${pdf.fileName}`);

            if (onProgress) {
              onProgress(
                processedCount,
                processedPdfs.length,
                ` (batch ${batchNumber}/${adaptiveBatches.length})`,
                `completed ${pdf.fileName}`
              );
            }
          } catch (retryError: any) {
            const retryErrorMessage = retryError instanceof Error ? retryError.message : String(retryError);
            failedFiles.push({
              fileName: pdf.fileName,
              error: `Batch failed, retry failed: ${retryErrorMessage}`,
              retryCount: 1
            });
            processedCount++;
            console.error(`❌ Individual retry failed: ${pdf.fileName}`);

            if (onProgress) {
              onProgress(
                processedCount,
                processedPdfs.length,
                ` (batch ${batchNumber}/${adaptiveBatches.length})`,
                `failed ${pdf.fileName}`
              );
            }
          }

          // Small delay between individual retries
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        // Single file batch failed, no retry
        for (const pdf of batch.files) {
          failedFiles.push({
            fileName: pdf.fileName,
            error: errorMessage,
            retryCount: 0
          });
          processedCount++;
        }
      }

      if (onProgress) {
        onProgress(
          processedCount,
          processedPdfs.length,
          ` (batch ${batchNumber}/${adaptiveBatches.length})`,
          `batch failed, retried individually`
        );
      }
    }

    // Adaptive delay between batches
    if (batchIndex < adaptiveBatches.length - 1) {
      const delay = calculateAdaptiveDelay(lastBatchDurationMs);
      if (delay > 0) {
        console.log(`⏸️ Adaptive delay: ${(delay / 1000).toFixed(1)}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Add skipped files to failed list (with special marker)
  for (const { pdf, reason } of skipped) {
    failedFiles.push({
      fileName: pdf.fileName,
      error: `Skipped: ${reason}`,
      retryCount: 0
    });
  }

  // Add oversized files to failed list
  for (const { pdf, reason } of oversizedFiles) {
    failedFiles.push({
      fileName: pdf.fileName,
      error: `Too large: ${reason}`,
      retryCount: 0
    });
  }

  if (onProgress) {
    onProgress(processedPdfs.length, processedPdfs.length, '', 'completed');
  }

  // If ALL processable files failed, throw an error
  if (results.length === 0 && validFiles.length > 0) {
    const errorDetails = failedFiles
      .filter(f => !f.error.startsWith('Skipped:'))
      .map(f => `${f.fileName}: ${f.error}`)
      .join('\n');
    throw new Error(`All processable files failed:\n${errorDetails}`);
  }

  // Attach failure info to results
  const batchResults: ClaudeResponseBatch = results as ClaudeResponseBatch;
  if (failedFiles.length > 0) {
    batchResults._failedFiles = failedFiles.map(f => ({
      fileName: f.fileName,
      error: f.error
    }));

    const actualFailures = failedFiles.filter(f => !f.error.startsWith('Skipped:') && !f.error.startsWith('Too large:'));
    const skippedCount = failedFiles.filter(f => f.error.startsWith('Skipped:')).length;
    const oversizedCount = failedFiles.filter(f => f.error.startsWith('Too large:')).length;

    console.log(`📊 Processing Summary:`);
    console.log(`   ✅ Successful: ${results.length}`);
    console.log(`   ❌ Failed: ${actualFailures.length}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   ⚠️  Too Large: ${oversizedCount}`);
  }

  return batchResults;
}

/**
 * Determine error type for telemetry
 */
function getErrorType(error: any): string {
  if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
    return 'timeout';
  }
  if (error.status === 429 || error.message?.includes('rate_limit')) {
    return 'rate_limit';
  }
  if (error.status === 413 || error.message?.includes('too large') || error.message?.includes('Payload')) {
    return 'payload_too_large';
  }
  if (error.status === 504) {
    return 'gateway_timeout';
  }
  if (error.status >= 500) {
    return 'server_error';
  }
  if (error.status >= 400) {
    return 'client_error';
  }
  return 'unknown';
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
  
  // Extract all non-null values and sanitize invalid date strings
  const names = patientInfos.map(p => p.name).filter((n): n is string => n !== null);
  const dobs = patientInfos.map(p => p.dateOfBirth).filter((d): d is string => d !== null && d !== 'Not provided' && d !== 'N/A');
  const genders = patientInfos.map(p => p.gender).filter((g): g is 'male' | 'female' | 'other' => g !== null);
  const testDates = patientInfos.map(p => p.testDate).filter((t): t is string => t !== null && t !== 'Not provided' && t !== 'N/A');
  
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

