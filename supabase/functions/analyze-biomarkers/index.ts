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

    const { processedPdf, processedPdfs, batchMode } = requestBody

    // Handle both single file and batch mode
    const pdfsToProcess = batchMode && processedPdfs ? processedPdfs : (processedPdf ? [processedPdf] : null)

    // For single file mode, get the first PDF
    const singlePdf = !batchMode && pdfsToProcess ? pdfsToProcess[0] : null

    if (!pdfsToProcess || pdfsToProcess.length === 0) {
      console.error('❌ Missing processedPdf/processedPdfs in request body')
      return new Response(
        JSON.stringify({ error: 'Missing processedPdf or processedPdfs in request body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (batchMode) {
      console.log(`✅ Batch mode: Processing ${pdfsToProcess.length} files`)
    } else {
      console.log('✅ Single file mode:', pdfsToProcess[0].fileName)
    }

    // Validate file size to prevent timeouts on oversized files
    let totalSize = 0
    for (const pdf of pdfsToProcess) {
      const textLength = pdf.extractedText?.length || 0
      const singleImageSize = pdf.imageData?.length || 0
      const multiImageSize = pdf.imagePages?.reduce((sum, img) => sum + img.length, 0) || 0
      totalSize += textLength + singleImageSize + multiImageSize
    }

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
    const extractionPrompt = batchMode ? createBatchExtractionPrompt() : createExtractionPrompt()

    // Prepare content based on batch mode and file type
    let content: any[]

    if (batchMode) {
      // Batch mode: Combine all PDFs into single text request
      let combinedText = extractionPrompt + '\n\n'

      for (let i = 0; i < pdfsToProcess.length; i++) {
        const pdf = pdfsToProcess[i]
        combinedText += `\n\n=== DOCUMENT ${i + 1}: ${pdf.fileName} ===\n\n`
        combinedText += pdf.extractedText || ''
      }

      content = [
        {
          type: 'text',
          text: combinedText,
        },
      ]

      console.log(`📦 Batch: Combined ${pdfsToProcess.length} documents into single request (${combinedText.length} chars)`)
    } else {
      // Single file mode (existing logic)
      if (singlePdf && singlePdf.isImage && singlePdf.mimeType) {
        // For images (single or multi-page), use Claude's vision API
        content = [
          {
            type: 'text',
            text: extractionPrompt,
          },
        ]

        // Handle multi-page PDFs converted to images
        if (singlePdf.imagePages && singlePdf.imagePages.length > 0) {
          for (const imageData of singlePdf.imagePages) {
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: singlePdf.mimeType,
                data: imageData,
              },
            })
          }
        }
        // Handle single image
        else if (singlePdf.imageData) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: singlePdf.mimeType,
              data: singlePdf.imageData,
            },
          })
        }
      } else {
        // For PDFs and Word documents, use text extraction
        content = [
          {
            type: 'text',
            text: `${extractionPrompt}\n\n=== EXTRACTED TEXT ===\n${singlePdf?.extractedText || ''}`,
          },
        ]
      }
    }

    // Call Claude API with timeout protection
    // Vision API with ALL pages can take 2-5 minutes for large multi-page PDFs
    const CLAUDE_API_TIMEOUT = 300000; // 300 seconds (5 minutes) - increased for multi-page processing

    console.log(`📤 Sending ${content.length} content blocks to Claude...`)
    const response = await Promise.race([
      client.messages.create({
        model: 'claude-3-5-haiku-20241022', // Claude 3.5 Haiku - proven working version
        max_tokens: 8192,
        temperature: 0,
        messages: [{ role: 'user', content }],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Claude API timeout after 300 seconds')), CLAUDE_API_TIMEOUT)
      )
    ]) as any
    console.log(`✅ Received response from Claude`)

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

    // IMPORTANT: Claude sometimes adds explanatory text after the JSON
    // Extract only the JSON (object or array)
    const jsonStartChar = batchMode ? '[' : '{'
    const jsonEndChar = batchMode ? ']' : '}'
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
          const originalResponseText = textContent.text.trim()
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
      throw new Error(`Claude returned invalid JSON: ${parseError.message}. Response preview: ${responseText.substring(0, 200)}`)
    }

    if (batchMode) {
      // Batch mode: Validate array of results
      if (!Array.isArray(parsedResponse)) {
        console.error('Batch mode expected array but got:', typeof parsedResponse)
        throw new Error('Batch mode expected an array of results from Claude')
      }

      console.log(`✅ Batch: Received ${parsedResponse.length} results from Claude`)

      // Validate each result
      for (let i = 0; i < parsedResponse.length; i++) {
        const result = parsedResponse[i]
        if (!result.biomarkers || !Array.isArray(result.biomarkers)) {
          console.error(`Missing biomarkers array in document ${i + 1}:`, result)
          throw new Error(`Document ${i + 1} missing biomarkers array`)
        }
      }

      // Return array of results
      return new Response(JSON.stringify(parsedResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      // Single file mode: Validate single result
      if (!parsedResponse.biomarkers || !Array.isArray(parsedResponse.biomarkers)) {
        console.error('Missing or invalid biomarkers array:', parsedResponse)
        throw new Error('Claude response missing biomarkers array. This file may not contain lab results.')
      }

      // Check if Claude returned empty biomarkers (likely not a lab report)
      if (parsedResponse.biomarkers.length === 0) {
        console.warn('Claude returned 0 biomarkers - file may not contain lab results')
        return new Response(
          JSON.stringify({
            error: 'No biomarkers found in this document. Please ensure the file contains laboratory test results.',
            suggestion: 'This file may be a different type of document (e.g., medical notes, prescription, etc.) and not a lab report.',
            biomarkers: [],
            patientInfo: parsedResponse.patientInfo || null,
          }),
          {
            status: 422,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      return new Response(JSON.stringify(parsedResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
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
