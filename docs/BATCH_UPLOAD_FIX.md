# Batch Upload Fix - Single Client per Batch

## Problem Statement

When uploading multiple PDFs/images for a single client, OCR errors and inconsistent data extraction could cause the system to create **multiple duplicate clients** with variations in:
- Name spelling (e.g., "Ashley Lebedev" vs "Ashley Leebody")
- Date of birth (e.g., "5/4/1983" vs "5/7/1981")
- Gender

This violated the core assumption: **batch uploads are always for ONE client**.

## Solution Overview

The system now:
1. ✅ **Consolidates patient info** from all PDFs in a batch
2. ✅ **Always creates/matches ONE client** per batch upload
3. ✅ **Detects and rejects blurry images** that could cause OCR errors
4. ✅ **Shows discrepancy warnings** when extracted data conflicts
5. ✅ **Provides client merge functionality** to fix existing duplicates

---

## Changes Made

### 1. Image Quality Detection (`pdf-processor.ts`)

Added automatic quality checking for uploaded images:

**Features:**
- Resolution check (minimum 800x600 recommended)
- Blur detection using variance and Laplacian edge detection
- Quality scoring (0-1 scale)
- Files with score < 0.5 are flagged and can be rejected

**Interface Updates:**
```typescript
export interface ProcessedPDF {
  // ... existing fields
  qualityScore?: number;      // 0-1, for images
  qualityWarning?: string;    // Warning message if quality is low
}
```

**Implementation:**
- Analyzes image sharpness using pixel variance
- Uses Laplacian kernel for edge detection
- Automatically skips poor quality images during processing

---

### 2. Patient Info Consolidation (`claude-service.ts`)

Added smart consolidation of patient data from multiple PDFs:

**New Function:**
```typescript
export function consolidatePatientInfo(
  patientInfos: PatientInfo[]
): { 
  consolidated: PatientInfo; 
  discrepancies: string[];
  confidence: 'high' | 'medium' | 'low';
}
```

**Consolidation Logic:**
- **Name**: Picks most common value (handles "Ashley Lebedev" appearing 3x vs "Ashley Leebody" 1x)
- **DOB**: Picks most common date (ignores OCR errors)
- **Gender**: Picks most common value
- **Test Date**: Picks most recent date

**Discrepancy Detection:**
- Flags when multiple different values are found
- Returns list of what was detected and what was chosen
- Confidence level based on number of conflicts

---

### 3. Unified Client Creation (`App.tsx`)

**Old Behavior:**
```typescript
// ❌ Created separate client for EACH PDF
for (let i = 0; i < allAnalyses.length; i++) {
  const matchResult = await matchOrCreateClient(analysis.patientInfo);
  // Could create "Ashley Lebedev" AND "Ashley Leebody"
}
```

**New Behavior:**
```typescript
// ✅ Consolidate FIRST, then create ONE client
const { consolidated, discrepancies } = consolidatePatientInfo(allPatientInfos);
const matchResult = await matchOrCreateClient(consolidated);
// Creates ONLY "Ashley Lebedev" (most common)
```

**Flow:**
1. Process all PDFs → extract patient info from each
2. **Consolidate** patient info into single best representation
3. **Match or create ONE client** using consolidated info
4. Save all analyses to that ONE client
5. Display discrepancy warnings if needed

---

### 4. Discrepancy Warning UI (`App.tsx`)

Added visual feedback when patient data conflicts are detected:

```tsx
{patientInfoDiscrepancies.length > 0 && (
  <Alert>
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>
      <p className="font-semibold mb-2">Patient Information Consolidated</p>
      <ul>
        {patientInfoDiscrepancies.map((discrepancy, i) => (
          <li key={i}>{discrepancy}</li>
        ))}
      </ul>
    </AlertDescription>
  </Alert>
)}
```

**Example Warning:**
```
Multiple names found: Ashley Lebedev, Ashley Leebody, Ashley Lebedew - Using: Ashley Lebedev
Multiple DOBs found: 1983-05-04, 1981-05-07 - Using: 1983-05-04
```

---

### 5. Client Merge Function (`client-service.ts`)

Added function to fix existing duplicate clients:

