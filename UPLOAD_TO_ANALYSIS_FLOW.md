# Upload Bloodwork → Analysis Flow - Complete Technical Breakdown

## Overview
This document outlines the complete end-to-end flow from uploading bloodwork PDFs through patient data extraction, client matching, confirmation, and displaying the final biomarker analysis results.

---

## Flow Architecture

```
1. PDF Upload (PdfUploader)
    ↓
2. Text Extraction (pdf-processor)
    ↓
3. AI Analysis (Claude API)
    ↓
4. Patient Info Consolidation
    ↓
5. Client Matching (client-matcher)
    ↓
6. Confirmation Dialog (ClientConfirmation) ← PRE-POPULATED DATA REVIEW
    ↓
7. Save Client & Analysis
    ↓
8. Display Results (AnalysisResults)
```

---

## Step 1: PDF Upload

### Component: PdfUploader
**File**: `src/components/PdfUploader.tsx`

### Features
- Drag & drop interface
- Multiple file support
- Accepts: PDF, DOCX, PNG, JPG
- File validation (size, type)
- Visual file list with remove option

### User Actions
1. User drags/drops files or clicks to select
2. Files are validated
3. Files appear in list
4. User clicks "Analyze Reports" button

### Code Flow
```typescript
const onDrop = useCallback((acceptedFiles: File[]) => {
  const validation = validatePdfFiles(acceptedFiles);
  if (!validation.valid) {
    setErrors(validation.errors);
    return;
  }
  const newFiles = [...files, ...acceptedFiles];
  setFiles(newFiles);
  onFilesSelected(newFiles); // Passes to parent
}, [files, onFilesSelected]);
```

### State Updates
- Sets `files` array in parent (HomePage)
- Triggers `handleAnalyze()` on button click

---

## Step 2: Text Extraction

### Trigger: handleAnalyze()
**File**: `src/pages/HomePage.tsx` (lines 49-252)

### State Changes
```typescript
setState('processing');
setProcessingMessage('Extracting text from X PDF(s)...');
setProcessingProgress(5);
```

### Process Multiple PDFs
```typescript
const processedPdfs = await processMultiplePdfs(files);
```

**File**: `src/lib/pdf-processor.ts`

**What Happens**:
1. Reads PDF files
2. Extracts text content page-by-page
3. Calculates quality score
4. Filters out low-quality PDFs (< 0.5 score)
5. Returns `ProcessedPDF[]` with extracted text

**ProcessedPDF Structure**:
```typescript
interface ProcessedPDF {
  fileName: string;
  extractedText: string;
  pageCount: number;
  qualityScore: number;
  qualityWarning?: string;
  isImage: boolean;
  imageData?: string;
  mimeType?: string;
}
```

### Progress Updates
- 5% → Extracting text
- 20% → Text extraction complete

---

## Step 3: AI Analysis (Claude API)

### Progress Update
```typescript
setProcessingMessage('Analyzing X document(s) with Claude AI...');
setProcessingProgress(30);
```

### Extract Biomarkers from PDFs
```typescript
const claudeResponses: ClaudeResponseBatch = await extractBiomarkersFromPdfs(
  currentApiKey, 
  validPdfs,
  (current, total, batchInfo) => {
    const progress = 30 + Math.round((current / total) * 40);
    setProcessingProgress(progress);
    setProcessingMessage(`Analyzing document ${current + 1} of ${total}...`);
  }
);
```

**File**: `src/lib/claude-service.ts`

### Claude API Call Flow

#### For Each PDF:
1. **Create Extraction Prompt** (`createExtractionPrompt()`)
   - Multilingual instructions
   - Lists all 54 biomarkers to extract
   - Explains WBC differential rules (absolute counts only)
   - Requests structured JSON output

2. **Send to Claude**
   ```typescript
   const message = await client.messages.create({
     model: 'claude-haiku-4-5-20251001',
     max_tokens: 4096,
     messages: [
       {
         role: 'user',
         content: prompt + pdfText
       }
     ]
   });
   ```

