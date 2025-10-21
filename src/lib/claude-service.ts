import Anthropic from '@anthropic-ai/sdk';
import type { ProcessedPDF } from './pdf-processor';
import type { ExtractedBiomarker } from './biomarkers';

const MODEL_NAME = 'claude-3-5-haiku-20241022';

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

/**
 * Create the specialized prompt for biomarker extraction
 */
function createExtractionPrompt(): string {
  return `You are an expert health data analyst specializing in clinical pathology and nutritional biochemistry.

Your task is to extract PATIENT INFORMATION and ALL biomarker values from the provided laboratory result PDFs or images.

⚠️ CRITICAL: You MUST extract EVERY SINGLE biomarker visible in the document. Do NOT skip any values, even if they seem like duplicates or are in unusual formats.

INSTRUCTIONS:
1. THOROUGHLY scan EVERY page of the provided document(s) - look at ALL sections, tables, and data
2. Extract PATIENT DEMOGRAPHIC INFORMATION:
   - Patient's full name (as shown on the lab report)
   - Patient's date of birth (convert to YYYY-MM-DD format)
   - Patient's gender/sex (male, female, or other)
   - Test/collection date (the most recent date if multiple reports, in YYYY-MM-DD format)

3. Extract EVERY biomarker name, its numerical value, and unit of measurement that you can find
4. If a biomarker appears multiple times, use the MOST RECENT value (check dates on the reports)
5. Include ALL of these 54 core biomarkers if present - lab reports use MANY different name variations, so look carefully:

   ⚠️ IMPORTANT PATTERN RECOGNITION NOTES:
   - Lab reports vary significantly across countries, languages, and institutions
   - Be flexible with word order: "B12 Vitamin" vs "Vitamin B12", "D Vitamin" vs "Vitamin D"
   - Look for variations with/without hyphens and spaces: "B12", "B-12", "B 12"
   - Check for international language variations: Spanish (Vitamina, Glucosa, Colesterol), Portuguese (Vitamina, Glicose), French (Vitamine, Glucose), German (Vitamin, Glukose), Italian (Vitamina, Glucosio)
   - Common abbreviations may vary: FT3/fT3/F.T.3, HbA1C/HbA1c/HBA1C, etc.
   - Some biomarkers have scientific names: Cobalamin (B12), Calcidiol (Vitamin D), Triiodothyronine (T3)

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
   - Total Cholesterol (may appear as: Cholesterol, Chol, CHOL, Total Cholesterol, Cholesterol Total, Colesterol [Spanish/Portuguese/Italian], Cholestérol [French], Cholesterin [German])
   - HDL Cholesterol (may appear as: HDL, HDL-C, HDL C, HDL Cholesterol, Cholesterol HDL, HDL Chol, Colesterol HDL [Spanish], Cholestérol HDL [French])
   - LDL Cholesterol (may appear as: LDL, LDL-C, LDL C, LDL Cholesterol, Cholesterol LDL, LDL Calculated, LDL Calc, LDL Direct, Colesterol LDL [Spanish], Cholestérol LDL [French])
   - Triglycerides (may appear as: Trig, TG, TRIG, Triglyceride, Triglycérides [French], Triglicéridos [Spanish])

   METABOLIC (3):
   - Fasting Glucose (may appear as: Glucose, Gluc, GLU, Glucose Fasting, FBG, FBS, Blood Glucose, Blood Sugar, Glucosa [Spanish], Glicose [Portuguese], Glycémie [French], Glukose [German], Glucosio [Italian])
   - HbA1C (may appear as: HbA1c, HbA1C, HBA1C, Hb A1C, A1C, A1c, Hemoglobin A1C, Glycated Hemoglobin, Glycosylated Hemoglobin, Hemoglobina Glicada [Spanish/Portuguese], Hémoglobine Glyquée [French])
   - Fasting Insulin (may appear as: Insulin, Insulin Fasting, Serum Insulin)

   THYROID (5):
   - TSH (may appear as: TSH, T.S.H., Thyroid Stimulating Hormone, Thyroid-Stimulating Hormone, Thyrotropin, Tirotropina [Spanish/Italian], Tireotropina [Portuguese], Thyréostimuline [French])
   - Free T3 (may appear as: Free T3, FT3, F T3, fT3, F.T.3, T3 Free, T3 Libre [Spanish/French], T3 Livre [Portuguese], Freies T3 [German], T3 Libero [Italian])
   - Free T4 (may appear as: Free T4, FT4, F T4, fT4, F.T.4, T4 Free, T4 Libre [Spanish/French], T4 Livre [Portuguese], Freies T4 [German], T4 Libero [Italian])
   - TPO Antibodies (may appear as: TPO Antibodies, TPO Ab, Thyroid Peroxidase Antibodies, Anti-TPO, Thyroid Peroxidase Ab)
   - Thyroglobulin Antibodies (may appear as: Thyroglobulin Antibodies, TgAb, Anti-Thyroglobulin, Anti-Tg, Thyroglobulin Ab)

   HORMONES (1):
   - SHBG (may appear as: Sex Hormone Binding Globulin)

   IRON STUDIES (4):
   - Serum Iron (may appear as: Iron, Fe, Iron Total)
   - Ferritin (may appear as: Serum Ferritin)
   - TIBC (may appear as: Total Iron Binding Capacity)
   - Transferrin Saturation % (may appear as: Transferrin Saturation, TSAT, Iron Saturation)

   VITAMINS (3):
   - Vitamin D (25-Hydroxy D) (may appear as: Vitamin D, D Vitamin, 25-Hydroxy Vitamin D, 25-OH Vitamin D, 25(OH)D, Calcidiol, Vitamina D [Spanish/Portuguese/Italian], Vitamine D [French])
   - Vitamin B12 (may appear as: B12, B-12, B 12, Vitamin B12, B12 Vitamin, Cobalamin, Vitamin B-12, VitB12, Vit B12, Vitamin B 12, B12 Vitamina [Spanish], B12 Vitamine [French])
     IMPORTANT: This is a critical biomarker - look carefully for it in all sections and check for various word orders (e.g., "B12 Vitamin" vs "Vitamin B12")
   - Serum Folate (may appear as: Folate, Folic Acid, Vitamin B9, B9, Folato [Spanish/Italian], Acide Folique [French], Folsäure [German])

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

Return your response now:`;
}

