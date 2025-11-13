/**
 * Batch Processing Telemetry & Payload Estimation
 *
 * Tracks batch performance metrics, estimates payload sizes,
 * and provides analytics for adaptive batch processing.
 */

import type { ProcessedPDF } from './pdf-processor';

export interface BatchMetrics {
  batchId: string;
  timestamp: number;
  fileCount: number;
  totalPayloadBytes: number;
  estimatedTokens: number;
  durationMs: number;
  success: boolean;
  statusCode?: number;
  errorType?: string;
  perFileMetrics: FileMetrics[];
}

export interface FileMetrics {
  fileName: string;
  textBytes: number;
  imageBytes: number;
  totalBytes: number;
  estimatedTokens: number;
  biomarkerCount?: number;
  wasIgnored?: boolean;
  ignoreReason?: string;
}

export interface PayloadEstimate {
  totalBytes: number;
  estimatedTokens: number;
  hasImages: boolean;
  largestFileBytes: number;
  largestFileName: string;
  exceedsLimit: boolean;
  limitType?: 'payload' | 'tokens' | 'none';
}

// Limits based on Claude API and Edge Function constraints
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10 MB for reasonable processing times
const MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file (matches upload limit)
const MAX_ESTIMATED_TOKENS = 75000; // Leave headroom under 200k context

// Rough token estimation constants
const CHARS_PER_TOKEN = 4; // Conservative estimate for text
const IMAGE_BASE_TOKENS = 1500; // Base tokens for image processing overhead
const IMAGE_TOKEN_PER_KB = 10; // Additional tokens per KB of image data

/**
 * Estimate payload size and token count for a batch of PDFs
 */
export function estimatePayload(pdfs: ProcessedPDF[]): PayloadEstimate {
  let totalBytes = 0;
  let estimatedTokens = 0;
  let hasImages = false;
  let largestFileBytes = 0;
  let largestFileName = '';

  for (const pdf of pdfs) {
    const fileMetrics = calculateFileMetrics(pdf);
    totalBytes += fileMetrics.totalBytes;
    estimatedTokens += fileMetrics.estimatedTokens;

    if (fileMetrics.imageBytes > 0) {
      hasImages = true;
    }

    if (fileMetrics.totalBytes > largestFileBytes) {
      largestFileBytes = fileMetrics.totalBytes;
      largestFileName = pdf.fileName;
    }
  }

  // Add JSON overhead (metadata, structure)
  const jsonOverhead = pdfs.length * 500; // ~500 bytes per file for metadata
  totalBytes += jsonOverhead;

  let exceedsLimit = false;
  let limitType: 'payload' | 'tokens' | 'none' = 'none';

  if (totalBytes > MAX_PAYLOAD_BYTES) {
    exceedsLimit = true;
    limitType = 'payload';
  } else if (estimatedTokens > MAX_ESTIMATED_TOKENS) {
    exceedsLimit = true;
    limitType = 'tokens';
  }

  return {
    totalBytes,
    estimatedTokens,
    hasImages,
    largestFileBytes,
    largestFileName,
    exceedsLimit,
    limitType
  };
}

/**
 * Calculate metrics for a single file
 */
export function calculateFileMetrics(pdf: ProcessedPDF): FileMetrics {
  const textBytes = new Blob([pdf.extractedText]).size;
  let imageBytes = 0;

  // Calculate image data size
  if (pdf.imageData) {
    // Single image: base64 string length * 0.75 to get original bytes
    imageBytes = Math.ceil((pdf.imageData.length * 3) / 4);
  } else if (pdf.imagePages && pdf.imagePages.length > 0) {
    // Multiple images: sum all pages
    for (const page of pdf.imagePages) {
      imageBytes += Math.ceil((page.length * 3) / 4);
    }
  }

  const totalBytes = textBytes + imageBytes;

  // Estimate tokens
  let estimatedTokens = Math.ceil(pdf.extractedText.length / CHARS_PER_TOKEN);

  if (imageBytes > 0) {
    // Images use significantly more tokens
    const imageKB = imageBytes / 1024;
    const imageTokens = IMAGE_BASE_TOKENS + (imageKB * IMAGE_TOKEN_PER_KB);
    estimatedTokens += Math.ceil(imageTokens);
  }

  return {
    fileName: pdf.fileName,
    textBytes,
    imageBytes,
    totalBytes,
    estimatedTokens
  };
}