3. **Parse Response**
   ```typescript
   const { biomarkers, patientInfo, panelName } = parseClaudeResponse(text);
   ```

### Claude Response Structure
```typescript
interface ClaudeResponse {
  biomarkers: ExtractedBiomarker[];  // Extracted biomarker values
  patientInfo: PatientInfo;         // Patient demographics
  panelName: string;                 // AI-generated panel name
  raw?: string;                      // Raw Claude response
}

interface ExtractedBiomarker {
  name: string;     // e.g., "Vitamin D"
  value: string;   // e.g., "150"
  unit: string;     // e.g., "nmol/L"
}

interface PatientInfo {
  name: string | null;           // Patient full name
  dateOfBirth: string | null;    // YYYY-MM-DD format
  gender: 'male' | 'female' | 'other' | null;
  testDate: string | null;       // YYYY-MM-DD format
}
```

### Progress Updates
- 30-70% → Analyzing documents (batch processing)
- Shows: "Analyzing document X of Y"

### Batch Processing
- Processes 3 PDFs at a time
- 2-second delay between batches
- Parallel processing with `Promise.allSettled`
- Handles partial failures gracefully

---

## Step 4: Patient Info Consolidation

### Progress Update
```typescript
setProcessingMessage('Consolidating patient information...');
setProcessingProgress(70);
```

### Consolidate Patient Info
```typescript
const allPatientInfos = claudeResponses.map(r => r.patientInfo);

const { consolidated, discrepancies, confidence } = consolidatePatientInfo(allPatientInfos);
```

**File**: `src/lib/claude-service.ts` (lines 679-798)

### Consolidation Algorithm

#### Name Consolidation
```typescript
// Count occurrences of each name (normalized)
const nameCounts = new Map<string, number>();
names.forEach(name => {
  const normalized = name.toLowerCase().trim();
  nameCounts.set(normalized, (nameCounts.get(normalized) || 0) + 1);
});

// Find most common name
let mostCommonName = names[0];
let maxCount = 0;
nameCounts.forEach((count, name) => {
  if (count > maxCount) {
    maxCount = count;
    mostCommonName = names.find(n => n.toLowerCase().trim() === name);
  }
});

// Convert to Title Case
consolidatedName = toTitleCase(mostCommonName);
```

**Logic**:
- Normalizes all names to lowercase
- Counts occurrences
- Picks most common name
- Converts to Title Case (e.g., "john smith" → "John Smith")
- Flags discrepancies if multiple unique names found

#### DOB Consolidation
```typescript
// Count occurrences
const dobCounts = new Map<string, number>();
dobs.forEach(dob => {
  dobCounts.set(dob, (dobCounts.get(dob) || 0) + 1);
});

// Pick most common DOB
consolidatedDob = dobs.reduce((mostCommon, current) => {
  return (dobCounts.get(current) || 0) > (dobCounts.get(mostCommon) || 0) 
    ? current 
    : mostCommon;
});
```

**Logic**:
- Picks most frequent DOB
- Flags discrepancies if multiple dates found

#### Gender Consolidation
```typescript
// Count occurrences
const genderCounts = new Map<string, number>();
genders.forEach(gender => {
  genderCounts.set(gender, (genderCounts.get(gender) || 0) + 1);
});

// Pick most common gender
consolidatedGender = genders.reduce((mostCommon, current) => {
  return (genderCounts.get(current) || 0) > (genderCounts.get(mostCommon) || 0)
    ? current
    : mostCommon;
});
```

#### Test Date Consolidation
```typescript
// Pick most recent date
consolidatedTestDate = testDates.reduce((latest, current) => {
  return new Date(current) > new Date(latest) ? current : latest;
});
```

**Logic**:
- Compares dates
- Returns most recent
- Flags multiple dates

### Confidence Scoring
```typescript
let confidence: 'high' | 'medium' | 'low' = 'high';
if (discrepancies.length > 2) {
  confidence = 'low';
} else if (discrepancies.length > 0) {
  confidence = 'medium';
}
```

