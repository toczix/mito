# PDF Processing Flow - Complete Technical Documentation

## Overview
This document provides a comprehensive, step-by-step breakdown of how PDFs are processed in the Mito biomarker analysis application, from initial upload through text extraction, Vision API processing, OCR fallback, biomarker extraction, and final display to practitioners.

---

## Table of Contents
1. [File Upload](#1-file-upload)
2. [File Validation](#2-file-validation)
3. [Text Extraction & Processing](#3-text-extraction--processing)
4. [Image Processing & Quality Checks](#4-image-processing--quality-checks)
5. [Edge Function Invocation](#5-edge-function-invocation)
6. [Vision API Processing](#6-vision-api-processing)
7. [Claude AI Extraction](#7-claude-ai-extraction)
8. [Biomarker Normalization](#8-biomarker-normalization)
9. [Patient Information Consolidation](#9-patient-information-consolidation)
10. [Client Matching](#10-client-matching)
11. [Analysis Generation](#11-analysis-generation)
12. [Results Display](#12-results-display)

---

## 1. File Upload

### Component: `PdfUploader`
**Location**: `src/components/PdfUploader.tsx`

### Upload Interface
- **Drag & Drop Support**: Uses `react-dropzone` library
- **File Selection**: Click-to-browse dialog
- **Multiple Files**: Supports batch uploads
- **Visual Feedback**: Shows drag-active state, file list with icons

### Accepted File Types
```typescript
accept: {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg']
}
```

### File Size Limits
- **Maximum per file**: 10 MB (`MAX_PROCESSING_BYTES = 10 * 1024 * 1024`)
- **UI Warning**: Files exceeding 10MB are shown with red warning but don't block upload
- **Processing Filter**: Files >10MB are filtered out before processing

### Upload Flow
1. User drags/drops or selects files
2. `onDrop` callback triggered with `acceptedFiles: File[]`
3. Files validated using `validatePdfFiles()` from `pdf-processor.ts`
4. Valid files added to component state: `setFiles(newFiles)`
5. Parent component notified: `onFilesSelected(newFiles)`
6. Files displayed in scrollable list with:
   - File icon (Image/FileText)
   - File name (truncated if long)
   - File size (formatted as KB/MB)
   - Remove button (X icon)
7. "Analyze Reports" button enabled when files present
8. On click, `onAnalyze()` callback triggers `handleAnalyze()` in `HomePage`

### State Management
```typescript
const [files, setFiles] = useState<File[]>([]);
const [errors, setErrors] = useState<string[]>([]);
```

---

## 2. File Validation

### Function: `validatePdfFiles()`
**Location**: `src/lib/pdf-processor.ts` (lines 250-269)

### Validation Rules

#### File Type Check
```typescript
const allowedTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg'
];
const allowedExtensions = ['.pdf', '.docx', '.png', '.jpg', '.jpeg'];
```

**Validation Logic**:
- Checks both MIME type (`file.type`) and file extension
- Must match at least one allowed type OR extension
- Invalid types return error: `"File must be a PDF, DOCX, PNG, or JPG"`

#### File Size Check
```typescript
const maxSize = 10 * 1024 * 1024; // 10MB
if (file.size > maxSize) {
  return { valid: false, error: 'File size must be less than 10MB' };
}
```

**Note**: Size validation errors don't block upload in UI, but files are filtered before processing.

### Batch Validation
- Validates each file individually
- Collects all errors into array
- Returns `{ valid: boolean, errors: string[] }`
- Only blocks upload if invalid file types detected (not size)

---

## 3. Text Extraction & Processing

### Function: `processPdfFile()`
**Location**: `src/lib/pdf-processor.ts` (lines 27-188)

### Processing Flow by File Type

#### A. Image Files (PNG/JPG)

**Detection**:
```typescript
if (file.type.startsWith('image/')) {
  // Process as image
}
```

**Processing Steps**:
1. Convert file to `ArrayBuffer`
2. Encode to base64:
   ```typescript
   const base64 = btoa(
     new Uint8Array(arrayBuffer).reduce((data, byte) => 
       data + String.fromCharCode(byte), '')
   );
   ```
3. Check image quality using `checkImageQuality()`:
   - Resolution check (min 800x600)
   - Sharpness analysis (variance & Laplacian)
   - Returns `{ score: 0-1, warning?: string }`
4. Return `ProcessedPDF`:
   ```typescript
   {
     fileName: file.name,
     extractedText: '', // Empty - Vision API will process
     pageCount: 1,
     isImage: true,
     imageData: base64,
     mimeType: file.type,
     qualityScore: qualityCheck.score,
     qualityWarning: qualityCheck.warning
   }
   ```

**Key Point**: Images bypass OCR entirely - sent directly to Vision API for better accuracy.

#### B. Word Documents (.docx)

**Detection**:
```typescript
if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
    file.name.endsWith('.docx')) {
  // Process Word document
}
```

**Processing Steps**:
1. Convert file to `ArrayBuffer`
2. Extract text using `mammoth` library:
   ```typescript
   const result = await mammoth.extractRawText({ arrayBuffer });
   ```
3. Validate extracted text:
   - Must have content: `result.value.trim().length > 0`
   - Minimum length: 100 characters
   - Throws error if too short or empty
4. Return `ProcessedPDF`:
   ```typescript
   {
     fileName: file.name,
     extractedText: result.value.trim(),
     pageCount: 1,
     isImage: false
   }
   ```

**Limitations**: Word documents with embedded images cannot be processed - images must be extracted first.

#### C. PDF Files

**Library**: `pdfjs-dist` (Mozilla PDF.js)

**Worker Setup**:
```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();
```

**Processing Steps**:

1. **Load PDF**:
   ```typescript
   const arrayBuffer = await file.arrayBuffer();
   const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
   const pageCount = pdf.numPages;
   ```

2. **Extract Text from Each Page**:
   ```typescript
   for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
     const page = await pdf.getPage(pageNum);
     const textContent = await page.getTextContent();
     const pageText = textContent.items
       .map((item: any) => item.str)
       .join(' ');
     extractedText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
   }
   ```

3. **Quality Check**:
   ```typescript
   const minExpectedChars = pageCount * 50; // 50 chars per page minimum
   if (extractedText.trim().length === 0 || 
       extractedText.length < minExpectedChars) {
     // Fallback to Vision API
   }
   ```

4. **Vision API Fallback** (if text extraction fails):
   - Converts ALL pages to PNG images
   - Uses 2x scale for better quality: `scale: 2.0`
   - Renders each page to canvas:
     ```typescript
     const viewport = page.getViewport({ scale: 2.0 });
     canvas.width = viewport.width;
     canvas.height = viewport.height;
     await page.render({
       canvasContext: context,
       viewport: viewport,
       canvas: canvas,
     }).promise;
     ```
   - Converts canvas to base64 PNG:
     ```typescript
     const imageData = canvas.toDataURL('image/png').split(',')[1];
     imagePages.push(imageData);
     ```
   - Returns `ProcessedPDF` with `isImage: true` and `imagePages: string[]`

5. **Success Path** (text extraction worked):
   ```typescript
   {
     fileName: file.name,
     extractedText: extractedText.trim(),
     pageCount: pageCount,
     isImage: false
   }
   ```

### Batch Processing

**Function**: `processMultiplePdfs()`
**Location**: `src/lib/pdf-processor.ts` (lines 195-215)

**Process**:
- Processes files sequentially (one at a time)
- Calls `processPdfFile()` for each file
- Optional progress callback: `onOcrProgress(fileName, progress)`
- Collects all results into `ProcessedPDF[]`
- Throws error if any file fails

---

## 4. Image Processing & Quality Checks

### Function: `checkImageQuality()`
**Location**: `src/lib/pdf-processor.ts` (lines 275-377)

### Quality Metrics

#### 1. Resolution Check
```typescript
const minWidth = 800;
const minHeight = 600;
if (img.width < minWidth || img.height < minHeight) {
  return {
    score: 0.3,
    warning: `Low resolution (${img.width}x${img.height}). Minimum ${minWidth}x${minHeight} recommended.`
  };
}
```

#### 2. Sharpness Analysis

**Variance Calculation**:
- Converts image to grayscale
- Calculates pixel variance (measure of contrast/sharpness)
- Blurry images have lower variance

**Laplacian Variance** (Edge Detection):
- Applies simplified Laplacian kernel to detect edges
- Measures edge strength across image
- Low Laplacian variance = blurry image

**Thresholds**:
```typescript
const varianceThreshold = 800;
const laplacianThreshold = 8;
if (variance < varianceThreshold || laplacianVariance < laplacianThreshold) {
  return {
    score: 0.4,
    warning: 'Image appears blurry or low quality. Text extraction may be inaccurate.'
  };
}
```

**Good Quality**:
```typescript
return { score: 1.0 }; // No warning
```

### Quality Score Range
- **0.0 - 0.3**: Very low quality (resolution too low)
- **0.4**: Low quality (blurry)
- **1.0**: Good quality

---

## 5. Edge Function Invocation

### Function: `extractBiomarkersFromPdf()`
**Location**: `src/lib/claude-service.ts` (lines 318-567)

### Pre-Request Setup

#### 1. Supabase Client Check
```typescript
if (!supabase) {
  throw new Error('Supabase is not configured');
}
```

#### 2. File Size Detection
```typescript
const textLength = processedPdf.extractedText?.length || 0;
const isLargeFile = textLength > 50000 || processedPdf.pageCount > 10;
```

#### 3. Progress Heartbeat (for large files)
```typescript
if (isLargeFile) {
  let secondsElapsed = 0;
  heartbeatInterval = setInterval(() => {
    secondsElapsed += 5;
    console.log(`⏳ Still processing... ${secondsElapsed}s elapsed`);
  }, 5000);
}
```

### Request Preparation

#### Payload Construction
```typescript
const payloadSize = JSON.stringify({ processedPdf }).length;
console.log(`📦 Payload size: ${(payloadSize / 1024).toFixed(2)} KB`);
```

**ProcessedPDF Object Contains**:
- `fileName`: string
- `extractedText`: string (empty for images)
- `pageCount`: number
- `isImage`: boolean
- `imageData`: string (base64, single image)
- `imagePages`: string[] (base64, multi-page PDF)
- `mimeType`: string
- `qualityScore`: number (0-1)
- `qualityWarning`: string (optional)

#### Timeout Protection
```typescript
const EDGE_FUNCTION_TIMEOUT = 180000; // 180 seconds (3 minutes)

const abortController = new AbortController();
const timeoutId = setTimeout(() => {
  console.error(`❌ Edge Function timeout after ${EDGE_FUNCTION_TIMEOUT / 1000}s`);
  abortController.abort();
}, EDGE_FUNCTION_TIMEOUT);
```

### Edge Function Call

#### Request
```typescript
const result = await supabaseClient.functions.invoke('analyze-biomarkers', {
  body: { processedPdf },
  signal: abortController.signal, // For timeout cancellation
});
```

#### Response Handling

**Success Path**:
```typescript
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
```

**Error Handling**:
- **401 Unauthorized**: Auth failed
- **422**: Not a lab report / No biomarkers found
- **413**: Payload too large
- **504**: Gateway timeout
- **429**: Rate limit
- **503**: Service unavailable

**Retry Logic**:
- Uses `retryWithBackoff()` wrapper
- Max retries: 2
- Exponential backoff: 3s → 6s → 10s (max)
- Only retries transient errors (429, 503, network errors)
- Does NOT retry: client errors (400-499 except 429), timeouts, payload too large

### Biomarker Normalization

After receiving response:
```typescript
const normalizedBiomarkers = await biomarkerNormalizer.normalizeBatch(
  rawResponse.biomarkers
);

return {
  ...rawResponse,
  normalizedBiomarkers
};
```

---

## 6. Vision API Processing

### Edge Function: `analyze-biomarkers`
**Location**: `supabase/functions/analyze-biomarkers/index.ts`

### Authentication & Setup

#### 1. CORS Headers
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

#### 2. Auth Check (Optional)
```typescript
const requireAuth = Deno.env.get('REQUIRE_AUTH') === 'true';
// Can be disabled for public access
```

#### 3. Claude API Key
```typescript
const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
if (!claudeApiKey) {
  return new Response(JSON.stringify({ error: 'Claude API key not configured' }), {
    status: 500,
  });
}
```

### Request Body Parsing

#### Timeout Protection
```typescript
const parsePromise = req.json();
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Request body parsing timeout after 30s')), 30000)
);
requestBody = await Promise.race([parsePromise, timeoutPromise]);
```

#### Payload Size Validation
```typescript
const MAX_PAYLOAD_SIZE = 20 * 1024 * 1024; // 20MB

const textLength = processedPdf.extractedText?.length || 0;
const singleImageSize = processedPdf.imageData?.length || 0;
const multiImageSize = processedPdf.imagePages?.reduce((sum, img) => sum + img.length, 0) || 0;
const totalSize = textLength + singleImageSize + multiImageSize;

if (totalSize > MAX_PAYLOAD_SIZE) {
  return new Response(JSON.stringify({
    error: `File too large for processing. Size: ${(totalSize / 1024 / 1024).toFixed(2)}MB. Maximum: 20MB.`,
  }), { status: 413 });
}
```

### Content Building

#### For Images (Vision API)
```typescript
if (processedPdf.isImage || processedPdf.imageData || processedPdf.imagePages) {
  // Add prompt first
  content.push({
    type: 'text',
    text: extractionPrompt,
  });

  // Single image
  if (processedPdf.imageData) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: processedPdf.mimeType || 'image/png',
        data: processedPdf.imageData,
      },
    });
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
      });
    });
  }
}
```

#### For Text-Based PDFs
```typescript
else {
  content.push({
    type: 'text',
    text: `${extractionPrompt}\n\n=== EXTRACTED TEXT ===\n${processedPdf.extractedText || ''}`,
  });
}
```

### Claude API Call

#### Client Initialization
```typescript
const client = new Anthropic({
  apiKey: claudeApiKey,
});
```

#### Streaming Request
```typescript
const stream = await client.messages.stream({
  model: 'claude-haiku-4-5-20251001', // Claude Haiku 4.5
  max_tokens: 32768, // Increased from 8192 to handle 300+ biomarkers
  temperature: 0, // Deterministic extraction
  messages: [{ role: 'user', content }],
});
```

#### Stream Processing
```typescript
let streamedText = '';
for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    streamedText += event.delta.text;
  }
}

const response = await stream.finalMessage();
```

**Note**: Vision API with ALL pages can take 2-5 minutes for large multi-page PDFs.

---

## 7. Claude AI Extraction

### Extraction Prompt
**Function**: `createExtractionPrompt()`
**Location**: `supabase/functions/analyze-biomarkers/index.ts` (lines 399-539)

### Key Instructions

#### Multilingual Support
- Supports lab reports in ANY language
- Recognizes biomarker names in multiple languages (English, Spanish, Portuguese, French, German, Italian, Chinese, Japanese, Korean, Arabic, Russian, Dutch, Polish, Turkish)
- Normalizes biomarker names to PRIMARY English names in output

#### Patient Information Extraction
- **Name**: Full name as shown (any language/script)
- **Date of Birth**: Convert to YYYY-MM-DD format
- **Gender**: Normalize to "male", "female", or "other"
- **Test Date**: Most recent date if multiple reports, YYYY-MM-DD format

#### Biomarker Extraction Rules

**Critical Rules**:
1. Extract EVERY SINGLE biomarker visible
2. Don't skip values even if duplicates or unusual formats
3. For WBC differentials (Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils):
   - Extract ONLY absolute counts (×10³/µL, K/µL)
   - NEVER extract percentage (%) values
   - Convert "cells/µL" to "×10³/µL" by dividing by 1000

**Unit Normalization Examples**:
- "12 cells/µL" → value: "0.012", unit: "×10³/µL"
- "150 cells/µL" → value: "0.15", unit: "×10³/µL"
- "3500 cells/µL" → value: "3.5", unit: "×10³/µL"

#### Response Format
```json
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
```

**Important**: If patient info not found, use `null` (not "Unknown", "N/A", etc.)

### Response Parsing

#### JSON Extraction
```typescript
// Remove markdown code blocks if present
if (responseText.startsWith('```json')) {
  responseText = responseText.replace(/^```json\n/, '').replace(/\n```$/, '');
}

// Extract JSON object (handle extra text after JSON)
const jsonStartIndex = responseText.indexOf('{');
if (jsonStartIndex !== -1) {
  // Find matching closing brace
  let bracketCount = 0;
  let jsonEndIndex = -1;
  for (let i = jsonStartIndex; i < responseText.length; i++) {
    if (responseText[i] === '{') bracketCount++;
    if (responseText[i] === '}') {
      bracketCount--;
      if (bracketCount === 0) {
        jsonEndIndex = i + 1;
        break;
      }
    }
  }
  responseText = responseText.substring(jsonStartIndex, jsonEndIndex);
}
```

#### Validation
```typescript
if (!parsedResponse.biomarkers || !Array.isArray(parsedResponse.biomarkers)) {
  throw new Error('Claude response missing biomarkers array');
}

if (parsedResponse.biomarkers.length === 0) {
  // Return success with empty biomarkers (not an error)
  return new Response(JSON.stringify({
    biomarkers: [],
    patientInfo: parsedResponse.patientInfo || null,
    metadata: {
      note: 'No biomarkers found in this document.',
      suggestion: 'This file may be a different type of document...'
    }
  }), { status: 200 });
}
```

#### Unit Normalization
**Function**: `normalizeUnit()`
**Location**: `supabase/functions/analyze-biomarkers/index.ts` (lines 383-397)

```typescript
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

// Applied to all biomarkers post-extraction:
parsedResponse.biomarkers = parsedResponse.biomarkers.map((biomarker: any) => {
  if (biomarker.unit) {
    biomarker.unit = normalizeUnit(biomarker.unit);
  }
  return biomarker;
});
```

**Normalization Rules**:
- `Tsd./µl` → `×10³/µL` (German: Tausend = Thousand)
- `Tsd/µl` → `×10³/µL`
- `K/µl` → `×10³/µL` (K = kilo = thousand)
- `k/µl` → `×10³/µL`
- `µl` → `µL` (standardize capitalization)
- `ul` → `µL`
- `uL` → `µL`

---

## 8. Biomarker Normalization

### Function: `biomarkerNormalizer.normalizeBatch()`
**Location**: `src/lib/biomarker-normalizer.ts` (referenced in `claude-service.ts`)

### Purpose
- Normalizes biomarker names to canonical forms
- Handles variations: "B12" vs "Vitamin B12" vs "B-12"
- Converts units to standard formats
- Applies value conversions if needed

### Process
1. Takes array of `ExtractedBiomarker[]`
2. Matches each biomarker to canonical name
3. Returns `NormalizedBiomarker[]` with:
   - `name`: Canonical name
   - `originalName`: Original extracted name
   - `value`: Normalized value
   - `originalValue`: Original value
   - `unit`: Normalized unit
   - `originalUnit`: Original unit
   - `confidence`: Match confidence (0-1)
   - `conversionApplied`: Boolean
   - `isNumeric`: Boolean

### Integration
```typescript
const normalizedBiomarkers = await biomarkerNormalizer.normalizeBatch(
  rawResponse.biomarkers
);

return {
  ...rawResponse,
  normalizedBiomarkers // Optional normalized version
};
```

**Note**: Frontend uses normalized biomarkers if available, falls back to raw biomarkers.

---

## 9. Patient Information Consolidation

### Function: `consolidatePatientInfo()`
**Location**: `src/lib/claude-service.ts` (lines 1313-1432)

### Purpose
When multiple PDFs are uploaded, patient info may vary slightly. This function:
- Picks most common/complete values
- Flags discrepancies
- Determines confidence level

### Process

#### Name Consolidation
```typescript
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

// Convert to Title Case
consolidatedName = toTitleCase(mostCommonName);
```

**Discrepancy Detection**:
```typescript
const uniqueNames = Array.from(new Set(names.map(n => n.toLowerCase().trim())));
if (uniqueNames.length > 1) {
  discrepancies.push(`Name: Found ${uniqueNames.length} variations → Using "${consolidatedName}"`);
}
```

#### Date of Birth Consolidation
- Picks most common DOB
- Flags if multiple different DOBs found

#### Gender Consolidation
- Picks most common gender
- Normalizes to "male", "female", or "other"

#### Test Date Consolidation
- Picks MOST RECENT date (not most common)
- Flags if multiple different dates (multiple lab visits)

### Confidence Levels
```typescript
let confidence: 'high' | 'medium' | 'low' = 'high';
if (discrepancies.length > 2) {
  confidence = 'low';
} else if (discrepancies.length > 0) {
  confidence = 'medium';
}
```

### Return Value
```typescript
{
  consolidated: PatientInfo,
  discrepancies: string[],
  confidence: 'high' | 'medium' | 'low'
}
```

---

## 10. Client Matching

### Function: `matchOrCreateClient()`
**Location**: `src/lib/client-matcher.ts` (lines 17-92)

### Process

#### 1. Search Existing Clients

**Fast Server-Side Search**:
```typescript
if (patientInfo.name) {
  // Fast server-side search with timeout (10 seconds max)
  try {
    const searchPromise = searchClientsByName(patientInfo.name, 50);
    const timeoutPromise = new Promise<Client[]>((_, reject) =>
      setTimeout(() => reject(new Error('Client search timeout')), 10000)
    );

    candidateClients = await Promise.race([searchPromise, timeoutPromise]);
  } catch (error) {
    console.warn('⚠️ Client search timed out or failed, suggesting create new:', error);
    // On timeout/error, suggest creating new client
    return {
      matched: false,
      client: null,
      confidence: 'high',
      needsConfirmation: true,
      suggestedAction: 'create-new',
    };
  }
}
```

**Matching Algorithm**:
```typescript
// Name matching (most important)
if (similarity >= 0.9) {
  matchScore += 3; // Exact or very close match
} else if (similarity >= 0.7) {
  matchScore += 2; // Good match
} else if (similarity >= 0.5) {
  matchScore += 1; // Partial match
}

// DOB matching (very important)
if (dateOfBirth === client.date_of_birth) {
  matchScore += 3; // Exact match
}

// Gender matching (nice to have)
if (gender === client.gender) {
  matchScore += 1;
}
```

#### 2. Match Confidence
- **High (≥85%)**: Exact name + DOB match → Auto-use existing (no confirmation)
- **Medium (≥65%)**: Name similar + DOB matches OR name exact → Needs confirmation
- **Low (<65%)**: No good match → Suggest create new

#### 3. Return Match Result
```typescript
{
  matched: boolean,
  client: Client | null,
  confidence: 'high' | 'medium' | 'low',
  needsConfirmation: boolean,
  suggestedAction: 'use-existing' | 'create-new' | 'manual-select'
}
```

### Client Creation with Timeout Protection

**Function**: `createClient()`
**Location**: `src/lib/client-service.ts` (lines 113-155)

**Problem**: In production, `supabase.auth.getSession()` can hang indefinitely, causing the UI to freeze at 20% progress.

**Solution**: Add 5-second timeout to getSession() call:

```typescript
export async function createClient(client: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client | null> {
  if (!supabase) return null;

  // Get current user ID from cached session with timeout to prevent infinite hang
  let userId: string | undefined;
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('getSession timeout after 5 seconds')), 5000)
    );

    const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
    if (session?.user) {
      userId = session.user.id;
      console.log('✅ Got user ID from session:', userId);
    } else {
      console.warn('⚠️ No session found - will attempt insert without user_id');
    }
  } catch (error) {
    console.error('❌ getSession failed or timed out:', error);
    // Continue without userId - let RLS policy fail with clear error if needed
    console.warn('⚠️ Continuing without user_id - RLS policy may reject insert');
  }

  // Build insert data - only include user_id if we have it
  const insertData: any = { ...client };
  if (userId) {
    insertData.user_id = userId;
  }

  const { data, error } = await supabase
    .from('clients')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    handleDatabaseError(error, 'clients', 'insert');
    return null;
  }

  return data;
}
```

**RLS Policy Update**:
Migration `20251114000001_fix_clients_rls_timeout.sql` allows inserts when `auth.uid()` is NULL (with user_id provided), providing better error messages than generic "permission denied".

### Confirmation Dialog
**Component**: `ClientConfirmation`
**Location**: `src/components/ClientConfirmation.tsx`

**Features**:
- Shows consolidated patient info (pre-populated)
- Shows match result if found
- Allows editing patient info
- Option to use existing client or create new
- Displays discrepancies if any

---

## 11. Analysis Generation

### Function: `matchBiomarkersWithRanges()`
**Location**: `src/lib/analyzer.ts` (referenced in `HomePage.tsx`)

### Process

#### 1. Biomarker Matching
- Matches extracted biomarkers to 54 core biomarkers
- Uses normalized biomarkers if available
- Falls back to raw biomarkers

#### 2. Range Lookup
- Gets optimal ranges based on gender
- Handles gender-specific ranges (e.g., Hemoglobin)
- Uses default ranges if gender not specified

#### 3. Value Comparison
- Compares patient value to optimal range
- Determines status: "in-range", "out-of-range", "unknown"
- Handles "N/A" values (biomarker not found)

#### 4. Result Generation
```typescript
AnalysisResult {
  biomarkerName: string,
  hisValue: string, // Patient value or "N/A"
  optimalRange: string,
  unit: string,
  status: 'in-range' | 'out-of-range' | 'unknown'
}
```

### Batch Processing

#### Multiple Test Dates
If multiple test dates found:
```typescript
if (biomarkersByDate.size > 1 && isSupabaseEnabled && clientId) {
  // Create separate analyses for each test date
  for (const [testDate, dateBiomarkers] of biomarkersByDate.entries()) {
    const dateResults = matchBiomarkersWithRanges(dateBiomarkers, finalGender);
    await createAnalysis(clientId, dateResults, testDate);
  }
}
```

#### Single Test Date
```typescript
const combinedResults = matchBiomarkersWithRanges(extractedBiomarkers, finalGender);
await createAnalysis(clientId, combinedResults, finalTestDate);
```

### Database Storage

#### Function: `createAnalysis()`
**Location**: `src/lib/analysis-service.ts`

**Stores**:
- Client ID
- Analysis results (biomarker values, ranges, status)
- Test date
- Created timestamp
- Notes (optional)

---

## 12. Results Display

### Component: `AnalysisResults`
**Location**: `src/components/AnalysisResults.tsx`

### Display Features

#### 1. Summary Header
- Client name
- Number of documents processed
- Number of analyses saved
- Patient info discrepancies (if any)

#### 2. Summary Statistics
```typescript
{
  total: number,
  inRange: number,
  outOfRange: number,
  notFound: number,
  percentages: {
    inRange: number,
    outOfRange: number,
    notFound: number
  }
}
```

#### 3. View Mode Filter
- **All**: Shows all 54 biomarkers
- **Out of Range**: Shows only biomarkers outside optimal range

#### 4. Biomarker Table

**Columns**:
- **Biomarker Name**: Full name with tooltip
- **Patient Value**: Editable (inline editing)
- **Optimal Range**: Gender-specific range
- **Unit**: Editable (inline editing)
- **Status**: Color-coded badge
  - Green: In range
  - Red: Out of range
  - Gray: Not found

**Row Colors**:
- Green background: In range
- Red background: Out of range
- Gray background: Not found

**Interactive Features**:
- Click biomarker name → Opens info dialog with:
  - Full biomarker description
  - Clinical significance
  - Optimal ranges explanation
  - Custom reasons (if configured)
- Double-click value/unit → Inline editing
- Hover → Tooltip with additional info

#### 5. Export Options

**Copy to Clipboard**:
```typescript
const markdown = generateMarkdownTable(filteredResults, clientName, gender, viewMode);
navigator.clipboard.writeText(markdown);
```

**Download as Markdown**:
```typescript
const blob = new Blob([markdown], { type: 'text/markdown' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.download = `biomarker-analysis-${new Date().toISOString().split('T')[0]}.md`;
a.click();
```

**Markdown Format**:
- Header with client name, date, gender
- Summary statistics table
- Biomarker results table
- Footer with notes

#### 6. Processing Information

**Collapsible Section**:
- Number of documents analyzed
- Patient info discrepancies
- File processing warnings
- Quality warnings

#### 7. Biomarker Info Dialog

**Opens on biomarker name click**:
- Full biomarker name
- Description
- Clinical significance
- Optimal ranges (male/female)
- Current value & status
- Custom reasons (if configured)
- References/sources

### State Management

```typescript
const [editableResults, setEditableResults] = useState<AnalysisResult[]>(results);
const [viewMode, setViewMode] = useState<'all' | 'out-of-range'>('all');
const [editingCell, setEditingCell] = useState<{index: number, field: 'value' | 'unit'} | null>(null);
```

### Inline Editing

**Process**:
1. Double-click value or unit cell
2. Input field appears with current value
3. Edit value
4. Press Enter to save, Escape to cancel
5. Updates `editableResults` state
6. Recalculates status based on new value

---

## Technical Details & Performance

### File Size Limits
- **Upload Limit**: 10 MB per file
- **Processing Limit**: 20 MB total payload
- **Large File Threshold**: >50K chars or >10 pages

### Timeouts
- **Edge Function**: 180 seconds (3 minutes)
- **Request Body Parsing**: 30 seconds
- **Large File Heartbeat**: Every 5 seconds

### Retry Logic
- **Max Retries**: 2
- **Initial Delay**: 3 seconds
- **Max Delay**: 10 seconds
- **Exponential Backoff**: 3s → 6s → 10s

### Batch Processing

#### Adaptive Batching
**Location**: `src/lib/adaptive-batching.ts`

**Features**:
- Groups files by size/complexity
- Large files processed sequentially
- Small files processed in parallel
- Adaptive delays between batches
- Split-on-failure retry strategy

#### Vision API Batching
- Files with images processed sequentially
- 500ms delay between Vision requests
- Prevents rate limiting

### Error Handling

#### Client-Side
- File validation errors shown in UI
- Processing errors shown in error state
- Failed files tracked in `_failedFiles` array

#### Server-Side
- Detailed error messages
- Error types: timeout, rate_limit, payload_too_large, server_error, client_error
- Non-retryable errors: 400-499 (except 429), timeouts, payload too large

### Progress Tracking

#### Phases
1. **Text Extraction**: 0-20%
2. **AI Analysis**: 20-90%
3. **Consolidation**: 90-98%
4. **Client Matching**: 98-99%
5. **Confirmation**: 99-100%

#### Per-File Progress
- Tracks status: 'pending', 'processing', 'completed', 'error'
- Shows current file being processed
- Updates in real-time

---

## Data Flow Summary

```
1. User uploads PDF/image/docx
   ↓
2. File validation (type, size)
   ↓
3. Text extraction (pdfjs-dist / mammoth)
   ↓
4. Quality check (if image)
   ↓
5. Vision API fallback (if text extraction fails)
   ↓
6. Edge Function invocation (Supabase)
   ↓
7. Claude API call (Vision or text)
   ↓
8. Biomarker extraction (JSON parsing)
   ↓
9. Biomarker normalization
   ↓
10. Patient info consolidation (if multiple files)
   ↓
11. Client matching (Supabase)
   ↓
12. Confirmation dialog (user review/edit)
   ↓
13. Analysis generation (range matching)
   ↓
14. Database storage (Supabase)
   ↓
15. Results display (AnalysisResults component)
```

---

## Key Technologies

- **PDF Processing**: `pdfjs-dist` (Mozilla PDF.js)
- **Word Documents**: `mammoth`
- **Vision API**: Claude Haiku 4.5 (Anthropic)
- **Edge Functions**: Supabase Edge Functions (Deno)
- **Image Processing**: HTML5 Canvas API
- **Base64 Encoding**: Browser `btoa()` function
- **File Upload**: `react-dropzone`
- **State Management**: React hooks (`useState`, `useEffect`)
- **Database**: Supabase (PostgreSQL)

---

## Security Considerations

1. **API Key Security**: Claude API key stored in Supabase secrets, never exposed to client
2. **Authentication**: Optional auth check in Edge Function (can be disabled)
3. **File Size Limits**: Prevents DoS attacks via large files
4. **Timeout Protection**: Prevents hanging requests
5. **Input Validation**: File type and size validation before processing
6. **Error Sanitization**: Error messages don't expose sensitive information

---

## Performance Optimizations

1. **Adaptive Batching**: Groups files intelligently for parallel/sequential processing
2. **Streaming Responses**: Uses Claude streaming API for faster initial response
3. **Progress Tracking**: Real-time updates prevent user confusion
4. **Retry Logic**: Handles transient errors automatically
5. **Large File Handling**: Sequential processing prevents rate limiting
6. **Image Quality Checks**: Early detection of low-quality images
7. **Biomarker Normalization**: Cached normalization for faster matching

---

## Future Enhancements

1. **PDF Storage**: Store original PDFs in Supabase Storage
2. **OCR Improvements**: Better OCR for low-quality images
3. **Batch Export**: Export multiple analyses at once
4. **PDF Export**: Generate PDF reports (currently markdown only)
5. **Real-time Collaboration**: Multiple practitioners viewing same analysis
6. **Historical Comparison**: Compare biomarkers across time periods
7. **AI Insights**: Generate recommendations based on biomarker patterns

---

## Conclusion

The PDF processing flow in Mito is a sophisticated, multi-stage pipeline that handles various file types, quality levels, and edge cases. From initial upload through Vision API processing to final display, each stage is carefully designed to provide accurate biomarker extraction and a smooth user experience for practitioners.

The system's strength lies in its:
- **Flexibility**: Handles PDFs, Word docs, and images
- **Robustness**: Multiple fallback mechanisms (text → Vision API)
- **Accuracy**: Vision API for scanned documents, normalization for consistency
- **User Experience**: Real-time progress, inline editing, comprehensive display
- **Scalability**: Adaptive batching, retry logic, timeout protection

This document serves as a complete reference for understanding, maintaining, and extending the PDF processing functionality.