/**
 * Extract biomarkers from a SINGLE PDF document using Claude API
 */
export async function extractBiomarkersFromPdf(
  apiKey: string,
  processedPdf: ProcessedPDF
): Promise<ClaudeResponse> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  try {
    // Initialize Claude
    const client = new Anthropic({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true, // Required for client-side usage
    });

    // Prepare content - handle both PDFs and images
    let content: Anthropic.MessageParam[];
    
    if (processedPdf.isImage && processedPdf.imageData && processedPdf.mimeType) {
      // For images, use Claude's vision API
      content = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: createExtractionPrompt(),
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: processedPdf.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: processedPdf.imageData,
              },
            },
          ],
        },
      ];
    } else {
      // For PDFs, use text extraction
      const pdfText = `\n=== ${processedPdf.fileName} (${processedPdf.pageCount} pages) ===\n${processedPdf.extractedText}`;
      content = [
        {
          role: 'user',
          content: createExtractionPrompt() + '\n\n' + pdfText,
        },
      ];
    }

    // Create message
    const message = await client.messages.create({
      model: MODEL_NAME,
      max_tokens: 4096,
      messages: content,
    });

    // Extract text from response
    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const text = textContent.text;

    // Parse the JSON response
    const { biomarkers, patientInfo, panelName } = parseClaudeResponse(text);

    return {
      biomarkers,
      patientInfo,
      panelName,
      raw: text,
    };
  } catch (error) {
    console.error('Claude API error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('invalid_api_key') || error.message.includes('authentication')) {
        throw new Error('Invalid API key. Please check your Claude API key.');
      }
      if (error.message.includes('rate_limit') || error.message.includes('overloaded') || error.message.includes('529')) {
        throw new Error('API rate limit exceeded or service is overloaded. Please try again in a moment.');
      }
      throw new Error(`Claude API error: ${error.message}`);
    }
    
    throw new Error('Failed to process PDF with Claude API');
  }
}

