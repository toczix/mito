# Implementation Plan: High-Performance Biomarker Analysis System (REVISED)

## Executive Summary

This revised plan fixes critical bugs identified in the initial implementation plan and provides production-ready code for all priority items.

**Key Changes from v1.0**:
- Fixed adaptive batching rate limit recovery
- Proper type definitions for normalized biomarkers
- Corrected Web Worker output format
- Atomic job queue claiming
- Verified Claude API specifications
- Byte-accurate payload size estimation

---

## Priority 1: Critical Stability & Throughput Fixes (Week 1-2)

### 1.1 Fix File Size Limit Mismatch
**Problem**: Client accepts 50MB files, Edge Function caps at 20MB combined
**Status**: ✅ No changes from v1.0

### 1.2 Implement Adaptive Batching with Rate-Limit Awareness (FIXED)

**Problem from v1.0**: Rate limit state never resets after recovery, causing infinite delays

**Fixed Implementation**:
```typescript
// File: src/lib/claude-service.ts

interface RateLimitInfo {
  remainingRequests: number;
  resetTime: Date;
  retryAfter?: number;
}

interface BatchResult {
  data: ClaudeResponse[];
  rateLimitHeaders?: {
    remaining: number;
    reset: number;
    limit: number;
  };
}

class AdaptiveBatcher {
  private rateLimitInfo: RateLimitInfo | null = null;
  private recentLatencies: number[] = [];

  async processBatch(batch: ProcessedPDF[]): Promise<ClaudeResponse[]> {
    const startTime = Date.now();

    try {
      const result = await extractBiomarkersFromBatch(batch);

      // Track successful latency
      this.recentLatencies.push(Date.now() - startTime);
      if (this.recentLatencies.length > 10) this.recentLatencies.shift();

      // ✅ FIX: Reset rate limit info on success
      // If we had a rate limit and successfully completed, clear it
      if (this.rateLimitInfo?.remainingRequests === 0) {
        console.log('✅ Rate limit recovered - resuming normal operation');
        this.rateLimitInfo = null;
      }

      // ✅ FIX: Update rate limit info from response headers (if available)
      // Note: Anthropic doesn't currently expose rate limit headers in SDK,
      // but we defensively handle them if they become available
      if (result._rateLimitHeaders) {
        this.rateLimitInfo = {
          remainingRequests: result._rateLimitHeaders.remaining,
          resetTime: new Date(result._rateLimitHeaders.reset * 1000),
        };
      }

      return result;
    } catch (error: any) {
      // Extract rate limit info from headers/error
      if (error.status === 429) {
        const retryAfter = error.retryAfter || 60000;
        this.rateLimitInfo = {
          remainingRequests: 0,
          resetTime: new Date(Date.now() + retryAfter),
          retryAfter
        };
        console.warn(`⚠️ Rate limited - will resume at ${this.rateLimitInfo.resetTime.toISOString()}`);
      }
      throw error;
    }
  }

  getOptimalDelay(): number {
    // If rate limited, wait until reset
    if (this.rateLimitInfo?.remainingRequests === 0) {
      const now = Date.now();
      const resetMs = this.rateLimitInfo.resetTime.getTime() - now;

      // ✅ FIX: If reset time has passed, clear rate limit info
      if (resetMs <= 0) {
        console.log('✅ Rate limit reset time passed - clearing');
        this.rateLimitInfo = null;
        return 500; // Minimal delay
      }

      return Math.max(0, resetMs);
    }

    // ✅ FIX: If we have remaining requests but they're low, be more conservative
    if (this.rateLimitInfo && this.rateLimitInfo.remainingRequests < 5) {
      return 3000; // Slow down when approaching limit
    }

    // Adaptive: if recent calls are fast, reduce delay
    const avgLatency = this.recentLatencies.length > 0
      ? this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length
      : 2000;

    // Conservative: wait 10% of average latency, min 500ms, max 3000ms
    return Math.min(3000, Math.max(500, avgLatency * 0.1));
  }

  // ✅ NEW: Expose rate limit state for debugging
  getRateLimitState() {
    return this.rateLimitInfo;
  }
}

// Update extractBiomarkersFromPdfs to use adaptive delay
const batcher = new AdaptiveBatcher();

for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
  const results = await batcher.processBatch(batches[batchIndex]);

  if (batchIndex < batches.length - 1) {
    const delay = batcher.getOptimalDelay();
    const rateLimitState = batcher.getRateLimitState();

    if (rateLimitState) {
      console.log(`⏸️ Adaptive delay: ${delay}ms (rate limit: ${rateLimitState.remainingRequests} remaining)`);
    } else {
      console.log(`⏸️ Adaptive delay: ${delay}ms`);
    }

    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

**Expected impact**: 40-file upload delay drops from 8s to 2-4s, with proper rate limit recovery

---

### 1.3 Verify Claude Haiku 4.5 Model ID and Token Limits

**Status**: ✅ Already verified in previous conversation
- Model ID: `claude-haiku-4-5-20251001` (confirmed from Anthropic docs)
- Max output tokens: 8,192 (current), can increase to 16,384
- Context window: 200K input tokens

**Recommended Change**:
```typescript
// File: supabase/functions/analyze-biomarkers/index.ts

