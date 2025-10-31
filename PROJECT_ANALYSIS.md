# Mito Clinical Pathology Analysis Portal - In-Depth Project Analysis

## Executive Summary

**Mito** is a sophisticated web-based clinical pathology analysis application that leverages AI to automate the extraction and analysis of biomarker data from laboratory reports. Built as a practitioner tool, it combines Claude AI's document understanding capabilities with a modern React frontend and optional Supabase backend to deliver real-time biomarker analysis against evidence-based optimal ranges.

**Key Value Proposition:**
- Automates tedious manual data entry from lab reports (saves hours per analysis)
- Supports 54 core biomarkers with gender-specific optimal ranges
- Multilingual document processing (any language)
- Client management with historical tracking
- Works offline (Supabase optional)
- Cost-optimized AI usage (~$0.01-0.02 per analysis)

---

## 1. Architecture & Technology Stack

### 1.1 Frontend Architecture

**Framework:** React 19 with TypeScript
- Single-page application (SPA) with client-side routing
- Component-based architecture using React hooks
- All PDF/document processing happens in the browser
- No backend server required (serverless architecture)

**Build System:**
- **Vite** - Lightning-fast build tool with HMR (Hot Module Replacement)
- **TypeScript** - Full type safety across the codebase
- **ESLint** - Code quality and consistency

**UI Framework:**
- **Tailwind CSS v3.4** - Utility-first styling
- **shadcn/ui** - Accessible, customizable component library built on Radix UI
- **Lucide React** - Modern icon system
- **Inter Font** - Clean, professional typography

**Routing:**
- **React Router DOM v7.9.4** - Client-side routing with 4 main routes:
  - `/` - Analysis page (upload and analyze)
  - `/clients` - Client management
  - `/benchmarks` - Custom benchmark editor
  - `/settings` - API key and configuration

### 1.2 Backend & Data Layer

**Database:** Supabase (PostgreSQL) - **OPTIONAL**
- Passwordless architecture (no authentication)
- Tables: `settings`, `clients`, `analyses`, `custom_benchmarks`
- Row Level Security disabled for internal tool use
- Real-time subscriptions not used (simple CRUD operations)

**API Integrations:**
1. **Anthropic Claude API** (Claude 3.5 Haiku)
   - Document understanding and biomarker extraction
   - Direct browser-to-API calls (no proxy server)
   - Cost-optimized: Uses text extraction instead of vision API where possible

2. **Supabase REST API** (optional)
   - Client data persistence
   - Analysis history storage
   - Settings sync across devices

**Local Storage:**
- API keys (fallback when Supabase disabled)
- Custom benchmarks (fallback when Supabase disabled)
- Temporary session data

### 1.3 Document Processing Pipeline

```
PDF/Image Upload
    ↓
File Validation (50MB limit)
    ↓
Text Extraction (PDF.js / Mammoth.js)
    ↓
Claude AI Analysis (Haiku model)
    ↓
JSON Parsing & Validation
    ↓
Biomarker Matching & Deduplication
    ↓
Range Comparison (Gender-specific)
    ↓
Results Display & Export
```

---

## 2. Core Features

### 2.1 Document Analysis Pipeline

**Supported File Types:**
- PDF (`.pdf`) - Primary format
- Microsoft Word (`.docx`) - Using Mammoth.js
- Images (`.png`, `.jpg`, `.jpeg`) - Fallback to Vision API

**Text Extraction:**
- **PDF.js** - Client-side PDF text extraction (fast, free)
- **Mammoth.js** - Word document text extraction
- **Vision API Fallback** - When text extraction fails, converts PDF pages to images

**AI Analysis:**
- Uses Claude 3.5 Haiku (fastest, cheapest model)
- Extracts patient demographics (name, DOB, gender, test date)
- Identifies and extracts all 54 biomarkers with values and units
- Handles multilingual documents (Spanish, Portuguese, French, German, Italian, Chinese, Japanese, Korean, Arabic, Russian, etc.)
- Smart name matching with extensive alias support

**Quality Assurance:**
- Image quality checks (resolution, sharpness, blur detection)
- Text extraction validation (minimum character threshold)
- JSON parsing with multiple fallback strategies
- Duplicate detection and deduplication

### 2.2 Biomarker Analysis System

