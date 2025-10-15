import Anthropic from '@anthropic-ai/sdk';
import type { ProcessedPDF } from './pdf-processor';
import type { ExtractedBiomarker } from './biomarkers';

const MODEL_NAME = 'claude-3-5-haiku-20241022';

export interface ClaudeResponse {
  biomarkers: ExtractedBiomarker[];
  raw?: string;
}

/**
 * Create the specialized prompt for biomarker extraction
 */
function createExtractionPrompt(): string {
  return `You are an expert health data analyst specializing in clinical pathology and nutritional biochemistry.

Your task is to extract ALL biomarker values from the provided laboratory result PDFs for a male patient named Adam Winchester.

INSTRUCTIONS:
1. Carefully scan all pages of all provided PDF documents
2. Extract EVERY biomarker name, its numerical value, and unit of measurement
3. If a biomarker appears multiple times, use the MOST RECENT value (check dates on the reports)
4. Include ALL of these biomarkers if present:
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

5. Return ONLY a valid JSON object with this EXACT structure:
{
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
- Extract ONLY numerical values (no text descriptions)
- Include the unit exactly as shown
- If a value is marked as "<0.1" or similar, extract "0.1" and note in the unit
- Do NOT include any explanatory text, only the JSON object
- Ensure the JSON is valid and parseable

Return your response now:`;
}

/**
 * Extract biomarkers from PDF documents using Claude API
 */
export async function extractBiomarkersFromPdfs(
  apiKey: string,
  processedPdfs: ProcessedPDF[]
): Promise<ClaudeResponse> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  if (processedPdfs.length === 0) {
    throw new Error('No PDFs provided');
  }

  try {
    // Initialize Claude
    const client = new Anthropic({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true, // Required for client-side usage
    });

    // Prepare content - send extracted text instead of full PDFs (much cheaper!)
    const allPdfText = processedPdfs
      .map((pdf) => `\n=== ${pdf.fileName} (${pdf.pageCount} pages) ===\n${pdf.extractedText}`)
      .join('\n\n');

    const content: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: createExtractionPrompt() + '\n\n' + allPdfText,
      },
    ];

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
    const biomarkers = parseClaudeResponse(text);

    return {
      biomarkers,
      raw: text,
    };
  } catch (error) {
    console.error('Claude API error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('invalid_api_key') || error.message.includes('authentication')) {
        throw new Error('Invalid API key. Please check your Claude API key.');
      }
      if (error.message.includes('rate_limit') || error.message.includes('overloaded')) {
        throw new Error('API rate limit exceeded or service is overloaded. Please try again in a moment.');
      }
      throw new Error(`Claude API error: ${error.message}`);
    }
    
    throw new Error('Failed to process PDFs with Claude API');
  }
}

/**
 * Parse the Claude response and extract biomarker data
 */
function parseClaudeResponse(text: string): ExtractedBiomarker[] {
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

    return parsed.biomarkers.map((b: any) => ({
      name: String(b.name || '').trim(),
      value: String(b.value || '').trim(),
      unit: String(b.unit || '').trim(),
    }));
  } catch (error) {
    console.error('Failed to parse Claude response:', error);
    console.log('Raw response:', text);
    throw new Error('Failed to parse biomarker data from API response. The response may not be in the expected format.');
  }
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

