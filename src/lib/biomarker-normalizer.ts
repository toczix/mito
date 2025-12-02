import type { ExtractedBiomarker, NormalizedBiomarker } from './biomarkers';
import { BIOMARKERS } from './biomarkers';

/**
 * Biomarker-specific conversion factors
 * Key: biomarker name (lowercase) → { fromUnit → { toUnit → factor } }
 * To convert: newValue = oldValue * factor
 */
const BIOMARKER_CONVERSIONS: Record<string, Record<string, Record<string, number>>> = {
  // Iron studies (µmol/L ↔ µg/dL): 1 µmol/L = 5.585 µg/dL
  // Note: mg/dL for iron is rare but may appear - 1 mg/dL = 100 µg/dL = 17.9 µmol/L
  'serum iron': {
    'µg/dL': { 'µmol/L': 0.179 },  // µg/dL → µmol/L
    'µmol/L': { 'µg/dL': 5.585 },  // µmol/L → µg/dL
    'mg/dL': { 'µmol/L': 17.9 },   // mg/dL → µmol/L (rare)
  },
  'tibc': {
    'µg/dL': { 'µmol/L': 0.179 },
    'µmol/L': { 'µg/dL': 5.585, 'mg/dL': 0.05585 },
    'mg/dL': { 'µmol/L': 17.9 },   // mg/dL → µmol/L
  },
  // Creatinine (µmol/L ↔ mg/dL): 1 mg/dL = 88.4 µmol/L
  'creatinine': {
    'mg/dL': { 'µmol/L': 88.4 },   // mg/dL → µmol/L
    'µmol/L': { 'mg/dL': 0.0113 }, // µmol/L → mg/dL
  },
  // Glucose (mmol/L ↔ mg/dL): 1 mmol/L = 18.02 mg/dL
  // Note: Canonical name is "Fasting Glucose" but "Glucose" alias also exists
  'fasting glucose': {
    'mg/dL': { 'mmol/L': 0.0555 }, // mg/dL → mmol/L
    'mmol/L': { 'mg/dL': 18.02 },  // mmol/L → mg/dL
  },
  'glucose': {
    'mg/dL': { 'mmol/L': 0.0555 },
    'mmol/L': { 'mg/dL': 18.02 },
  },
  // BUN (mmol/L ↔ mg/dL): 1 mmol/L = 2.8 mg/dL (urea nitrogen)
  'bun': {
    'mg/dL': { 'mmol/L': 0.357 },  // mg/dL → mmol/L
    'mmol/L': { 'mg/dL': 2.8 },    // mmol/L → mg/dL
  },
  // Calcium (mmol/L ↔ mg/dL): 1 mmol/L = 4.0 mg/dL
  'calcium': {
    'mg/dL': { 'mmol/L': 0.25 },   // mg/dL → mmol/L
    'mmol/L': { 'mg/dL': 4.0 },    // mmol/L → mg/dL
  },
  // Magnesium (mmol/L ↔ mg/dL): 1 mmol/L = 2.43 mg/dL
  'serum magnesium': {
    'mg/dL': { 'mmol/L': 0.411 },  // mg/dL → mmol/L
    'mmol/L': { 'mg/dL': 2.43 },   // mmol/L → mg/dL
  },
  // Triglycerides (mmol/L ↔ mg/dL): 1 mmol/L = 88.57 mg/dL
  'triglycerides': {
    'mg/dL': { 'mmol/L': 0.0113 }, // mg/dL → mmol/L
    'mmol/L': { 'mg/dL': 88.57 },  // mmol/L → mg/dL
  },
  // Cholesterol (mmol/L ↔ mg/dL): 1 mmol/L = 38.67 mg/dL
  // Note: Using exact canonical names from BIOMARKERS array
  'total cholesterol': {
    'mg/dL': { 'mmol/L': 0.0259 }, // mg/dL → mmol/L
    'mmol/L': { 'mg/dL': 38.67 },  // mmol/L → mg/dL
  },
  'hdl cholesterol': {
    'mg/dL': { 'mmol/L': 0.0259 },
    'mmol/L': { 'mg/dL': 38.67 },
  },
  'ldl cholesterol': {
    'mg/dL': { 'mmol/L': 0.0259 },
    'mmol/L': { 'mg/dL': 38.67 },
  },
  // Uric Acid (µmol/L ↔ mg/dL): 1 mg/dL = 59.48 µmol/L
  'uric acid': {
    'mg/dL': { 'µmol/L': 59.48 },
    'µmol/L': { 'mg/dL': 0.0168 },
  },
  // Bilirubin (µmol/L ↔ mg/dL): 1 mg/dL = 17.1 µmol/L
  'total bilirubin': {
    'mg/dL': { 'µmol/L': 17.1 },
    'µmol/L': { 'mg/dL': 0.0585 },
  },
  'direct bilirubin': {
    'mg/dL': { 'µmol/L': 17.1 },
    'µmol/L': { 'mg/dL': 0.0585 },
  },
};

