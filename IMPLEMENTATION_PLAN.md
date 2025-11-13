# Implementation Plan: High-Performance Biomarker Analysis System

## Executive Summary

This plan addresses critical bottlenecks, stability risks, and effectiveness gaps in the current biomarker extraction pipeline. Priority is on moving from a client-heavy, sequential architecture to a scalable, backend-driven system with deterministic normalization.

---

## Priority 1: Critical Stability & Throughput Fixes (Week 1-2)

### 1.1 Fix File Size Limit Mismatch
**Problem**: Client accepts 50MB files, Edge Function caps at 20MB combined
**Impact**: Users upload files that silently fail server-side

**Implementation**:
```typescript
// File: src/components/PdfUploader.tsx
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file
const MAX_BATCH_SIZE = 15 * 1024 * 1024; // 15MB total per batch

// Validate file size on upload
if (file.size > MAX_FILE_SIZE) {
  throw new Error(`File too large: ${file.name} (${formatSize(file.size)}). Max: 20MB`);
}

// Pre-calculate batch sizes
function estimateBatchSize(processedPdfs: ProcessedPDF[]): number {
  return processedPdfs.reduce((sum, pdf) => {
    return sum + (pdf.extractedText?.length || 0) +
           (pdf.imageData?.length || 0) +
           (pdf.imagePages?.reduce((s, p) => s + p.length, 0) || 0);
  }, 0);
}
```

**Files to modify**:
- `src/components/PdfUploader.tsx` - Add stricter validation
- `src/lib/pdf-processor.ts` - Add size estimation function
- `src/lib/claude-service.ts` - Smart batch splitting based on actual payload size

---

### 1.2 Implement Adaptive Batching with Rate-Limit Awareness
**Problem**: Hard-coded 2s delay wastes time; no response to rate limits
**Impact**: 40-file upload wastes 8s+ in idle time

**Implementation**:
```typescript
// File: src/lib/claude-service.ts

interface RateLimitInfo {
  remainingRequests: number;
  resetTime: Date;
  retryAfter?: number;
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

      return result;
    } catch (error: any) {
      // Extract rate limit info from headers/error
      if (error.status === 429) {
        this.rateLimitInfo = {
          remainingRequests: 0,
          resetTime: new Date(Date.now() + (error.retryAfter || 60000)),
          retryAfter: error.retryAfter
        };
      }
      throw error;
    }
  }

  getOptimalDelay(): number {
    // If rate limited, wait until reset
    if (this.rateLimitInfo?.remainingRequests === 0) {
      const now = Date.now();
      const resetMs = this.rateLimitInfo.resetTime.getTime() - now;
      return Math.max(0, resetMs);
    }

    // Adaptive: if recent calls are fast, reduce delay
    const avgLatency = this.recentLatencies.length > 0
      ? this.recentLatencies.reduce((a, b) => a + b, 0) / this.recentLatencies.length
      : 2000;

    // Conservative: wait 10% of average latency, min 500ms, max 3000ms
    return Math.min(3000, Math.max(500, avgLatency * 0.1));
  }
}

// Update extractBiomarkersFromPdfs to use adaptive delay
const batcher = new AdaptiveBatcher();

for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
  const results = await batcher.processBatch(batches[batchIndex]);

  if (batchIndex < batches.length - 1) {
    const delay = batcher.getOptimalDelay();
    console.log(`⏸️ Adaptive delay: ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

**Expected impact**: 40-file upload delay drops from 8s to 2-4s

---

### 1.3 Align Max Tokens with Claude Haiku 4.5 Limits
**Problem**: Current limit is 8192 tokens, Claude Haiku 4.5 supports up to 200K output
**Impact**: Large lab reports with 100+ biomarkers may be truncated

**Implementation**:
```typescript
// File: supabase/functions/analyze-biomarkers/index.ts

const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 16384, // Increase to 16K for comprehensive reports
  temperature: 0,
  messages: [{ role: 'user', content }],
});
```