```typescript
export async function mergeClients(
  targetId: string,   // Keep this one
  sourceId: string    // Archive this one
): Promise<boolean>
```

**What it does:**
1. Moves all lab tests from source to target
2. Archives the source client
3. Preserves all historical data

**Usage (in browser console or future UI):**
```javascript
import { mergeClients } from '@/lib/client-service';

// Merge "Ashley Leebody" into "Ashley Lebedev"
await mergeClients(
  'correct-client-id',    // Ashley Lebedev (keep)
  'duplicate-client-id'   // Ashley Leebody (archive)
);
```

---

## Testing the Fix

### Test Case 1: Multiple PDFs, Same Client
**Input:**
- 3 PDFs all for "John Smith, DOB: 1/1/1990"
- One PDF has OCR error: "John Smitb"

**Expected:**
- ✅ Consolidates to "John Smith" (most common)
- ✅ Creates ONE client
- ✅ Shows warning about "John Smitb" discrepancy

### Test Case 2: Blurry Image
**Input:**
- 1 clear PDF, 1 blurry image

**Expected:**
- ✅ Detects blurry image (quality score < 0.5)
- ✅ Skips blurry image
- ✅ Processes only the clear PDF

### Test Case 3: Mixed Test Dates
**Input:**
- 2 PDFs for same client, different dates (1/1/2024 and 2/1/2024)

**Expected:**
- ✅ Creates ONE client
- ✅ Saves TWO separate analyses (different lab visits)

---

## Fixing Existing Duplicates

For the existing "Ashley Lebedev" and "Ashley Leebody" duplicates:

### Option 1: Manual Database Merge (SQL)
```sql
-- 1. Find the client IDs
SELECT id, full_name, date_of_birth FROM clients 
WHERE full_name LIKE 'Ashley Leb%';

-- 2. Move lab tests from duplicate to correct client
UPDATE lab_tests 
SET client_id = 'correct-client-id' 
WHERE client_id = 'duplicate-client-id';

-- 3. Archive the duplicate
UPDATE clients 
SET status = 'past' 
WHERE id = 'duplicate-client-id';
```

### Option 2: Using Console (Browser DevTools)
```javascript
// Import the function
const { mergeClients } = await import('./lib/client-service');

// Merge clients
await mergeClients(
  'ashley-lebedev-id',   // Correct one
  'ashley-leebody-id'    // Duplicate
);
```

### Option 3: Future UI Enhancement
Add a "Merge Clients" button to the Clients tab that:
1. Shows potential duplicates (similar names, same DOB)
2. Allows selecting target and source
3. Calls `mergeClients()` function

---

## Key Benefits

1. **No More Duplicates**: Batch uploads always create ONE client
2. **Better Data Quality**: Blurry images are rejected automatically
3. **Transparency**: Users see when data conflicts are detected
4. **Recoverable**: Existing duplicates can be merged without data loss
5. **Smart Consolidation**: Uses most common/complete values, not just first found

---

## Configuration

No configuration needed! The changes work automatically with these defaults:

- **Min image resolution**: 800x600 pixels
- **Quality threshold**: 0.5 (reject if below)
- **Consolidation logic**: Most common value wins
- **Multiple dates**: Saved as separate analyses for same client

To adjust thresholds, modify these values in `pdf-processor.ts`:
```typescript
const minWidth = 800;
const minHeight = 600;
const varianceThreshold = 800;
const laplacianThreshold = 8;
```

---

## Future Enhancements

Potential improvements for consideration:

1. **Pre-upload Preview**: Show extracted patient info before confirming
2. **Manual Correction**: Allow editing patient info before saving
3. **Duplicate Detection UI**: Auto-suggest merging similar clients
4. **Phonetic Matching**: Use Soundex/Metaphone for better name matching
5. **Confidence Scoring**: Show confidence percentage for each field

---

## Summary

The system now treats batch uploads as they're intended: **always for ONE client**. Patient information is intelligently consolidated from all documents, poor quality images are rejected, and users are informed when discrepancies are detected. Existing duplicates can be easily merged using the new `mergeClients()` function.

This prevents issues like "Ashley Lebedev" and "Ashley Leebody" being created as separate clients from the same batch upload.

