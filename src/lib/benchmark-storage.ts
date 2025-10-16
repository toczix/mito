import { BIOMARKERS } from './biomarkers';
import type { Biomarker } from './biomarkers';

const CUSTOM_BENCHMARKS_KEY = 'mito_custom_benchmarks';

export interface CustomBiomarker extends Biomarker {
  id: string;
  isCustom: boolean;
  // Note: maleRange and femaleRange are now in the base Biomarker interface
}

/**
 * Get all benchmarks (default + custom)
 */
export function getAllBenchmarks(): CustomBiomarker[] {
  const defaultBenchmarks: CustomBiomarker[] = BIOMARKERS.map((b, index) => ({
    ...b,
    id: `default-${index}`,
    isCustom: false,
  }));

  const customBenchmarks = getCustomBenchmarks();
  
  // Merge: custom benchmarks can override defaults by name
  const benchmarkMap = new Map<string, CustomBiomarker>();
  
  defaultBenchmarks.forEach(b => benchmarkMap.set(b.name, b));
  customBenchmarks.forEach(b => benchmarkMap.set(b.name, b));
  
  return Array.from(benchmarkMap.values());
}

/**
 * Get only custom benchmarks from localStorage
 */
export function getCustomBenchmarks(): CustomBiomarker[] {
  try {
    const stored = localStorage.getItem(CUSTOM_BENCHMARKS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading custom benchmarks:', error);
    return [];
  }
}

/**
 * Save custom benchmarks to localStorage
 */
export function saveCustomBenchmarks(benchmarks: CustomBiomarker[]): void {
  try {
    localStorage.setItem(CUSTOM_BENCHMARKS_KEY, JSON.stringify(benchmarks));
  } catch (error) {
    console.error('Error saving custom benchmarks:', error);
    throw new Error('Failed to save benchmarks');
  }
}

/**
 * Add a new custom benchmark
 */
export function addCustomBenchmark(benchmark: Omit<CustomBiomarker, 'id' | 'isCustom'>): CustomBiomarker {
  const customBenchmarks = getCustomBenchmarks();
  const newBenchmark: CustomBiomarker = {
    ...benchmark,
    id: `custom-${Date.now()}`,
    isCustom: true,
  };
  
  customBenchmarks.push(newBenchmark);
  saveCustomBenchmarks(customBenchmarks);
  
  return newBenchmark;
}

/**
 * Update an existing custom benchmark
 */
export function updateCustomBenchmark(id: string, updates: Partial<CustomBiomarker>): void {
  const customBenchmarks = getCustomBenchmarks();
  const index = customBenchmarks.findIndex(b => b.id === id);
  
  if (index !== -1) {
    customBenchmarks[index] = { ...customBenchmarks[index], ...updates };
    saveCustomBenchmarks(customBenchmarks);
  }
}

/**
 * Delete a custom benchmark
 */
export function deleteCustomBenchmark(id: string): void {
  const customBenchmarks = getCustomBenchmarks();
  const filtered = customBenchmarks.filter(b => b.id !== id);
  saveCustomBenchmarks(filtered);
}

/**
 * Reset all custom benchmarks (keep only defaults)
 */
export function resetToDefaults(): void {
  localStorage.removeItem(CUSTOM_BENCHMARKS_KEY);
}

/**
 * Export benchmarks as JSON
 */
export function exportBenchmarks(): string {
  const all = getAllBenchmarks();
  return JSON.stringify(all, null, 2);
}

/**
 * Import benchmarks from JSON
 */
export function importBenchmarks(jsonString: string): void {
  try {
    const imported = JSON.parse(jsonString) as CustomBiomarker[];
    const customOnly = imported.filter(b => b.isCustom);
    saveCustomBenchmarks(customOnly);
  } catch (error) {
    throw new Error('Invalid benchmark data');
  }
}

