import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

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
 * Extract text content from a PDF file, Word document, or process an image
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

  // Check if it's a Word document
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
    console.log(`📄 Processing Word document: ${file.name}`);
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    console.log(`   Extracted ${result.value.length} characters from ${file.name}`);
    
    if (result.messages && result.messages.length > 0) {
      console.warn('   Mammoth warnings:', result.messages);
    }
    
    if (!result.value || result.value.trim().length === 0) {
      throw new Error(
        `No text could be extracted from ${file.name}. ` +
        `This Word document may be empty, corrupted, or contain only images. ` +
        `If it contains scanned images, please convert it to PNG/JPG images instead. ` +
        `Word documents with embedded images cannot be processed - extract the images first.`
      );
    }
    
    if (result.value.trim().length < 100) {
      console.warn(`   ⚠️ Very little text extracted (${result.value.length} chars) - document may be mostly images`);
      throw new Error(
        `${file.name} contains very little extractable text (${result.value.length} characters). ` +
        `If this document contains scanned images or screenshots of lab results, ` +
        `please extract those images and upload them as PNG/JPG files instead.`
      );
    }
    
    console.log('   First 200 chars:', result.value.substring(0, 200));
    console.log(`✅ Word document processed successfully`);
    
    return {
      fileName: file.name,
      extractedText: result.value.trim(),
      pageCount: 1, // Word documents don't have a clear page concept in our context
      isImage: false,
    };
  }

  // Process PDF
  console.log(`📄 Processing PDF: ${file.name}`);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  console.log(`   - PDF has ${pageCount} pages`);
  
  let extractedText = '';

  // Extract text from each page
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    console.log(`   - Page ${pageNum}: Found ${textContent.items.length} text items`);
    
    // Combine text items
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    
    console.log(`   - Page ${pageNum} text length: ${pageText.length} chars`);
    if (pageNum === 1) {
      console.log(`   - Page 1 preview (first 300 chars): "${pageText.substring(0, 300)}"`);
    }
    
    extractedText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
  }

  console.log(`✅ PDF extraction complete: ${extractedText.length} total characters`);
  
  // Check if we actually extracted meaningful text (not just page markers)
  // Page markers add about 20 chars per page, so if total is less than pages * 30, it's probably empty
  const minExpectedChars = pageCount * 50; // Expect at least 50 chars of actual content per page
  
  if (extractedText.trim().length === 0 || extractedText.length < minExpectedChars) {
    console.warn(`⚠️ PDF text extraction failed (${extractedText.length} chars for ${pageCount} pages)`);
    console.log(`🔄 Falling back to Vision API - converting PDF pages to images...`);
    
    // Fallback: Convert PDF pages to images for Vision API
    // We'll only convert the first 5 pages to avoid overwhelming the API
    const pagesToConvert = Math.min(pageCount, 5);
    console.log(`   Converting first ${pagesToConvert} of ${pageCount} pages to images`);
    
    // Render first page as image
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better quality
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not create canvas context for PDF rendering');
    }
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;
    
    // Convert canvas to base64 image
    const imageData = canvas.toDataURL('image/png').split(',')[1];
    
    console.log(`✅ Converted page 1 to image (${imageData.length} bytes)`);
    console.log(`📸 Using Vision API instead of text extraction`);
    
    return {
      fileName: file.name,
      extractedText: '', // No text, will use image
      pageCount: 1, // Only first page for now
      isImage: true,
      imageData: imageData,
      mimeType: 'image/png',
    };
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
 * Validate PDF, Word document, or image file
 */
export function validatePdfFile(file: File): { valid: boolean; error?: string } {
  // Check file type - allow PDFs, Word documents, and images
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ];
  const allowedExtensions = ['.pdf', '.docx', '.png', '.jpg', '.jpeg'];
  
  const hasValidType = allowedTypes.includes(file.type);
  const hasValidExtension = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  
  if (!hasValidType && !hasValidExtension) {
    return { valid: false, error: 'File must be a PDF, DOCX, PNG, or JPG' };
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
