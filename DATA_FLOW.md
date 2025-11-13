# Complete Data Flow: File Upload to Database Storage

## Overview
This document traces the complete flow of data from file upload through biomarker extraction, analysis, and database storage in the Mito biomarker analysis application.

---

## 1. UPLOAD COMPONENT & FILE SUBMISSION

### File: `/Users/gman/Desktop/mito/src/components/PdfUploader.tsx`

**Purpose**: React component for file upload interface

**Key Features**:
- Drag-and-drop file upload support
- Accepts PDF, DOCX, PNG, and JPG files
- Maximum file size: 50MB per file
- Multiple file upload support
- Client-side file validation

**Process**:
1. User drags/drops or selects files via dialog
2. `onDrop` callback validates files using `validatePdfFiles()`
3. Valid files are stored in component state
4. "Analyze Reports" button triggers `handleAnalyze()` in HomePage

**File Types Supported**:
- PDF (`.pdf`) - text extraction
- Word (`.docx`) - text extraction with mammoth library
- Images (`.png`, `.jpg`) - base64 encoded for Vision API

---

## 2. PDF PROCESSING & TEXT EXTRACTION

### File: `/Users/gman/Desktop/mito/src/lib/pdf-processor.ts`

**Purpose**: Convert files to processable format (text or base64 images)

**Key Functions**:

#### `processPdfFile(file: File): Promise<ProcessedPDF>`
Processes a single file and returns extracted text or base64-encoded images.

**PDF Processing**:
1. Load PDF using `pdfjs-dist`
2. Extract text from each page
3. If text extraction yields < 50 chars per page on average:
   - Convert ALL PDF pages to high-quality PNG images (2x scale)
   - Store as base64 in `imagePages` array
   - Flag as `isImage: true`
4. Return `ProcessedPDF` object with:
   - `extractedText`: Full text content
   - `pageCount`: Number of pages
   - `imagePages`: Base64-encoded images (if fallback used)
   - `qualityScore`: Quality assessment (0-1)
   - `qualityWarning`: Warnings if quality is low

**Word Document Processing**:
1. Extract raw text using `mammoth` library
2. Validate minimum text content (100+ chars)
3. Return `ProcessedPDF` with extracted text
4. Throw error if document is mostly images

**Image Processing**:
1. Convert image to base64
2. Check image quality using:
   - Resolution check (minimum 800x600)
   - Sharpness variance analysis
   - Laplacian edge detection (blur detection)
3. Return quality score and warning if needed

#### `processMultiplePdfs(files: File[]): Promise<ProcessedPDF[]>`
- Sequentially processes multiple files
- Maintains order of files
- Throws error on first failure

**Output**: Array of `ProcessedPDF` objects ready for Claude analysis

---

## 3. BIOMARKER EXTRACTION & CLAUDE AI ANALYSIS

### File: `/Users/gman/Desktop/mito/src/lib/claude-service.ts`

**Purpose**: Extract biomarker data from documents using Claude AI via Supabase Edge Function

**Key Functions**:

#### `extractBiomarkersFromPdfs(processedPdfs, onProgress): Promise<ClaudeResponseBatch>`

**Batch Processing Strategy**:
- Splits files into batches of max 10 files per request
- Processes batches sequentially with 2-second delays
- Provides real-time progress callbacks
- Handles partial failures (some files can fail while others succeed)

**Process Flow**:
1. Split files into batches of ≤10
2. For each batch:
   - Call `extractBiomarkersFromBatch()`
   - Update progress via callback
   - Wait 2 seconds before next batch
3. Aggregate results from all batches
4. Return array with `_failedFiles` metadata

#### `extractBiomarkersFromPdf(processedPdf): Promise<ClaudeResponse>`

**Single File Processing**:
1. Calls Supabase Edge Function: `analyze-biomarkers`
2. Implements retry logic with exponential backoff:
   - Max 2 retries
   - Initial delay: 3 seconds
   - Max delay: 10 seconds
   - Non-retryable errors: Client errors (400-499), processing timeouts, 413 (file too large)
