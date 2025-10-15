import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source to use the npm package version
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ProcessedPDF {
  fileName: string;
  extractedText: string;
  pageCount: number;
}

/**
 * Extract text content from a PDF file
 */
export async function processPdfFile(file: File): Promise<ProcessedPDF> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  
  let extractedText = '';

  // Extract text from each page
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Combine text items
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    
    extractedText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
  }

  return {
    fileName: file.name,
    extractedText: extractedText.trim(),
    pageCount,
  };
}

/**
 * Process multiple PDF files
 */
export async function processMultiplePdfs(files: File[]): Promise<ProcessedPDF[]> {
  const results: ProcessedPDF[] = [];
  
  for (const file of files) {
    try {
      const processed = await processPdfFile(file);
      results.push(processed);
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      throw new Error(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return results;
}

/**
 * Validate PDF file
 */
export function validatePdfFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'File must be a PDF' };
  }

  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 50MB' };
  }

  return { valid: true };
}

/**
 * Validate multiple PDF files
 */
export function validatePdfFiles(files: File[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (files.length === 0) {
    return { valid: false, errors: ['No files selected'] };
  }

  for (const file of files) {
    const validation = validatePdfFile(file);
    if (!validation.valid && validation.error) {
      errors.push(`${file.name}: ${validation.error}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
