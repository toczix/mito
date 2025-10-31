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
    // Verify the request is from an authenticated user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

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
    const { processedPdf } = await req.json()

    if (!processedPdf) {
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
      max_tokens: 16000,
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
    return new Response(
      JSON.stringify({
        error: error.message || 'An unexpected error occurred',
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
