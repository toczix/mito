import { useState } from 'react';
import { PdfUploader } from '@/components/PdfUploader';
import { LoadingState } from '@/components/LoadingState';
import { AnalysisResults } from '@/components/AnalysisResults';
import { ClientConfirmation } from '@/components/ClientConfirmation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { processMultiplePdfs, type ProcessedPDF } from '@/lib/pdf-processor';
import { extractBiomarkersFromPdfs, type PatientInfo, consolidatePatientInfo } from '@/lib/claude-service';
import { matchBiomarkersWithRanges } from '@/lib/analyzer';
import { createAnalysis } from '@/lib/analysis-service';
import { matchOrCreateClient, autoCreateClient, type ClientMatchResult } from '@/lib/client-matcher';
import type { AnalysisResult, ExtractedBiomarker } from '@/lib/biomarkers';
import { AlertCircle, UserCircle, CheckCircle2 } from 'lucide-react';
import { getClaudeApiKey, isSupabaseEnabled } from '@/lib/supabase';

type AppState = 'upload' | 'processing' | 'confirmation' | 'analyzing' | 'results' | 'error';

export function HomePage() {
  const [state, setState] = useState<AppState>('upload');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClientName, setSelectedClientName] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string>('Processing...');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  
  // Step 1: Confirmation state
  const [consolidatedPatientInfo, setConsolidatedPatientInfo] = useState<PatientInfo | null>(null);
  const [matchResult, setMatchResult] = useState<ClientMatchResult | null>(null);
  const [extractedBiomarkers, setExtractedBiomarkers] = useState<ExtractedBiomarker[]>([]);
  
  const [extractedAnalyses, setExtractedAnalyses] = useState<Array<{
    patientInfo: PatientInfo;
    results: AnalysisResult[];
    fileName: string;
    panelName: string;
  }>>([]);
  const [savedAnalysesCount, setSavedAnalysesCount] = useState<number>(0);
  const [patientInfoDiscrepancies, setPatientInfoDiscrepancies] = useState<string[]>([]);

  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('Please select at least one PDF file');
      return;
    }

    const currentApiKey = await getClaudeApiKey();
    if (!currentApiKey) {
      setError('Please set your Claude API key in the Settings tab first.');
      setState('error');
      return;
    }

    setState('processing');
    setError(null);
    setSavedAnalysesCount(0);
    setProcessingProgress(0);

    try {
      setProcessingMessage(`Extracting text from ${files.length} PDF(s)...`);
      setProcessingProgress(5);
      const processedPdfs = await processMultiplePdfs(files);
      
      const qualityIssues: string[] = [];
      const validPdfs: ProcessedPDF[] = [];
      
      processedPdfs.forEach(pdf => {
        if (pdf.qualityWarning && pdf.qualityScore && pdf.qualityScore < 0.5) {
          qualityIssues.push(`${pdf.fileName}: ${pdf.qualityWarning}`);
        } else {
          validPdfs.push(pdf);
        }
      });
      
      if (qualityIssues.length > 0) {
        const errorMsg = `Some files have quality issues and were skipped:\n${qualityIssues.join('\n')}`;
        if (validPdfs.length === 0) {
          setError(errorMsg);
          setState('error');
          return;
        } else {
          console.warn(errorMsg);
        }
      }
      
      setProcessingProgress(20);
      
      setProcessingMessage(`Analyzing ${validPdfs.length} document(s) with Claude AI...`);
      setProcessingProgress(30);
      const claudeResponses = await extractBiomarkersFromPdfs(
        currentApiKey, 
        validPdfs,
        (current, total, batchInfo) => {
          const progress = 30 + Math.round((current / total) * 40);
          setProcessingProgress(progress);
          setProcessingMessage(`Analyzing document ${current + 1} of ${total}${batchInfo}...`);
        }
      );
      setProcessingProgress(70);
      
      setProcessingMessage('Consolidating patient information...');
      setProcessingProgress(70);
      
      const allPatientInfos = claudeResponses.map(r => r.patientInfo);
      const { consolidated: consolidatedPatientInfo, discrepancies, confidence } = consolidatePatientInfo(allPatientInfos);
      
      setPatientInfoDiscrepancies(discrepancies);
      
      if (confidence === 'low') {
        console.warn('Low confidence in patient info consolidation:', discrepancies);
      }
      
      // ENHANCED LOGGING: Show what Claude extracted from each PDF
      console.group('📊 Biomarker Extraction Summary');
      claudeResponses.forEach((response, idx) => {
        console.group(`📄 PDF ${idx + 1}: ${validPdfs[idx].fileName}`);
        console.log(`✅ Extracted ${response.biomarkers.length} biomarkers:`);
        console.table(response.biomarkers.map(b => ({
          name: b.name,
          value: b.value,
          unit: b.unit
        })));
        console.groupEnd();
      });
      console.groupEnd();
      
      const allAnalyses: typeof extractedAnalyses = [];
      const allBiomarkersWithMeta: Array<{ biomarker: ExtractedBiomarker; testDate: string | null; pdfIndex: number }> = [];
      
      for (let i = 0; i < claudeResponses.length; i++) {
        const claudeResponse = claudeResponses[i];
        const processedPdf = validPdfs[i];
        
        const progressInStep = 75 + (i / claudeResponses.length) * 10;
        setProcessingProgress(Math.round(progressInStep));
        setProcessingMessage(`Processing analysis ${i + 1} of ${claudeResponses.length}...`);
        
        claudeResponse.biomarkers.forEach(biomarker => {
          allBiomarkersWithMeta.push({
            biomarker,
            testDate: claudeResponse.patientInfo.testDate,
            pdfIndex: i
          });
        });
        
        // Use gender from patient info, default to 'male' if not specified
        const gender = claudeResponse.patientInfo.gender === 'female' ? 'female' : 'male';
        const analysisResults = matchBiomarkersWithRanges(claudeResponse.biomarkers, gender);
        
        allAnalyses.push({
          patientInfo: claudeResponse.patientInfo,
          results: analysisResults,
          fileName: processedPdf.fileName,
          panelName: claudeResponse.panelName,
        });
      }
      
      setProcessingMessage('Combining biomarkers from all documents...');
      setProcessingProgress(85);
      
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
      setProcessingProgress(90);
      setConsolidatedPatientInfo(consolidatedPatientInfo);
      setExtractedBiomarkers(deduplicatedBiomarkers);
      setExtractedAnalyses(allAnalyses);
      
      // Check if Supabase is enabled and we have patient info
      if (isSupabaseEnabled && consolidatedPatientInfo.name) {
        setProcessingMessage('Matching client...');
        const matchResult = await matchOrCreateClient(consolidatedPatientInfo);
        setMatchResult(matchResult);
        setProcessingProgress(100);
        
        // Show confirmation dialog
        setState('confirmation');
      } else {
        // No Supabase - go straight to results with extracted gender
        const extractedGender = consolidatedPatientInfo.gender === 'female' ? 'female' : 'male';
        const combinedResults = matchBiomarkersWithRanges(deduplicatedBiomarkers, extractedGender);
        
        console.group('🎯 Biomarker Matching Results');
        console.log(`Gender used: ${extractedGender}`);
        console.log(`✅ Matched: ${combinedResults.filter(r => r.hisValue !== 'N/A').length}`);
        console.groupEnd();
        
        setResults(combinedResults);
        setSelectedGender(extractedGender);
        setProcessingProgress(100);
        setState('results');
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
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
      let clientId: string;
      let clientName: string;
      let finalGender: 'male' | 'female';

      setProcessingProgress(20);

      if (useExistingClient && matchResult?.client) {
        // Use existing client
        clientId = matchResult.client.id;
        clientName = matchResult.client.full_name;
        // Use the client's stored gender (most accurate)
        finalGender = (matchResult.client.gender === 'female' || matchResult.client.gender === 'male') 
          ? matchResult.client.gender 
          : (confirmedInfo.gender === 'female' ? 'female' : 'male');
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
          : 'male';
        console.log(`✅ Created new client: ${clientName} (${finalGender})`);
      }

      setSelectedClientId(clientId);
      setSelectedClientName(clientName);
      setSelectedGender(finalGender);

      setProcessingProgress(40);
      setProcessingMessage('Generating analysis results...');

      // Generate results with the correct gender
      const combinedResults = matchBiomarkersWithRanges(extractedBiomarkers, finalGender);

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
      setProcessingMessage(`Saving analysis for ${clientName}...`);

      // Save to database
      await createAnalysis(clientId, combinedResults, confirmedInfo.testDate);
      setSavedAnalysesCount(1);

      setProcessingProgress(80);

      // Update results
      setResults(combinedResults);

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
    setSelectedClientId('');
    setSelectedClientName('');
    setExtractedAnalyses([]);
    setSavedAnalysesCount(0);
    setProcessingProgress(0);
    setPatientInfoDiscrepancies([]);
    setState('upload');
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      {state === 'upload' && (
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-2xl font-bold mb-3">
            Automated Biomarker Analysis
          </h2>
          <p className="text-muted-foreground">
            Upload clinical pathology reports and patient information will be automatically detected.
            Get instant comparison against optimal reference ranges for all 54 biomarkers.
          </p>
        </div>
      )}

      {/* Summary Badge */}
      {(state === 'results') && extractedAnalyses.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-3">
          {patientInfoDiscrepancies.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold text-sm">Patient info consolidated from multiple documents:</p>
                <div className="mt-2 space-y-1 text-xs">
                  {patientInfoDiscrepancies.map((discrepancy, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{discrepancy}</span>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="p-4 bg-secondary rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-semibold">
                  {extractedAnalyses.length === 1 
                    ? 'Processed 1 document'
                    : `${extractedAnalyses.length} documents`}
                </span>
              </div>
              {savedAnalysesCount > 0 && (
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>{savedAnalysesCount} {savedAnalysesCount > 1 ? 'analyses' : 'analysis'} saved to {selectedClientName}</span>
                </div>
              )}
            </div>
          </div>
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
      {state === 'upload' && (
        <PdfUploader
          onFilesSelected={handleFilesSelected}
          onAnalyze={handleAnalyze}
          isProcessing={false}
        />
      )}

      {/* Processing (Extraction) */}
      {state === 'processing' && (
        <LoadingState message={processingMessage} progress={processingProgress} />
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
        <LoadingState message={processingMessage} progress={processingProgress} />
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
          />
        </div>
      )}
    </div>
  );
}

