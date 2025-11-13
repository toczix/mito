/**
 * Document Filter
 *
 * Pre-filters documents to identify empty/invalid files
 * before sending to Claude API, saving costs and time.
 */

import type { ProcessedPDF } from './pdf-processor';

export interface FilterResult {
  shouldProcess: boolean;
  reason?: string;
  confidence: number; // 0-1, how confident we are this should be skipped
}

// Lab-related keywords that indicate a valid lab report
const LAB_KEYWORDS = [
  // Units
  'mg/dl', 'mg/l', 'mmol/l', 'µmol/l', 'umol/l', 'pg/ml', 'ng/ml', 'iu/l', 'u/l',
  'g/dl', 'g/l', '%', 'miu/l', 'pmol/l', 'nmol/l', 'fl', 'meq/l',
  'k/µl', 'k/ul', '×10³/µl', '×10¹²/l',

  // Common biomarkers (English)
  'glucose', 'cholesterol', 'hemoglobin', 'creatinine', 'albumin',
  'sodium', 'potassium', 'calcium', 'tsh', 'vitamin',
  'hdl', 'ldl', 'triglyceride', 'bilirubin', 'ferritin',
  'wbc', 'rbc', 'platelet', 'hematocrit', 'ast', 'alt', 'alp',

  // Lab report terms
  'laboratory', 'lab result', 'test result', 'specimen', 'reference range',
  'normal range', 'optimal range', 'patient', 'collection date', 'result',

  // Spanish
  'glucosa', 'colesterol', 'hemoglobina', 'creatinina', 'albumina',
  'sodio', 'potasio', 'calcio', 'vitamina', 'triglicéridos',
  'laboratorio', 'resultado', 'paciente', 'rango', 'referencia',

  // Portuguese
  'glicose', 'hemoglobina', 'vitamina', 'resultado', 'laboratório',

  // French
  'glycémie', 'cholestérol', 'hémoglobine', 'vitamine', 'résultat',

  // German
  'glukose', 'cholesterin', 'hämoglobin', 'vitamin', 'ergebnis',
];

// Patterns that indicate non-lab documents
const EXCLUDE_PATTERNS = [
  /^\s*$/,  // Empty
  /^[\s\n\r]*page\s+\d+[\s\n\r]*$/i, // Just page numbers
  /^[\s\n\r]*\d+[\s\n\r]*$/,  // Just numbers
];

/**
 * Check if document should be processed
 */
export function shouldProcessDocument(pdf: ProcessedPDF): FilterResult {
  const hasImages = Boolean(pdf.imageData || (pdf.imagePages && pdf.imagePages.length > 0) || pdf.isImage);
  const text = (pdf.extractedText || '').toLowerCase();

  // If we have image data (scanned PDFs or uploaded images), always process.
  // These files rarely contain reliable text content, so downstream Vision/OCR should handle them.
  if (hasImages) {
    return {
      shouldProcess: true,
      reason: 'Has images (potential scanned lab report)',
      confidence: 1.0
    };
  }

  // Rule 1: Empty or very short text (< 50 chars) with no images
  if (text.length < 50) {
    return {
      shouldProcess: false,
      reason: 'Empty document (< 50 characters, no images)',
      confidence: 1.0
    };
  }

  // Rule 2: Check exclude patterns
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(text.trim())) {
      return {
        shouldProcess: false,
        reason: 'Document contains only whitespace or page numbers',
        confidence: 0.95
      };
    }
  }

  // Rule 3: Count numeric tokens (lab results have many numbers)
  const numericMatches = text.match(/\d+\.?\d*/g) || [];
  const numericCount = numericMatches.length;

  // Rule 4: Count lab keywords
  let labKeywordCount = 0;
  for (const keyword of LAB_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      labKeywordCount++;
    }
  }

  // Rule 5: Has images? Images might be scanned lab reports
  // Text-only documents: require lab indicators
  if (numericCount < 5 && labKeywordCount === 0) {
    return {
      shouldProcess: false,
      reason: `Insufficient lab indicators (${numericCount} numbers, ${labKeywordCount} keywords)`,
      confidence: 0.9
    };
  }

  if (numericCount < 3 && labKeywordCount < 2) {
    return {
      shouldProcess: false,
      reason: `Low lab probability (${numericCount} numbers, ${labKeywordCount} keywords)`,
      confidence: 0.8
    };
  }

  // Looks like a lab report
  return {
    shouldProcess: true,
    reason: `Lab indicators present (${numericCount} numbers, ${labKeywordCount} keywords)`,
    confidence: 1.0 - (1 / (labKeywordCount + numericCount + 1))
  };
}

/**
 * Filter a batch of documents, separating processable from skipped
 */
export interface FilteredBatch {
  processable: ProcessedPDF[];
  skipped: Array<{ pdf: ProcessedPDF; reason: string }>;
}

export function filterDocuments(pdfs: ProcessedPDF[]): FilteredBatch {
  const processable: ProcessedPDF[] = [];
  const skipped: Array<{ pdf: ProcessedPDF; reason: string }> = [];

  for (const pdf of pdfs) {
    const result = shouldProcessDocument(pdf);

    if (result.shouldProcess) {
      processable.push(pdf);
    } else {
      skipped.push({
        pdf,
        reason: result.reason || 'Unknown reason'
      });
      console.log(`⏭️ Skipping "${pdf.fileName}": ${result.reason}`);
    }
  }

  if (skipped.length > 0) {
    console.log(`📋 Filtered ${pdfs.length} documents: ${processable.length} processable, ${skipped.length} skipped`);
  }

  return { processable, skipped };
}

/**
 * Check if a single file is too large to process
 */
export function isFileTooLarge(pdf: ProcessedPDF): { tooLarge: boolean; reason?: string } {
  const MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file (matches upload limit)

  // Calculate total size
  const textBytes = new Blob([pdf.extractedText]).size;
  let imageBytes = 0;

  if (pdf.imageData) {
    imageBytes = Math.ceil((pdf.imageData.length * 3) / 4);
  } else if (pdf.imagePages && pdf.imagePages.length > 0) {
    for (const page of pdf.imagePages) {
      imageBytes += Math.ceil((page.length * 3) / 4);
    }
  }

  const totalBytes = textBytes + imageBytes;

  if (totalBytes > MAX_SINGLE_FILE_BYTES) {
    return {
      tooLarge: true,
      reason: `File size ${(totalBytes / 1024 / 1024).toFixed(1)} MB exceeds ${MAX_SINGLE_FILE_BYTES / 1024 / 1024} MB limit`
    };
  }

  return { tooLarge: false };
}
