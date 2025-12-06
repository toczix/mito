import { useState, useEffect, useRef } from 'react';
import { PdfUploader } from '@/components/PdfUploader';
import { LoadingState, type FileProgress } from '@/components/LoadingState';
import { AnalysisResults } from '@/components/AnalysisResults';
import { ClientConfirmation } from '@/components/ClientConfirmation';
import { VerificationBanner } from '@/components/VerificationBanner';
import { UpgradeModal } from '@/components/UpgradeModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { processMultiplePdfs } from '@/lib/pdf-processor';
import { extractBiomarkersFromPdfs, type PatientInfo, consolidatePatientInfo, type ClaudeResponseBatch } from '@/lib/claude-service';
import { matchBiomarkersWithRanges } from '@/lib/analyzer';
import { createAnalysis } from '@/lib/analysis-service';
import { matchOrCreateClient, autoCreateClient, type ClientMatchResult } from '@/lib/client-matcher';
import type { AnalysisResult, ExtractedBiomarker } from '@/lib/biomarkers';
import { AlertCircle, Copy, CheckCircle } from 'lucide-react';
import { isSupabaseEnabled } from '@/lib/supabase';
import { AuthService, type AuthUser } from '@/lib/auth-service';
import { canAnalyzeClient } from '@/lib/subscription-service';
import { Button } from '@/components/ui/button';

const GLOBAL_TIMEOUT_MS = 120000;

interface DiagnosticInfo {
  timestamp: string;
  lastProgress: number;
  lastMessage: string;
  filesProcessing: string[];
  userAgent: string;
  errorCode: string;
}

function generateDiagnosticInfo(
  progress: number,
  message: string,
  fileProgress: FileProgress[],
  errorMessage?: string
): DiagnosticInfo {
  const processingFiles = fileProgress
    .filter(f => f.status === 'processing')
    .map(f => f.fileName);
  
  return {
    timestamp: new Date().toISOString(),
    lastProgress: progress,
    lastMessage: message,
    filesProcessing: processingFiles,
    userAgent: navigator.userAgent.substring(0, 100),
    errorCode: `MITO-${Date.now().toString(36).toUpperCase()}-${errorMessage ? 'ERR' : 'TIMEOUT'}`
  };
}

function formatDiagnosticForCopy(info: DiagnosticInfo, errorMessage?: string): string {
  return `--- Mito Diagnostic Report ---
Error Code: ${info.errorCode}
Time: ${info.timestamp}
Progress: ${info.lastProgress}%
Status: ${info.lastMessage}
Files in progress: ${info.filesProcessing.length > 0 ? info.filesProcessing.join(', ') : 'None'}
${errorMessage ? `Error: ${errorMessage}` : 'Issue: Processing timeout - analysis did not complete within 2 minutes'}
Browser: ${info.userAgent}
---`;
}

type AppState = 'upload' | 'processing' | 'confirmation' | 'analyzing' | 'results' | 'error';