**Coverage:** 54 Core Biomarkers
1. **Liver Function (5):** ALP, ALT, AST, GGT, Total Bilirubin
2. **Kidney Function (3):** BUN, Creatinine, eGFR
3. **Red Blood Cells (8):** RBC, Hemoglobin, HCT, MCV, MCH, MCHC, RDW, Platelets
4. **White Blood Cells (6):** WBC, Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils
5. **Lipids (4):** Total Cholesterol, HDL, LDL, Triglycerides
6. **Metabolic (3):** Fasting Glucose, HbA1C, Fasting Insulin
7. **Thyroid (5):** TSH, Free T3, Free T4, TPO Antibodies, Thyroglobulin Antibodies
8. **Hormones (1):** SHBG
9. **Electrolytes (4):** Sodium, Potassium, Chloride, Bicarbonate
10. **Minerals (3):** Calcium, Phosphorus, Serum Magnesium
11. **Iron Studies (4):** Serum Iron, Ferritin, TIBC, Transferrin Saturation
12. **Vitamins (3):** Vitamin D, Vitamin B12, Serum Folate
13. **Proteins (3):** Albumin, Globulin, Total Protein
14. **Other (3):** Homocysteine, LDH, C-Reactive Protein

**Range Comparison:**
- Gender-specific optimal ranges (male/female)
- Evidence-based reference values
- Visual status indicators (in-range, out-of-range, missing)
- Unit normalization (handles variations like µmol/L vs umol/L)
- Smart parsing of complex ranges (e.g., "4.2-6.4 mmol/L (162-240 mg/dL)")

**Matching Intelligence:**
- Extensive multilingual alias system (200+ aliases)
- Fuzzy name normalization (removes special characters, case-insensitive)
- Handles word order variations (e.g., "B12 Vitamin" vs "Vitamin B12")
- Deduplication logic (keeps most recent/complete values)

### 2.3 Client Management System

**Client Records:**
- Full name, email, date of birth, gender
- Status: Active or Past
- Notes field for practitioner annotations
- Tags array (future use)
- Automatic timestamps (created_at, updated_at)

**Auto-Detection & Matching:**
- Extracts patient info from lab reports automatically
- Smart matching algorithm using Levenshtein distance
- Name normalization (handles "Last, First" vs "First Last")
- Confidence scoring (high/medium/low)
- Automatic client creation with user confirmation

**Analysis History:**
- Links analyses to specific clients
- Tracks both lab test date (from report) and upload date
- Stores complete biomarker results as JSON
- Summary statistics (measured, missing, in-range counts)
- Notes per analysis

**Deduplication:**
- Prevents duplicate analyses for same test date
- Updates existing analysis instead of creating duplicate
- Automatic duplicate cleanup functions

### 2.4 Benchmark Management

**Default Benchmarks:**
- 54 pre-configured biomarkers
- Separate male/female ranges
- Multiple accepted units per biomarker
- Category grouping

**Custom Benchmarks:**
- Add new biomarkers
- Override default ranges
- Local storage with Supabase sync option
- Import/Export functionality (JSON)
- Reset to defaults

### 2.5 Batch Processing & Multi-Document Analysis

**Batch Upload:**
- Process multiple PDFs simultaneously
- Batch size: 3 concurrent API calls
- 2-second delay between batches (rate limiting)
- Progress tracking with percentage and batch info

**Multi-Date Analysis:**
- Detects multiple test dates in same upload
- Creates separate analyses per date
- Consolidates patient demographics across documents
- Discrepancy detection and warnings

**Data Consolidation:**
- Merges biomarkers from multiple reports
- Keeps most recent values by test date
- Prioritizes non-N/A values over missing data
- Title case normalization for patient names

### 2.6 Export & Sharing

**Markdown Export:**
- Generates formatted markdown tables
- Includes summary statistics
- Color-coded status indicators (emoji)
- Copy to clipboard or download as `.md` file

**Inline Editing:**
- Edit biomarker values directly in results table
- Edit units without re-processing
- Changes persist in saved analyses
- Keyboard shortcuts (Enter to save, Escape to cancel)

---

## 3. Data Models

### 3.1 Core TypeScript Interfaces

#### Biomarker Definition
```typescript
interface Biomarker {
  name: string;                    // Primary name (e.g., "TSH")
  maleRange: string;               // Optimal range for males
  femaleRange: string;             // Optimal range for females
  units: string[];                 // Accepted units (e.g., ["mIU/L", "µIU/mL"])
  category?: string;               // Grouping (e.g., "Thyroid")
  aliases?: string[];              // Alternative names for matching
}
```

#### Extracted Biomarker (from AI)
```typescript
interface ExtractedBiomarker {
  name: string;                    // Biomarker name (as extracted)
  value: string;                   // Numerical value
  unit: string;                    // Unit of measurement
  testDate?: string;               // Lab test date (YYYY-MM-DD)
}
```

#### Analysis Result (final output)
```typescript
interface AnalysisResult {
  biomarkerName: string;           // Matched biomarker name
  hisValue: string;                // Patient's value or "N/A"
  unit: string;                    // Unit of measurement
  optimalRange: string;            // Gender-specific optimal range
  testDate?: string;               // Test date if available
}
```