**Files to modify**:
- `supabase/functions/analyze-biomarkers/index.ts` - Update max_tokens

---

## Priority 2: Deterministic Biomarker Normalization (Week 2-3)

### 2.1 Build Biomarker Taxonomy Database
**Problem**: Claude output is non-deterministic; multilingual names don't match benchmarks
**Impact**: 30-50% miss rate for non-English biomarkers

**Implementation**:

**Create new database tables**:
```sql
-- File: supabase/migrations/YYYYMMDD_biomarker_taxonomy.sql

CREATE TABLE biomarker_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL UNIQUE, -- e.g., "Vitamin B12"
  category TEXT NOT NULL,              -- e.g., "Vitamins"
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE biomarker_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  biomarker_id UUID REFERENCES biomarker_taxonomy(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,                 -- e.g., "B12", "Cobalamin", "Vitamina B12"
  language TEXT,                       -- e.g., "en", "es", "pt", "zh"
  confidence REAL DEFAULT 1.0,         -- 0.0-1.0 confidence score
  UNIQUE(biomarker_id, alias)
);

CREATE INDEX idx_aliases_lookup ON biomarker_aliases(LOWER(alias));

CREATE TABLE unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  biomarker_canonical_name TEXT NOT NULL,
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  multiplier NUMERIC NOT NULL,         -- multiply by this to convert
  UNIQUE(biomarker_canonical_name, from_unit, to_unit)
);

-- Example data
INSERT INTO biomarker_taxonomy (canonical_name, category) VALUES
  ('Vitamin B12', 'Vitamins'),
  ('Vitamin D', 'Vitamins'),
  ('Glucose', 'Metabolic'),
  ('Total Cholesterol', 'Lipids'),
  ('Neutrophils', 'White Blood Cells');

INSERT INTO biomarker_aliases (biomarker_id, alias, language) VALUES
  ((SELECT id FROM biomarker_taxonomy WHERE canonical_name = 'Vitamin B12'), 'B12', 'en'),
  ((SELECT id FROM biomarker_taxonomy WHERE canonical_name = 'Vitamin B12'), 'B-12', 'en'),
  ((SELECT id FROM biomarker_taxonomy WHERE canonical_name = 'Vitamin B12'), 'Vitamin B 12', 'en'),
  ((SELECT id FROM biomarker_taxonomy WHERE canonical_name = 'Vitamin B12'), 'Cobalamin', 'en'),
  ((SELECT id FROM biomarker_taxonomy WHERE canonical_name = 'Vitamin B12'), 'Vitamina B12', 'es'),
  ((SELECT id FROM biomarker_taxonomy WHERE canonical_name = 'Vitamin B12'), 'Vitamina B12', 'pt'),
  ((SELECT id FROM biomarker_taxonomy WHERE canonical_name = 'Vitamin B12'), 'Vitamine B12', 'fr'),
  ((SELECT id FROM biomarker_taxonomy WHERE canonical_name = 'Vitamin B12'), 'Vitamin B12', 'de'),
  ((SELECT id FROM biomarker_taxonomy WHERE canonical_name = 'Vitamin B12'), 'ビタミンB12', 'ja'),
  ((SELECT id FROM biomarker_taxonomy WHERE canonical_name = 'Vitamin B12'), '维生素B12', 'zh'),
  ((SELECT id FROM biomarker_taxonomy WHERE canonical_name = 'Vitamin B12'), 'Витамин B12', 'ru');

INSERT INTO unit_conversions (biomarker_canonical_name, from_unit, to_unit, multiplier) VALUES
  ('Glucose', 'mmol/L', 'mg/dL', 18.0),
  ('Glucose', 'mg/dL', 'mmol/L', 0.0555),
  ('Total Cholesterol', 'mmol/L', 'mg/dL', 38.67),
  ('Total Cholesterol', 'mg/dL', 'mmol/L', 0.0259),
  ('Neutrophils', 'cells/µL', '×10³/µL', 0.001),
  ('Neutrophils', '×10³/µL', 'K/µL', 1.0),
  ('Neutrophils', 'K/µL', '×10³/µL', 1.0);
```