3. Timeout protection: 120 seconds per file
4. Heartbeat logging every 5 seconds for large files (>50KB or >10 pages)

**Retry Logic Details**:
- Retries only transient errors: rate limits (429), service unavailable (503), network errors
- Does NOT retry processing timeouts (file too large/complex)
- Provides detailed error messages for debugging

**Return**: `ClaudeResponse` containing:
```typescript
{
  biomarkers: ExtractedBiomarker[];  // name, value, unit
  patientInfo: PatientInfo;          // name, DOB, gender, testDate
  panelName: string;                 // AI-generated panel name
  raw?: string;                      // Raw response JSON
}
```

#### `consolidatePatientInfo(patientInfos): PatientInfo + metadata`

**Purpose**: Merge patient info from multiple documents (batch uploads)

**Algorithm**:
1. Name: Pick most common name (normalized for comparison)
2. DOB: Pick most common date
3. Gender: Pick most common gender
4. Test Date: Pick most recent date
5. Confidence: Evaluate confidence level based on discrepancies

**Output**:
```typescript
{
  consolidated: PatientInfo;          // Merged patient info
  discrepancies: string[];            // List of issues found
  confidence: 'high' | 'medium' | 'low'
}
```

**Edge Function**: `/Users/gman/Desktop/mito/supabase/functions/analyze-biomarkers/index.ts`

**Edge Function Process**:
1. Validates authentication and Claude API key
2. Checks file size (max 20MB combined)
3. Builds extraction prompt with multilingual support
4. Calls Claude API:
   - Model: `claude-haiku-4-5-20251001`
   - Temperature: 0 (deterministic)
   - Max tokens: 8192
   - Timeout: 300 seconds (5 minutes for multi-page PDFs)
5. Handles both Vision API (images) and text extraction
6. Parses JSON response and validates biomarkers array
7. Returns error if 0 biomarkers found (likely not a lab report)

**Multilingual Support**:
- Recognizes biomarkers in 15+ languages
- Extracts biomarker names in English (normalized)
- Preserves units exactly as shown in document
- Converts dates to YYYY-MM-DD format
- Normalizes gender to: male, female, other, or null

**Critical WBC Differential Handling**:
- ONLY extracts absolute counts (×10³/µL, K/µL)
- NEVER extracts percentages
- Converts cells/µL to ×10³/µL by dividing by 1000
- Examples:
  - "12 cells/µL" → "0.012" with unit "×10³/µL"
  - "Neutrophils: 55% | 3.2 K/µL" → "3.2" with unit "K/µL"

---

## 4. BIOMARKER MATCHING & ANALYSIS

### File: `/Users/gman/Desktop/mito/src/lib/analyzer.ts`

**Purpose**: Match extracted biomarkers against optimal reference ranges

#### `matchBiomarkersWithRanges(extractedBiomarkers, gender): AnalysisResult[]`

**Process**:
1. Get all benchmarks (built-in + custom) from database
2. Normalize all biomarker names (lowercase, remove special chars)
3. For each benchmark:
   - Try to find match by name or aliases
   - Extract gender-specific range (male vs female)
   - If found: Create result with value + optimal range
   - If not found: Create result with "N/A" + optimal range
4. Sort results by biomarker name
5. Return array of `AnalysisResult`

**Matching Algorithm**:
- Creates normalized name map for fast lookups
- Checks primary name + aliases for flexibility
- Removes matches from "unmatched" set
- Logs any unmatched extracted biomarkers

**Output**: `AnalysisResult[]` containing:
```typescript
{
  biomarkerName: string;        // Primary benchmark name
  hisValue: string;             // Patient's value or "N/A"
  unit: string;                 // Unit of measurement
  optimalRange: string;         // Gender-specific optimal range
  testDate?: string;            // Optional test date
}
```

---

## 5. CLIENT MATCHING & CREATION

