import { supabase } from './supabase';
import { telemetryStore, type BatchMetrics } from './batch-telemetry';

/**
 * Get low-confidence biomarker normalizations from stored analyses
 * Helps identify which biomarker names need aliases added to the taxonomy
 */
export async function getLowConfidenceNormalizations(
  minConfidence: number = 0.5,
  limit: number = 100
) {
  if (!supabase) {
    console.warn('Supabase not configured - cannot fetch normalizations');
    return null;
  }

  try {
    // Get all analyses with their results
    const { data: analyses, error } = await supabase
      .from('analyses')
      .select('results')
      .limit(1000);

    if (error) {
      console.error('Failed to fetch analyses:', error);
      return null;
    }

    if (!analyses) return null;

    // Extract low-confidence normalizations from JSON
    const lowConfidence: Array<{
      originalName: string;
      canonicalName: string;
      confidence: number;
    }> = [];

    for (const analysis of analyses) {
      const results = analysis.results as any[];
      if (!Array.isArray(results)) continue;

      for (const result of results) {
        // Check if this result has normalization metadata
        if (result._normalization && result._normalization.confidence !== undefined) {
          if (result._normalization.confidence < minConfidence) {
            lowConfidence.push({
              originalName: result._normalization.originalName || result.biomarkerName,
              canonicalName: result.biomarkerName,
              confidence: result._normalization.confidence
            });
          }
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

    // Convert to array and sort by count (most common first)
    const result = Object.values(grouped).sort(
      (a: any, b: any) => b.count - a.count
    );

    console.log(`📊 Found ${result.length} unique low-confidence normalizations`);
    return result.slice(0, limit);
  } catch (error) {
    console.error('Error fetching low-confidence normalizations:', error);
    return null;
  }
}

/**
 * Get normalization statistics across all analyses
 */
export async function getNormalizationStats() {
  if (!supabase) return null;

  try {
    const { data: analyses } = await supabase
      .from('analyses')
      .select('results')
      .limit(1000);

    if (!analyses) return null;

    let totalBiomarkers = 0;
    let normalizedCount = 0;
    let lowConfidenceCount = 0;
    let unitConversionsCount = 0;
    let nonNumericCount = 0;

    for (const analysis of analyses) {
      const results = analysis.results as any[];
      if (!Array.isArray(results)) continue;

      for (const result of results) {
        totalBiomarkers++;

        if (result._normalization) {
          normalizedCount++;

          if (result._normalization.confidence < 0.5) {
            lowConfidenceCount++;
          }

          if (result._normalization.conversionApplied) {
            unitConversionsCount++;
          }

          if (result._normalization.isNumeric === false) {
            nonNumericCount++;
          }
        }
      }
    }

    return {
      totalBiomarkers,
      normalizedCount,
      normalizedPercentage: totalBiomarkers > 0
        ? (normalizedCount / totalBiomarkers * 100).toFixed(1)
        : '0',
      lowConfidenceCount,
      lowConfidencePercentage: normalizedCount > 0
        ? (lowConfidenceCount / normalizedCount * 100).toFixed(1)
        : '0',
      unitConversionsCount,
      nonNumericCount
    };
  } catch (error) {
    console.error('Error fetching normalization stats:', error);
    return null;
  }
}

/**
 * Get analyses with normalization metadata for a specific client
 */
export async function getClientNormalizationDetails(clientId: string) {
  if (!supabase) return null;

  try {
    const { data: analyses } = await supabase
      .from('analyses')
      .select('*')
      .eq('client_id', clientId)
      .order('analysis_date', { ascending: false });

    if (!analyses) return null;

    return analyses.map(analysis => {
      const results = analysis.results as any[];
      if (!Array.isArray(results)) return { ...analysis, normalizationSummary: null };

      let normalized = 0;
      let lowConfidence = 0;
      let conversions = 0;

      for (const result of results) {
        if (result._normalization) {
          normalized++;
          if (result._normalization.confidence < 0.5) lowConfidence++;
          if (result._normalization.conversionApplied) conversions++;
        }
      }

      return {
        ...analysis,
        normalizationSummary: {
          total: results.length,
          normalized,
          lowConfidence,
          conversions
        }
      };
    });
  } catch (error) {
    console.error('Error fetching client normalization details:', error);
    return null;
  }
}

/**
 * Get batch processing telemetry for performance monitoring
 */
export function getBatchTelemetry(recentCount: number = 20): BatchMetrics[] {
  return telemetryStore.getRecent(recentCount);
}

/**
 * Get batch processing statistics
 */
export function getBatchStats() {
  return {
    averageDurationMs: telemetryStore.getAverageDuration(),
    successRate: telemetryStore.getSuccessRate(),
    averagePayloadBytes: telemetryStore.getAveragePayloadSize(),
    timeoutCount: telemetryStore.getTimeoutCount(),
    rateLimitCount: telemetryStore.getRateLimitCount(),
    totalBatches: telemetryStore.getAll().length
  };
}

/**
 * Log telemetry summary to console
 */
export function logTelemetrySummary() {
  const stats = getBatchStats();
  const recent = telemetryStore.getRecent(10);

  console.group('📊 Batch Processing Telemetry');
  console.log(`Total Batches: ${stats.totalBatches}`);
  console.log(`Success Rate: ${stats.successRate}%`);
  console.log(`Avg Duration: ${(stats.averageDurationMs / 1000).toFixed(1)}s`);
  console.log(`Avg Payload: ${(stats.averagePayloadBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Timeouts: ${stats.timeoutCount}`);
  console.log(`Rate Limits: ${stats.rateLimitCount}`);

  if (recent.length > 0) {
    console.groupCollapsed(`Recent ${recent.length} batches:`);
    console.table(recent.map(m => ({
      id: m.batchId.substring(0, 12) + '...',
      files: m.fileCount,
      sizeMB: (m.totalPayloadBytes / 1024 / 1024).toFixed(2),
      tokens: m.estimatedTokens.toLocaleString(),
      durationS: (m.durationMs / 1000).toFixed(1),
      status: m.success ? '✅' : '❌',
      error: m.errorType || '-'
    })));
    console.groupEnd();
  }

  console.groupEnd();
}