### Discrepancy Examples
- `"Name: Found 2 variations → Using \"John Smith\""`
- `"Date of Birth: Found 2 different dates → Using 1990-01-15"`
- `"Test Dates: Found 3 different dates (multiple lab visits)"`

### Progress Updates
- 70% → Consolidating patient info
- 75-85% → Processing individual analyses

---

## Step 5: Client Matching

### Progress Update
```typescript
setProcessingMessage('Matching client...');
setProcessingProgress(90);
```

### Match or Create Client
```typescript
if (isSupabaseEnabled && consolidatedPatientInfo.name) {
  const matchResult = await matchOrCreateClient(consolidatedPatientInfo);
  setMatchResult(matchResult);
}
```

**File**: `src/lib/client-matcher.ts`

### Matching Algorithm

#### Step 1: Get All Clients
```typescript
const allClients = await getAllClients();
```

#### Step 2: Find Best Match
```typescript
function findBestMatch(clients: Client[], patientInfo: PatientInfo): ClientMatchResult | null {
  for (const client of clients) {
    let matchScore = 0;
    let maxScore = 0;
    
    // Name matching (weight: 3)
    if (name) {
      maxScore += 3;
      const similarity = calculateNameSimilarity(name, client.full_name);
      if (similarity >= 0.9) matchScore += 3;      // Exact match
      else if (similarity >= 0.7) matchScore += 2; // Good match
      else if (similarity >= 0.5) matchScore += 1;  // Partial match
    }
    
    // DOB matching (weight: 3)
    if (dateOfBirth && client.date_of_birth) {
      maxScore += 3;
      if (dateOfBirth === client.date_of_birth) matchScore += 3;
    }
    
    // Gender matching (weight: 1)
    if (gender && client.gender) {
      maxScore += 1;
      if (gender === client.gender) matchScore += 1;
    }
    
    const confidence = maxScore > 0 ? matchScore / maxScore : 0;
    
    // High confidence: 85%+ → Auto-accept
    if (confidence >= 0.85) {
      return { matched: true, client, confidence: 'high', needsConfirmation: false };
    }
    
    // Medium confidence: 65%+ → Require confirmation
    if (confidence >= 0.65) {
      return { matched: true, client, confidence: 'medium', needsConfirmation: true };
    }
  }
  
  return null; // No match found
}
```

### Name Similarity Calculation

#### Normalize Names
```typescript
function normalizeName(name: string): string {
  let normalized = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')  // Remove special chars
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim();
  
  // Sort words alphabetically
  const words = normalized.split(' ');
  return words.sort().join(' ');
}
```

**Examples**:
- "John Smith" → "john smith"
- "Smith, John" → "john smith"
- "Adam Winchester" → "adam winchester"
- "Winchester Adam" → "adam winchester" (same after sorting)

#### Levenshtein Distance
```typescript
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];
  
  // Initialize matrix
  for (let i = 0; i <= len1; i++) matrix[i] = [i];
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}
```

#### Similarity Score
```typescript
const similarity = calculateNameSimilarity(name1, name2);
function calculateNameSimilarity(name1: string, name2: string): number {
  const s1 = normalizeName(name1);
  const s2 = normalizeName(name2);
  
  if (s1 === s2) return 1.0;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  return 1 - distance / maxLength;
}
```

**Examples**:
- "John Smith" vs "John Smith" → 1.0 (exact)
- "John Smith" vs "Jon Smith" → ~0.9 (high)
- "John Smith" vs "John Smyth" → ~0.86 (high)
- "John Smith" vs "Jane Smith" → ~0.6 (medium)

### Match Result Structure
```typescript
interface ClientMatchResult {
  matched: boolean;        // Found existing client?
  client: Client | null;   // Matched client (if found)
  confidence: 'high' | 'medium' | 'low';
  needsConfirmation: boolean;
  suggestedAction: 'use-existing' | 'create-new' | 'manual-select';
}
```

