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
  gender: 'male' | 'female' = 'male',
  debug = true
): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  const matchedNames = new Set<string>();

  // Get all benchmarks (including custom ones)
  const benchmarks = getAllBenchmarks();

  // Create a map of extracted biomarkers by normalized name
  // This map will store: normalized name -> extracted biomarker
  const extractedMap = new Map<string, ExtractedBiomarker>();
  
  for (const extracted of extractedBiomarkers) {
    const normalized = normalizeName(extracted.name);
    // Keep the most recent or first occurrence
    if (!extractedMap.has(normalized)) {
      extractedMap.set(normalized, extracted);
    }
  }

  if (debug) {
    console.group('🔍 Detailed Biomarker Matching');
    console.log('Extracted biomarker names (normalized):');
    console.log(Array.from(extractedMap.keys()).sort());
  }

  // Track which extracted biomarkers didn't match any benchmark
  const extractedNormalized = new Set(extractedMap.keys());

  // Process all benchmarks
  for (const benchmark of benchmarks) {
    // Try to find a match by checking the biomarker name and all its aliases
    const namesToCheck = [benchmark.name];
    if (benchmark.aliases && Array.isArray(benchmark.aliases)) {
      namesToCheck.push(...benchmark.aliases);
    }
    
    let extractedData: ExtractedBiomarker | undefined = undefined;
    let matchedAlias: string | undefined = undefined;
    
    // Check all possible names (primary name + aliases)
    for (const nameToCheck of namesToCheck) {
      const normalized = normalizeName(nameToCheck);
      const found = extractedMap.get(normalized);
      if (found) {
        extractedData = found;
        matchedAlias = nameToCheck;
        matchedNames.add(normalized);
        extractedNormalized.delete(normalized); // Remove from unmatched set
        break; // Found a match, no need to check other aliases
      }
    }
    
    // Get the appropriate range based on gender
    const optimalRange = gender === 'female' && benchmark.femaleRange
      ? benchmark.femaleRange
      : benchmark.maleRange;
    
    if (extractedData) {
      // We have data for this biomarker
      if (debug && extractedData.name !== benchmark.name) {
        console.log(`✅ Matched: "${extractedData.name}" → "${benchmark.name}" (via alias: "${matchedAlias}")`);
      }
      results.push({
        biomarkerName: benchmark.name,
        hisValue: extractedData.value,
        unit: extractedData.unit,
        optimalRange: optimalRange,
        testDate: extractedData.testDate,
        // ✅ Preserve normalization metadata if present
        _normalization: extractedData._normalization
      });
    } else {
      // No data found, mark as N/A
      if (debug) {
        console.warn(`❌ Not found: "${benchmark.name}" (tried: ${namesToCheck.join(', ')})`);
      }
      results.push({
        biomarkerName: benchmark.name,
        hisValue: 'N/A',
        unit: benchmark.units[0] || '',
        optimalRange: optimalRange,
        testDate: undefined,
        // No normalization metadata for N/A values
      });
    }
  }

  // Log any extracted biomarkers that didn't match any benchmark
  if (debug && extractedNormalized.size > 0) {
    console.group('⚠️ Extracted biomarkers that didn\'t match any benchmark:');
    extractedNormalized.forEach(normalized => {
      const biomarker = extractedMap.get(normalized);
      if (biomarker) {
        console.log(`"${biomarker.name}" (normalized: "${normalized}")`);
      }
    });
    console.groupEnd();
  }

  if (debug) {
    console.groupEnd();
  }

  // Sort results by biomarker name
  results.sort((a, b) => a.biomarkerName.localeCompare(b.biomarkerName));

  return results;
}

/**
 * Check if a value is within the optimal range
 * This is a helper function for visual indicators
 */
