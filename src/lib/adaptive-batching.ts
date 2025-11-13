/**
 * Adaptive Batch Splitter
 *
 * Intelligently splits files into batches based on:
 * - Payload size (bytes)
 * - Estimated token count
 * - File count limits
 *
 * Uses weighted scoring to handle mixed text/image documents.
 */

import type { ProcessedPDF } from './pdf-processor';
import { calculateFileMetrics, type FileMetrics } from './batch-telemetry';

export interface BatchConfig {
  maxFiles: number;           // Max files per batch
  maxPayloadMB: number;        // Max total payload in MB
  maxEstimatedTokens: number;  // Max estimated tokens
}

export interface ScoredFile {
  pdf: ProcessedPDF;
  metrics: FileMetrics;
  score: number;  // Weighted score for batching decisions
}

export interface AdaptiveBatch {
  files: ProcessedPDF[];
  totalBytes: number;
  estimatedTokens: number;
  fileCount: number;
  batchType: 'text-heavy' | 'image-heavy' | 'mixed';
}

// Default configuration
const DEFAULT_CONFIG: BatchConfig = {
  maxFiles: 10,
  maxPayloadMB: 12,  // 12 MB safe limit (below 15 MB hard limit)
  maxEstimatedTokens: 75000
};

// Config for image-heavy batches (Vision API is fast, so we can handle many in parallel)
const IMAGE_HEAVY_CONFIG: BatchConfig = {
  maxFiles: 50,  // Process many images in parallel - Vision API handles this well
  maxPayloadMB: 15,  // Increased - single images are small
  maxEstimatedTokens: 100000
};

/**
 * Calculate weighted score for a file (used for sorting and batching)
 * Higher score = more resource-intensive
 */
function calculateFileScore(metrics: FileMetrics): number {
  // Weight: 1.0 for text, 0.75 for images (images compress better in practice)
  const score = metrics.textBytes + (metrics.imageBytes * 0.75);
  return score;
}

/**
 * Score and sort files by resource intensity
 */
function scoreFiles(pdfs: ProcessedPDF[]): ScoredFile[] {
  return pdfs.map(pdf => {
    const metrics = calculateFileMetrics(pdf);
    const score = calculateFileScore(metrics);
    return { pdf, metrics, score };
  }).sort((a, b) => b.score - a.score); // Largest first
}

/**
 * Determine batch type based on content
 */
function determineBatchType(files: ScoredFile[]): 'text-heavy' | 'image-heavy' | 'mixed' {
  let totalText = 0;
  let totalImage = 0;

  for (const file of files) {
    totalText += file.metrics.textBytes;
    totalImage += file.metrics.imageBytes;
  }

  const totalBytes = totalText + totalImage;
  if (totalBytes === 0) return 'text-heavy';

  const imageRatio = totalImage / totalBytes;

  if (imageRatio > 0.7) return 'image-heavy';
  if (imageRatio < 0.3) return 'text-heavy';
  return 'mixed';
}

/**
 * Split files into adaptive batches using greedy algorithm
 */