const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 16384, // ✅ Increase for comprehensive reports (100+ biomarkers)
  temperature: 0,
  messages: [{ role: 'user', content }],
});
```

**Reasoning**: Most comprehensive lab reports have 50-80 biomarkers. At ~100 tokens per biomarker, we need 5,000-8,000 tokens. 16K provides safe headroom.

---

### 1.4 Fix Payload Size Estimation (NEW)

**Problem from v1.0**: Using string `.length` overestimates bytes (UTF-16 vs UTF-8)

**Fixed Implementation**:
```typescript
// File: src/lib/pdf-processor.ts

/**
 * Calculate accurate byte size of a string in UTF-8
 */
function getByteSize(str: string): number {
  return new Blob([str]).size;
}

/**
 * Estimate actual payload size in bytes
 */
export function estimateBatchSize(processedPdfs: ProcessedPDF[]): number {
  let totalBytes = 0;

  for (const pdf of processedPdfs) {
    // Text content
    if (pdf.extractedText) {
      totalBytes += getByteSize(pdf.extractedText);
    }

    // Single image (base64 is ~33% larger than binary)
    if (pdf.imageData) {
      const base64Data = pdf.imageData.split(',')[1] || pdf.imageData;
      totalBytes += Math.ceil(base64Data.length * 0.75); // Convert base64 to binary size
    }

    // Multiple images
    if (pdf.imagePages) {
      for (const imagePage of pdf.imagePages) {
        const base64Data = imagePage.split(',')[1] || imagePage;
        totalBytes += Math.ceil(base64Data.length * 0.75);
      }
    }

    // JSON overhead (metadata, structure)
    totalBytes += 1000; // Conservative estimate for JSON overhead per file
  }

  return totalBytes;
}

/**
 * Split PDFs into batches that fit within size limit
 */