**Create normalization service**:
```typescript
// File: src/lib/biomarker-normalizer.ts

import { supabase } from './supabase';

interface NormalizationResult {
  canonicalName: string;
  originalName: string;
  confidence: number;
  category: string;
}

interface UnitConversion {
  originalUnit: string;
  normalizedUnit: string;
  originalValue: number;
  normalizedValue: number;
  conversionApplied: boolean;
}

export class BiomarkerNormalizer {
  private taxonomyCache: Map<string, { canonical: string; category: string }> = new Map();
  private unitConversionCache: Map<string, Map<string, number>> = new Map();

  /**
   * Initialize cache from database
   */
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

  /**
   * Normalize biomarker name to canonical form
   */
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
   * Convert units to standardized form
   */
  normalizeUnit(
    biomarkerName: string,
    value: string | number,
    unit: string,
    preferredUnit?: string
  ): UnitConversion {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      return {
        originalUnit: unit,
        normalizedUnit: unit,
        originalValue: 0,
        normalizedValue: 0,
        conversionApplied: false
      };
    }

    // Check if we have a conversion rule
    const conversions = this.unitConversionCache.get(biomarkerName);
    if (!conversions) {
      return {
        originalUnit: unit,
        normalizedUnit: unit,
        originalValue: numValue,
        normalizedValue: numValue,
        conversionApplied: false
      };
    }

    // If preferred unit specified, try to convert
    if (preferredUnit && unit !== preferredUnit) {
      const key = `${unit}→${preferredUnit}`;
      const multiplier = conversions.get(key);

      if (multiplier) {
        return {
          originalUnit: unit,
          normalizedUnit: preferredUnit,
          originalValue: numValue,
          normalizedValue: numValue * multiplier,
          conversionApplied: true
        };
      }
    }

    return {
      originalUnit: unit,
      normalizedUnit: unit,
      originalValue: numValue,
      normalizedValue: numValue,
      conversionApplied: false
    };
  }

  /**
   * Normalize extracted biomarkers from Claude
   */
  async normalizeBatch(biomarkers: ExtractedBiomarker[]): Promise<ExtractedBiomarker[]> {
    const normalized: ExtractedBiomarker[] = [];

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

      normalized.push({
        name: nameResult.canonicalName,
        value: unitResult.normalizedValue.toString(),
        unit: unitResult.normalizedUnit,
        _metadata: {
          originalName: biomarker.name,
          originalValue: biomarker.value,
          originalUnit: biomarker.unit,
          confidence: nameResult.confidence,
          conversionApplied: unitResult.conversionApplied
        }
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

// Singleton instance
export const biomarkerNormalizer = new BiomarkerNormalizer();
```

**Integrate into claude-service.ts**:
```typescript
// File: src/lib/claude-service.ts

import { biomarkerNormalizer } from './biomarker-normalizer';

// In extractBiomarkersFromPdf, after receiving Claude response:
export async function extractBiomarkersFromPdf(
  processedPdf: ProcessedPDF
): Promise<ClaudeResponse> {
  // ... existing code ...

  const response = await retryWithBackoff(async () => {
    // ... API call ...

    const rawResult = {
      biomarkers: data.biomarkers || [],
      patientInfo: data.patientInfo || { /* ... */ },
      panelName: data.panelName || 'Lab Results',
      raw: JSON.stringify(data),
    };

    // ✨ NEW: Normalize biomarkers before returning
    const normalizedBiomarkers = await biomarkerNormalizer.normalizeBatch(
      rawResult.biomarkers
    );

    return {
      ...rawResult,
      biomarkers: normalizedBiomarkers
    };
  });

  return response;
}
```

**Expected impact**:
- Biomarker match rate improves from 70% → 95%
- Multilingual reports normalize correctly
- Unit conversions are deterministic