/**
 * Check if a single file exceeds safe limits
 */
export function isFileTooLarge(pdf: ProcessedPDF): { tooLarge: boolean; reason?: string } {
  const metrics = calculateFileMetrics(pdf);

  if (metrics.totalBytes > MAX_SINGLE_FILE_BYTES) {
    return {
      tooLarge: true,
      reason: `File size ${(metrics.totalBytes / 1024 / 1024).toFixed(1)} MB exceeds ${MAX_SINGLE_FILE_BYTES / 1024 / 1024} MB limit`
    };
  }

  if (metrics.estimatedTokens > MAX_ESTIMATED_TOKENS) {
    return {
      tooLarge: true,
      reason: `Estimated ${metrics.estimatedTokens} tokens exceeds ${MAX_ESTIMATED_TOKENS} token limit`
    };
  }

  return { tooLarge: false };
}

/**
 * Storage for batch metrics (in-memory, persists during session)
 */
class TelemetryStore {
  private metrics: BatchMetrics[] = [];
  private maxStoredMetrics = 100; // Keep last 100 batches

  add(metric: BatchMetrics) {
    this.metrics.push(metric);
    // Keep only recent metrics
    if (this.metrics.length > this.maxStoredMetrics) {
      this.metrics = this.metrics.slice(-this.maxStoredMetrics);
    }
  }

  getRecent(count: number = 20): BatchMetrics[] {
    return this.metrics.slice(-count);
  }

  getAll(): BatchMetrics[] {
    return [...this.metrics];
  }

  clear() {
    this.metrics = [];
  }

  // Analytics helpers
  getAverageDuration(): number {
    if (this.metrics.length === 0) return 0;
    const total = this.metrics.reduce((sum, m) => sum + m.durationMs, 0);
    return Math.round(total / this.metrics.length);
  }

  getSuccessRate(): number {
    if (this.metrics.length === 0) return 0;
    const successful = this.metrics.filter(m => m.success).length;
    return Math.round((successful / this.metrics.length) * 100);
  }

  getAveragePayloadSize(): number {
    if (this.metrics.length === 0) return 0;
    const total = this.metrics.reduce((sum, m) => sum + m.totalPayloadBytes, 0);
    return Math.round(total / this.metrics.length);
  }

  getTimeoutCount(): number {
    return this.metrics.filter(m =>
      !m.success && (
        m.errorType === 'timeout' ||
        m.statusCode === 504
      )
    ).length;
  }

  getRateLimitCount(): number {
    return this.metrics.filter(m => m.statusCode === 429).length;
  }
}

// Singleton instance
export const telemetryStore = new TelemetryStore();

/**
 * Log batch metrics
 */
export function logBatchMetrics(
  batchId: string,
  pdfs: ProcessedPDF[],
  durationMs: number,
  success: boolean,
  statusCode?: number,
  errorType?: string
) {
  const perFileMetrics = pdfs.map(calculateFileMetrics);
  const totalPayloadBytes = perFileMetrics.reduce((sum, m) => sum + m.totalBytes, 0);
  const estimatedTokens = perFileMetrics.reduce((sum, m) => sum + m.estimatedTokens, 0);

  const metrics: BatchMetrics = {
    batchId,
    timestamp: Date.now(),
    fileCount: pdfs.length,
    totalPayloadBytes,
    estimatedTokens,
    durationMs,
    success,
    statusCode,
    errorType,
    perFileMetrics
  };

  telemetryStore.add(metrics);

  // Console logging
  console.log(`📊 Batch Metrics [${batchId}]`);
  console.log(`├─ Files: ${pdfs.length}`);
  console.log(`├─ Payload: ${(totalPayloadBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`├─ Est. Tokens: ${estimatedTokens.toLocaleString()}`);
  console.log(`├─ Duration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`└─ Status: ${success ? '✅ Success' : `❌ Failed (${errorType || statusCode || 'unknown'})`}`);
}

/**
 * Generate a unique batch ID
 */
export function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