export function createSmartBatches(
  processedPdfs: ProcessedPDF[],
  maxBatchSize: number = 15 * 1024 * 1024, // 15MB
  maxBatchCount: number = 10 // Max files per batch
): ProcessedPDF[][] {
  const batches: ProcessedPDF[][] = [];
  let currentBatch: ProcessedPDF[] = [];
  let currentBatchSize = 0;

  for (const pdf of processedPdfs) {
    const pdfSize = estimateBatchSize([pdf]);

    // If single PDF exceeds limit, put it in its own batch (will fail, but isolates the problem)
    if (pdfSize > maxBatchSize) {
      console.warn(`⚠️ ${pdf.fileName} exceeds max batch size (${formatSize(pdfSize)})`);
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchSize = 0;
      }
      batches.push([pdf]); // Isolate oversized file
      continue;
    }

    // If adding this PDF would exceed limits, start new batch
    if (
      currentBatch.length >= maxBatchCount ||
      currentBatchSize + pdfSize > maxBatchSize
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchSize = 0;
    }

    currentBatch.push(pdf);
    currentBatchSize += pdfSize;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
```

**Update claude-service.ts to use smart batching**:
```typescript
// File: src/lib/claude-service.ts

export async function extractBiomarkersFromPdfs(
  processedPdfs: ProcessedPDF[],
  onProgress?: (current: number, total: number, batchInfo?: string, status?: string) => void
): Promise<ClaudeResponseBatch> {
  if (processedPdfs.length === 0) {
    throw new Error('No PDFs provided');
  }

  // ✅ Use smart batching instead of fixed size
  const batches = createSmartBatches(processedPdfs, 15 * 1024 * 1024, 10);

  console.log(`📦 Processing ${processedPdfs.length} file(s) in ${batches.length} batch(es)`);
  batches.forEach((batch, i) => {
    const size = estimateBatchSize(batch);
    console.log(`   Batch ${i + 1}: ${batch.length} files, ${formatSize(size)}`);
  });

  // ... rest of function unchanged ...
}
```

---

## Priority 2: Deterministic Biomarker Normalization (Week 2-3)

### 2.1 Build Biomarker Taxonomy Database
**Status**: ✅ No changes to SQL from v1.0

### 2.2 Create Normalization Service with Proper Types (FIXED)

**Problem from v1.0**:
1. `_metadata` property added to `ExtractedBiomarker` doesn't exist in type
2. Non-numeric values get converted to `0` instead of preserved

**Fixed Implementation**:

```typescript
// File: src/lib/biomarkers.ts (ADD NEW TYPES)

export interface ExtractedBiomarker {
  name: string;
  value: string;
  unit: string;
}

// ✅ NEW: Separate type for normalized biomarkers
export interface NormalizedBiomarker {
  name: string;              // Canonical name
  value: string;             // Normalized value (or original if non-numeric)
  unit: string;              // Normalized unit
  originalName: string;      // Original name from Claude
  originalValue: string;     // Original value from Claude
  originalUnit: string;      // Original unit from Claude
  confidence: number;        // 0.0-1.0 confidence in name normalization
  conversionApplied: boolean; // Whether unit conversion was applied
  isNumeric: boolean;        // Whether value is numeric (false for "N/A", "<0.1", etc.)
}
```

```typescript
// File: src/lib/biomarker-normalizer.ts

import { supabase } from './supabase';
import type { ExtractedBiomarker, NormalizedBiomarker } from './biomarkers';

interface NormalizationResult {
  canonicalName: string;
  originalName: string;
  confidence: number;
  category: string;
}

interface UnitConversion {
  originalUnit: string;
  normalizedUnit: string;
  originalValue: string;
  normalizedValue: string;
  conversionApplied: boolean;
  isNumeric: boolean;
}

export class BiomarkerNormalizer {
  private taxonomyCache: Map<string, { canonical: string; category: string }> = new Map();
  private unitConversionCache: Map<string, Map<string, number>> = new Map();

  async initialize() {
    if (!supabase) return;

    // Load taxonomy + aliases
    const { data: aliases } = await supabase
      .from('biomarker_aliases')
      .select(`
        alias,
        biomarker_taxonomy!inner(canonical_name, category)
      `);

    if (aliases) {
      for (const row of aliases) {
        const key = this.normalizeKey(row.alias);
        this.taxonomyCache.set(key, {
          canonical: row.biomarker_taxonomy.canonical_name,
          category: row.biomarker_taxonomy.category
        });
      }
    }

    // Load unit conversions
    const { data: conversions } = await supabase
      .from('unit_conversions')
      .select('*');

    if (conversions) {
      for (const conv of conversions) {
        const biomarkerKey = conv.biomarker_canonical_name;
        if (!this.unitConversionCache.has(biomarkerKey)) {
          this.unitConversionCache.set(biomarkerKey, new Map());
        }
        const key = `${conv.from_unit}→${conv.to_unit}`;
        this.unitConversionCache.get(biomarkerKey)!.set(key, conv.multiplier);
      }
    }

    console.log(`✅ Loaded ${this.taxonomyCache.size} biomarker aliases and ${conversions?.length || 0} unit conversions`);
  }

  normalizeBiomarkerName(name: string): NormalizationResult {
    const key = this.normalizeKey(name);
    const match = this.taxonomyCache.get(key);

    if (match) {
      return {
        canonicalName: match.canonical,
        originalName: name,
        confidence: 1.0,
        category: match.category
      };
    }

    // Fuzzy fallback: try removing common prefixes/suffixes
    const cleaned = name
      .replace(/^(serum|plasma|blood|total|free)\s+/i, '')
      .replace(/\s+(serum|level|count)$/i, '');

    const fuzzyKey = this.normalizeKey(cleaned);
    const fuzzyMatch = this.taxonomyCache.get(fuzzyKey);

    if (fuzzyMatch) {
      return {
        canonicalName: fuzzyMatch.canonical,
        originalName: name,
        confidence: 0.8,
        category: fuzzyMatch.category
      };
    }

    // No match - return original with low confidence
    return {
      canonicalName: name,
      originalName: name,
      confidence: 0.3,
      category: 'Unknown'
    };
  }

  /**
   * ✅ FIXED: Preserve non-numeric values instead of converting to 0
   */
  normalizeUnit(
    biomarkerName: string,
    value: string | number,
    unit: string,
    preferredUnit?: string
  ): UnitConversion {
    const valueStr = String(value);
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    // ✅ FIX: Detect non-numeric values and preserve them
    const isNumeric = !isNaN(numValue) && isFinite(numValue);

    if (!isNumeric) {
      console.log(`ℹ️ Non-numeric value detected: "${valueStr}" - preserving as-is`);
      return {
        originalUnit: unit,
        normalizedUnit: unit,
        originalValue: valueStr,
        normalizedValue: valueStr, // Preserve original
        conversionApplied: false,
        isNumeric: false
      };
    }

    // Check if we have a conversion rule
    const conversions = this.unitConversionCache.get(biomarkerName);
    if (!conversions) {
      return {
        originalUnit: unit,
        normalizedUnit: unit,
        originalValue: valueStr,
        normalizedValue: valueStr,
        conversionApplied: false,
        isNumeric: true
      };
    }

    // If preferred unit specified, try to convert
    if (preferredUnit && unit !== preferredUnit) {
      const key = `${unit}→${preferredUnit}`;
      const multiplier = conversions.get(key);

      if (multiplier) {
        const convertedValue = numValue * multiplier;
        return {
          originalUnit: unit,
          normalizedUnit: preferredUnit,
          originalValue: valueStr,
          normalizedValue: convertedValue.toString(),
          conversionApplied: true,
          isNumeric: true
        };
      }
    }

    return {
      originalUnit: unit,
      normalizedUnit: unit,
      originalValue: valueStr,
      normalizedValue: valueStr,
      conversionApplied: false,
      isNumeric: true
    };
  }

  /**
   * ✅ FIXED: Return NormalizedBiomarker[] instead of mutating ExtractedBiomarker
   */
  async normalizeBatch(biomarkers: ExtractedBiomarker[]): Promise<NormalizedBiomarker[]> {
    const normalized: NormalizedBiomarker[] = [];

    for (const biomarker of biomarkers) {
      // Normalize name
      const nameResult = this.normalizeBiomarkerName(biomarker.name);

      // Get preferred unit for this biomarker (from benchmarks)
      const preferredUnit = this.getPreferredUnit(nameResult.canonicalName);

      // Normalize unit
      const unitResult = this.normalizeUnit(
        nameResult.canonicalName,
        biomarker.value,
        biomarker.unit,
        preferredUnit
      );

      // ✅ FIX: Create proper NormalizedBiomarker object
      normalized.push({
        name: nameResult.canonicalName,
        value: unitResult.normalizedValue,
        unit: unitResult.normalizedUnit,
        originalName: biomarker.name,
        originalValue: biomarker.value,
        originalUnit: biomarker.unit,
        confidence: nameResult.confidence,
        conversionApplied: unitResult.conversionApplied,
        isNumeric: unitResult.isNumeric
      });
    }

    return normalized;
  }

  private normalizeKey(text: string): string {
    return text.toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[–—]/g, '-'); // Normalize dashes
  }

  private getPreferredUnit(biomarkerName: string): string | undefined {
    // TODO: Look up from benchmarks table
    const unitMap: Record<string, string> = {
      'Glucose': 'mg/dL',
      'Total Cholesterol': 'mg/dL',
      'Neutrophils': '×10³/µL',
      'Vitamin B12': 'pg/mL',
      'Vitamin D': 'ng/mL'
    };
    return unitMap[biomarkerName];
  }
}

