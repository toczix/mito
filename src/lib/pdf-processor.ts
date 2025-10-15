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
  isImage?: boolean;
  imageData?: string; // base64 encoded image
  mimeType?: string;
  qualityScore?: number; // 0-1, for images
  qualityWarning?: string;
}

/**
 * Extract text content from a PDF file or process an image
 */
export async function processPdfFile(file: File): Promise<ProcessedPDF> {
  // Check if it's an image
  if (file.type.startsWith('image/')) {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    // Check image quality
    const qualityCheck = await checkImageQuality(arrayBuffer, file.type);
    
    return {
      fileName: file.name,
      extractedText: '', // Images will be sent directly to Claude
      pageCount: 1,
      isImage: true,
      imageData: base64,
      mimeType: file.type,
      qualityScore: qualityCheck.score,
      qualityWarning: qualityCheck.warning,
    };
  }

  // Process PDF
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
    isImage: false,
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
 * Validate PDF or image file
 */
export function validatePdfFile(file: File): { valid: boolean; error?: string } {
  // Check file type - allow PDFs and images
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File must be a PDF, PNG, or JPG image' };
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

/**
 * Check image quality using basic heuristics
 * Returns a quality score (0-1) and optional warning
 */
async function checkImageQuality(
  arrayBuffer: ArrayBuffer, 
  mimeType: string
): Promise<{ score: number; warning?: string }> {
  try {
    // Create image from buffer
    const blob = new Blob([arrayBuffer], { type: mimeType });
    const imageUrl = URL.createObjectURL(blob);
    
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
    
    // Check 1: Resolution (lab reports should be at least 800x600)
    const minWidth = 800;
    const minHeight = 600;
    if (img.width < minWidth || img.height < minHeight) {
      URL.revokeObjectURL(imageUrl);
      return {
        score: 0.3,
        warning: `Low resolution (${img.width}x${img.height}). Minimum ${minWidth}x${minHeight} recommended.`
      };
    }
    
    // Check 2: Analyze sharpness using canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(imageUrl);
      return { score: 0.5, warning: 'Could not analyze image quality' };
    }
    
    // Scale down for analysis (faster)
    const scaleFactor = Math.min(1, 400 / Math.max(img.width, img.height));
    canvas.width = img.width * scaleFactor;
    canvas.height = img.height * scaleFactor;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Calculate variance (measure of sharpness/blur)
    // Blurry images have lower variance
    let sum = 0;
    let sumSq = 0;
    const totalPixels = canvas.width * canvas.height;
    
    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += gray;
      sumSq += gray * gray;
    }
    
    const mean = sum / totalPixels;
    const variance = (sumSq / totalPixels) - (mean * mean);
    
    // Calculate Laplacian variance (edge detection - another blur metric)
    let laplacianVariance = 0;
    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        const idx = (y * canvas.width + x) * 4;
        const center = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        
        // Simplified Laplacian kernel
        const top = 0.299 * data[idx - canvas.width * 4] + 0.587 * data[idx - canvas.width * 4 + 1] + 0.114 * data[idx - canvas.width * 4 + 2];
        const bottom = 0.299 * data[idx + canvas.width * 4] + 0.587 * data[idx + canvas.width * 4 + 1] + 0.114 * data[idx + canvas.width * 4 + 2];
        const left = 0.299 * data[idx - 4] + 0.587 * data[idx - 3] + 0.114 * data[idx - 2];
        const right = 0.299 * data[idx + 4] + 0.587 * data[idx + 5] + 0.114 * data[idx + 6];
        
        const laplacian = Math.abs(4 * center - top - bottom - left - right);
        laplacianVariance += laplacian;
      }
    }
    
    laplacianVariance /= ((canvas.width - 2) * (canvas.height - 2));
    
    URL.revokeObjectURL(imageUrl);
    
    // Threshold values (empirically determined)
    // Lab reports typically have variance > 1000 and Laplacian > 10
    const varianceThreshold = 800;
    const laplacianThreshold = 8;
    
    if (variance < varianceThreshold || laplacianVariance < laplacianThreshold) {
      return {
        score: 0.4,
        warning: 'Image appears blurry or low quality. Text extraction may be inaccurate.'
      };
    }
    
    // Good quality
    return { score: 1.0 };
    
  } catch (error) {
    console.error('Error checking image quality:', error);
    return { score: 0.5, warning: 'Could not analyze image quality' };
  }
}
