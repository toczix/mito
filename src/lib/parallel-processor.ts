import type { ProcessedPDF } from './pdf-processor';
import type { ClaudeResponse } from './claude-service';

export interface ProcessingQueue {
  textBased: ProcessedPDF[];  // Good quality text -> Claude Haiku (fast)
  visionBased: ProcessedPDF[]; // Poor/no text -> Vision API (slower)
}

export interface ProcessingProgress {
  total: number;
  completed: number;
  textBased: { total: number; completed: number; processing: number };
  visionBased: { total: number; completed: number; processing: number };
  currentFile?: string;
  status: 'preparing' | 'processing' | 'completed' | 'failed';
}

export interface ProcessingResult {
  success: ClaudeResponse[];
  failed: Array<{ fileName: string; error: string }>;
  processingTime: number;
}

/**
 * Categorize files by text quality for optimal processing routing
 */
export function categorizeFiles(processedFiles: ProcessedPDF[]): ProcessingQueue {
  const queue: ProcessingQueue = {
    textBased: [],
    visionBased: []
  };

  for (const file of processedFiles) {
    if (file.textQuality === 'good' && !file.isImage) {
      queue.textBased.push(file);
    } else {
      queue.visionBased.push(file);
    }
  }

  console.log(`📊 Categorized ${processedFiles.length} files:`);
  console.log(`   - Text-based (Claude Haiku): ${queue.textBased.length}`);
  console.log(`   - Vision-based (Vision API): ${queue.visionBased.length}`);

  return queue;
}

/**
 * Process files in parallel with concurrency limits
 * - Text-based files: Higher concurrency (up to 10 parallel)
 * - Vision-based files: Limited concurrency (max 3-5 to avoid API overload)
 */
export async function processInParallel(
  queue: ProcessingQueue,
  processorFn: (file: ProcessedPDF) => Promise<ClaudeResponse>,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const results: ClaudeResponse[] = [];
  const failures: Array<{ fileName: string; error: string }> = [];

  const total = queue.textBased.length + queue.visionBased.length;
  let completed = 0;

  const progress: ProcessingProgress = {
    total,
    completed: 0,
    textBased: { total: queue.textBased.length, completed: 0, processing: 0 },
    visionBased: { total: queue.visionBased.length, completed: 0, processing: 0 },
    status: 'preparing'
  };

  // Helper to update progress
  const updateProgress = (type: 'textBased' | 'visionBased', delta: number, processing: number) => {
    progress[type].completed += delta;
    progress[type].processing = processing;
    progress.completed = progress.textBased.completed + progress.visionBased.completed;
    progress.status = progress.completed === total ? 'completed' : 'processing';
    
    if (onProgress) {
      onProgress({ ...progress });
    }
  };

  // Process with concurrency limit
  const processWithLimit = async (
    files: ProcessedPDF[],
    limit: number,
    type: 'textBased' | 'visionBased'
  ) => {
    const queue = [...files];
    const active = new Set<Promise<void>>();

    while (queue.length > 0 || active.size > 0) {
      // Fill up to limit
      while (active.size < limit && queue.length > 0) {
        const file = queue.shift()!;
        
        const task = (async () => {
          try {
            progress.currentFile = file.fileName;
            
            console.log(`🔄 [${type}] Processing: ${file.fileName}`);
            const result = await processorFn(file);
            results.push(result);
            console.log(`✅ [${type}] Completed: ${file.fileName}`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ [${type}] Failed: ${file.fileName}`, errorMsg);
            failures.push({ fileName: file.fileName, error: errorMsg });
          } finally {
            active.delete(task); // Remove from active set when done
            updateProgress(type, 1, active.size);
          }
        })();

        active.add(task);
        // Update progress after adding to show correct in-flight count
        updateProgress(type, 0, active.size);
      }

      // Wait for at least one to complete
      if (active.size > 0) {
        await Promise.race(active);
      }
    }
  };

  progress.status = 'processing';
  if (onProgress) {
    onProgress({ ...progress });
  }

  console.log('\n🚀 Starting parallel processing...');
  console.log(`   Text-based files: ${queue.textBased.length} (concurrency: 10)`);
  console.log(`   Vision-based files: ${queue.visionBased.length} (concurrency: 3)`);

  // Process both queues in parallel
  await Promise.all([
    processWithLimit(queue.textBased, 10, 'textBased'),    // Higher concurrency for fast text processing
    processWithLimit(queue.visionBased, 3, 'visionBased')  // Limited concurrency for Vision API
  ]);

  const processingTime = Date.now() - startTime;
  
  console.log('\n✅ Parallel processing complete!');
  console.log(`   Total time: ${(processingTime / 1000).toFixed(1)}s`);
  console.log(`   Successful: ${results.length}/${total}`);
  console.log(`   Failed: ${failures.length}/${total}`);
  console.log(`   Avg time per file: ${(processingTime / total / 1000).toFixed(1)}s`);

  progress.status = failures.length === total ? 'failed' : 'completed';
  if (onProgress) {
    onProgress({ ...progress });
  }

  return {
    success: results,
    failed: failures,
    processingTime
  };
}

/**
 * Calculate estimated processing time based on file categorization
 */
export function estimateProcessingTime(queue: ProcessingQueue): {
  min: number;
  max: number;
  breakdown: string;
} {
  // Text-based: ~2-3 seconds per file, up to 10 parallel
  const textTime = queue.textBased.length > 0
    ? Math.ceil(queue.textBased.length / 10) * 2.5
    : 0;

  // Vision-based: ~8-15 seconds per file, up to 3 parallel
  const visionTime = queue.visionBased.length > 0
    ? Math.ceil(queue.visionBased.length / 3) * 12
    : 0;

  // Both run in parallel, so total is the max
  const estimatedMin = Math.max(textTime * 0.8, visionTime * 0.6);
  const estimatedMax = Math.max(textTime * 1.2, visionTime * 1.4);

  const breakdown = `Text: ${textTime.toFixed(0)}s (${queue.textBased.length} files) | Vision: ${visionTime.toFixed(0)}s (${queue.visionBased.length} files)`;

  return {
    min: Math.round(estimatedMin),
    max: Math.round(estimatedMax),
    breakdown
  };
}