export const biomarkerNormalizer = new BiomarkerNormalizer();
```

**Update ClaudeResponse interface**:
```typescript
// File: src/lib/claude-service.ts

export interface ClaudeResponse {
  biomarkers: ExtractedBiomarker[]; // Raw from Claude
  normalizedBiomarkers?: NormalizedBiomarker[]; // After normalization
  patientInfo: PatientInfo;
  panelName: string;
  raw?: string;
}
```

**Integrate into claude-service.ts**:
```typescript
// File: src/lib/claude-service.ts

import { biomarkerNormalizer } from './biomarker-normalizer';
import type { NormalizedBiomarker } from './biomarkers';

export async function extractBiomarkersFromPdf(
  processedPdf: ProcessedPDF
): Promise<ClaudeResponse> {
  // ... existing code ...

  const response = await retryWithBackoff(async () => {
    // ... API call ...

    const rawResult: ClaudeResponse = {
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

    // ✅ NEW: Normalize biomarkers and attach as separate property
    try {
      const normalizedBiomarkers = await biomarkerNormalizer.normalizeBatch(
        rawResult.biomarkers
      );

      return {
        ...rawResult,
        normalizedBiomarkers
      };
    } catch (normError) {
      console.warn('⚠️ Normalization failed, returning raw biomarkers:', normError);
      return rawResult; // Return without normalization if it fails
    }
  });

  return response;
}
```

---

## Priority 3: Background Job Queue System (Week 3-4)

### 3.1 Move PDF Processing to Web Workers (FIXED)

**Problem from v1.0**: Worker output doesn't match `ProcessedPDF` interface

**Fixed Implementation**:
```typescript
// File: src/workers/pdf-worker.ts

import * as pdfjsLib from 'pdfjs-dist';
import type { ProcessedPDF } from '../lib/pdf-processor';

self.onmessage = async (e: MessageEvent) => {
  const { file, fileIndex } = e.data;

  try {
    // Process PDF in worker thread
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const imagePages: string[] = [];
    let combinedText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);

      // Extract text
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      combinedText += pageText + '\n\n';

      // Render to canvas
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d')!;

      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const imageData = await blobToBase64(blob);

      imagePages.push(imageData);
    }

    // Calculate quality score
    const qualityScore = combinedText.trim().length > 100 ? 'high' : 'low';

    // ✅ FIX: Build proper ProcessedPDF object
    const result: ProcessedPDF = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: 'image/png',
      extractedText: combinedText.trim(),
      imagePages,
      isImage: true, // Treat as image since we converted to PNG
      pageCount: pdf.numPages,
      qualityScore
    };

    self.postMessage({
      success: true,
      fileIndex,
      result
    });
  } catch (error: any) {
    self.postMessage({
      success: false,
      fileIndex,
      error: error.message
    });
  }
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