/**
 * Extract biomarkers from MULTIPLE PDFs (processes in batches to avoid rate limits)
 * Returns array of results, one per PDF
 */
export async function extractBiomarkersFromPdfs(
  apiKey: string,
  processedPdfs: ProcessedPDF[],
  onProgress?: (current: number, total: number, batchInfo?: string) => void
): Promise<ClaudeResponse[]> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (processedPdfs.length === 0) {
    throw new Error('No PDFs provided');
  }

  // Process PDFs in batches to avoid rate limits
  const BATCH_SIZE = 3; // Process 3 PDFs at a time
  const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches
  
  const results: ClaudeResponse[] = [];
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
    
    // Process batch in parallel
    const batchPromises = batch.map(pdf => extractBiomarkersFromPdf(apiKey, pdf));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults);
    
    // Add delay between batches (except for the last batch)
    if (i + BATCH_SIZE < processedPdfs.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  if (onProgress) {
    onProgress(processedPdfs.length, processedPdfs.length, '');
  }

  return results;
}

/**
 * Generate a smart panel name based on biomarkers found
 */
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

/**
 * Parse the Claude response and extract biomarker data + patient info
 */
function parseClaudeResponse(text: string): { biomarkers: ExtractedBiomarker[]; patientInfo: PatientInfo; panelName: string } {
  try {
    // Try to extract JSON from markdown code blocks if present
    let jsonText = text.trim();
    
    // Strategy 1: Remove markdown code blocks
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }

    // Strategy 2: Find JSON object with "biomarkers" field (more flexible regex)
    if (!jsonText.startsWith('{')) {
      const jsonMatch = jsonText.match(/\{[\s\S]*?"biomarkers"[\s\S]*?\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    // Strategy 3: Try to find balanced braces if previous strategies failed
    if (!jsonText.startsWith('{')) {
      const firstBrace = jsonText.indexOf('{');
      if (firstBrace !== -1) {
        let depth = 0;
        let endIndex = firstBrace;
        for (let i = firstBrace; i < jsonText.length; i++) {
          if (jsonText[i] === '{') depth++;
          if (jsonText[i] === '}') depth--;
          if (depth === 0) {
            endIndex = i + 1;
            break;
          }
        }
        jsonText = jsonText.substring(firstBrace, endIndex);
      }
    }

    // Clean up common JSON issues
    jsonText = jsonText
      .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
      .replace(/\n/g, ' ') // Remove newlines that might break parsing
      .trim();

    console.log('Attempting to parse JSON:', jsonText.substring(0, 200) + '...');

    const parsed = JSON.parse(jsonText);
    
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
    console.error('Raw response (first 500 chars):', text.substring(0, 500));
    console.error('Raw response (last 500 chars):', text.substring(Math.max(0, text.length - 500)));
    
    // Provide more specific error messages
    if (error instanceof SyntaxError) {
      throw new Error('Claude returned invalid JSON. This may be due to a malformed response. Please try again.');
    }
    
    if (text.length < 50) {
      throw new Error('Claude returned an unusually short response. Please try uploading the file again.');
    }
    
    if (text.toLowerCase().includes('error') || text.toLowerCase().includes('sorry')) {
      throw new Error('Claude encountered an issue processing the document. The document may be unreadable or corrupted. Please try a different file or re-scan the document.');
    }
    
    throw new Error('Failed to parse biomarker data from API response. The document may not contain standard lab results, or the format is unusual. Please try again or contact support if the issue persists.');
  }
}

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

