// Supabase Edge Function to analyze biomarkers using Claude API
// This keeps the Claude API key secure on the server-side

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.65.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check if authentication is required (disabled by default, enable via REQUIRE_AUTH=true secret)
    const requireAuth = Deno.env.get('REQUIRE_AUTH') === 'true'
    
    // Verify API key is present (Edge Functions require anon key or JWT)
    const authHeader = req.headers.get('Authorization') || req.headers.get('apikey')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    // Verify the request is from an authenticated user (if auth is enabled)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      anonKey,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    if (requireAuth) {
      const {
        data: { user },
        error: authError,
      } = await supabaseClient.auth.getUser()

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      // When auth is disabled, just verify the anon key is used (not required to be a user)
      // The supabase client initialization above is sufficient
    }

    // Get the Claude API key from environment (server-side only)
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY')
    if (!claudeApiKey) {
      return new Response(
        JSON.stringify({ error: 'Claude API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Parse the request body
    let requestBody: any
    try {
      requestBody = await req.json()
    } catch (parseError: any) {
      console.error('Error parsing request body:', parseError)
      return new Response(
        JSON.stringify({ error: `Invalid JSON in request body: ${parseError.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { processedPdf } = requestBody

    if (!processedPdf) {
      console.error('Missing processedPdf in request body:', JSON.stringify(requestBody))
      return new Response(
        JSON.stringify({ error: 'Missing processedPdf in request body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Initialize Claude client (server-side, secure)
    const client = new Anthropic({
      apiKey: claudeApiKey,
    })

    // Build the extraction prompt
    const extractionPrompt = createExtractionPrompt()

    // Prepare content based on file type
    let content: any[]

    if (processedPdf.isImage && processedPdf.imageData && processedPdf.mimeType) {
      // For images, use Claude's vision API
      content = [
        {
          type: 'text',
          text: extractionPrompt,
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: processedPdf.mimeType,
            data: processedPdf.imageData,
          },
        },
      ]
    } else {
      // For PDFs and Word documents, use text extraction
      content = [
        {
          type: 'text',
          text: `${extractionPrompt}\n\n=== EXTRACTED TEXT ===\n${processedPdf.extractedText}`,
        },
      ]
    }

    // Call Claude API
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 8192, // Maximum allowed for haiku model
      temperature: 0,
      messages: [{ role: 'user', content }],
    })

    // Extract the response text
    const textContent = response.content.find((block: any) => block.type === 'text')
    if (!textContent || !textContent.text) {
      throw new Error('No text response from Claude')
    }

    let responseText = textContent.text.trim()

    // Remove markdown code blocks if present
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json\n/, '').replace(/\n```$/, '')
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```\n/, '').replace(/\n```$/, '')
    }

    // Parse the JSON response
    const parsedResponse = JSON.parse(responseText)

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error in analyze-biomarkers function:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    // Provide more detailed error messages
    let errorMessage = error.message || 'An unexpected error occurred'
    if (error.cause) {
      errorMessage += `: ${error.cause}`
    }
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: Deno.env.get('DENO_ENV') === 'development' ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

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

⚠️ CRITICAL RULE FOR WHITE BLOOD CELL DIFFERENTIALS:
For Neutrophils, Lymphocytes, Monocytes, Eosinophils, and Basophils:
- ONLY extract the ABSOLUTE COUNT values - NEVER extract percentage (%) values
- Lab reports often show BOTH percentage and absolute count - you MUST choose the absolute count

⚠️ UNIT NORMALIZATION FOR WBC DIFFERENTIALS (VERY IMPORTANT):
- If the value is in "cells/µL" or "cells/uL", YOU MUST convert it to "×10³/µL" by dividing by 1000
- Example: "12 cells/µL" → extract as value "0.012" with unit "×10³/µL" (12 ÷ 1000 = 0.012)
- Example: "150 cells/µL" → extract as value "0.15" with unit "×10³/µL" (150 ÷ 1000 = 0.15)
- Example: "3500 cells/µL" → extract as value "3.5" with unit "×10³/µL" (3500 ÷ 1000 = 3.5)
- If already in "×10³/µL", "K/µL", "K/uL", "×10^3/µL", "10^3/µL", or "10³/µL" format, use as-is

EXAMPLES OF CORRECT EXTRACTION:
- Lab shows "Neutrophils: 55% | 3.2 K/µL" → extract value="3.2", unit="K/µL" (NOT the 55%)
- Lab shows "Lymphocytes: 2.1 ×10³/µL (35%)" → extract value="2.1", unit="×10³/µL" (NOT the 35%)
- Lab shows "Basophils: 12 cells/µL" → extract value="0.012", unit="×10³/µL" (converted: 12÷1000)
- Lab shows "Eosinophils: 150 cells/µL" → extract value="0.15", unit="×10³/µL" (converted: 150÷1000)
- Lab shows "Monocytes: 450 cells/µL" → extract value="0.45", unit="×10³/µL" (converted: 450÷1000)

RESPONSE FORMAT (JSON only):
{
  "biomarkers": [
    { "name": "Glucose", "value": "95", "unit": "mg/dL" },
    { "name": "Hemoglobin A1c", "value": "5.4", "unit": "%" }
  ],
  "patientInfo": {
    "name": "Full Name",
    "dateOfBirth": "1990-01-15",
    "gender": "male",
    "testDate": "2024-03-20"
  },
  "panelName": "Comprehensive Metabolic Panel"
}

⚠️ EXTRACTION REQUIREMENT:
You should aim to extract AT LEAST 30-40 biomarkers from a typical comprehensive lab report. If you're only extracting a few biomarkers, you're likely missing data - go back and look more carefully at ALL sections of the document.

⚠️ REMINDER: Return ONLY valid JSON - no text before or after. Start your response with { and end with }

🌍 MULTILINGUAL EXTRACTION REMINDER:
- Documents can be in ANY language or mix of languages
- Patient names can use ANY script (Latin, Cyrillic, Arabic, CJK, etc.)
- Biomarker names should be normalized to the PRIMARY English names in your JSON output
- Units should be preserved exactly as shown in the document
- Dates should always be converted to YYYY-MM-DD format
- Gender should always be normalized to: "male", "female", or "other"

Return your response now:`
}