export function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<AppState>('upload');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClientName, setSelectedClientName] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string>('Processing...');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);

  // Get current user for email verification check
  useEffect(() => {
    if (isSupabaseEnabled) {
      AuthService.getCurrentUser()
        .then(setUser)
        .catch(() => setUser(null));
    }
  }, []);
  
  // Step 1: Confirmation state
  const [consolidatedPatientInfo, setConsolidatedPatientInfo] = useState<PatientInfo | null>(null);
  const [matchResult, setMatchResult] = useState<ClientMatchResult | null>(null);
  const [extractedBiomarkers, setExtractedBiomarkers] = useState<ExtractedBiomarker[]>([]);
  
  const [extractedAnalyses, setExtractedAnalyses] = useState<Array<{
    patientInfo: PatientInfo;
    results: AnalysisResult[];
    biomarkers: ExtractedBiomarker[];
    fileName: string;
    panelName: string;
  }>>([]);
  const [savedAnalysesCount, setSavedAnalysesCount] = useState<number>(0);
  const [patientInfoDiscrepancies, setPatientInfoDiscrepancies] = useState<string[]>([]);
  
  // Subscription & paywall state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [analysisLimitInfo, setAnalysisLimitInfo] = useState<{
    currentCount: number;
    patientName: string;
  } | null>(null);
  
  // Diagnostic state for error reporting
  const [diagnosticInfo, setDiagnosticInfo] = useState<DiagnosticInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef({ progress: 0, message: '' });
  const fileProgressRef = useRef<FileProgress[]>([]);

  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('Please select at least one PDF file');
      return;
    }

    setState('processing');
    setError(null);
    setDiagnosticInfo(null);
    setSavedAnalysesCount(0);
    setProcessingProgress(0);
    setFileProgress([]);
    progressRef.current = { progress: 0, message: 'Starting...' };
    fileProgressRef.current = [];

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    let analysisCompleted = false;
    
    const cleanupAndMarkComplete = () => {
      analysisCompleted = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    timeoutRef.current = setTimeout(() => {
      if (!analysisCompleted) {
        console.error('⏱️ Global timeout triggered after 2 minutes');
        const diagInfo = generateDiagnosticInfo(
          progressRef.current.progress,
          progressRef.current.message,
          fileProgressRef.current
        );
        setDiagnosticInfo(diagInfo);
        setError('Analysis is taking too long. The processing did not complete within 2 minutes. This may be due to server issues or file complexity. Please try again or contact support with the diagnostic info below.');
        setState('error');
      }
    }, GLOBAL_TIMEOUT_MS);

    try {
      // Filter out oversized files (>10MB) before processing
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const validFiles = files.filter(f => f.size <= MAX_FILE_SIZE);
      const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE);

      if (oversizedFiles.length > 0) {
        const oversizedNames = oversizedFiles.map(f => f.name).join(', ');
        console.warn(`⚠️ Skipping ${oversizedFiles.length} oversized file(s): ${oversizedNames}`);
      }

      if (validFiles.length === 0) {
        cleanupAndMarkComplete();
        setError('All selected files exceed the 10 MB limit. Please select smaller files.');
        setState('upload');
        return;
      }

      // OCR/Extraction phase: 0-20%
      const updateProgress = (progress: number, message: string) => {
        setProcessingProgress(progress);
        setProcessingMessage(message);
        progressRef.current = { progress, message };
      };
      
      updateProgress(5, `Extracting text from ${validFiles.length} PDF(s)...`);

      const processedPdfs = await processMultiplePdfs(
        validFiles,
        (fileName, ocrProgress) => {
          // Map OCR progress (0-100) to UI progress range (5-20%)
          // Each file gets equal portion of the 15% range
          const progressPerFile = 15 / validFiles.length;
          const fileIndex = validFiles.findIndex(f => f.name === fileName);
          const baseProgress = 5 + (fileIndex * progressPerFile);
          const currentProgress = baseProgress + (ocrProgress / 100) * progressPerFile;

          // Check if this is a large file to show appropriate message
          const file = validFiles.find(f => f.name === fileName);
          const isLarge = file && file.size > 8 * 1024 * 1024; // Over 8MB

          // Cap at 20% to prevent going over during OCR phase
          const ocrProgressNum = Math.min(20, Math.round(currentProgress));
          const ocrMessage = isLarge 
            ? `Running OCR on ${fileName}... ${ocrProgress}% (large file - may take longer)`
            : `Running OCR on ${fileName}... ${ocrProgress}%`;
          updateProgress(ocrProgressNum, ocrMessage);
        }
      );
      updateProgress(20, 'OCR complete, starting analysis...');

      // Notify user if files were skipped
      if (oversizedFiles.length > 0) {
        updateProgress(20, `⚠️ Skipped ${oversizedFiles.length} oversized file(s). Processing ${validFiles.length} valid file(s)...`);
        // Brief pause to show the message
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Process all files regardless of quality, but log warnings
      const qualityWarnings: string[] = [];
      processedPdfs.forEach(pdf => {
        if (pdf.qualityWarning && pdf.qualityScore && pdf.qualityScore < 0.5) {
          qualityWarnings.push(`${pdf.fileName}: ${pdf.qualityWarning}`);
        }
      });

      if (qualityWarnings.length > 0) {
        console.warn(`⚠️ Quality warnings (attempting to extract anyway):\n${qualityWarnings.join('\n')}`);
      }

      const validPdfs = processedPdfs;

      // Initialize file progress tracking
      const initialFileProgress: FileProgress[] = validPdfs.map(pdf => ({
        fileName: pdf.fileName,
        status: 'pending' as const
      }));
      setFileProgress(initialFileProgress);
      fileProgressRef.current = initialFileProgress;
      
      const updateFileProgress = (updater: (prev: FileProgress[]) => FileProgress[]) => {
        setFileProgress(prev => {
          const updated = updater(prev);
          fileProgressRef.current = updated;
          return updated;
        });
      };

      updateProgress(20, `Analyzing ${validPdfs.length} document(s) with Claude AI...`);

      let completedFiles = 0;
      const totalFiles = validPdfs.length;

      const claudeResponses: ClaudeResponseBatch = await extractBiomarkersFromPdfs(
        validPdfs,
        (_current, _total, _batchInfo, status) => {
          // Update file progress based on status
          if (status) {
            if (status.startsWith('processing')) {
              const parts = status.split(' ');
              const fileName = parts.slice(1).join(' ');
              const msg = `Processing ${fileName}...`;
              updateProgress(progressRef.current.progress, msg);
              updateFileProgress(prev => prev.map(f =>
                f.fileName === fileName ? { ...f, status: 'processing' as const } : f
              ));
            } else if (status.startsWith('completed')) {
              const parts = status.split(' ');
              const fileName = parts.slice(1).join(' ');
              completedFiles++;

              // Calculate granular progress: 20% + (completed/total * 70%)
              const analysisProgress = 20 + Math.round((completedFiles / totalFiles) * 70);
              const msg = `Completed ${fileName} (${completedFiles}/${totalFiles})`;
              updateProgress(analysisProgress, msg);

              updateFileProgress(prev => prev.map(f =>
                f.fileName === fileName ? { ...f, status: 'completed' as const } : f
              ));
            } else if (status.includes('page-progress')) {
              // Handle page-level progress updates for parallel processing
              // Format: "processing fileName page-progress pagesComplete/totalPages percentage%"
              const match = status.match(/processing (.+?) page-progress (\d+)\/(\d+) (\d+)%/);
              if (match) {
                const [, fileName, pagesComplete, totalPages, percentage] = match;

                // Update overall progress based on page completion
                // Map page progress to the 20-90% range (70% total)
                const fileWeight = 70 / totalFiles; // Each file gets equal weight
                const fileIndex = validPdfs.findIndex(p => p.fileName === fileName);
                const baseProgress = 20 + (fileIndex * fileWeight);
                const fileProgressCalc = (parseInt(percentage) / 100) * fileWeight;
                const overallProgress = Math.min(90, Math.round(baseProgress + fileProgressCalc));

                const msg = `Processing ${fileName}: ${pagesComplete}/${totalPages} pages (${percentage}%)`;
                updateProgress(overallProgress, msg);

                updateFileProgress(prev => prev.map(f =>
                  f.fileName === fileName ? {
                    ...f,
                    status: 'processing' as const,
                    error: `${pagesComplete}/${totalPages} pages (${percentage}%)`
                  } : f
                ));
              }
            } else if (status.startsWith('failed')) {
              const fileName = status.replace('failed ', '');
              completedFiles++;

              // Count failed files toward progress too
              const analysisProgress = 20 + Math.round((completedFiles / totalFiles) * 70);
              const msg = `Failed ${fileName} (${completedFiles}/${totalFiles})`;
              updateProgress(analysisProgress, msg);

              updateFileProgress(prev => prev.map(f =>
                f.fileName === fileName ? { ...f, status: 'error' as const, error: 'Processing failed' } : f
              ));
            } else if (status.startsWith('skipped')) {
              const message = status.replace(/^skipped\s+/i, 'Skipped ');
              updateProgress(progressRef.current.progress, message);
            }
          }
        }
      );
      updateProgress(90, 'AI analysis complete...');

      updateProgress(91, 'Consolidating patient information...');
      
      const allPatientInfos = claudeResponses.map(r => r.patientInfo);
      console.log('📊 All extracted patient infos:', allPatientInfos);
      
      const { consolidated: consolidatedPatientInfo, discrepancies, confidence } = consolidatePatientInfo(allPatientInfos);
      console.log('✅ Consolidated patient info:', consolidatedPatientInfo);
      console.log('⚠️ Discrepancies:', discrepancies);
      console.log('📊 Confidence:', confidence);
      
      // Check for failed files and add to discrepancies
      const failedFiles = claudeResponses._failedFiles || [];
      let allDiscrepancies = [...discrepancies];
      if (failedFiles.length > 0) {
        const oversized = failedFiles.filter(f => f.error.startsWith('Too large:'));
        const skippedFailures = failedFiles.filter(f => f.error.startsWith('Skipped:'));
        const otherFailures = failedFiles.filter(
          f => !f.error.startsWith('Too large:') && !f.error.startsWith('Skipped:')
        );

        if (oversized.length > 0) {
          allDiscrepancies.push(
            `📦 ${oversized.length} file(s) were ignored because they exceed the 10 MB per-file maximum: ${oversized
              .map(f => f.fileName)
              .join(', ')}`
          );
        }

        if (skippedFailures.length > 0) {
          allDiscrepancies.push(
            `⏭️ ${skippedFailures.length} file(s) were skipped: ${skippedFailures
              .map(f => f.fileName)
              .join(', ')}`
          );
        }

        if (otherFailures.length > 0) {
          allDiscrepancies.push(
            `⚠️ ${otherFailures.length} file(s) failed: ${otherFailures.map(f => f.fileName).join(', ')}`
          );
        }
      }
      
      setPatientInfoDiscrepancies(allDiscrepancies);
      
      if (confidence === 'low') {
        console.warn('Low confidence in patient info consolidation:', discrepancies);
      }
      
      // ENHANCED LOGGING: Show what Claude extracted from each PDF
      console.group('📊 Biomarker Extraction Summary');
      claudeResponses.forEach((response, idx) => {
        console.group(`📄 PDF ${idx + 1}: ${validPdfs[idx].fileName}`);

        // ✅ Use normalized biomarkers if available
        const biomarkers = response.normalizedBiomarkers || response.biomarkers;
        const isNormalized = !!response.normalizedBiomarkers;

        console.log(`✅ Extracted ${biomarkers.length} biomarkers${isNormalized ? ' (normalized)' : ''}:`);
        console.table(biomarkers.map(b => ({
          name: b.name,
          value: b.value,
          unit: b.unit,
          ...(isNormalized && 'originalName' in b ? {
            original: b.originalName,
            confidence: `${(b.confidence * 100).toFixed(0)}%`
          } : {})
        })));
        console.groupEnd();
      });
      console.groupEnd();
      
      const allAnalyses: typeof extractedAnalyses = [];
      const allBiomarkersWithMeta: Array<{ biomarker: ExtractedBiomarker; testDate: string | null; pdfIndex: number }> = [];

      for (let i = 0; i < claudeResponses.length; i++) {
        const claudeResponse = claudeResponses[i];
        const processedPdf = validPdfs[i];

        // Progress: 92-96% (processing individual analyses)
        const progressInStep = 92 + (i / claudeResponses.length) * 4;
        updateProgress(Math.round(progressInStep), `Matching biomarkers ${i + 1} of ${claudeResponses.length}...`);

        // ✅ Use normalized biomarkers if available, fall back to raw
        const biomarkers = claudeResponse.normalizedBiomarkers || claudeResponse.biomarkers;
        const isNormalized = !!claudeResponse.normalizedBiomarkers;

        // Convert normalized biomarkers to ExtractedBiomarker format
        const extractedBiomarkers: ExtractedBiomarker[] = biomarkers.map(b => {
          if (isNormalized && 'originalName' in b) {
            // NormalizedBiomarker -> ExtractedBiomarker (preserve metadata)
            // ✅ Use NORMALIZED unit (benchmark standard) for display
            return {
              name: b.name, // Use canonical name
              value: b.value, // Use converted value
              unit: b.unit, // Use normalized/benchmark unit
              testDate: claudeResponse.patientInfo.testDate || undefined,
              // ✅ Preserve normalization metadata
              _normalization: {
                originalName: b.originalName,
                originalValue: b.originalValue,
                originalUnit: b.originalUnit,
                confidence: b.confidence,
                conversionApplied: b.conversionApplied,
                isNumeric: b.isNumeric
              }
            };
          } else {
            // Already ExtractedBiomarker
            return b as ExtractedBiomarker;
          }
        });

        extractedBiomarkers.forEach(biomarker => {
          allBiomarkersWithMeta.push({
            biomarker,
            testDate: claudeResponse.patientInfo.testDate,
            pdfIndex: i
          });
        });

        // Use gender from patient info, default to 'male' if not specified
        const gender = claudeResponse.patientInfo.gender === 'female' ? 'female' : 'male';
        const analysisResults = matchBiomarkersWithRanges(extractedBiomarkers, gender);

        allAnalyses.push({
          patientInfo: claudeResponse.patientInfo,
          results: analysisResults,
          biomarkers: extractedBiomarkers, // Store normalized biomarkers
          fileName: processedPdf.fileName,
          panelName: claudeResponse.panelName,
        });
      }
      
      updateProgress(97, 'Combining biomarkers from all documents...');
      
      const biomarkerMap = new Map<string, { biomarker: ExtractedBiomarker; testDate: string | null; pdfIndex: number }>();
      
      for (const item of allBiomarkersWithMeta) {
        const normalizedName = item.biomarker.name.toLowerCase().trim();
        
        if (!biomarkerMap.has(normalizedName)) {
          biomarkerMap.set(normalizedName, item);
        } else {
          const existing = biomarkerMap.get(normalizedName)!;
          
          if (existing.biomarker.value === 'N/A' && item.biomarker.value !== 'N/A') {
            biomarkerMap.set(normalizedName, item);
          }
          else if (existing.biomarker.value !== 'N/A' && item.biomarker.value !== 'N/A') {
            if (item.testDate && existing.testDate) {
              if (new Date(item.testDate) > new Date(existing.testDate)) {
                biomarkerMap.set(normalizedName, item);
              }
            }
          }
        }
      }
      
      const deduplicatedBiomarkers = Array.from(biomarkerMap.values()).map(item => ({
        ...item.biomarker,
        testDate: item.testDate || undefined,
      }));
      
      // ENHANCED LOGGING: Show deduplicated biomarkers before matching
      console.group('🔄 Biomarker Consolidation');
      console.log(`Total extracted across all PDFs: ${allBiomarkersWithMeta.length}`);
      console.log(`After deduplication: ${deduplicatedBiomarkers.length}`);
      console.table(deduplicatedBiomarkers.map(b => ({
        name: b.name,
        value: b.value,
        unit: b.unit
      })));
      console.groupEnd();
      
      // STEP 1: Save extracted data and show confirmation dialog
      updateProgress(98, 'Preparing results...');
      setConsolidatedPatientInfo(consolidatedPatientInfo);
      setExtractedBiomarkers(deduplicatedBiomarkers);
      setExtractedAnalyses(allAnalyses);

      // ALWAYS show confirmation dialog so user can review/edit patient info
      if (isSupabaseEnabled && consolidatedPatientInfo.name) {
        // With Supabase: Try to match existing client
        updateProgress(99, 'Matching client...');
        const matchResult = await matchOrCreateClient(consolidatedPatientInfo);
        setMatchResult(matchResult);
      } else {
        // Without Supabase: Create a dummy match result for new client
        setMatchResult({
          matched: false,
          client: null,
          confidence: 'low',
          needsConfirmation: true,
          suggestedAction: 'create-new'
        });
      }

      updateProgress(100, 'Complete!');
      cleanupAndMarkComplete();
      setState('confirmation');
    } catch (err) {
      console.error('Analysis error:', err);
      cleanupAndMarkComplete();
      
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      const diagInfo = generateDiagnosticInfo(
        progressRef.current.progress,
        progressRef.current.message,
        fileProgressRef.current,
        errorMessage
      );
      setDiagnosticInfo(diagInfo);
      setError(errorMessage);
      setState('error');
    }
  };

  // STEP 2: After user confirms patient info, create/update client and run analysis
  const handleConfirmClient = async (confirmedInfo: PatientInfo, useExistingClient: boolean) => {
    if (!extractedBiomarkers.length) {
      setError('No biomarker data available');
      setState('error');
      return;
    }

    setState('analyzing');
    setProcessingMessage('Creating analysis...');
    setProcessingProgress(0);

    try {
      let clientId: string = '';
      let clientName: string = confirmedInfo.name || 'Unknown';
      let finalGender: 'male' | 'female' = confirmedInfo.gender === 'female' ? 'female' : 'male';

      setProcessingProgress(20);

      // Only create/use client if Supabase is enabled
      if (isSupabaseEnabled) {
        if (useExistingClient && matchResult?.client) {
          // Use existing client
          clientId = matchResult.client.id;
          clientName = matchResult.client.full_name;
          // Use the client's stored gender (most accurate)
          finalGender = (matchResult.client.gender === 'female' || matchResult.client.gender === 'male') 
            ? matchResult.client.gender 
            : finalGender;
          console.log(`✅ Using existing client: ${clientName} (${finalGender})`);
        } else {
          // Create new client with confirmed info
          setProcessingMessage('Creating new client...');
          const newClient = await autoCreateClient(confirmedInfo);
          if (!newClient) {
            throw new Error('Failed to create client');
          }
          clientId = newClient.id;
          clientName = newClient.full_name;
          finalGender = (newClient.gender === 'female' || newClient.gender === 'male') 
            ? newClient.gender 
            : finalGender;
          console.log(`✅ Created new client: ${clientName} (${finalGender})`);
        }

        setSelectedClientId(clientId);
      } else {
        // No Supabase - just use the confirmed info
        console.log(`✅ Using confirmed info: ${clientName} (${finalGender}) [No database]`);
      }

      setSelectedClientName(clientName);
      setSelectedGender(finalGender);

      // Check subscription limits before proceeding (only if we have a clientId)
      if (isSupabaseEnabled && clientId) {
        setProcessingMessage('Checking subscription limits...');
        setProcessingProgress(35);

        const limitCheck = await canAnalyzeClient(clientId);

        if (!limitCheck.allowed) {
          // User has exceeded their limit - show upgrade modal
          console.log(`❌ Analysis limit exceeded for client ${clientId}:`, limitCheck);
          setAnalysisLimitInfo({
            currentCount: limitCheck.currentCount,
            patientName: clientName,
          });
          setShowUpgradeModal(true);
          setState('upload'); // Return to upload state
          return; // Stop here - don't proceed with analysis
        }

        console.log(`✅ Subscription check passed:`, limitCheck);
      }

      setProcessingProgress(40);
      setProcessingMessage('Grouping biomarkers by test date...');

      // Group biomarkers by their test date using the ORIGINAL extracted biomarkers
      const biomarkersByDate = new Map<string, ExtractedBiomarker[]>();
      
      extractedAnalyses.forEach(analysis => {
        const testDate = analysis.patientInfo.testDate || 'no-date';
        if (!biomarkersByDate.has(testDate)) {
          biomarkersByDate.set(testDate, []);
        }
        
        // Use the original biomarkers from the Claude extraction (not the matched results)
        // This preserves the actual values from each test date
        biomarkersByDate.get(testDate)!.push(...analysis.biomarkers);
      });

      // Deduplicate biomarkers within each date group
      biomarkersByDate.forEach((biomarkers, date) => {
        const deduped = new Map<string, ExtractedBiomarker>();
        biomarkers.forEach(biomarker => {
          const key = biomarker.name.toLowerCase().trim();
          // If we haven't seen this biomarker yet, or this one has a non-N/A value, keep it
          if (!deduped.has(key) || (biomarker.value !== 'N/A' && deduped.get(key)?.value === 'N/A')) {
            deduped.set(key, biomarker);
          }
        });
        biomarkersByDate.set(date, Array.from(deduped.values()));
      });

      console.group('📅 Biomarkers Grouped by Date');
      console.log(`Found ${biomarkersByDate.size} unique date(s)`);
      biomarkersByDate.forEach((biomarkers, date) => {
        console.log(`  ${date}: ${biomarkers.length} biomarkers`);
      });
      console.groupEnd();

      setProcessingProgress(50);
      setProcessingMessage('Generating analysis results...');

      // If we have multiple dates, create separate analyses for each
      let analysesCreated = 0;
      let allResults: AnalysisResult[] = [];

      if (biomarkersByDate.size > 1 && isSupabaseEnabled && clientId) {
        // Multiple test dates - create separate analyses
        console.log('🔄 Creating separate analyses for each test date...');
        
        let dateIndex = 0;
        for (const [testDate, dateBiomarkers] of biomarkersByDate.entries()) {
          dateIndex++;
          const progressInStep = 50 + (dateIndex / biomarkersByDate.size) * 30;
          setProcessingProgress(Math.round(progressInStep));
          
          if (testDate === 'no-date') {
            console.warn('⚠️ Skipping biomarkers with no test date');
            continue;
          }
          
          setProcessingMessage(`Saving analysis ${dateIndex} of ${biomarkersByDate.size}...`);
          
          // Generate results for this date's biomarkers
          const dateResults = matchBiomarkersWithRanges(dateBiomarkers, finalGender);
          
          // Save analysis with the specific test date
          await createAnalysis(clientId, dateResults, testDate);
          analysesCreated++;
          
          // Merge results for display (keep the most complete/recent biomarker values)
          dateResults.forEach(newResult => {
            const existingIndex = allResults.findIndex(
              r => r.biomarkerName.toLowerCase() === newResult.biomarkerName.toLowerCase()
            );
            if (existingIndex === -1) {
              allResults.push(newResult);
            } else if (newResult.hisValue !== 'N/A' && allResults[existingIndex].hisValue === 'N/A') {
              allResults[existingIndex] = newResult;
            }
          });
        }
        
        setSavedAnalysesCount(analysesCreated);
        console.log(`✅ Created ${analysesCreated} separate analyses`);
      } else {
        // Single test date or no Supabase - create one combined analysis
        const combinedResults = matchBiomarkersWithRanges(extractedBiomarkers, finalGender);
        allResults = combinedResults;

        // ENHANCED LOGGING
        const matched = combinedResults.filter(r => r.hisValue !== 'N/A');
        const missing = combinedResults.filter(r => r.hisValue === 'N/A');
        console.group('🎯 Biomarker Matching Results');
        console.log(`Gender used: ${finalGender}`);
        console.log(`✅ Matched: ${matched.length}`);
        console.log(`❌ Missing: ${missing.length}`);
        if (missing.length > 0) {
          console.warn('Missing biomarkers:', missing.map(m => m.biomarkerName));
        }
        console.groupEnd();

        setProcessingProgress(60);

        // Save to database only if Supabase is enabled and we have a client ID
        if (isSupabaseEnabled && clientId) {
          setProcessingMessage(`Saving analysis for ${clientName}...`);
          // Use the single test date if available, otherwise null
          const singleTestDate = biomarkersByDate.size === 1 
            ? Array.from(biomarkersByDate.keys())[0]
            : null;
          const finalTestDate = (singleTestDate && singleTestDate !== 'no-date') ? singleTestDate : null;
          
          await createAnalysis(clientId, combinedResults, finalTestDate);
          setSavedAnalysesCount(1);
        }
      }

      setProcessingProgress(80);

      // Update results for display (show combined results from all dates)
      setResults(allResults);

      setProcessingProgress(100);
      setState('results');
    } catch (err) {
      console.error('Error creating analysis:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setState('error');
    }
  };

  const handleCancelConfirmation = () => {
    // Go back to upload
    setState('upload');
  };

  const handleReset = () => {
    setFiles([]);
    setResults([]);
    setError(null);
    setDiagnosticInfo(null);
    setCopied(false);
    setExtractedAnalyses([]);
    setSavedAnalysesCount(0);
    setProcessingProgress(0);
    setPatientInfoDiscrepancies([]);
    setConsolidatedPatientInfo(null);
    setMatchResult(null);
    setExtractedBiomarkers([]);
    setState('upload');
  };

  const handleStartOver = () => {
    setFiles([]);
    setResults([]);
    setError(null);
    setDiagnosticInfo(null);
    setCopied(false);
    setSelectedClientId('');
    setSelectedClientName('');
    setExtractedAnalyses([]);
    setSavedAnalysesCount(0);
    setProcessingProgress(0);
    setPatientInfoDiscrepancies([]);
    setState('upload');
  };

  // Check if email verification is required
  const requiresVerification = isSupabaseEnabled && user && !user.email_confirmed_at;
  const displayEmail = user?.email || '';

  return (
    <div className="space-y-4">
      {/* Email Verification Banner */}
      {requiresVerification && displayEmail && (
        <VerificationBanner userEmail={displayEmail} />
      )}

      {/* Hero Section */}
      {state === 'upload' && !requiresVerification && (
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-xl font-bold mb-2">
            Automated Biomarker Analysis
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload clinical pathology reports and patient information will be automatically detected.
            Get instant comparison against optimal reference ranges for all 54 biomarkers.
          </p>
        </div>
      )}


      {/* Error Display */}
      {state === 'error' && error && (
        <div className="max-w-2xl mx-auto space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              <p className="font-semibold mb-1">Analysis Failed</p>
              <p>{error}</p>
            </AlertDescription>
          </Alert>
          
          {/* Diagnostic Info for Support */}
          {diagnosticInfo && (
            <div className="bg-muted p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Diagnostic Information</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const text = formatDiagnosticForCopy(diagnosticInfo, error || undefined);
                    navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy for Support
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                If this problem persists, please copy this information and send it to support.
              </p>
              <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                <code>{formatDiagnosticForCopy(diagnosticInfo, error || undefined)}</code>
              </pre>
            </div>
          )}
          
          <div className="flex justify-center gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Try Again
            </button>
            <button
              onClick={handleStartOver}
              className="px-4 py-2 border border-border rounded-md hover:bg-accent"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* PDF Upload */}
      {state === 'upload' && !requiresVerification && (
        <PdfUploader
          onFilesSelected={handleFilesSelected}
          onAnalyze={handleAnalyze}
          isProcessing={false}
        />
      )}

      {/* Processing (Extraction) */}
      {state === 'processing' && (
        <LoadingState
          message={processingMessage}
          progress={processingProgress}
          fileProgress={fileProgress}
        />
      )}

      {/* Patient Info Confirmation */}
      {state === 'confirmation' && consolidatedPatientInfo && matchResult && (
        <ClientConfirmation
          patientInfo={consolidatedPatientInfo}
          matchResult={matchResult}
          onConfirm={handleConfirmClient}
          onCancel={handleCancelConfirmation}
        />
      )}

      {/* Analyzing (After confirmation) */}
      {state === 'analyzing' && (
        <LoadingState
          message={processingMessage}
          progress={processingProgress}
          fileProgress={fileProgress}
        />
      )}

      {/* Results */}
      {state === 'results' && (
        <div className="space-y-4">
          <AnalysisResults 
            results={results} 
            onReset={handleReset}
            selectedClientId={selectedClientId}
            selectedClientName={selectedClientName}
            gender={selectedGender}
            documentCount={extractedAnalyses.length}
            savedAnalysesCount={savedAnalysesCount}
            patientInfoDiscrepancies={patientInfoDiscrepancies}
          />
        </div>
      )}

      {/* Upgrade Modal (Paywall) */}
      {showUpgradeModal && analysisLimitInfo && (
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          currentCount={analysisLimitInfo.currentCount}
          patientName={analysisLimitInfo.patientName}
        />
      )}
    </div>
  );
}

