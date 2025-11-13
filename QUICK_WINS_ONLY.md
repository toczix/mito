# Quick Wins Implementation Guide (Works with Current Schema)

## Executive Summary

This guide implements **only the quick wins** from the implementation plan that work with your **actual current schema**. No new tables, no breaking changes - just immediate improvements.

**Current Schema Reality**:
```typescript
interface Analysis {
  id: string;
  client_id: string;
  lab_test_date: string | null;
  analysis_date: string;
  results: AnalysisResult[]; // ✅ JSON array (current schema)
  summary: any | null;
  notes: string | null;
  user_id?: string;
}

interface AnalysisResult {
  biomarkerName: string;
  hisValue: string;
  unit: string;
  optimalRange: string;
  testDate?: string;
}
```

---

## Quick Win #1: Increase Max Tokens to 32K ⚡

**Current**: 8,192 tokens (truncates large reports)
**New**: 32,768 tokens (handles 300+ biomarkers)
**Source**: https://docs.claude.com/en/docs/about-claude/models (Claude Haiku 4.5 supports 64K)

### Implementation

```typescript
// File: supabase/functions/analyze-biomarkers/index.ts
// Line 243

const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 32768, // ✅ Change from 8192 to 32768
  temperature: 0,
  messages: [{ role: 'user', content }],
});
```

**Test**: Upload a comprehensive metabolic panel with 100+ biomarkers

---

## Quick Win #2: Fix retryAfter Conversion Bug 🐛

**Problem**: `Retry-After` is in seconds, but code treats it as milliseconds
**Impact**: Hammers API 60ms after 429 instead of waiting 60 seconds

### Find the Bug

```bash
# Search for retryAfter usage
grep -rn "retryAfter" src/lib/claude-service.ts
```

### Fix (if found)

```typescript
// File: src/lib/claude-service.ts

// ❌ BEFORE (if this pattern exists)
const resetTime = new Date(Date.now() + error.retryAfter);

// ✅ AFTER
const retryAfterSeconds = error.retryAfter || 60;
const retryAfterMs = retryAfterSeconds * 1000;
const resetTime = new Date(Date.now() + retryAfterMs);
```

**Test**: Simulate a 429 error and verify wait time

---

## Quick Win #3: Add Normalized Biomarker Metadata (JSON Extension)

**Goal**: Track normalization confidence WITHOUT changing schema

### Extend AnalysisResult Interface

```typescript
// File: src/lib/biomarkers.ts

export interface AnalysisResult {
  biomarkerName: string;
  hisValue: string;
  unit: string;
  optimalRange: string;
  testDate?: string;

  // ✅ NEW: Optional normalization metadata (backward compatible)
  _normalization?: {
    originalName?: string;
    originalValue?: string;
    originalUnit?: string;
    confidence?: number; // 0.0-1.0
    conversionApplied?: boolean;
    isNumeric?: boolean;
  };
}
```

### Why This Works

- ✅ **Backward compatible**: Existing code ignores `_normalization`
- ✅ **No migration needed**: JSON column accepts any structure
- ✅ **Queryable**: Can filter low-confidence matches later
- ✅ **Future-proof**: Can extract to separate table later

---

## Quick Win #4: Add Normalizer Initialization (Client-Side Only)

**Goal**: Initialize biomarker normalizer on app startup

### Implementation

```typescript
// File: src/main.tsx (or App.tsx)

import { biomarkerNormalizer } from './lib/biomarker-normalizer';

// ✅ Initialize normalizer on app load
async function initializeApp() {
  console.log('🚀 Initializing Mito app...');

  try {
    await biomarkerNormalizer.initialize();
    console.log('✅ Biomarker normalizer ready');
  } catch (error) {
    console.warn('⚠️ Normalizer initialization failed (will use passthrough):', error);
    // Non-fatal - app works without normalization
  }
}

// Bootstrap
initializeApp().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
```

**Test**: Check console for "Biomarker normalizer ready" message

---

## Quick Win #5: Use Normalized Biomarkers in HomePage

**Goal**: Prefer normalized biomarkers if available

### Implementation

```typescript
// File: src/pages/HomePage.tsx

const handleProcessFiles = async () => {
  try {
    const results: ClaudeResponse[] = await extractBiomarkersFromPdfs(
      processedPdfs,
      handleProgress
    );

    // ✅ Use normalized biomarkers if available, fall back to raw
    const biomarkersToAnalyze = results.flatMap(result => {
      const biomarkers = result.normalizedBiomarkers || result.biomarkers;

      // Convert NormalizedBiomarker[] to AnalysisResult[]
      return biomarkers.map(b => ({
        biomarkerName: b.name,
        hisValue: b.value,
        unit: b.unit,
        optimalRange: '', // Will be filled by analyzer
        _normalization: result.normalizedBiomarkers ? {
          originalName: b.originalName,
          originalValue: b.originalValue,
          originalUnit: b.originalUnit,
          confidence: b.confidence,
          conversionApplied: b.conversionApplied,
          isNumeric: b.isNumeric
        } : undefined
      }));
    });

    // Analyze as usual
    const analyzedResults = matchBiomarkersWithRanges(
      biomarkersToAnalyze,
      benchmarks
    );

    setExtractedResults(analyzedResults);
  } catch (error) {
    // ... error handling ...
  }
};
```