### File: `/Users/gman/Desktop/mito/src/lib/client-matcher.ts`

**Purpose**: Find existing clients or prepare to create new ones

#### `matchOrCreateClient(patientInfo): Promise<ClientMatchResult>`

**Process**:
1. If no name or DOB: Return "manual-select" suggestion
2. If name provided: Search database for candidates
   - Uses fast server-side search (< 10 second timeout)
   - Limits to 50 matches
3. If candidates found:
   - Find best match using `findBestMatch()`
   - Calculate match confidence
4. If no match or search fails: Suggest "create-new"

**Match Scoring Algorithm**:
- Name similarity: Normalized Levenshtein distance (0-3 points)
  - ≥0.9 similarity = 3 points (exact match)
  - ≥0.7 similarity = 2 points (good match)
  - ≥0.5 similarity = 1 point (partial match)
- DOB exact match: 3 points
- Gender match: 1 point
- Confidence = points / max_points
- Returns "high" if ≥0.85, "medium" if ≥0.65

**Output**: `ClientMatchResult`
```typescript
{
  matched: boolean;
  client: Client | null;
  confidence: 'high' | 'medium' | 'low';
  needsConfirmation: boolean;
  suggestedAction: 'use-existing' | 'create-new' | 'manual-select';
}
```

#### `autoCreateClient(patientInfo): Promise<Client | null>`

**Process**:
1. Convert name to Title Case for consistency
2. Normalize DOB (null if "Unknown" or empty)
3. Normalize gender (male/female/other or null)
4. Insert into `clients` table with:
   - `full_name`: Formatted name
   - `date_of_birth`: DOB or null
   - `gender`: Normalized gender
   - `status`: "active"
   - `user_id`: Current user ID (if authenticated)
   - `notes`: "Auto-created from lab report"

---

## 6. DATABASE OPERATIONS

### File: `/Users/gman/Desktop/mito/src/lib/analysis-service.ts`

**Purpose**: Save analysis results to database

#### `createAnalysis(clientId, results, labTestDate?, notes?): Promise<Analysis | null>`

**Process**:
1. Get current user ID from Supabase session (cached, no network)
2. Check if analysis already exists for same `lab_test_date`:
   - If exists: Update existing instead of creating duplicate
3. Generate summary stats:
   - Total biomarkers
   - Measured biomarkers (value ≠ "N/A")
   - Missing biomarkers (value = "N/A")
4. Insert into `analyses` table with:
   - `client_id`: Client ID
   - `lab_test_date`: Lab test date from report (YYYY-MM-DD) or null
   - `results`: JSON array of AnalysisResult objects
   - `summary`: Summary stats
   - `notes`: Optional notes
   - `user_id`: Current user (if authenticated)
   - `analysis_date`: Current timestamp (auto)

**Key Features**:
- Deduplicates analyses by `(client_id, lab_test_date)` pair
- Stores full biomarker results as JSON
- Preserves test date from lab report (separate from analysis upload date)

#### Other Key Functions:
- `updateAnalysis()`: Update existing analysis results
- `deleteAnalysis()`: Remove analysis
- `getClientAnalyses()`: Retrieve all analyses for a client
- `getLatestAnalysis()`: Get most recent analysis
- `findAnalysisByDate()`: Get specific analysis by test date
- `deleteDuplicateAnalyses()`: Clean up duplicate analyses

---

## 7. CLIENT DATA STORAGE

### File: `/Users/gman/Desktop/mito/src/lib/client-service.ts`

**Purpose**: Manage client records in database

#### `createClient(clientData): Promise<Client | null>`

**Process**:
1. Get current user ID from session (cached)
2. Build insert data with:
   - `full_name`: Client name
   - `date_of_birth`: DOB or null
   - `gender`: male/female/other/null
   - `email`: Email or null
   - `status`: "active" or "past"
   - `notes`: Any notes
   - `tags`: Array of tags
   - `user_id`: Current user (if authenticated)
