import type { ExtractedBiomarker, AnalysisResult } from './biomarkers';
import { getAllBenchmarks } from './benchmark-storage';

/**
 * Normalize biomarker names for matching
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Match extracted biomarkers with optimal ranges
 */
export function matchBiomarkersWithRanges(
  extractedBiomarkers: ExtractedBiomarker[],
  gender: 'male' | 'female' = 'male'
): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  const matchedNames = new Set<string>();

  // Get all benchmarks (including custom ones)
  const benchmarks = getAllBenchmarks();

  // Create a map of extracted biomarkers by normalized name
  const extractedMap = new Map<string, ExtractedBiomarker>();
  
  for (const extracted of extractedBiomarkers) {
    const normalized = normalizeName(extracted.name);
    // Keep the most recent or first occurrence
    if (!extractedMap.has(normalized)) {
      extractedMap.set(normalized, extracted);
    }
  }

  // Process all benchmarks
  for (const benchmark of benchmarks) {
    const normalized = normalizeName(benchmark.name);
    
    // Check if we have extracted data for this biomarker
    const extractedData = extractedMap.get(normalized);
    
    // Get the appropriate range based on gender
    const optimalRange = gender === 'female' && benchmark.femaleRange
      ? benchmark.femaleRange
      : benchmark.maleRange || benchmark.optimalRange;
    
    if (extractedData) {
      // We have data for this biomarker
      results.push({
        biomarkerName: benchmark.name,
        hisValue: extractedData.value,
        unit: extractedData.unit,
        optimalRange: optimalRange,
      });
      matchedNames.add(normalized);
    } else {
      // No data found, mark as N/A
      results.push({
        biomarkerName: benchmark.name,
        hisValue: 'N/A',
        unit: benchmark.units[0] || '',
        optimalRange: optimalRange,
      });
    }
  }

  // Sort results by biomarker name
  results.sort((a, b) => a.biomarkerName.localeCompare(b.biomarkerName));

  return results;
}

/**
 * Check if a value is within the optimal range
 * This is a helper function for visual indicators
 */
export function isValueInRange(value: string, optimalRange: string): boolean | null {
  // If value is N/A, return null (unknown)
  if (value === 'N/A' || !value) {
    return null;
  }

  // Try to parse the value
  const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
  if (isNaN(numValue)) {
    return null;
  }

  // Try to extract range from optimalRange string
  // Format: "min-max unit" or "<max unit" or multiple ranges
  const rangeMatch = optimalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return numValue >= min && numValue <= max;
  }

  // Handle "<X" format
  const lessThanMatch = optimalRange.match(/<\s*(\d+\.?\d*)/);
  if (lessThanMatch) {
    const max = parseFloat(lessThanMatch[1]);
    return numValue < max;
  }

  // Can't determine, return null
  return null;
}

/**
 * Get status indicator for a biomarker value
 */
export function getValueStatus(value: string, optimalRange: string): 'in-range' | 'out-of-range' | 'unknown' {
  const inRange = isValueInRange(value, optimalRange);
  
  if (inRange === null) return 'unknown';
  return inRange ? 'in-range' : 'out-of-range';
}

/**
 * Generate summary statistics
 */
export interface AnalysisSummary {
  totalBiomarkers: number;
  measuredBiomarkers: number;
  missingBiomarkers: number;
  inRangeCount: number;
  outOfRangeCount: number;
  unknownCount: number;
}

export function generateSummary(results: AnalysisResult[]): AnalysisSummary {
  const totalBiomarkers = results.length;
  const measuredBiomarkers = results.filter(r => r.hisValue !== 'N/A').length;
  const missingBiomarkers = totalBiomarkers - measuredBiomarkers;
  
  let inRangeCount = 0;
  let outOfRangeCount = 0;
  let unknownCount = 0;

  for (const result of results) {
    if (result.hisValue === 'N/A') {
      unknownCount++;
      continue;
    }

    const status = getValueStatus(result.hisValue, result.optimalRange);
    if (status === 'in-range') {
      inRangeCount++;
    } else if (status === 'out-of-range') {
      outOfRangeCount++;
    } else {
      unknownCount++;
    }
  }

  return {
    totalBiomarkers,
    measuredBiomarkers,
    missingBiomarkers,
    inRangeCount,
    outOfRangeCount,
    unknownCount,
  };
}