### Possible Outcomes

#### 1. High Confidence Match (≥85%)
```typescript
{
  matched: true,
  client: { id: '...', full_name: 'John Smith', ... },
  confidence: 'high',
  needsConfirmation: false,  // Auto-accept!
  suggestedAction: 'use-existing'
}
```

#### 2. Medium Confidence Match (65-84%)
```typescript
{
  matched: true,
  client: { id: '...', full_name: 'Jon Smith', ... },
  confidence: 'medium',
  needsConfirmation: true,  // Require confirmation
  suggestedAction: 'use-existing'
}
```

#### 3. No Match Found
```typescript
{
  matched: false,
  client: null,
  confidence: 'high',
  needsConfirmation: true,
  suggestedAction: 'create-new'
}
```

### Progress Updates
- 90% → Matching client
- 100% → Transition to confirmation state

---

## Step 6: Confirmation Dialog (PRE-POPULATED DATA)

### State Transition
```typescript
setState('confirmation');
setConsolidatedPatientInfo(consolidatedPatientInfo);
setMatchResult(matchResult);
setExtractedBiomarkers(deduplicatedBiomarkers);
setExtractedAnalyses(allAnalyses);
```

### Component: ClientConfirmation
**File**: `src/components/ClientConfirmation.tsx`

### Props
```typescript
interface ClientConfirmationProps {
  patientInfo: PatientInfo;           // Pre-populated from extraction
  matchResult: ClientMatchResult;     // Match results
  onConfirm: (confirmedInfo: PatientInfo, useExistingClient: boolean) => void;
  onCancel: () => void;
}
```

### UI Structure

#### 1. Match Status Section
```typescript
{renderMatchInfo()}
```

**If Match Found**:
```typescript
<Alert className={matchResult.confidence === 'high' ? 'border-green-500 bg-green-50' : ''}>
  <Users className="h-4 w-4" />
  <AlertDescription>
    <div className="flex items-center justify-between mb-2">
      <strong>Existing Client Match Found</strong>
      {confidenceBadge} {/* High/Medium/Low badge */}
    </div>
    <div className="text-sm space-y-1">
      <p><strong>Name:</strong> {client.full_name}</p>
      <p><strong>DOB:</strong> {client.date_of_birth}</p>
      <p><strong>Gender:</strong> {client.gender}</p>
      <p><strong>Email:</strong> {client.email}</p>
    </div>
  </AlertDescription>
</Alert>

<div className="flex items-center gap-4">
  <Label>Add results to this client?</Label>
  <div className="flex gap-2">
    <Button variant={useExisting ? 'default' : 'outline'} onClick={() => setUseExisting(true)}>
      Yes, Use Existing
    </Button>
    <Button variant={!useExisting ? 'default' : 'outline'} onClick={() => setUseExisting(false)}>
      No, Create New
    </Button>
  </div>
</div>
```

**If No Match**:
```typescript
<Alert>
  <UserCircle className="h-4 w-4" />
  <AlertDescription>
    <strong>New Client Detected</strong>
    <p className="text-sm mt-1">
      No existing client found. A new client record will be created.
    </p>
  </AlertDescription>
</Alert>
```

#### 2. Editable Patient Information Section