/**
 * Get the target unit for a biomarker from benchmarks
 */
function getBenchmarkTargetUnit(biomarkerName: string): string | null {
  const benchmark = BIOMARKERS.find(b => 
    b.name.toLowerCase() === biomarkerName.toLowerCase()
  );
  if (benchmark && benchmark.units && benchmark.units.length > 0) {
    return benchmark.units[0]; // First unit is the preferred/target unit
  }
  return null;
}

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
   * Normalize unit symbols to standard forms
   */
  private normalizeUnitSymbols(unit: string): string {
    let normalized = unit
      // Normalize micro symbol variations: mcg, ug, μg → µg
      .replace(/\bmcg\b/gi, 'µg')
      .replace(/\bug\b/gi, 'µg')
      .replace(/μg/g, 'µg') // Greek mu to micro sign
      // Normalize other micro prefixes
      .replace(/\bumol\b/gi, 'µmol')
      .replace(/μmol/g, 'µmol')
      .replace(/\buIU\b/gi, 'µIU')
      .replace(/\buL\b/gi, 'µL')
      .replace(/μL/g, 'µL')
      // Normalize milli-IU
      .replace(/\bmU\/L\b/gi, 'mIU/L')
      // Normalize powers
      .replace(/×10\^3/gi, '×10³')
      .replace(/×10\^12/gi, '×10¹²')
      .replace(/10\^3/gi, '×10³')
      .replace(/10\^12/gi, '×10¹²')
      // Normalize per-microliter
      .replace(/K\/uL/gi, 'K/µL')
      .replace(/M\/uL/gi, 'M/µL')
      // Normalize "Mio./μL" and similar to "×10¹²/L"
      .replace(/Mio\.?\/[μuµ]L/gi, '×10¹²/L')
      .replace(/mio\.?\/[μuµ]L/gi, '×10³/µL')
      .replace(/Mil\.?\/[μuµ]L/gi, '×10¹²/L');
    
    // Normalize common unit case variations to canonical forms
    // This ensures conversion lookups work regardless of case
    normalized = normalized
      // Volume units: /l → /L, /dl → /dL
      .replace(/\/l\b/g, '/L')
      .replace(/\/dl\b/gi, '/dL')
      // Concentration units: mmol, mg, µmol with proper case
      .replace(/\bmmol\/l\b/gi, 'mmol/L')
      .replace(/\bmg\/dl\b/gi, 'mg/dL')
      .replace(/\bµmol\/l\b/gi, 'µmol/L')
      .replace(/\bµg\/dl\b/gi, 'µg/dL')
      .replace(/\bg\/l\b/gi, 'g/L')
      .replace(/\bg\/dl\b/gi, 'g/dL')
      .replace(/\bng\/ml\b/gi, 'ng/mL')
      .replace(/\bpg\/ml\b/gi, 'pg/mL')
      .replace(/\bpmol\/l\b/gi, 'pmol/L')
      .replace(/\bnmol\/l\b/gi, 'nmol/L')
      .replace(/\bmiu\/l\b/gi, 'mIU/L')
      .replace(/\biu\/l\b/gi, 'IU/L')
      .replace(/\bu\/l\b/gi, 'U/L');
    
    return normalized;
  }

  /**
   * Try to convert value from one unit to another
   */
  private tryConvertValue(
    biomarkerName: string,
    value: string,
    fromUnit: string,
    toUnit: string
  ): { value: string; converted: boolean } {
    // If units are the same, no conversion needed
    if (fromUnit === toUnit) {
      return { value, converted: false };
    }

    // Try to parse the value
    const numValue = parseFloat(value);
    if (isNaN(numValue) || !isFinite(numValue)) {
      return { value, converted: false };
    }

    // Look up biomarker-specific conversion
    const biomarkerKey = biomarkerName.toLowerCase();
    const biomarkerConversions = BIOMARKER_CONVERSIONS[biomarkerKey];
    
    if (biomarkerConversions && biomarkerConversions[fromUnit] && biomarkerConversions[fromUnit][toUnit]) {
      const factor = biomarkerConversions[fromUnit][toUnit];
      const convertedValue = numValue * factor;
      // Format with appropriate precision (2 decimals, remove trailing zeros)
      return { 
        value: convertedValue.toFixed(2).replace(/\.?0+$/, ''),
        converted: true 
      };
    }

    // No conversion available
    return { value, converted: false };
  }

  /**
   * Normalize and validate units based on biomarker name
   */
  private normalizeAndValidateUnit(biomarkerName: string, unit: string, value: string): {
    unit: string;
    value: string;
    conversionApplied: boolean;
  } {
    // First, normalize unit symbols
    let normalizedUnit = this.normalizeUnitSymbols(unit);
    let normalizedValue = value;
    let conversionApplied = false;

    // Get the target unit from benchmarks
    const targetUnit = getBenchmarkTargetUnit(biomarkerName);
    
    // If we have a target unit and it differs, try to convert
    if (targetUnit && normalizedUnit !== targetUnit) {
      // Normalize the target unit too for comparison
      const normalizedTargetUnit = this.normalizeUnitSymbols(targetUnit);
      
      if (normalizedUnit !== normalizedTargetUnit) {
        const conversion = this.tryConvertValue(
          biomarkerName,
          normalizedValue,
          normalizedUnit,
          normalizedTargetUnit
        );
        
        if (conversion.converted) {
          normalizedValue = conversion.value;
          normalizedUnit = normalizedTargetUnit;
          conversionApplied = true;
        } else {
          // If no conversion available, just use the target unit for display
          // (value stays the same - user will see mismatch in ranges)
          normalizedUnit = normalizedTargetUnit;
        }
      }
    }

    // Biomarker-specific unit validation and correction
    const canonicalName = biomarkerName.toUpperCase();

    // Fix Albumin: should be g/L or g/dL, not %
    if (canonicalName.includes('ALBUMIN') && !canonicalName.includes('GLOBULIN')) {
      if (normalizedUnit === '%' || normalizedUnit.includes('%')) {
        normalizedUnit = 'g/L';
        conversionApplied = true;
      }
    }

    // Fix RBC: ensure it's in ×10¹²/L not Mio./μL
    if (canonicalName === 'RBC' || canonicalName === 'RED BLOOD CELL COUNT') {
      if (normalizedUnit.match(/mio/i) || normalizedUnit.match(/mil/i)) {
        normalizedUnit = '×10¹²/L';
        conversionApplied = true;
      }
    }

    // Fix WBC differential counts: ensure they're in ×10³/µL not %
    const wbcDifferentials = ['NEUTROPHILS', 'LYMPHOCYTES', 'MONOCYTES', 'EOSINOPHILS', 'BASOPHILS'];
    if (wbcDifferentials.some(name => canonicalName.includes(name))) {
      if (normalizedUnit === '%' || normalizedUnit.includes('%')) {
        normalizedUnit = '×10³/µL';
        conversionApplied = true;
      }
    }

    return {
      unit: normalizedUnit,
      value: normalizedValue,
      conversionApplied
    };
  }

  /**
   * Normalize a batch of biomarkers
   */
  async normalizeBatch(biomarkers: ExtractedBiomarker[]): Promise<NormalizedBiomarker[]> {
    const normalized: NormalizedBiomarker[] = [];

    for (const biomarker of biomarkers) {
      const nameResult = this.normalizeBiomarkerName(biomarker.name);

      // Normalize and validate units
      const unitResult = this.normalizeAndValidateUnit(
        nameResult.canonicalName,
        biomarker.unit,
        biomarker.value
      );

      // Check if value is numeric
      const numValue = parseFloat(biomarker.value);
      const isNumeric = !isNaN(numValue) && isFinite(numValue);

      normalized.push({
        name: nameResult.canonicalName,
        value: unitResult.value,
        unit: unitResult.unit,
        originalName: biomarker.name,
        originalValue: biomarker.value,
        originalUnit: biomarker.unit,
        confidence: nameResult.confidence,
        conversionApplied: unitResult.conversionApplied,
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