**Update pdf-processor.ts to handle errors properly**:
```typescript
// File: src/lib/pdf-processor.ts

export async function processMultiplePdfsParallel(
  files: File[],
  maxConcurrency: number = 3
): Promise<ProcessedPDF[]> {
  const workers: Worker[] = [];
  const results: (ProcessedPDF | null)[] = new Array(files.length).fill(null);
  const errors: Map<number, string> = new Map();

  // Create worker pool
  for (let i = 0; i < maxConcurrency; i++) {
    workers.push(new Worker(new URL('../workers/pdf-worker.ts', import.meta.url)));
  }

  return new Promise((resolve, reject) => {
    let completed = 0;
    let nextFileIndex = 0;

    workers.forEach(worker => {
      worker.onmessage = (e: MessageEvent) => {
        const { success, fileIndex, result, error } = e.data;

        if (success) {
          results[fileIndex] = result;
        } else {
          console.error(`Worker error for file ${fileIndex}:`, error);
          errors.set(fileIndex, error);
          // ✅ FIX: Don't put { error } in results array - set to null
          results[fileIndex] = null;
        }

        completed++;

        // Assign next file or terminate
        if (nextFileIndex < files.length) {
          worker.postMessage({ file: files[nextFileIndex], fileIndex: nextFileIndex });
          nextFileIndex++;
        } else {
          worker.terminate();
        }

        if (completed === files.length) {
          // ✅ FIX: Filter out null results and report errors
          const validResults = results.filter((r): r is ProcessedPDF => r !== null);

          if (validResults.length === 0) {
            reject(new Error('All files failed to process'));
          } else if (errors.size > 0) {
            console.warn(`⚠️ ${errors.size} file(s) failed processing:`, Array.from(errors.entries()));
            // Return valid results, caller can decide how to handle partial success
            resolve(validResults);
          } else {
            resolve(validResults);
          }
        }
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
        reject(error);
      };

      // Start first batch
      if (nextFileIndex < files.length) {
        worker.postMessage({ file: files[nextFileIndex], fileIndex: nextFileIndex });
        nextFileIndex++;
      }
    });
  });
}
```