#### Patient Information
```typescript
interface PatientInfo {
  name: string | null;             // Full name
  dateOfBirth: string | null;      // YYYY-MM-DD
  gender: 'male' | 'female' | 'other' | null;
  testDate: string | null;         // YYYY-MM-DD
}
```

### 3.2 Database Schema (Supabase)

#### Settings Table
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY,                           -- Fixed UUID (singleton)
  claude_api_key TEXT,                           -- Encrypted API key
  updated_at TIMESTAMP WITH TIME ZONE
);
```

#### Clients Table
```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past')),
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

#### Analyses Table
```sql
CREATE TABLE analyses (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  lab_test_date DATE,                            -- Actual test date from report
  analysis_date TIMESTAMP WITH TIME ZONE,        -- When uploaded/analyzed
  results JSONB NOT NULL,                        -- Array of AnalysisResult
  summary JSONB,                                 -- Summary stats
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

#### Custom Benchmarks Table
```sql
CREATE TABLE custom_benchmarks (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  male_range TEXT,
  female_range TEXT,
  units TEXT[],
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### 3.3 Key Relationships

```
Client (1) ─────< Analyses (N)
   ↓
Analysis contains JSONB array of AnalysisResult
   ↓
Each AnalysisResult references a Biomarker definition
```

**Cascade Deletion:** Deleting a client automatically deletes all associated analyses.

---

## 4. Services & Business Logic

### 4.1 PDF Processor Service (`pdf-processor.ts`)

**Responsibilities:**
- File validation (type, size)
- Text extraction from PDFs (PDF.js)
- Text extraction from Word docs (Mammoth.js)
- Image processing and quality checks
- Fallback to Vision API for scanned PDFs

**Key Functions:**
- `processPdfFile(file: File): Promise<ProcessedPDF>`
- `processMultiplePdfs(files: File[]): Promise<ProcessedPDF[]>`
- `validatePdfFile(file: File): { valid: boolean; error?: string }`
- `checkImageQuality()` - Analyzes resolution, sharpness, blur

**Quality Metrics:**
- Minimum resolution: 800x600 pixels
- Variance-based blur detection
- Laplacian edge detection for sharpness
- Quality score: 0-1 with warnings

### 4.2 Claude Service (`claude-service.ts`)

**Responsibilities:**
- AI model integration (Claude 3.5 Haiku)
- Prompt engineering for biomarker extraction
- Patient demographic extraction
- JSON parsing and validation
- Patient info consolidation

**Key Functions:**
- `extractBiomarkersFromPdf()` - Single PDF analysis
- `extractBiomarkersFromPdfs()` - Batch processing with rate limiting
- `consolidatePatientInfo()` - Merge patient data from multiple PDFs
- `validateApiKey()` - Format validation

**Prompt Design:**
- Comprehensive multilingual support instructions
- Explicit alias examples for each biomarker
- JSON schema enforcement
- Edge case handling (percentages vs absolute counts for WBC)
- Thorough extraction requirements (30-40 biomarkers expected)

**Error Handling:**
- Multiple JSON parsing strategies
- Balanced brace extraction
- Markdown code block removal
- Detailed error messages with debugging info
- SessionStorage error logging

### 4.3 Analyzer Service (`analyzer.ts`)

**Responsibilities:**
- Biomarker name matching (with aliases)
- Range comparison logic
- Status determination (in-range/out-of-range)
- Unit normalization
- Summary statistics generation

**Key Functions:**
- `matchBiomarkersWithRanges()` - Core matching algorithm
- `isValueInRange()` - Range checking with unit awareness
- `getValueStatus()` - Status indicator logic
- `generateSummary()` - Statistics calculation

**Matching Algorithm:**
1. Normalize extracted biomarker names (lowercase, remove special chars)
2. Check against primary name + all aliases
3. Match with Levenshtein distance tolerance
4. Select appropriate gender-specific range
5. Return result with status

**Range Parsing:**
- Handles "min-max unit" format
- Handles parenthetical ranges "(162-240 mg/dL)"
- Handles comparison operators (<, >, ≤)
- Unit-aware parsing (matches unit in range string)

### 4.4 Client Service (`client-service.ts`)

**Responsibilities:**
- CRUD operations for clients
- Client status management (active/past)
- Client merging for duplicates

**Key Functions:**
- `getAllClients()`, `getActiveClients()`, `getPastClients()`
- `getClient(id)`, `createClient()`, `updateClient()`, `deleteClient()`
- `archiveClient()`, `reactivateClient()`
- `mergeClients()` - Consolidate duplicates

### 4.5 Client Matcher Service (`client-matcher.ts`)

**Responsibilities:**
- Intelligent client matching
- Duplicate detection
- Confidence scoring
- Name similarity calculation

**Key Functions:**
- `matchOrCreateClient()` - Main matching entry point
- `findBestMatch()` - Scoring algorithm
- `calculateNameSimilarity()` - Levenshtein distance
- `autoCreateClient()` - Title case conversion

**Matching Algorithm:**
1. **Name matching** (weight: 3)
   - Exact match: 3 points
   - High similarity (≥0.7): 2 points
   - Partial match (≥0.5): 1 point

2. **DOB matching** (weight: 3)
   - Exact match: 3 points

3. **Gender matching** (weight: 1)
   - Match: 1 point

**Confidence Levels:**
- **High (≥85%):** Auto-use existing client
- **Medium (≥65%):** Suggest existing, require confirmation
- **Low (<65%):** Suggest new client creation

**Name Normalization:**
- Lowercase conversion
- Remove special characters
- Alphabetical word sorting (handles "First Last" vs "Last First")

### 4.6 Analysis Service (`analysis-service.ts`)

**Responsibilities:**
- CRUD operations for analyses
- Duplicate detection by test date
- Summary generation
- Latest analysis retrieval

**Key Functions:**
- `createAnalysis()` - With duplicate prevention
- `getClientAnalyses()` - Sorted by date (desc)
- `updateAnalysis()`, `deleteAnalysis()`
- `getLatestAnalysis()`, `findAnalysisByDate()`
- `deleteDuplicateAnalyses()` - Cleanup utility

**Duplicate Prevention:**
- Checks for existing analysis with same client + test date
- Updates existing instead of creating duplicate
- Keeps newest when multiple duplicates exist

### 4.7 Benchmark Storage Service (`benchmark-storage.ts`)

**Responsibilities:**
- Custom benchmark management
- Local storage persistence
- Default benchmark loading
- Import/Export functionality

**Key Functions:**
- `getAllBenchmarks()` - Merge defaults + custom
- `getCustomBenchmarks()`, `saveCustomBenchmarks()`
- `addCustomBenchmark()`, `updateCustomBenchmark()`, `deleteCustomBenchmark()`
- `resetToDefaults()`, `exportBenchmarks()`, `importBenchmarks()`

**Override Logic:**
Custom benchmarks with same name override default benchmarks.

---

## 5. User Workflows

### 5.1 Primary Analysis Workflow

```
┌─────────────────────────────────────────────┐
│ 1. Upload Lab Reports                       │
│    - Drag & drop or select files            │
│    - Multiple PDFs supported                │
│    - File validation                        │
└───────────────┬─────────────────────────────┘
                ↓
┌─────────────────────────────────────────────┐
│ 2. Automatic Processing                     │
│    - Text extraction from PDFs              │
│    - Claude AI biomarker extraction         │
│    - Patient info extraction                │
│    - Quality validation                     │
└───────────────┬─────────────────────────────┘
                ↓
┌─────────────────────────────────────────────┐
│ 3. Client Confirmation Dialog               │
│    - Review extracted patient info          │
│    - Edit name/DOB/gender if needed         │
│    - Match with existing client OR          │
│    - Create new client                      │
│    - Review discrepancies (if any)          │
└───────────────┬─────────────────────────────┘
                ↓
┌─────────────────────────────────────────────┐
│ 4. Analysis Generation                      │
│    - Match biomarkers to benchmarks         │
│    - Apply gender-specific ranges           │
│    - Group by test date (if multiple)       │
│    - Calculate status indicators            │
│    - Save to database (if Supabase enabled) │
└───────────────┬─────────────────────────────┘
                ↓
┌─────────────────────────────────────────────┐
│ 5. Results Display                          │
│    - Interactive table with all biomarkers  │
│    - Visual status badges                   │
│    - Inline editing capability              │
│    - Summary statistics                     │
│    - Export options (copy/download)         │
└─────────────────────────────────────────────┘
```

### 5.2 Client Management Workflow

```
Clients Page
    ↓
┌────────────┬───────────────┐
│  Active    │     Past      │
│  Clients   │    Clients    │
└────┬───────┴───────────────┘
     ↓
Click Client
     ↓
┌─────────────────────────────────┐
│ Client Details                  │
│ - Name, DOB, Gender             │
│ - Contact info                  │
│ - Notes                         │
│                                 │
│ Analysis History                │
│ - List of all past analyses     │
│ - Sorted by date (newest first) │
│ - View/Delete each analysis     │
└─────────────────────────────────┘
```

### 5.3 Benchmark Customization Workflow

```
Benchmarks Page
    ↓
┌─────────────────────────────────┐
│ Default Benchmarks (54)         │
│ - View all biomarkers           │
│ - Edit ranges inline            │
│ - Separate male/female ranges   │
└────┬────────────────────────────┘
     ↓
Edit or Add Custom
     ↓
┌─────────────────────────────────┐
│ Custom Benchmark Editor         │
│ - Name                          │
│ - Male range                    │
│ - Female range                  │
│ - Units (comma-separated)       │
│ - Category                      │
└────┬────────────────────────────┘
     ↓
Save → Stored in localStorage
       (or Supabase if enabled)
```

---

## 6. Key Design Decisions

### 6.1 Architecture Decisions

**1. Client-Side Processing**
- **Decision:** Process PDFs entirely in browser
- **Rationale:** Privacy (no server uploads), speed, reduced costs
- **Trade-off:** Requires modern browser, limited by browser capabilities

**2. Optional Backend**
- **Decision:** Make Supabase completely optional
- **Rationale:** Works for single-user scenarios, easier setup, portable
- **Trade-off:** No data sync without Supabase

**3. Passwordless Architecture**
- **Decision:** No authentication required
- **Rationale:** Internal practitioner tool, simplicity
- **Trade-off:** Not suitable for production with real PHI without additional security

**4. Direct API Calls**
- **Decision:** Browser calls Claude API directly (no proxy)
- **Rationale:** Simplicity, no backend maintenance
- **Trade-off:** API key exposed in browser (acceptable for internal use)

### 6.2 Data Model Decisions

**1. Gender-Specific Ranges**
- **Decision:** Separate male/female optimal ranges
- **Rationale:** Biological differences in biomarker levels
- **Trade-off:** More complex data model, requires gender input

**2. JSON Storage for Results**
- **Decision:** Store analysis results as JSONB in database
- **Rationale:** Flexible schema, easy to query, handles evolving biomarker list
- **Trade-off:** Less structured than normalized tables

**3. Two Date Fields**
- **Decision:** Track both `lab_test_date` (from report) and `analysis_date` (upload)
- **Rationale:** Distinguish when test was taken vs when it was uploaded
- **Trade-off:** More complex date handling

**4. Extensive Alias System**
- **Decision:** 200+ aliases for 54 biomarkers
- **Rationale:** Handles variations across labs and languages
- **Trade-off:** Large data structure, maintenance overhead

### 6.3 UX Decisions

**1. Confirmation Dialog**
- **Decision:** Always show patient info confirmation before saving
- **Rationale:** Allows user to review/edit AI extractions, prevent errors
- **Trade-off:** Extra step in workflow

**2. Inline Editing**
- **Decision:** Allow editing results after analysis
- **Rationale:** AI may miss values or user wants to add manual data
- **Trade-off:** Complexity in state management

**3. Visual Status Indicators**
- **Decision:** Color-coded badges for in-range/out-of-range
- **Rationale:** Quick visual scanning, immediate insights
- **Trade-off:** May oversimplify complex clinical situations

**4. Batch Processing UI**
- **Decision:** Show progress with percentage and batch info
- **Rationale:** User feedback during long operations
- **Trade-off:** More complex state management

### 6.4 Cost Optimization

**1. Text Extraction First**
- **Decision:** Try text extraction before using Vision API
- **Rationale:** Vision API is 10x more expensive
- **Trade-off:** Scanned PDFs need fallback processing

**2. Haiku Model**
- **Decision:** Use Claude 3.5 Haiku (not Sonnet or Opus)
- **Rationale:** Fast enough, 90% cheaper than Sonnet
- **Trade-off:** May have slightly lower accuracy

**3. Batch Rate Limiting**
- **Decision:** 3 concurrent + 2s delay between batches
- **Rationale:** Avoid rate limits, maintain responsiveness
- **Trade-off:** Slower for large batches (10+ PDFs)

---

## 7. Error Handling & Edge Cases

### 7.1 Document Processing Errors

**Empty PDFs:**
- Checks character count after extraction
- Falls back to Vision API if < 50 chars per page
- Clear error message if both fail

**Corrupted Files:**
- Catches PDF.js parsing errors
- Shows specific error message with file name
- Allows user to skip and continue with other files

**Low Quality Images:**
- Resolution check (800x600 minimum)
- Blur detection using Laplacian variance
- Warning shown but processing continues

**Scanned PDFs:**
- Automatically detects lack of text
- Converts first page to image
- Uses Vision API for OCR

### 7.2 AI Extraction Errors

**Invalid JSON:**
- Multiple parsing strategies
- Balanced brace extraction
- Markdown code block removal
- Saves raw response to sessionStorage for debugging

**Zero Biomarkers:**
- Shows clear error: "No biomarkers found"
- Suggests checking file contents

**Missing Patient Info:**
- Defaults to null values
- Shows confirmation dialog for manual entry
- Allows creating "anonymous" analysis

### 7.3 Matching & Deduplication

**Name Variations:**
- Levenshtein distance algorithm
- Word order normalization
- Special character removal
- Handles "SMITH, JOHN" vs "John Smith"

**Multiple Test Dates:**
- Detects dates across multiple PDFs
- Creates separate analyses per date
- Shows summary of multiple analyses created

**Duplicate Biomarkers:**
- Keeps most recent by test date
- Prioritizes non-N/A values
- Warns about discrepancies

### 7.4 Database Errors

**Supabase Connection Failures:**
- Graceful fallback to localStorage
- Shows warning but continues operation
- Retries on transient failures

**Duplicate Analysis Prevention:**
- Checks for existing analysis with same client + date
- Updates instead of creating duplicate
- User notified of update

---

## 8. Performance Considerations

### 8.1 Frontend Performance

**Bundle Size:**
- PDF.js worker loaded separately (lazy)
- Shadcn components tree-shaken
- Code splitting by route

**Rendering:**
- React 19 with automatic batching
- Virtual scrolling not needed (54 rows manageable)
- Minimal re-renders with careful state management

**PDF Processing:**
- Processes in batches to avoid memory issues
- Web Worker for PDF.js (offloads to separate thread)
- Limits fallback image conversion to first 5 pages

### 8.2 API Performance

**Claude API:**
- Batch size: 3 concurrent requests
- 2-second delay between batches
- Text extraction preferred over Vision API
- Estimated 5-15 seconds per analysis

**Supabase:**
- Indexed queries (client_id, analysis_date)
- JSONB queries supported but not heavily used
- No real-time subscriptions (reduces overhead)

### 8.3 Optimization Opportunities

**Future Improvements:**
1. Implement virtual scrolling for large biomarker lists
2. Add service worker for offline functionality
3. Implement result caching to avoid re-processing same PDFs
4. Compress stored analysis JSON
5. Lazy load analysis history in client view

---

## 9. Security & Privacy

### 9.1 Data Protection

**Local Processing:**
- PDFs never leave the browser (except Claude API call)
- No server-side storage of documents
- API keys stored encrypted in Supabase or localStorage

**API Key Handling:**
- Validated before use
- Never logged or exposed in error messages
- Can be synced via Supabase (encrypted)

**Database Security:**
- Row Level Security disabled (internal tool assumption)
- Should be enabled for production with multiple users
- No password authentication (internal use)

### 9.2 HIPAA Considerations

**Current State:** NOT HIPAA compliant
- No encryption at rest for localStorage
- No audit logging
- No user authentication
- API calls expose data to third party (Anthropic)

**For Production PHI:**
1. Enable authentication (Supabase Auth)
2. Enable Row Level Security
3. Add audit logging
4. Use Business Associate Agreement with Anthropic
5. Encrypt localStorage data
6. Implement session timeouts
7. Add data retention policies

---

## 10. Testing & Quality Assurance

### 10.1 Current Testing

**Manual Testing:**
- Extensive console logging for debugging
- Visual indicators for extraction results
- Test PDF processing pipeline
- UI component testing

**Error Handling:**
- Try-catch blocks throughout
- Detailed error messages
- SessionStorage debugging info

### 10.2 Missing Testing Infrastructure

**No Unit Tests:**
- Services not covered (analyzer, claude-service, etc.)
- No Jest/Vitest configuration

**No Integration Tests:**
- No end-to-end testing
- No Supabase integration tests

**No Type Testing:**
- Could benefit from stricter TypeScript config
- Missing some return type annotations

**Future Testing Needs:**
1. Unit tests for biomarker matching logic
2. Integration tests for client matcher
3. E2E tests for full analysis workflow
4. PDF extraction test fixtures
5. Claude API mocking for tests

---

## 11. Deployment & DevOps

### 11.1 Current Deployment

**Build Process:**
```bash
npm run build  # TypeScript compilation + Vite build
npm run preview # Local preview of production build
```

**Output:**
- Static files in `dist/`
- Can be deployed to any static hosting (Vercel, Netlify, etc.)

**Environment Variables:**
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

### 11.2 Vercel Configuration

**File:** `vercel.json`
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```
- Enables client-side routing
- All routes served by index.html

### 11.3 Production Considerations

**Pre-Deployment Checklist:**
1. ✅ Set Supabase environment variables
2. ✅ Run production build and test locally
3. ⚠️ Review API key security implications
4. ⚠️ Consider rate limiting for Claude API
5. ⚠️ Add error tracking (Sentry, LogRocket)
6. ⚠️ Set up monitoring/analytics
7. ⚠️ Review HIPAA requirements if handling real PHI

---

## 12. Future Enhancements

### 12.1 Short-Term Improvements

**UI/UX:**
- Add biomarker trends visualization (charts over time)
- Implement PDF preview in UI
- Add bulk client operations (batch archive, export)
- Improve mobile responsiveness

**Features:**
- Add support for more biomarkers (currently 54)
- Implement biomarker notes/annotations
- Add report templates for printing
- Client photo upload

**Performance:**
- Implement caching for processed PDFs
- Add loading skeletons instead of spinners
- Optimize large table rendering

### 12.2 Medium-Term Enhancements

**Collaboration:**
- Multi-user support with authentication
- Role-based access control
- Shared client access between practitioners
- Comment system on analyses

**Analytics:**
- Dashboard with aggregate statistics
- Biomarker distribution charts
- Trend analysis across client base
- Outlier detection

**Integration:**
- Export to electronic health records (EHR)
- Direct lab integration (HL7/FHIR)
- Calendar integration for test reminders
- Email notifications

### 12.3 Long-Term Vision

**AI Improvements:**
- Fine-tune custom model for better extraction
- Add clinical interpretation (recommendations)
- Predict future biomarker trends
- Automated report generation

**Platform:**
- Mobile app (React Native)
- Offline-first architecture with sync
- White-label version for other practitioners
- API for third-party integrations

---

## 13. Documentation & Maintenance

### 13.1 Existing Documentation

**README.md:**
- Comprehensive setup instructions
- Feature overview
- Tech stack details
- Usage guide

**Code Documentation:**
- TypeScript interfaces well-documented
- Service functions have JSDoc comments
- Complex algorithms explained

**SQL Schema:**
- Well-commented database setup script
- Migration scripts for updates

### 13.2 Documentation Gaps

**Missing:**
1. API documentation (if exposing endpoints)
2. Component library documentation (Storybook)
3. Contribution guidelines
4. Changelog
5. Architecture decision records (ADRs)

### 13.3 Maintenance Considerations

**Dependency Updates:**
- Regular updates needed for security patches
- PDF.js updates for compatibility
- React/TypeScript major version migrations

**Database Migrations:**
- Currently manual SQL scripts
- Need migration tool (like Prisma) for production

**Biomarker Range Updates:**
- Need process to update optimal ranges as research evolves
- Consider version tracking for benchmark changes

---

## 14. Conclusion

### 14.1 Strengths

1. **Intelligent AI Integration** - Sophisticated prompt engineering with multilingual support
2. **Flexible Architecture** - Works with or without database backend
3. **Privacy-Focused** - Client-side processing, no server uploads
4. **Cost-Optimized** - Smart use of cheaper AI models and text extraction
5. **Comprehensive Coverage** - 54 biomarkers with extensive alias system
6. **User-Friendly** - Clean UI, inline editing, confirmation dialogs
7. **Well-Structured Code** - Clear separation of concerns, TypeScript types

### 14.2 Weaknesses

1. **No Authentication** - Security concerns for production use
2. **Limited Testing** - No unit/integration test coverage
3. **Manual Benchmark Updates** - No automated process for range updates
4. **Single Language UI** - Interface only in English (documents can be any language)
5. **No Audit Trail** - Can't track who made changes when (multi-user)
6. **Browser Limitations** - Large PDFs may cause memory issues
7. **API Key Exposure** - Stored in browser (acceptable for internal use only)

### 14.3 Ideal Use Cases

**Perfect For:**
- Solo practitioners analyzing patient lab reports
- Internal clinic tool with controlled access
- Research projects requiring biomarker extraction
- Educational/demonstration purposes

**Not Suitable For:**
- Multi-tenant SaaS without major security additions
- Uncontrolled public access
- Production healthcare without HIPAA compliance
- High-volume processing (rate limits)

### 14.4 Final Assessment

Mito is a **well-architected, feature-rich application** that successfully combines modern web technologies with AI capabilities to solve a real problem: automating tedious biomarker data entry. The codebase demonstrates strong engineering practices with TypeScript, clear service boundaries, and thoughtful error handling.

**Technical Grade: A-**
- Clean architecture ✅
- Modern tech stack ✅
- Good documentation ✅
- Strong AI integration ✅
- Missing tests ⚠️
- Security considerations ⚠️

**For production deployment with real patient data, additional work is needed around security, authentication, testing, and compliance. However, as an internal practitioner tool or MVP, it's production-ready.**

---

## Appendix A: File Structure Reference

```
mito/
├── src/
│   ├── components/
│   │   ├── ui/                          # shadcn/ui components
│   │   │   ├── alert.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   └── tooltip.tsx
│   │   ├── AnalysisResults.tsx          # Results table with editing
│   │   ├── ApiKeyInput.tsx              # API key management
│   │   ├── BenchmarkManager.tsx         # Custom benchmark editor
│   │   ├── BiomarkerTrends.tsx          # Trend visualization
│   │   ├── ClientConfirmation.tsx       # Patient info confirmation dialog
│   │   ├── ClientLibrary.tsx            # Client list and management
│   │   ├── ClientSelector.tsx           # Client dropdown picker
│   │   ├── LoadingState.tsx             # Progress indicator
│   │   ├── PdfUploader.tsx              # File upload component
│   │   └── Settings.tsx                 # Settings management
│   ├── lib/
│   │   ├── analysis-service.ts          # Analysis CRUD operations
│   │   ├── analyzer.ts                  # Biomarker matching logic
│   │   ├── benchmark-storage.ts         # Custom benchmark management
│   │   ├── biomarkers.ts                # 54 biomarker definitions + aliases
│   │   ├── claude-service.ts            # Claude AI integration
│   │   ├── client-matcher.ts            # Intelligent client matching
│   │   ├── client-service.ts            # Client CRUD operations
│   │   ├── pdf-processor.ts             # PDF/image text extraction
│   │   ├── supabase.ts                  # Supabase client + types
│   │   └── utils.ts                     # Utility functions
│   ├── pages/
│   │   ├── BenchmarksPage.tsx           # /benchmarks route
│   │   ├── ClientsPage.tsx              # /clients route
│   │   ├── HomePage.tsx                 # / route (main analysis)
│   │   └── SettingsPage.tsx             # /settings route
│   ├── App.tsx                          # Main app with routing
│   ├── main.tsx                         # React entry point
│   └── index.css                        # Global styles
├── sql/
│   ├── supabase-setup.sql               # Initial database schema
│   ├── supabase-migration-*.sql         # Various migrations
│   ├── supabase-seed-benchmarks.sql     # Seed data
│   └── update-melissa-gender.sql        # Data fix script
├── docs/
│   ├── IMPLEMENTATION_SUMMARY.md
│   ├── SUPABASE_SETUP.md
│   ├── QUICKSTART.md
│   └── [various other docs]
├── dist/                                # Production build output
├── public/                              # Static assets
├── package.json                         # Dependencies
├── tsconfig.json                        # TypeScript config
├── vite.config.ts                       # Vite config
├── tailwind.config.js                   # Tailwind config
├── components.json                      # shadcn/ui config
└── vercel.json                          # Vercel deployment config
```

---

## Appendix B: Key Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 19.1.1 | UI framework |
| `react-dom` | 19.1.1 | React DOM renderer |
| `react-router-dom` | 7.9.4 | Client-side routing |
| `@anthropic-ai/sdk` | 0.65.0 | Claude AI integration |
| `@supabase/supabase-js` | 2.75.0 | Database client |
| `pdfjs-dist` | 5.4.296 | PDF text extraction |
| `mammoth` | 1.11.0 | Word document extraction |
| `react-dropzone` | 14.3.8 | File upload UI |
| `lucide-react` | 0.545.0 | Icon library |
| `tailwindcss` | 3.4.0 | Styling framework |
| `@radix-ui/*` | Various | Accessible UI primitives |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `vite` | Build tool |
| `typescript` | Type system |
| `eslint` | Code linting |
| `@vitejs/plugin-react` | Vite React support |
| `autoprefixer` | CSS prefixing |
| `postcss` | CSS processing |

---

## Appendix C: Environment Variables

### Required for Supabase Features

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Optional

```bash
# None currently - API key stored in database/localStorage
```

---

## Appendix D: Database ERD

```
┌─────────────────┐
│    settings     │
├─────────────────┤
│ id (UUID) PK    │
│ claude_api_key  │
│ updated_at      │
└─────────────────┘

┌──────────────────────┐
│  custom_benchmarks   │
├──────────────────────┤
│ id (UUID) PK         │
│ name                 │
│ male_range           │
│ female_range         │
│ units (TEXT[])       │
│ category             │
│ is_active            │
│ created_at           │
│ updated_at           │
└──────────────────────┘

┌──────────────────────┐         ┌─────────────────────┐
│      clients         │         │      analyses       │
├──────────────────────┤         ├─────────────────────┤
│ id (UUID) PK         │ ◄───┐   │ id (UUID) PK        │
│ full_name            │     └───┤ client_id (FK)      │
│ email                │         │ lab_test_date       │
│ date_of_birth        │         │ analysis_date       │
│ gender               │         │ results (JSONB)     │
│ status               │         │ summary (JSONB)     │
│ notes                │         │ notes               │
│ tags (TEXT[])        │         │ created_at          │
│ created_at           │         │ updated_at          │
│ updated_at           │         └─────────────────────┘
└──────────────────────┘

Relationship: One Client has Many Analyses
Cascade: Deleting client deletes all analyses
```

---

*Document generated: 2025-01-22*
*Project Version: 0.0.0*
*Mito Clinical Pathology Analysis Portal*


