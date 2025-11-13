import type { ExtractedBiomarker, NormalizedBiomarker } from './biomarkers';
import { BIOMARKERS } from './biomarkers';

/**
 * Biomarker Normalizer
 *
 * Normalizes biomarker names and units to canonical forms.
 * Phase 1: Uses built-in alias matching (no database required)
 * Phase 2: Will load from biomarker_taxonomy tables when available
 */
export class BiomarkerNormalizer {
  private aliasMap: Map<string, string> = new Map();
  private initialized = false;

  /**
   * Initialize the normalizer
   * For now, loads from built-in BIOMARKERS array
   * Later: will load from Supabase taxonomy tables
   */
  async initialize() {
    if (this.initialized) return;

    console.log('🔄 Initializing biomarker normalizer...');

    // Build alias map from BIOMARKERS array
    for (const biomarker of BIOMARKERS) {
      // Map canonical name to itself
      const canonicalKey = this.normalizeKey(biomarker.name);
      this.aliasMap.set(canonicalKey, biomarker.name);

      // Map aliases to canonical name
      if (biomarker.aliases) {
        for (const alias of biomarker.aliases) {
          const aliasKey = this.normalizeKey(alias);
          this.aliasMap.set(aliasKey, biomarker.name);
        }
      }
    }

    // TODO: Load from Supabase taxonomy tables when available
    // try {
    //   if (supabase) {
    //     const { data } = await supabase.from('biomarker_aliases').select('*');
    //     // ... load aliases
    //   }
    // } catch (error) {
    //   console.warn('Could not load taxonomy from database:', error);
    // }

    this.initialized = true;
    console.log(`✅ Loaded ${this.aliasMap.size} biomarker aliases`);
  }

  /**
   * Normalize a single biomarker name
   */
  normalizeBiomarkerName(name: string): {
    canonicalName: string;
    originalName: string;
    confidence: number;
  } {
    const key = this.normalizeKey(name);
    const canonical = this.aliasMap.get(key);

    if (canonical) {
      return {
        canonicalName: canonical,
        originalName: name,
        confidence: 1.0 // Exact match
      };
    }

    // Try fuzzy matching (remove common prefixes/suffixes)
    const cleaned = name
      .replace(/^(serum|plasma|blood|total|free)\s+/i, '')
      .replace(/\s+(serum|level|count)$/i, '');

    const fuzzyKey = this.normalizeKey(cleaned);
    const fuzzyMatch = this.aliasMap.get(fuzzyKey);

    if (fuzzyMatch) {
      return {
        canonicalName: fuzzyMatch,
        originalName: name,
        confidence: 0.8 // Fuzzy match
      };
    }

    // No match - return original with low confidence
    return {
      canonicalName: name,
      originalName: name,
      confidence: 0.3 // Unknown
    };
  }

  /**
   * Normalize a batch of biomarkers
   */
  async normalizeBatch(biomarkers: ExtractedBiomarker[]): Promise<NormalizedBiomarker[]> {
    const normalized: NormalizedBiomarker[] = [];

    for (const biomarker of biomarkers) {
      const nameResult = this.normalizeBiomarkerName(biomarker.name);

      // Check if value is numeric
      const numValue = parseFloat(biomarker.value);
      const isNumeric = !isNaN(numValue) && isFinite(numValue);

      normalized.push({
        name: nameResult.canonicalName,
        value: biomarker.value,
        unit: biomarker.unit,
        originalName: biomarker.name,
        originalValue: biomarker.value,
        originalUnit: biomarker.unit,
        confidence: nameResult.confidence,
        conversionApplied: false, // TODO: Unit conversions in Phase 2
        isNumeric
      });
    }

    return normalized;
  }

  /**
   * Normalize a key for lookup (lowercase, trim, collapse whitespace)
   */
  private normalizeKey(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[–—]/g, '-'); // Normalize dashes
  }
}

// Singleton instance
export const biomarkerNormalizer = new BiomarkerNormalizer();