3. Insert into `clients` table
4. Return created client with auto-generated ID

**Other Client Functions**:
- `getClient()`: Retrieve by ID
- `getAllClients()`: Get all clients
- `searchClientsByName()`: Fast server-side search with ilike
- `getActiveClients()`: Filter by status
- `updateClient()`: Modify client info
- `archiveClient()`: Mark as "past" status
- `mergeClients()`: Move analyses from one client to another

---

## 8. DATA FLOW IN HOMEPAGE

### File: `/Users/gman/Desktop/mito/src/pages/HomePage.tsx`

**Complete Workflow**:

### Step 1: Upload & Process (State: "processing")
```
Files → processMultiplePdfs() 
    ↓
ProcessedPDF[] → extractBiomarkersFromPdfs()
    ↓
ClaudeResponseBatch → Consolidate patient info + deduplicate biomarkers
```

**Progress Tracking**:
- 5%: Extract text
- 20-30%: Start Claude analysis
- 30-70%: Analyze per-file (detailed progress)
- 70-85%: Combine biomarkers
- 85-90%: Match client
- 90-100%: Finalize

### Step 2: Confirmation (State: "confirmation")
User reviews:
- Patient info (consolidated from all documents)
- Discrepancies found (e.g., multiple names, multiple test dates)
- Match result (existing client found? Confidence level?)
- Option to use existing client or create new

**Client Matching Decision**:
- If high confidence match: Auto-select, but allow override
- If medium confidence: Suggest, require confirmation
- If no match: Suggest create-new
- If no name/DOB: Require manual selection from list

### Step 3: Create/Select Client & Analyses (State: "analyzing")
```
Confirmed PatientInfo
    ↓
Create or use existing Client
    ↓
Group biomarkers by test date
    ↓
For each test date:
  - Run matchBiomarkersWithRanges()
  - Create separate Analysis record
    ↓
If no Supabase: Skip database, show results only
```

**Multiple Test Dates**:
- If multiple test dates found: Create separate Analysis per date
- Each analysis gets its own database record
- Preserves lab_test_date for trend analysis

### Step 4: Display Results (State: "results")
```
AnalysisResult[] → AnalysisResults component
    ↓
Shows:
- Biomarker values vs optimal ranges
- In-range vs out-of-range indicators
- Missing biomarkers
- Patient info summary
- Document count + saved analyses count
```

---

## DATABASE SCHEMA

### Main Tables:

**`clients`**:
- `id`: UUID (primary key)
- `user_id`: UUID (foreign key, nullable)
- `full_name`: Text
- `date_of_birth`: Date (nullable)
- `gender`: Enum (male/female/other, nullable)
- `email`: Text (nullable)
- `status`: Enum (active/past)
- `notes`: Text (nullable)
- `tags`: Text array
- `created_at`: Timestamp
- `updated_at`: Timestamp

**`analyses`**:
- `id`: UUID (primary key)
- `client_id`: UUID (foreign key)
- `user_id`: UUID (foreign key, nullable)
- `lab_test_date`: Date (nullable) - Actual lab test date from report
- `analysis_date`: Timestamp - When analysis was uploaded/created
- `results`: JSONB - Array of AnalysisResult objects
- `summary`: JSONB - Summary stats
- `notes`: Text (nullable)
- `created_at`: Timestamp
- `updated_at`: Timestamp

**`benchmarks`** (system default biomarkers):
- `id`: UUID
- `name`: Text - Primary benchmark name
- `aliases`: Text array - Alternative names
- `male_range`: Text - Optimal range for males
- `female_range`: Text - Optimal range for females (nullable)
- `units`: Text array - Possible units
- `category`: Text - Biomarker category

---

## ERROR HANDLING & RECOVERY

### Retry Strategy (Claude Service):
- Transient errors: Retry with exponential backoff
- Non-retryable errors: Fail immediately
  - Client errors (400-499)
  - Processing timeouts
  - File too large (413)
  - Gateway timeout (504)