export function createAdaptiveBatches(
  pdfs: ProcessedPDF[],
  config: Partial<BatchConfig> = {}
): AdaptiveBatch[] {
  if (pdfs.length === 0) return [];

  // Detect if most files are images (use stricter limits to prevent timeouts)
  const imageCount = pdfs.filter(pdf => pdf.isImage || pdf.imagePages).length;
  const isImageHeavy = imageCount > (pdfs.length / 2);

  const baseConfig = isImageHeavy ? IMAGE_HEAVY_CONFIG : DEFAULT_CONFIG;
  const finalConfig: BatchConfig = { ...baseConfig, ...config };
  const maxPayloadBytes = finalConfig.maxPayloadMB * 1024 * 1024;

  // Score and sort files (largest first for better bin packing)
  const scoredFiles = scoreFiles(pdfs);

  const batches: AdaptiveBatch[] = [];
  let currentBatch: ScoredFile[] = [];
  let currentBytes = 0;
  let currentTokens = 0;

  for (const scoredFile of scoredFiles) {
    const fileBytes = scoredFile.metrics.totalBytes;
    const fileTokens = scoredFile.metrics.estimatedTokens;

    // Check if adding this file would exceed limits
    const wouldExceedFiles = currentBatch.length >= finalConfig.maxFiles;
    const wouldExceedBytes = (currentBytes + fileBytes) > maxPayloadBytes;
    const wouldExceedTokens = (currentTokens + fileTokens) > finalConfig.maxEstimatedTokens;

    // If adding would exceed any limit, finalize current batch and start new one
    if (currentBatch.length > 0 && (wouldExceedFiles || wouldExceedBytes || wouldExceedTokens)) {
      // Finalize current batch
      batches.push(finalizeBatch(currentBatch));

      // Start new batch
      currentBatch = [scoredFile];
      currentBytes = fileBytes;
      currentTokens = fileTokens;
    } else {
      // Add to current batch
      currentBatch.push(scoredFile);
      currentBytes += fileBytes;
      currentTokens += fileTokens;
    }
  }

  // Finalize last batch
  if (currentBatch.length > 0) {
    batches.push(finalizeBatch(currentBatch));
  }

  // Log batch summary
  console.log(`📦 Created ${batches.length} adaptive batch(es) from ${pdfs.length} file(s)`);
  batches.forEach((batch, i) => {
    console.log(`   Batch ${i + 1}: ${batch.fileCount} files, ${(batch.totalBytes / 1024 / 1024).toFixed(2)} MB, ~${batch.estimatedTokens.toLocaleString()} tokens [${batch.batchType}]`);
  });

  return batches;
}

/**
 * Finalize a batch from scored files
 */
function finalizeBatch(scoredFiles: ScoredFile[]): AdaptiveBatch {
  const files = scoredFiles.map(sf => sf.pdf);
  const totalBytes = scoredFiles.reduce((sum, sf) => sum + sf.metrics.totalBytes, 0);
  const estimatedTokens = scoredFiles.reduce((sum, sf) => sum + sf.metrics.estimatedTokens, 0);
  const batchType = determineBatchType(scoredFiles);

  return {
    files,
    totalBytes,
    estimatedTokens,
    fileCount: files.length,
    batchType
  };
}

/**
 * Calculate recommended delay between batches based on last duration
 */
export function calculateAdaptiveDelay(lastDurationMs: number): number {
  const MIN_DELAY = 500;    // 0.5 second minimum
  const MAX_DELAY = 5000;   // 5 second maximum
  const LONG_REQUEST_THRESHOLD = 90000; // 90 seconds

  // If last request took > 90 seconds, we're close to timeout - don't delay
  if (lastDurationMs > LONG_REQUEST_THRESHOLD) {
    return 0;
  }

  // Otherwise, delay 10% of last duration (prevents rate limits)
  const calculatedDelay = Math.round(lastDurationMs * 0.1);
  return Math.max(MIN_DELAY, Math.min(calculatedDelay, MAX_DELAY));
}

/**
 * Validate batch can be safely sent
 */
export function validateBatch(batch: AdaptiveBatch): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const maxSafePayload = 15 * 1024 * 1024; // 15 MB absolute limit
  const maxSafeTokens = 100000; // 100k tokens absolute limit

  if (batch.totalBytes > maxSafePayload) {
    errors.push(`Batch payload ${(batch.totalBytes / 1024 / 1024).toFixed(2)} MB exceeds 15 MB limit`);
  }

  if (batch.estimatedTokens > maxSafeTokens) {
    errors.push(`Batch estimated tokens ${batch.estimatedTokens.toLocaleString()} exceeds 100k limit`);
  }

  if (batch.fileCount === 0) {
    errors.push('Batch contains no files');
  }

  // Warnings
  if (batch.totalBytes > 12 * 1024 * 1024) {
    warnings.push('Batch payload near limit, may be slow');
  }

  if (batch.estimatedTokens > 75000) {
    warnings.push('High token count, may take longer to process');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
