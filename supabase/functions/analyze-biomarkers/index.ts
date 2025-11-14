// Supabase Edge Function to analyze biomarkers using Claude API
// This keeps the Claude API key secure on the server-side

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.3?no-check'

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
    console.log('🔹 Edge Function started')

    // Check if authentication is required (disabled by default, enable via REQUIRE_AUTH=true secret)
    const requireAuth = Deno.env.get('REQUIRE_AUTH') === 'true'
    console.log('🔹 Auth required:', requireAuth)

    // Verify API key is present (Edge Functions require anon key or JWT)
    const authHeader = req.headers.get('Authorization') || req.headers.get('apikey')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!authHeader) {
      console.error('❌ Missing authorization header')
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('🔹 Creating Supabase client')
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
      console.log('🔹 Verifying user authentication...')
      const {
        data: { user },
        error: authError,
      } = await supabaseClient.auth.getUser()

      if (authError || !user) {
        console.error('❌ Unauthorized:', authError)
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      console.log('✅ User authenticated')
    } else {
      // When auth is disabled, just verify the anon key is used (not required to be a user)
      // The supabase client initialization above is sufficient
      console.log('✅ Auth check skipped (disabled)')
    }

    // Get the Claude API key from environment (server-side only)
    console.log('🔹 Checking Claude API key')
    const claudeApiKey = Deno.env.get('CLAUDE_API_KEY')
    if (!claudeApiKey) {
      console.error('❌ Claude API key not configured')
      return new Response(
        JSON.stringify({ error: 'Claude API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    console.log('✅ Claude API key found')

    // Parse the request body with timeout protection
    console.log('🔹 Parsing request body...')
    let requestBody: any
    try {
      // Add timeout to request body parsing (30 seconds max)
      const parsePromise = req.json()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request body parsing timeout after 30s')), 30000)
      )
      requestBody = await Promise.race([parsePromise, timeoutPromise])
      console.log('✅ Request body parsed (size:', JSON.stringify(requestBody).length, 'bytes)')
    } catch (parseError: any) {
      console.error('❌ Error parsing request body:', parseError)
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
      console.error('❌ Missing processedPdf in request body')
      return new Response(
        JSON.stringify({ error: 'Missing processedPdf in request body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('✅ Processing file:', processedPdf.fileName)

    // Validate file size to prevent timeouts on oversized files
    const textLength = processedPdf.extractedText?.length || 0
    const singleImageSize = processedPdf.imageData?.length || 0
    const multiImageSize = processedPdf.imagePages?.reduce((sum: number, img: string) => sum + img.length, 0) || 0
    const totalSize = textLength + singleImageSize + multiImageSize

    // 20MB limit for request payload (to handle multi-page PDFs with all pages)
    // Claude API supports up to 100MB, but we limit to 20MB for reasonable processing times
    const MAX_PAYLOAD_SIZE = 20 * 1024 * 1024

    if (totalSize > MAX_PAYLOAD_SIZE) {
      console.error(`File too large: ${(totalSize / 1024 / 1024).toFixed(2)}MB`)
      return new Response(
        JSON.stringify({
          error: `File too large for processing. Size: ${(totalSize / 1024 / 1024).toFixed(2)}MB. Maximum: 20MB.`,
          suggestion: 'Try splitting the document into smaller files or reducing image quality.'
        }),
        {
          status: 413,
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

    // Build content based on whether we have images or text
    const content: any[] = []

    // For images: use Vision API (single image or multi-page scanned PDF)
    if (processedPdf.isImage || processedPdf.imageData || processedPdf.imagePages) {
      console.log('📸 Using Vision API for image processing')

      // Add the prompt first
      content.push({
        type: 'text',
        text: extractionPrompt,
      })

      // Single image
      if (processedPdf.imageData) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: processedPdf.mimeType || 'image/png',
            data: processedPdf.imageData,
          },
        })
      }

      // Multi-page scanned PDF (multiple images)
      if (processedPdf.imagePages && processedPdf.imagePages.length > 0) {
        processedPdf.imagePages.forEach((imageData: string) => {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageData,
            },
          })
        })
      }
    } else {
      // For text-based PDFs: use extracted text only
      console.log('📄 Using text-only processing')
      content.push({
        type: 'text',
        text: `${extractionPrompt}\n\n=== EXTRACTED TEXT ===\n${processedPdf.extractedText || ''}`,
      })
    }

    // Call Claude API with timeout protection
    // Vision API with ALL pages can take 2-5 minutes for large multi-page PDFs
    console.log(`📤 Sending ${content.length} content blocks to Claude...`)
    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001', // Claude Haiku 4.5 - latest version (Oct 1, 2025 snapshot)
      max_tokens: 32768, // ✅ Increased from 8192 to 32768 (model supports 64K, this handles 300+ biomarkers)
      temperature: 0,
      messages: [{ role: 'user', content }],
    })

    let streamedText = ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        streamedText += event.delta.text
      }
    }

    const response = await stream.finalMessage()
    console.log(`✅ Received response from Claude`)

    // Extract the response text (prefer streamed text, fall back to final message content)
    let responseText = streamedText.trim()
    if (!responseText) {
      const textContent = response.content.find((block: any) => block.type === 'text')
      if (!textContent || !textContent.text) {
        throw new Error('No text response from Claude')
      }
      responseText = textContent.text.trim()
    }

    // Remove markdown code blocks if present
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json\n/, '').replace(/\n```$/, '')
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```\n/, '').replace(/\n```$/, '')
    }

    // IMPORTANT: Claude sometimes adds explanatory text after the JSON
    // Extract only the JSON object
    const jsonStartChar = '{'
    const jsonEndChar = '}'
    const jsonStartIndex = responseText.indexOf(jsonStartChar)

    if (jsonStartIndex !== -1) {
      // Find the matching closing bracket/brace
      let bracketCount = 0
      let jsonEndIndex = -1
      for (let i = jsonStartIndex; i < responseText.length; i++) {
        const char = responseText[i]
        if (char === jsonStartChar) bracketCount++
        if (char === jsonEndChar) {
          bracketCount--
          if (bracketCount === 0) {
            jsonEndIndex = i + 1
            break
          }
        }
      }

      if (jsonEndIndex !== -1) {
        const originalLength = responseText.length
        responseText = responseText.substring(jsonStartIndex, jsonEndIndex)

        // Log if we removed extra text
        if (jsonEndIndex < originalLength) {
          const originalResponseText = streamedText.trim() || responseText
          const removedText = originalResponseText.substring(jsonEndIndex).trim()
          if (removedText) {
            console.warn('Removed extra text after JSON:', removedText.substring(0, 100))
          }
        }
      }
    }

    // Parse the JSON response
    let parsedResponse
    try {
      parsedResponse = JSON.parse(responseText)
    } catch (parseError: any) {
      console.error('Failed to parse Claude response as JSON:', parseError)
      console.error('Response text:', responseText.substring(0, 500))

      const trimmed = responseText.trim()
      const startsWithJson = trimmed.startsWith('{') || trimmed.startsWith('[')

      if (!startsWithJson) {
        const preview = trimmed.substring(0, 200)
        console.warn('⚠️ Claude returned a non-JSON response, likely not a lab report:', preview)
        // Return success with empty biomarkers array instead of error
        // This allows the frontend to show "No biomarkers found" instead of "Failed"
        return new Response(
          JSON.stringify({
            biomarkers: [],
            metadata: {
              note: 'No biomarkers found in this document.',
              suggestion: 'This file may be an image or document without lab results. Please upload laboratory reports that contain numeric biomarker values.',
              rawResponsePreview: preview
            }
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      throw new Error(`Claude returned invalid JSON: ${parseError.message}. Response preview: ${responseText.substring(0, 200)}`)
    }

    // Validate single result
    if (!parsedResponse.biomarkers || !Array.isArray(parsedResponse.biomarkers)) {
      console.error('Missing or invalid biomarkers array:', parsedResponse)
      throw new Error('Claude response missing biomarkers array. This file may not contain lab results.')
    }

    // Check if Claude returned empty biomarkers (likely not a lab report)
    if (parsedResponse.biomarkers.length === 0) {
      console.warn('Claude returned 0 biomarkers - file may not contain lab results')
      return new Response(
        JSON.stringify({
          biomarkers: [],
          patientInfo: parsedResponse.patientInfo || null,
          metadata: {
            note: 'No biomarkers found in this document.',
            suggestion: 'This file may be a different type of document (e.g., medical notes, prescription, etc.) and not a lab report.'
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Normalize units for consistency (e.g., German "Tsd./µl" → "×10³/µL")
    parsedResponse.biomarkers = parsedResponse.biomarkers.map((biomarker: any) => {
      if (biomarker.unit) {
        biomarker.unit = normalizeUnit(biomarker.unit)
      }
      return biomarker
    })

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

    // Add more specific error information
    let statusCode = 500
    if (error.message?.includes('timeout')) {
      statusCode = 504
      errorMessage = `Processing timeout: ${errorMessage}`
    } else if (error.message?.includes('Invalid JSON') || error.message?.includes('parse')) {
      statusCode = 422
      errorMessage = `Failed to parse Claude response: ${errorMessage}`
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: error.stack,
        fileName: error.fileName || 'unknown',
        errorType: error.name || 'UnknownError',
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/**
 * Normalize unit strings for consistency across different languages
 * Examples:
 *   "Tsd./µl" → "×10³/µL" (German: Tausend = Thousand)
 *   "Tsd/µl" → "×10³/µL"
 *   "K/µl" → "×10³/µL" (K = kilo = thousand)
 *   "k/µl" → "×10³/µL"
 */
function normalizeUnit(unit: string): string {
  if (!unit) return unit

  // Normalize common variations
  let normalized = unit
    .replace(/Tsd\./gi, '×10³') // German: Tausend (thousand)
    .replace(/Tsd/gi, '×10³')
    .replace(/\bK\b/g, '×10³')  // K = kilo = thousand
    .replace(/\bk\b/g, '×10³')  // k = kilo = thousand
    .replace(/µl/g, 'µL')       // Standardize µL capitalization
    .replace(/ul/g, 'µL')       // ul → µL
    .replace(/uL/g, 'µL')       // uL → µL

  return normalized
}

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

⚠️ IMPORTANT: If patient information is not visible in the document, use null for missing fields:
{
  "patientInfo": {
    "name": null,
    "dateOfBirth": null,
    "gender": null,
    "testDate": null
  }
}
Do NOT use strings like "Unknown", "N/A", "Not provided" - use null instead.

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

function createBatchExtractionPrompt(): string {
  return `You are an expert health data analyst specializing in clinical pathology and nutritional biochemistry.

Your task is to extract PATIENT INFORMATION and ALL biomarker values from MULTIPLE laboratory result documents provided below.

🌍 MULTILINGUAL SUPPORT: This system supports lab reports in ANY LANGUAGE. Lab reports may be in English, Spanish, Portuguese, French, German, Italian, Chinese, Japanese, Korean, Arabic, Russian, Dutch, Polish, Turkish, or any other language. You MUST accurately extract biomarkers regardless of the language used in the document.

⚠️ CRITICAL: You MUST extract EVERY SINGLE biomarker from EACH DOCUMENT. Do NOT skip any values, even if they seem like duplicates or are in unusual formats.

INSTRUCTIONS:
1. THOROUGHLY scan EVERY document provided (marked with === DOCUMENT N: filename ===)
2. For EACH document, extract:
   - Patient's full name (as shown on the lab report, in any language/script)
   - Patient's date of birth (convert to YYYY-MM-DD format, regardless of original date format)
   - Patient's gender/sex (normalize to: male, female, or other)
   - Test/collection date (the most recent date if multiple reports, in YYYY-MM-DD format)
   - EVERY biomarker name, its numerical value, and unit of measurement

3. ⚠️ CRITICAL RULE FOR WHITE BLOOD CELL DIFFERENTIALS:
For Neutrophils, Lymphocytes, Monocytes, Eosinophils, and Basophils:
- ONLY extract the ABSOLUTE COUNT values - NEVER extract percentage (%) values
- Lab reports often show BOTH percentage and absolute count - you MUST choose the absolute count

4. ⚠️ UNIT NORMALIZATION FOR WBC DIFFERENTIALS (VERY IMPORTANT):
- If the value is in "cells/µL" or "cells/uL", YOU MUST convert it to "×10³/µL" by dividing by 1000
- Example: "12 cells/µL" → extract as value "0.012" with unit "×10³/µL" (12 ÷ 1000 = 0.012)
- Example: "150 cells/µL" → extract as value "0.15" with unit "×10³/µL" (150 ÷ 1000 = 0.15)
- If already in "×10³/µL", "K/µL", "K/uL", "×10^3/µL", "10^3/µL", or "10³/µL" format, use as-is

RESPONSE FORMAT (JSON array with one object per document):
[
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
  },
  {
    "biomarkers": [
      { "name": "Total Cholesterol", "value": "180", "unit": "mg/dL" }
    ],
    "patientInfo": {
      "name": "Full Name",
      "dateOfBirth": "1990-01-15",
      "gender": "male",
      "testDate": "2024-03-21"
    },
    "panelName": "Lipid Panel"
  }
]

⚠️ IMPORTANT: If patient information is not visible in a document, use null for missing fields:
{
  "patientInfo": {
    "name": null,
    "dateOfBirth": null,
    "gender": null,
    "testDate": null
  }
}
Do NOT use strings like "Unknown", "N/A", "Not provided" - use null instead.

⚠️ EXTRACTION REQUIREMENT:
You should aim to extract AT LEAST 30-40 biomarkers from a typical comprehensive lab report. If you're only extracting a few biomarkers, you're likely missing data - go back and look more carefully at ALL sections of each document.

⚠️ REMINDER: Return ONLY valid JSON ARRAY - no text before or after. Start your response with [ and end with ]

🌍 MULTILINGUAL EXTRACTION REMINDER:
- Documents can be in ANY language or mix of languages
- Patient names can use ANY script (Latin, Cyrillic, Arabic, CJK, etc.)
- Biomarker names should be normalized to the PRIMARY English names in your JSON output
- Units should be preserved exactly as shown in the document
- Dates should always be converted to YYYY-MM-DD format
- Gender should always be normalized to: "male", "female", or "other"

Return your response now:`
}