---

### 3.2 Implement Atomic Job Queue (FIXED)

**Problem from v1.0**:
1. No RPC for `max_attempts`
2. Race condition - two workers can claim same job

**Fixed Implementation**:

**Create atomic claim function**:
```sql
-- File: supabase/migrations/YYYYMMDD_job_queue.sql

CREATE TABLE job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL,
  result JSONB,
  error TEXT,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  claimed_by TEXT, -- Worker ID that claimed this job
  claimed_at TIMESTAMPTZ
);

CREATE INDEX idx_queue_status ON job_queue(status, created_at);
CREATE INDEX idx_queue_user ON job_queue(user_id);

-- ✅ ATOMIC CLAIM FUNCTION
CREATE OR REPLACE FUNCTION claim_pending_jobs(
  worker_id TEXT,
  max_jobs INT DEFAULT 5
)
RETURNS SETOF job_queue
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE job_queue
  SET
    status = 'processing',
    claimed_by = worker_id,
    claimed_at = now(),
    started_at = COALESCE(started_at, now()),
    attempts = attempts + 1
  WHERE id IN (
    SELECT id
    FROM job_queue
    WHERE status = 'pending'
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT max_jobs
    FOR UPDATE SKIP LOCKED -- ✅ Prevents double-claiming
  )
  RETURNING *;
END;
$$;
```

