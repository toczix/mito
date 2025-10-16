import { useState } from 'react';
import { PdfUploader } from '@/components/PdfUploader';
import { LoadingState } from '@/components/LoadingState';
import { AnalysisResults } from '@/components/AnalysisResults';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { processMultiplePdfs, type ProcessedPDF } from '@/lib/pdf-processor';
import { extractBiomarkersFromPdfs, type PatientInfo, consolidatePatientInfo } from '@/lib/claude-service';
import { matchBiomarkersWithRanges } from '@/lib/analyzer';
import { createAnalysis } from '@/lib/analysis-service';
import { matchOrCreateClient, autoCreateClient } from '@/lib/client-matcher';
import type { AnalysisResult, ExtractedBiomarker } from '@/lib/biomarkers';
import { AlertCircle, UserCircle, CheckCircle2 } from 'lucide-react';
import { getClaudeApiKey, isSupabaseEnabled } from '@/lib/supabase';

type AppState = 'upload' | 'processing' | 'results' | 'error';

export function HomePage() {
  const [state, setState] = useState<AppState>('upload');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClientName, setSelectedClientName] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string>('Processing...');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  
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
        
        const analysisResults = matchBiomarkersWithRanges(claudeResponse.biomarkers);
        
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
      const combinedResults = matchBiomarkersWithRanges(deduplicatedBiomarkers);
      
      const uniqueTestDates = Array.from(
        new Set(
          allBiomarkersWithMeta
            .map(item => item.testDate)
            .filter((date): date is string => date !== null)
        )
      );
      const hasMultipleDates = uniqueTestDates.length > 1;
      
      setProcessingProgress(90);
      let savedCount = 0;
      
      if (isSupabaseEnabled && consolidatedPatientInfo.name) {
        setProcessingMessage('Matching or creating client...');
        
        const matchResult = await matchOrCreateClient(consolidatedPatientInfo);
        
        let clientId: string;
        let clientName: string;
        
        if (matchResult.client) {
          clientId = matchResult.client.id;
          clientName = matchResult.client.full_name;
          console.log(`Matched existing client: ${clientName}`);
        } else {
          const newClient = await autoCreateClient(consolidatedPatientInfo);
          if (!newClient) {
            throw new Error('Failed to create client');
          }
          clientId = newClient.id;
          clientName = newClient.full_name;
          console.log(`Created new client: ${clientName}`);
        }
        
        setSelectedClientId(clientId);
        setSelectedClientName(clientName);
        
        if (hasMultipleDates) {
          setProcessingMessage(`Saving ${uniqueTestDates.length} analyses for ${clientName}...`);
          
          for (const testDate of uniqueTestDates) {
            const biomarkersForDate = allBiomarkersWithMeta
              .filter(item => item.testDate === testDate)
              .map(item => item.biomarker);
            
            const resultsForDate = matchBiomarkersWithRanges(biomarkersForDate);
            
            await createAnalysis(clientId, resultsForDate, testDate);
            savedCount++;
          }
        } else {
          setProcessingMessage(`Saving analysis for ${clientName}...`);
          
          await createAnalysis(clientId, combinedResults, consolidatedPatientInfo.testDate);
          savedCount = 1;
        }
      }
      
      setExtractedAnalyses(allAnalyses);
      setSavedAnalysesCount(savedCount);
      setResults(combinedResults);
      
      setProcessingProgress(100);
      setState('results');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setState('error');
    }
  };

  const handleReset = () => {
    setFiles([]);
    setResults([]);
    setError(null);
    setExtractedAnalyses([]);
    setSavedAnalysesCount(0);
    setProcessingProgress(0);
    setPatientInfoDiscrepancies([]);
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

      {/* Processing */}
      {state === 'processing' && (
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
          />
        </div>
      )}
    </div>
  );
}