### Batch Processing Resilience:
- Individual file failures don't stop entire batch
- Failed files tracked in `_failedFiles` array
- User notified of which files failed
- User can choose to proceed with successful files

### File Quality Warnings:
- Low resolution images flagged
- Blurry images detected via Laplacian variance
- User warned but analysis proceeds anyway
- Quality score saved with results

### Duplicate Prevention:
- Analyses deduplicated by `(client_id, lab_test_date)`
- If same lab_test_date: Update existing instead of duplicate
- Helper function `deleteDuplicateAnalyses()` for cleanup

---

## KEY FEATURES & DESIGN DECISIONS

### 1. **Batch Processing for Performance**
- Groups up to 10 files per Claude API call
- 10x faster than processing files individually
- Reduces API costs and round-trip latency

### 2. **Multilingual Support**
- Claude prompts include 15+ language examples
- Biomarker names normalized to English
- Units and dates converted to standard formats
- Supports CJK, Cyrillic, Arabic scripts

### 3. **Smart Image Fallback**
- Attempts text extraction first (faster)
- Falls back to Vision API if text extraction fails
- Processes ALL PDF pages as images (not just first page)

### 4. **Patient Info Consolidation**
- Merges data from multiple lab reports
- Flags discrepancies for user review
- Confidence scoring for match quality

### 5. **WBC Differential Handling**
- Critical logic to extract absolute counts only
- Automatic unit conversion (cells/µL → ×10³/µL)
- Prevents percentage vs count confusion

### 6. **Progress Tracking**
- Real-time progress callbacks
- Per-file status updates
- Heartbeat logging for long-running operations

### 7. **Authentication Optional**
- Works with or without Supabase auth
- Edge Function can run unauthenticated
- Client-side analysis-only mode (no database)

---

## COMPLETE DATA TYPES

```typescript
// Input
interface File {
  name: string;
  type: string;
  size: number;
}

// After PDF Processing
interface ProcessedPDF {
  fileName: string;
  extractedText: string;
  pageCount: number;
  isImage?: boolean;
  imageData?: string;  // base64
  imagePages?: string[];  // base64
  mimeType?: string;
  qualityScore?: number;
  qualityWarning?: string;
}

// From Claude
interface ExtractedBiomarker {
  name: string;
  value: string;  // "95" or "N/A"
  unit: string;
}

interface PatientInfo {
  name: string | null;
  dateOfBirth: string | null;  // YYYY-MM-DD
  gender: 'male' | 'female' | 'other' | null;
  testDate: string | null;  // YYYY-MM-DD
}

interface ClaudeResponse {
  biomarkers: ExtractedBiomarker[];
  patientInfo: PatientInfo;
  panelName: string;
}

// After Analysis
interface AnalysisResult {
  biomarkerName: string;
  hisValue: string;  // Patient's value
  unit: string;
  optimalRange: string;
  testDate?: string;
}

// Database
interface Client {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  email: string | null;
  status: 'active' | 'past';
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface Analysis {
  id: string;
  client_id: string;
  lab_test_date: string | null;
  analysis_date: string;
  results: AnalysisResult[];
  summary: {
    totalBiomarkers: number;
    measuredBiomarkers: number;
    missingBiomarkers: number;
  };
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

---

## DEPLOYMENT & CONFIGURATION

### Environment Variables:
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Public anon key
- `VITE_AUTH_DISABLED`: Set to "true" to disable authentication
- `CLAUDE_API_KEY`: Claude API key (Supabase secret only)
- `REQUIRE_AUTH`: Set to "true" in Edge Function to require auth

### Edge Function Deployment:
```bash
supabase functions deploy analyze-biomarkers
```

Requires environment variables:
- `CLAUDE_API_KEY`: Stored in Supabase secrets
- `SUPABASE_URL`: Auto-configured
- `SUPABASE_ANON_KEY`: Auto-configured