**KEY FEATURE: Pre-populated with extracted data**
```typescript
const [editedInfo, setEditedInfo] = useState<PatientInfo>(patientInfo);

<div className="space-y-4 p-4 border rounded-lg bg-muted/30">
  <h3 className="font-medium text-sm text-muted-foreground">
    Extracted Information (Editable)
  </h3>

  {/* Name */}
  <div className="space-y-2">
    <Label htmlFor="patient-name">Full Name *</Label>
    <Input
      id="patient-name"
      value={editedInfo.name || ''}  // ← PRE-POPULATED
      onChange={(e) => setEditedInfo({ ...editedInfo, name: e.target.value })}
      placeholder="Patient Name"
    />
  </div>

  {/* Date of Birth */}
  <div className="space-y-2">
    <Label htmlFor="patient-dob">Date of Birth</Label>
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Input
        id="patient-dob"
        type="date"
        value={editedInfo.dateOfBirth || ''}  // ← PRE-POPULATED
        onChange={(e) => setEditedInfo({ ...editedInfo, dateOfBirth: e.target.value })}
      />
    </div>
  </div>

  {/* Gender */}
  <div className="space-y-2">
    <Label htmlFor="patient-gender">Gender *</Label>
    <Select
      value={editedInfo.gender || undefined}  // ← PRE-POPULATED
      onValueChange={(value: 'male' | 'female' | 'other') => 
        setEditedInfo({ ...editedInfo, gender: value })
      }
    >
      <SelectTrigger id="patient-gender">
        <SelectValue placeholder="Select gender..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="male">Male</SelectItem>
        <SelectItem value="female">Female</SelectItem>
        <SelectItem value="other">Other</SelectItem>
      </SelectContent>
    </Select>
  </div>
</div>
```

**Pre-population Details**:
- Name: Comes from consolidated patient info (most common name, Title Case)
- DOB: Most frequent date found across all PDFs
- Gender: Most common gender value
- All fields are editable

#### 3. Action Buttons
```typescript
<div className="flex gap-3 pt-4">
  <Button variant="outline" onClick={onCancel} className="flex-1">
    Cancel
  </Button>
  <Button 
    onClick={handleConfirm} 
    className="flex-1 gap-2"
    disabled={!editedInfo.name || !editedInfo.gender}
  >
    <CheckCircle2 className="h-4 w-4" />
    {useExisting && matchResult.client 
      ? 'Use This Client & Continue' 
      : 'Continue to Analysis'}
  </Button>
</div>
```

### Validation
- Name: Required
- Gender: Required
- DOB: Optional

### User Interaction Flow

1. **View pre-populated data** from PDF extraction
2. **See match result** (if any)
3. **Choose** to use existing client or create new
4. **Edit** patient information if needed
5. **Click** "Continue to Analysis"

---

## Step 7: Save Client & Create Analysis

### Handler: handleConfirmClient()
**File**: `src/pages/HomePage.tsx` (lines 255-436)

### State Transition
```typescript
setState('analyzing');
setProcessingMessage('Creating analysis...');
setProcessingProgress(0);
```

### Extract Confirmed Info
```typescript
const { name, dateOfBirth, gender } = confirmedInfo;
let clientId: string = '';
let clientName: string = confirmedInfo.name || 'Unknown';
let finalGender: 'male' | 'female' = confirmedInfo.gender === 'female' ? 'female' : 'male';
```

### Create or Use Client

#### If Using Existing Client
```typescript
if (useExistingClient && matchResult?.client) {
  clientId = matchResult.client.id;
  clientName = matchResult.client.full_name;
  finalGender = (matchResult.client.gender === 'female' || matchResult.client.gender === 'male') 
    ? matchResult.client.gender 
    : finalGender;
  console.log(`✅ Using existing client: ${clientName} (${finalGender})`);
}
```

#### If Creating New Client
```typescript
else {
  setProcessingMessage('Creating new client...');
  const newClient = await autoCreateClient(confirmedInfo);
  if (!newClient) {
    throw new Error('Failed to create client');
  }
  clientId = newClient.id;
  clientName = newClient.full_name;
  finalGender = (newClient.gender === 'female' || newClient.gender === 'male') 
    ? newClient.gender 
    : finalGender;
  console.log(`✅ Created new client: ${clientName} (${finalGender})`);
}
```

**File**: `src/lib/client-matcher.ts` (lines 214-231)

```typescript
export async function autoCreateClient(patientInfo: PatientInfo): Promise<Client | null> {
  if (!patientInfo.name) {
    throw new Error('Patient name is required to create a client');
  }

  const formattedName = toTitleCase(patientInfo.name);

  return createClient({
    full_name: formattedName,
    date_of_birth: patientInfo.dateOfBirth || null,
    gender: patientInfo.gender || null,
    email: null,
    status: 'active',
    notes: 'Auto-created from lab report',
    tags: [],
  });
}
```