**Update worker to use atomic claim**:
```typescript
// File: supabase/functions/job-worker/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WORKER_ID = `worker-${Deno.env.get('DENO_DEPLOYMENT_ID') || crypto.randomUUID()}`;

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // ✅ FIX: Use atomic claim function
  const { data: jobs, error: claimError } = await supabase
    .rpc('claim_pending_jobs', {
      worker_id: WORKER_ID,
      max_jobs: 5
    });

  if (claimError) {
    console.error('Failed to claim jobs:', claimError);
    return new Response(JSON.stringify({ error: claimError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!jobs || jobs.length === 0) {
    return new Response(JSON.stringify({ message: 'No jobs to process' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log(`✅ Claimed ${jobs.length} jobs`);

  // Process each job
  const results = [];
  for (const job of jobs) {
    try {
      console.log(`🚀 Processing job ${job.id} (attempt ${job.attempts}/${job.max_attempts})`);

      let result;
      if (job.job_type === 'extract_biomarkers') {
        result = await processBiomarkerExtraction(job.payload);
      } else {
        throw new Error(`Unknown job type: ${job.job_type}`);
      }

      // Mark as completed
      await supabase
        .from('job_queue')
        .update({
          status: 'completed',
          result,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      console.log(`✅ Job ${job.id} completed`);
      results.push({ id: job.id, status: 'completed' });

    } catch (error: any) {
      console.error(`❌ Job ${job.id} failed:`, error);

      const status = job.attempts >= job.max_attempts ? 'failed' : 'pending';

      await supabase
        .from('job_queue')
        .update({
          status,
          error: error.message,
          claimed_by: null, // Release claim so it can be retried
          claimed_at: null
        })
        .eq('id', job.id);

      results.push({ id: job.id, status, error: error.message });
    }
  }

  return new Response(JSON.stringify({ processed: results }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

async function processBiomarkerExtraction(payload: any) {
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-biomarkers`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Biomarker extraction failed: ${errorText}`);
  }

  return await response.json();
}
```

---

## Priority 4: Observability & Monitoring (Week 4-5)

**Status**: ✅ No changes from v1.0

---

## Priority 5: Advanced Features (Week 5-6)

**Status**: ✅ No changes from v1.0

---

## Critical Fixes Summary

| Issue | v1.0 Problem | v2.0 Fix | Priority |
|-------|-------------|----------|----------|
| **Adaptive batching** | Rate limit never resets, infinite delays | Clear rate limit on success/timeout expiry | P0 🔴 |
| **Normalized types** | `_metadata` mutates `ExtractedBiomarker` | New `NormalizedBiomarker` type | P0 🔴 |
| **Non-numeric values** | "N/A" becomes `0` | Preserve original string, add `isNumeric` flag | P0 🔴 |
| **Web Worker output** | Doesn't match `ProcessedPDF` shape | Build complete `ProcessedPDF` in worker | P0 🔴 |
| **Job queue race** | Two workers can claim same job | Atomic `claim_pending_jobs()` with `FOR UPDATE SKIP LOCKED` | P0 🔴 |
| **Payload estimation** | UTF-16 `.length` overestimates | `Blob` size + base64 conversion | P1 🟡 |
| **Model verification** | Speculative model ID | Verified `claude-haiku-4-5-20251001` | P0 🔴 |

---

## Testing Checklist

### Before Deployment
- [ ] Test adaptive batching recovery after simulated 429 error
- [ ] Verify `NormalizedBiomarker` type compiles and serializes correctly
- [ ] Test non-numeric biomarker values ("N/A", "<0.1", "Pending")
- [ ] Verify Web Worker output matches `ProcessedPDF` interface
- [ ] Test job queue under concurrent load (2+ workers)
- [ ] Verify payload size estimation vs actual bytes sent
- [ ] Confirm Claude model ID works in production

### After Deployment
- [ ] Monitor rate limit recovery in production logs
- [ ] Track normalization confidence scores
- [ ] Measure Web Worker performance improvement
- [ ] Monitor job queue claim conflicts (should be 0)
- [ ] Track payload size accuracy

---

## Questions for Final Review

1. **Normalization strategy**: Should we save both raw and normalized biomarkers to the database, or only normalized?
2. **Web Worker fallback**: If OffscreenCanvas isn't supported, should we fall back to main thread or reject the file?
3. **Job queue cron**: How often should we invoke the job-worker function? (every 30s, 1min, 5min?)
4. **Rate limit logging**: Should we send rate limit events to external monitoring (Sentry, DataDog)?
5. **Type migration**: How do we handle existing analyses with the old biomarker format?

---

**Document Version**: 2.0 (REVISED)
**Last Updated**: 2025-11-12
**Author**: Claude (AI Assistant)
**Status**: Ready for implementation