export function isValueInRange(value: string, optimalRange: string, unit?: string): boolean | null {
  // If value is N/A, return null (unknown)
  if (value === 'N/A' || !value) {
    return null;
  }

  // Try to parse the numeric value
  const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
  if (isNaN(numValue)) {
    return null;
  }

  // Extract unit from value if not provided separately, or use the provided unit
  let valueUnit = unit || value.replace(/[0-9.-\s]/g, '').trim();
  
  // Normalize common unit variations for better matching
  valueUnit = normalizeUnit(valueUnit);
  
  // Also normalize the optimal range string for consistent unit matching
  const normalizedRange = normalizeUnit(optimalRange);
  
  // Try to find a range that matches the value's unit
  // Look for patterns like "min-max unit" where unit matches the value's unit
  // We need to escape special regex characters in the unit
  const escapedUnit = escapeRegexSpecialChars(valueUnit);
  
  // Try to find a range with the matching unit in parentheses first (e.g., "(162-240 mg/dL)")
  if (valueUnit) {
    const parenthesesPattern = new RegExp(`\\((\\d+\\.?\\d*)\\s*-\\s*(\\d+\\.?\\d*)\\s*${escapedUnit}\\)`, 'i');
    const parenthesesMatch = normalizedRange.match(parenthesesPattern);
    if (parenthesesMatch) {
      const min = parseFloat(parenthesesMatch[1]);
      const max = parseFloat(parenthesesMatch[2]);
      return numValue >= min && numValue <= max;
    }
    
    // Try to find a range with the matching unit (e.g., "162-240 mg/dL")
    const unitPattern = new RegExp(`(\\d+\\.?\\d*)\\s*-\\s*(\\d+\\.?\\d*)\\s*${escapedUnit}(?:\\s|$|\\(|,)`, 'i');
    const unitMatch = normalizedRange.match(unitPattern);
    if (unitMatch) {
      const min = parseFloat(unitMatch[1]);
      const max = parseFloat(unitMatch[2]);
      return numValue >= min && numValue <= max;
    }

    // Handle "<X" format with unit matching
    const lessThanWithUnit = new RegExp(`<\\s*${escapedUnit.replace(/^\\s*/, '')}\\s*(\\d+\\.?\\d*)\\s*${escapedUnit}`, 'i');
    const lessThanUnitMatch = normalizedRange.match(lessThanWithUnit);
    if (lessThanUnitMatch) {
      const max = parseFloat(lessThanUnitMatch[1]);
      return numValue < max;
    }

    // Handle ">X" format with unit matching
    const greaterThanWithUnit = new RegExp(`>\\s*(\\d+\\.?\\d*)\\s*${escapedUnit}`, 'i');
    const greaterThanUnitMatch = normalizedRange.match(greaterThanWithUnit);
    if (greaterThanUnitMatch) {
      const min = parseFloat(greaterThanUnitMatch[1]);
      return numValue > min;
    }

    // Handle "≤X" format with unit matching
    const lessThanOrEqualWithUnit = new RegExp(`[≤<=]\\s*(\\d+\\.?\\d*)\\s*${escapedUnit}`, 'i');
    const lessThanOrEqualMatch = normalizedRange.match(lessThanOrEqualWithUnit);
    if (lessThanOrEqualMatch) {
      const max = parseFloat(lessThanOrEqualMatch[1]);
      return numValue <= max;
    }
  }

  // If no unit-specific match, fall back to the first range found
  // This handles cases where there's only one range or no clear unit distinction
  const rangeMatch = normalizedRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return numValue >= min && numValue <= max;
  }

  // Handle "<X" format without unit
  const lessThanMatch = normalizedRange.match(/[<]\s*(\d+\.?\d*)/);
  if (lessThanMatch) {
    const max = parseFloat(lessThanMatch[1]);
    return numValue < max;
  }

  // Handle ">X" format without unit
  const greaterThanMatch = normalizedRange.match(/[>]\s*(\d+\.?\d*)/);
  if (greaterThanMatch) {
    const min = parseFloat(greaterThanMatch[1]);
    return numValue > min;
  }

  // Handle "≤X" format without unit
  const lessThanOrEqualMatch = normalizedRange.match(/[≤<=]\s*(\d+\.?\d*)/);
  if (lessThanOrEqualMatch) {
    const max = parseFloat(lessThanOrEqualMatch[1]);
    return numValue <= max;
  }

  // Can't determine, return null
  return null;
}

/**
 * Normalize unit strings for consistent matching
 */
function normalizeUnit(unit: string): string {
  if (!unit) return '';
  
  // Normalize common variations
  let normalized = unit
    .replace(/umol/gi, 'µmol')
    .replace(/ug/gi, 'µg')
    .replace(/uIU/gi, 'µIU')
    .replace(/uL/gi, 'µL')
    .replace(/\bmU\/L\b/gi, 'mIU/L')  // mU/L is equivalent to mIU/L
    .replace(/×10\^3/gi, '×10³')
    .replace(/×10\^12/gi, '×10¹²')
    .replace(/K\/uL/gi, 'K/µL')
    .replace(/M\/uL/gi, 'M/µL');
  
  // Normalize µIU/mL to mIU/L (they are equivalent: 1 µIU/mL = 1 mIU/L)
  normalized = normalized.replace(/µIU\/mL/gi, 'mIU/L');
  
  return normalized;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegexSpecialChars(str: string): string {
  if (!str) return '';
  // Escape all special regex characters including /
  return str.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * Get status indicator for a biomarker value
 */
export function getValueStatus(value: string, optimalRange: string, unit?: string): 'in-range' | 'out-of-range' | 'unknown' {
  const inRange = isValueInRange(value, optimalRange, unit);
  
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

    const status = getValueStatus(result.hisValue, result.optimalRange, result.unit);
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