### Progress Updates
- 20% → Creating/using client
- 40% → Grouping biomarkers by test date

### Group Biomarkers by Test Date
```typescript
const biomarkersByDate = new Map<string, ExtractedBiomarker[]>();

extractedAnalyses.forEach(analysis => {
  const testDate = analysis.patientInfo.testDate || 'no-date';
  if (!biomarkersByDate.has(testDate)) {
    biomarkersByDate.set(testDate, []);
  }
  biomarkersByDate.get(testDate)!.push(...analysis.biomarkers);
});

// Deduplicate within each date group
biomarkersByDate.forEach((biomarkers, date) => {
  const deduped = new Map<string, ExtractedBiomarker>();
  biomarkers.forEach(biomarker => {
    const key = biomarker.name.toLowerCase().trim();
    if (!deduped.has(key) || (biomarker.value !== 'N/A' && deduped.get(key)?.value === 'N/A')) {
      deduped.set(key, biomarker);
    }
  });
  biomarkersByDate.set(date, Array.from(deduped.values()));
});
```

**Logic**:
- Group biomarkers by their test date
- Deduplicate within each group (keep non-N/A values)
- Handles multiple lab visits

### Progress Updates
- 50% → Generating analysis results

### Match Biomarkers with Ranges
```typescript
const combinedResults = matchBiomarkersWithRanges(extractedBiomarkers, finalGender);
```

**File**: `src/lib/analyzer.ts`

**What It Does**:
1. Takes extracted biomarkers
2. Looks up each biomarker in the 54-marker database
3. Matches using name + aliases (multilingual)
4. Compares patient value to optimal range (gender-specific)
5. Returns AnalysisResult[] with status (optimal/suboptimal/etc.)

### Save Analysis to Database
```typescript
if (isSupabaseEnabled && clientId) {
  setProcessingMessage(`Saving analysis for ${clientName}...`);
  const finalTestDate = (singleTestDate && singleTestDate !== 'no-date') ? singleTestDate : null;
  
  await createAnalysis(clientId, combinedResults, finalTestDate);
  setSavedAnalysesCount(1);
}
```

**File**: `src/lib/analysis-service.ts` (lines 38-80)

```typescript
export async function createAnalysis(
  clientId: string,
  results: AnalysisResult[],
  labTestDate?: string | null,
  notes?: string
): Promise<Analysis | null> {
  if (!supabase) return null;
  
  // Check for existing analysis with same lab_test_date
  if (labTestDate) {
    const existing = await findAnalysisByDate(clientId, labTestDate);
    if (existing) {
      console.log(`Analysis already exists for ${labTestDate}, updating instead of creating duplicate`);
      return updateAnalysis(existing.id, { results, notes });
    }
  }
  
  // Generate summary stats
  const summary = {
    totalBiomarkers: results.length,
    measuredBiomarkers: results.filter(r => r.hisValue !== 'N/A').length,
    missingBiomarkers: results.filter(r => r.hisValue === 'N/A').length,
  };
  
  const { data, error } = await supabase
    .from('analyses')
    .insert({
      client_id: clientId,
      lab_test_date: labTestDate || null,
      results: results,
      summary: summary,
      notes: notes || null,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating analysis:', error);
    return null;
  }
  
  return data;
}
```

### Progress Updates
- 60% → Saving analysis
- 80% → Finalizing
- 100% → Complete

---

## Step 8: Display Results

### State Transition
```typescript
setState('results');
setResults(allResults);
setSelectedClientId(clientId);
setSelectedClientName(clientName);
setSelectedGender(finalGender);
```

### Component: AnalysisResults
**File**: `src/components/AnalysisResults.tsx`

