import Tesseract from 'tesseract.js';

/**
 * Extract text from an image using Tesseract OCR
 * @param imageData - Base64 encoded image data
 * @param fileName - Name of the file (for logging)
 * @param onProgress - Optional callback for OCR progress (0-100)
 * @returns Extracted text
 */
export async function extractTextFromImage(
  imageData: string,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    console.log(`📸 Running OCR on ${fileName}...`);

    // Create worker
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        // Log progress for user feedback
        if (m.status === 'recognizing text') {
          const progressPercent = Math.round(m.progress * 100);
          console.log(`   OCR progress: ${progressPercent}%`);

          // Call the progress callback if provided
          if (onProgress) {
            onProgress(progressPercent);
          }
        }
      },
    });

    // Convert base64 to image
    const image = `data:image/png;base64,${imageData}`;

    // Perform OCR
    const { data: { text } } = await worker.recognize(image);

    // Terminate worker to free memory
    await worker.terminate();

    console.log(`✅ OCR extracted ${text.length} characters from ${fileName}`);
    return text;
  } catch (error: any) {
    console.error(`❌ OCR failed for ${fileName}:`, error.message);
    // Return empty string on failure - Claude will still attempt analysis
    return '';
  }
}

/**
 * Extract text from multiple image pages
 * @param imagePages - Array of base64 encoded images
 * @param fileName - Name of the file (for logging)
 * @param onProgress - Optional callback for overall OCR progress (0-100)
 * @returns Combined text from all pages
 */
export async function extractTextFromPages(
  imagePages: string[],
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  console.log(`📄 Running OCR on ${imagePages.length} pages from ${fileName}...`);

  const results: string[] = [];

  for (let i = 0; i < imagePages.length; i++) {
    const pageNum = i + 1;
    console.log(`   Page ${pageNum}/${imagePages.length}`);

    // Calculate progress for this page: each page is a fraction of total
    const pageStartProgress = (i / imagePages.length) * 100;
    const pageEndProgress = ((i + 1) / imagePages.length) * 100;

    const pageText = await extractTextFromImage(
      imagePages[i],
      `${fileName} (page ${pageNum})`,
      (pageProgress) => {
        // Map page progress (0-100) to overall progress range
        if (onProgress) {
          const overallProgress = pageStartProgress + (pageProgress / 100) * (pageEndProgress - pageStartProgress);
          onProgress(Math.round(overallProgress));
        }
      }
    );
    results.push(`=== PAGE ${pageNum} ===\n${pageText}`);
  }

  const combinedText = results.join('\n\n');
  console.log(`✅ OCR complete: ${combinedText.length} total characters from ${fileName}`);

  return combinedText;
}
