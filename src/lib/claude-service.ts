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

Your task is to extract PATIENT INFORMATION and ALL biomarker values from the provided laboratory result PDFs.

INSTRUCTIONS:
1. Carefully scan all pages of all provided PDF documents
2. Extract PATIENT DEMOGRAPHIC INFORMATION:
   - Patient's full name (as shown on the lab report)
   - Patient's date of birth (convert to YYYY-MM-DD format)
   - Patient's gender/sex (male, female, or other)
   - Test/collection date (the most recent date if multiple reports, in YYYY-MM-DD format)

3. Extract EVERY biomarker name, its numerical value, and unit of measurement
4. If a biomarker appears multiple times, use the MOST RECENT value (check dates on the reports)
5. Include ALL of these biomarkers if present:
   - Liver Function: ALP, ALT, AST, GGT, Total Bilirubin
   - Kidney Function: BUN, Creatinine
   - Proteins: Albumin, Globulin, Total Protein
   - Electrolytes: Sodium, Potassium, Chloride, Bicarbonate, CO2
   - Minerals: Calcium, Magnesium, Phosphate
   - Complete Blood Count: WBC, RBC, Hemoglobin, Hematocrit, MCV, MCH, MCHC, RDW, Platelets
   - White Blood Cell Differential: Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils
   - Lipids: Total Cholesterol, HDL, LDL, Triglycerides
   - Metabolic: Fasting Glucose, HbA1c, Fasting Insulin, Uric Acid
   - Hormones: TSH, Free T3, Free T4, Testosterone, FSH, LH, Prolactin, DHEA-S, Cortisol, SHBG, FAI
   - Thyroid Antibodies: TPO Antibodies, Thyroglobulin Antibodies
   - Iron Studies: Serum Iron, Ferritin, TIBC, Transferrin Saturation
   - Vitamins: Vitamin D (25-Hydroxy D), Vitamin B12
   - Inflammation: C-Reactive Protein (CRP/hsCRP)
   - Other: Homocysteine, LDH

6. Return ONLY a valid JSON object with this EXACT structure:
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

IMPORTANT RULES:
- Use the EXACT biomarker names as they appear in the lab reports
- Extract ONLY numerical values for biomarkers (no text descriptions)
- Include the unit exactly as shown
- If a value is marked as "<0.1" or similar, extract "0.1" and note in the unit
- For dates, always convert to YYYY-MM-DD format
- For gender, normalize to: "male", "female", or "other"
- If patient info is not found, use null
- Do NOT include any explanatory text, only the JSON object
- Ensure the JSON is valid and parseable

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
    
    // Remove markdown code blocks
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }

    // Try to find JSON object in the text
    const jsonMatch = jsonText.match(/\{[\s\S]*"biomarkers"[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonText);
    
    if (!parsed.biomarkers || !Array.isArray(parsed.biomarkers)) {
      throw new Error('Invalid response format: missing biomarkers array');
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

    return { biomarkers, patientInfo, panelName };
  } catch (error) {
    console.error('Failed to parse Claude response:', error);
    console.log('Raw response:', text);
    throw new Error('Failed to parse biomarker data from API response. The response may not be in the expected format.');
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