**Test**: Upload a Spanish lab report, verify biomarker names normalize to English

---

## Quick Win #6: Save Normalization Metadata

**Goal**: Save normalization confidence in existing JSON structure

### Implementation

```typescript
// File: src/lib/analysis-service.ts
// Update createAnalysis function

export async function createAnalysis(
  clientId: string,
  results: AnalysisResult[], // ✅ Now includes _normalization metadata
  labTestDate?: string | null,
  notes?: string
): Promise<Analysis | null> {
  // ... existing code ...

  // ✅ results already contain _normalization metadata (no changes needed!)
  const insertData: any = {
    client_id: clientId,
    lab_test_date: labTestDate || null,
    results: results, // ✅ JSON includes normalization metadata
    summary: summary,
    notes: notes || null,
  };

  // ... rest of function unchanged ...
}
```

**Test**: Create an analysis and verify `_normalization` is saved in `results` JSON

---

## Quick Win #7: Query Low-Confidence Normalizations

**Goal**: Find biomarker names that need aliases added

### Implementation

```typescript
// File: src/lib/analytics-queries.ts (new file)

import { supabase } from './supabase';

export async function getLowConfidenceNormalizations() {
  if (!supabase) return null;

  // Get all analyses with their results
  const { data: analyses } = await supabase
    .from('analyses')
    .select('results')
    .limit(1000);

  if (!analyses) return null;

  // Extract low-confidence normalizations from JSON
  const lowConfidence: any[] = [];

  for (const analysis of analyses) {
    const results = analysis.results as any[];

    for (const result of results) {
      if (result._normalization && result._normalization.confidence < 0.5) {
        lowConfidence.push({
          originalName: result._normalization.originalName,
          canonicalName: result.biomarkerName,
          confidence: result._normalization.confidence
        });
      }
    }
  }

  // Group by original name and count occurrences
  const grouped = lowConfidence.reduce((acc, item) => {
    const key = item.originalName;
    if (!acc[key]) {
      acc[key] = {
        originalName: key,
        canonicalName: item.canonicalName,
        confidence: item.confidence,
        count: 0
      };
    }
    acc[key].count++;
    return acc;
  }, {} as Record<string, any>);

  return Object.values(grouped).sort((a: any, b: any) => b.count - a.count);
}
```

**Test**: Call function and log results to console

---

## Deployment Checklist

### Step 1: Update Edge Function
```bash
cd /Users/gman/Desktop/mito

# Update max_tokens in analyze-biomarkers/index.ts (line 243)
# Change: max_tokens: 8192 → max_tokens: 32768

# Deploy
supabase functions deploy analyze-biomarkers
```

### Step 2: Update Client Code
```bash
# 1. Add _normalization to AnalysisResult interface
# 2. Add normalizer initialization to main.tsx
# 3. Update HomePage to use normalized biomarkers
# 4. Create analytics-queries.ts

# Test locally
npm run dev
```

### Step 3: Verify
```bash
# Upload a test lab report
# Check console for:
# - "✅ Biomarker normalizer ready"
# - Biomarker names in English (even for Spanish reports)
# - _normalization metadata in saved results
```

---

## Success Metrics

| Metric | Before | After | How to Test |
|--------|--------|-------|-------------|
| Max biomarkers | 80 | 300+ | Upload 200-biomarker report |
| Multilingual match rate | 70% | 90%+ | Upload Spanish report |
| Normalization tracking | None | Available | Query low-confidence matches |

---

## What's NOT in This Guide

These require schema changes (deferred):
- ❌ New `analysis_biomarkers` table
- ❌ Separate `biomarker_taxonomy` table
- ❌ Job queue system
- ❌ Web Workers (requires build config changes)
- ❌ Adaptive batching (no current rate limit issues)

---

## Next Steps

After these quick wins are deployed:
1. Monitor low-confidence normalizations
2. Add aliases to `biomarker-normalizer.ts` for common misses
3. Consider schema migration if normalization proves valuable

---

**Document Version**: Quick Wins Only
**Last Updated**: 2025-11-12
**Estimated Time**: 2 hours
**Risk Level**: Low (all changes are backward compatible)