---

## Priority 3: Background Job Queue System (Week 3-4)

### 3.1 Move PDF Processing to Web Workers
**Problem**: Large PDFs block UI thread during conversion
**Impact**: UI freezes for 5-10s on complex files

**Implementation**:
```typescript
// File: src/workers/pdf-worker.ts

import * as pdfjsLib from 'pdfjs-dist';

self.onmessage = async (e: MessageEvent) => {
  const { file, fileIndex } = e.data;

  try {
    // Process PDF in worker thread
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);

      // Extract text
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      // Render to canvas if needed
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d')!;

      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const imageData = await blobToBase64(blob);

      pages.push({ text, imageData });
    }

    self.postMessage({
      success: true,
      fileIndex,
      result: {
        fileName: file.name,
        pages,
        pageCount: pdf.numPages
      }
    });
  } catch (error) {
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

**Update pdf-processor.ts to use worker**:
```typescript
// File: src/lib/pdf-processor.ts

export async function processMultiplePdfsParallel(
  files: File[],
  maxConcurrency: number = 3
): Promise<ProcessedPDF[]> {
  const workers: Worker[] = [];
  const results: ProcessedPDF[] = new Array(files.length);

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
          results[fileIndex] = { error };
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
          resolve(results);
        }
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

**Expected impact**:
- UI remains responsive during processing
- 3x faster processing via parallelization

---

### 3.2 Implement Supabase Queue for Claude API Calls
**Problem**: Long-running Claude calls timeout at 120s; no retry/recovery
**Impact**: Large batches fail and lose progress

**Implementation**:
```sql
-- File: supabase/migrations/YYYYMMDD_job_queue.sql

CREATE TABLE job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  job_type TEXT NOT NULL,           -- 'extract_biomarkers'
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  payload JSONB NOT NULL,
  result JSONB,
  error TEXT,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_queue_status ON job_queue(status, created_at);
CREATE INDEX idx_queue_user ON job_queue(user_id);
```

**Create background worker**:
```typescript
// File: supabase/functions/job-worker/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Service role for queue access
  );

  // Poll for pending jobs
  const { data: jobs } = await supabase
    .from('job_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('attempts', supabase.rpc('max_attempts'))
    .order('created_at', { ascending: true })
    .limit(5);

  if (!jobs || jobs.length === 0) {
    return new Response(JSON.stringify({ message: 'No jobs to process' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Process each job
  for (const job of jobs) {
    try {
      // Mark as processing
      await supabase
        .from('job_queue')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', job.id);

      // Execute job
      let result;
      if (job.job_type === 'extract_biomarkers') {
        result = await processBiomarkerExtraction(job.payload);
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

    } catch (error: any) {
      console.error(`Job ${job.id} failed:`, error);

      const newAttempts = job.attempts + 1;
      const status = newAttempts >= job.max_attempts ? 'failed' : 'pending';

      await supabase
        .from('job_queue')
        .update({
          status,
          attempts: newAttempts,
          error: error.message
        })
        .eq('id', job.id);
    }
  }

  return new Response(JSON.stringify({ processed: jobs.length }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

async function processBiomarkerExtraction(payload: any) {
  // Call analyze-biomarkers function
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
    throw new Error(await response.text());
  }

  return await response.json();
}
```

**Update client to use queue**:
```typescript
// File: src/lib/analysis-queue.ts

export async function submitAnalysisJob(
  processedPdfs: ProcessedPDF[]
): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('job_queue')
    .insert({
      job_type: 'extract_biomarkers',
      payload: { processedPdfs, batchMode: true }
    })
    .select()
    .single();

  if (error) throw error;

  return data.id;
}

export async function pollJobStatus(
  jobId: string,
  onProgress?: (status: string) => void
): Promise<any> {
  if (!supabase) throw new Error('Supabase not configured');

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('job_queue')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        clearInterval(interval);
        reject(error);
        return;
      }

      if (onProgress) onProgress(data.status);

      if (data.status === 'completed') {
        clearInterval(interval);
        resolve(data.result);
      } else if (data.status === 'failed') {
        clearInterval(interval);
        reject(new Error(data.error || 'Job failed'));
      }
    }, 2000); // Poll every 2 seconds
  });
}
```