### Props Passed
```typescript
<AnalysisResults 
  results={results}                           // Matched biomarker results
  onReset={handleReset}                       // Reset handler
  selectedClientId={selectedClientId}         // Database client ID
  selectedClientName={selectedClientName}     // Client name
  gender={selectedGender}                     // Gender for ranges
  documentCount={extractedAnalyses.length}    // Number of PDFs processed
  savedAnalysesCount={savedAnalysesCount}    // Number of analyses saved
  patientInfoDiscrepancies={patientInfoDiscrepancies} // Any discrepancies found
/>
```

### Display Features

#### 1. Summary Header
- Client name
- Number of documents processed
- Number of analyses saved
- Patient info discrepancies (if any)

#### 2. Biomarker Table
- Shows all 54 biomarkers
- Patient value vs optimal range
- Status indicators (optimal/suboptimal/etc.)
- Color-coded rows

#### 3. Export Options
- Copy to clipboard (markdown)
- Download as markdown file
- Export to PDF (future)

---

## Key Data Structures Throughout Flow

### Stage 1: Upload
```typescript
files: File[]  // Raw PDF files
```

### Stage 2: Text Extraction
```typescript
ProcessedPDF[]  // Text extracted from PDFs
```

### Stage 3: AI Extraction
```typescript
ClaudeResponse[] {
  biomarkers: ExtractedBiomarker[],
  patientInfo: PatientInfo,
  panelName: string
}
```

### Stage 4: Consolidation
```typescript
consolidatedPatientInfo: PatientInfo {
  name: string | null,
  dateOfBirth: string | null,
  gender: 'male' | 'female' | 'other' | null,
  testDate: string | null
}
```

### Stage 5: Matching
```typescript
matchResult: ClientMatchResult {
  matched: boolean,
  client: Client | null,
  confidence: 'high' | 'medium' | 'low',
  needsConfirmation: boolean,
  suggestedAction: 'use-existing' | 'create-new' | 'manual-select'
}
```

### Stage 6: Confirmation (PRE-POPULATED)
```typescript
editedInfo: PatientInfo  // User-editable, pre-populated data
useExisting: boolean     // Use existing client or create new?
```

### Stage 7: Analysis
```typescript
Analysis {
  id: string,
  client_id: string,
  lab_test_date: string | null,
  results: AnalysisResult[],
  summary: {
    totalBiomarkers: number,
    measuredBiomarkers: number,
    missingBiomarkers: number
  }
}
```

### Stage 8: Results Display
```typescript
results: AnalysisResult[] {
  biomarkerName: string,
  hisValue: string,
  unit: string,
  optimalRange: string,
  status: string,
  testDate?: string
}
```

---

## User Experience Summary

### Complete Flow
1. **Upload** PDF files via drag & drop
2. **Wait** while AI extracts data (progress updates)
3. **Review** pre-populated patient information
4. **Choose** to use existing client or create new
5. **Edit** patient info if needed
6. **Confirm** to proceed
7. **Wait** while analysis is created
8. **View** complete biomarker analysis results

### Key UX Features
- **No upfront client selection** - Upload first, match later
- **Pre-populated data** - Minimal manual entry
- **Smart matching** - Finds existing clients automatically
- **Confidence indicators** - Shows match quality
- **Editable fields** - User can correct any data
- **Progress tracking** - Real-time progress updates
- **Discrepancy detection** - Flags inconsistencies

---

## Summary for AI Design Tool

The upload-to-analysis flow implements a **patient-first workflow** that:

1. **Uploads PDFs** without requiring client selection upfront
2. **Extracts patient info** automatically via AI (name, DOB, gender, test date)
3. **Consolidates** data from multiple PDFs (handles discrepancies)
4. **Matches** to existing clients using smart similarity algorithms
5. **Pre-populates** confirmation dialog with extracted data (USER CAN EDIT)
6. **Saves** client (new or existing) and analysis to database
7. **Displays** complete biomarker analysis with status indicators

The key innovation is **pre-population**: The confirmation dialog shows all extracted patient information already filled in, allowing users to review and edit rather than type from scratch. This dramatically reduces manual data entry while maintaining accuracy through user confirmation.