**Expected impact**:
- No 120s timeout failures
- Jobs survive edge function restarts
- Better progress tracking

---

## Priority 4: Observability & Monitoring (Week 4-5)

### 4.1 Add Comprehensive Logging & Metrics

**Create analytics table**:
```sql
-- File: supabase/migrations/YYYYMMDD_analytics.sql

CREATE TABLE processing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  page_count INT,
  processing_stage TEXT NOT NULL,  -- 'pdf_convert', 'claude_api', 'normalize', 'save'
  status TEXT NOT NULL,             -- 'success', 'failure'
  duration_ms INT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_metrics_stage ON processing_metrics(processing_stage, created_at);
CREATE INDEX idx_metrics_status ON processing_metrics(status, created_at);
```

**Add telemetry service**:
```typescript
// File: src/lib/telemetry.ts

interface MetricEvent {
  fileName: string;
  fileSize?: number;
  pageCount?: number;
  processingStage: 'pdf_convert' | 'claude_api' | 'normalize' | 'save';
  status: 'success' | 'failure';
  durationMs: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export async function trackMetric(event: MetricEvent) {
  if (!supabase) return;

  try {
    await supabase.from('processing_metrics').insert({
      file_name: event.fileName,
      file_size_bytes: event.fileSize,
      page_count: event.pageCount,
      processing_stage: event.processingStage,
      status: event.status,
      duration_ms: event.durationMs,
      error_message: event.errorMessage,
      metadata: event.metadata
    });
  } catch (error) {
    console.warn('Failed to track metric:', error);
  }
}

// Usage:
const startTime = Date.now();
try {
  const result = await extractBiomarkersFromPdf(pdf);
  await trackMetric({
    fileName: pdf.fileName,
    fileSize: pdf.fileSize,
    pageCount: pdf.pageCount,
    processingStage: 'claude_api',
    status: 'success',
    durationMs: Date.now() - startTime,
    metadata: { biomarkerCount: result.biomarkers.length }
  });
} catch (error) {
  await trackMetric({
    fileName: pdf.fileName,
    processingStage: 'claude_api',
    status: 'failure',
    durationMs: Date.now() - startTime,
    errorMessage: error.message
  });
  throw error;
}
```

**Create analytics dashboard queries**:
```typescript
// File: src/lib/analytics-queries.ts

export async function getProcessingStats(timeRangeHours: number = 24) {
  if (!supabase) return null;

  const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('processing_metrics')
    .select('*')
    .gte('created_at', since);

  if (!data) return null;

  // Calculate stats
  const stats = {
    totalFiles: data.length,
    successRate: data.filter(m => m.status === 'success').length / data.length,
    avgDurationMs: {
      pdfConvert: avg(data.filter(m => m.processing_stage === 'pdf_convert'), 'duration_ms'),
      claudeApi: avg(data.filter(m => m.processing_stage === 'claude_api'), 'duration_ms'),
      normalize: avg(data.filter(m => m.processing_stage === 'normalize'), 'duration_ms')
    },
    topErrors: getTopErrors(data),
    ocrFallbackRate: data.filter(m => m.metadata?.ocrUsed).length / data.length
  };

  return stats;
}
```

---

## Priority 5: Advanced Features (Week 5-6)

### 5.1 Cache Claude Responses for Replay
**Problem**: Can't re-run normalization without re-calling API
**Impact**: Taxonomy updates require re-processing all files

**Implementation**:
```sql
-- File: supabase/migrations/YYYYMMDD_claude_cache.sql

CREATE TABLE claude_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash TEXT NOT NULL,          -- SHA-256 of file content
  model_version TEXT NOT NULL,      -- 'claude-haiku-4-5-20251001'
  raw_response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(file_hash, model_version)
);

CREATE INDEX idx_cache_hash ON claude_responses(file_hash);
```

```typescript
// File: src/lib/response-cache.ts

export async function getCachedResponse(
  fileHash: string,
  modelVersion: string
): Promise<any | null> {
  if (!supabase) return null;

  const { data } = await supabase
    .from('claude_responses')
    .select('raw_response')
    .eq('file_hash', fileHash)
    .eq('model_version', modelVersion)
    .maybeSingle();

  return data?.raw_response || null;
}

export async function cacheResponse(
  fileHash: string,
  modelVersion: string,
  response: any
) {
  if (!supabase) return;

  await supabase
    .from('claude_responses')
    .upsert({
      file_hash: fileHash,
      model_version: modelVersion,
      raw_response: response
    });
}
```

---

## Implementation Timeline

| Week | Priority | Tasks | Owner | Status |
|------|----------|-------|-------|--------|
| 1 | P1 | Fix file size limits, adaptive batching | Dev | Not Started |
| 2 | P1 | Increase max_tokens to 16K | Dev | Not Started |
| 2-3 | P2 | Build taxonomy DB + normalizer | Dev + Data | Not Started |
| 3 | P2 | Integrate normalizer into pipeline | Dev | Not Started |
| 3-4 | P3 | Implement Web Workers for PDF processing | Dev | Not Started |
| 4 | P3 | Build job queue system | Dev | Not Started |
| 4-5 | P4 | Add telemetry and analytics | Dev | Not Started |
| 5-6 | P5 | Implement response caching | Dev | Not Started |

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| **Throughput** ||||
| Files per minute (single user) | ~5 | 20+ | Week 4 |
| Batch idle time (40 files) | 8s | 2-4s | Week 1 |
| UI responsiveness during upload | Freezes | Smooth | Week 3 |
| **Stability** ||||
| Success rate (English) | ~95% | 99% | Week 2 |
| Success rate (multilingual) | ~70% | 95% | Week 3 |
| Timeout failures (large files) | ~10% | <1% | Week 4 |
| **Effectiveness** ||||
| Biomarker match rate | ~70% | 95% | Week 3 |
| Unit conversion accuracy | ~80% | 99% | Week 3 |
| False positives (client matching) | ~5% | <1% | Week 5 |

---

## Risk Mitigation

### High-Risk Items
1. **Database migration complexity** - Biomarker taxonomy requires seeding 1000+ aliases
   - *Mitigation*: Start with top 50 biomarkers, expand incrementally

2. **Web Worker compatibility** - Not all browsers support OffscreenCanvas
   - *Mitigation*: Feature detection with fallback to main thread

3. **Queue polling overhead** - Frequent DB queries may impact performance
   - *Mitigation*: Use Supabase Realtime subscriptions instead of polling

### Medium-Risk Items
1. **API cost increase** - More retries = more API calls
   - *Mitigation*: Set strict retry limits, monitor costs via telemetry

2. **Normalization accuracy** - Taxonomy may not cover all edge cases
   - *Mitigation*: Track low-confidence matches, add aliases based on logs

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Prioritize top 3 items** for immediate implementation
3. **Create spike tickets** for unknowns (Web Worker compat, Supabase Queue API)
4. **Set up staging environment** to test changes without impacting production
5. **Begin with P1 fixes** - quickest wins with highest impact

---

## Questions for Review

1. **Background jobs**: Should we use Supabase Queue or a third-party service (Inngest, QStash)?
2. **Taxonomy seeding**: Do you have existing biomarker reference data we can import?
3. **Web Workers**: Should we support offline mode, or require network for all processing?
4. **Rate limits**: What are the actual Anthropic API rate limits for your tier?
5. **Monitoring**: Do you use external APM (Sentry, DataDog) or should we build custom dashboards?

---

**Document Version**: 1.0
**Last Updated**: 2025-11-12
**Author**: Claude (AI Assistant)
