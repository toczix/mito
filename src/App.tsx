import { useState } from 'react';
import { PdfUploader } from '@/components/PdfUploader';
import { LoadingState } from '@/components/LoadingState';
import { AnalysisResults } from '@/components/AnalysisResults';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { processMultiplePdfs } from '@/lib/pdf-processor';
import { extractBiomarkersFromPdfs, type PatientInfo } from '@/lib/claude-service';
import { matchBiomarkersWithRanges } from '@/lib/analyzer';
import { createAnalysis } from '@/lib/analysis-service';
import { matchOrCreateClient, autoCreateClient } from '@/lib/client-matcher';
import type { AnalysisResult, ExtractedBiomarker } from '@/lib/biomarkers';
import { AlertCircle, Activity, FileText, Settings as SettingsIcon, Users, UserCircle } from 'lucide-react';
import { BenchmarkManager } from '@/components/BenchmarkManager';
import { ClientLibrary } from '@/components/ClientLibrary';
import { Settings } from '@/components/Settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { getClaudeApiKey, isSupabaseEnabled } from '@/lib/supabase';

type AppState = 'upload' | 'processing' | 'results' | 'error';

function App() {
  const [state, setState] = useState<AppState>('upload');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClientName, setSelectedClientName] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string>('Processing...');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  
  // New state for auto-detection flow (batch processing)
  const [extractedAnalyses, setExtractedAnalyses] = useState<Array<{
    patientInfo: PatientInfo;
    results: AnalysisResult[];
    fileName: string;
    panelName: string;
  }>>([]);
  const [savedAnalysesCount, setSavedAnalysesCount] = useState<number>(0);

  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('Please select at least one PDF file');
      return;
    }

    // Get API key from Supabase (or allow without if not configured)
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
      // Step 1: Process PDFs (extract text) - 0-20%
      setProcessingMessage(`Extracting text from ${files.length} PDF(s)...`);
      setProcessingProgress(5);
      const processedPdfs = await processMultiplePdfs(files);
      setProcessingProgress(20);
      
      // Step 2: Extract biomarkers AND patient info from EACH PDF separately - 20-70%
      setProcessingMessage(`Analyzing ${processedPdfs.length} document(s) with Claude AI...`);
      setProcessingProgress(30);
      const claudeResponses = await extractBiomarkersFromPdfs(currentApiKey, processedPdfs);
      setProcessingProgress(70);
      
      // Step 3: Process each analysis and combine biomarkers - 70-85%
      const allAnalyses: typeof extractedAnalyses = [];
      const allBiomarkersWithMeta: Array<{ biomarker: ExtractedBiomarker; testDate: string | null; pdfIndex: number }> = [];
      const testDates: string[] = [];
      let savedCount = 0;
      let primaryPatientInfo: PatientInfo | null = null;
      
      for (let i = 0; i < claudeResponses.length; i++) {
        const claudeResponse = claudeResponses[i];
        const processedPdf = processedPdfs[i];
        
        const progressInStep = 70 + (i / claudeResponses.length) * 15;
        setProcessingProgress(Math.round(progressInStep));
        setProcessingMessage(`Processing analysis ${i + 1} of ${claudeResponses.length}...`);
        
        // Collect all biomarkers with metadata (which PDF they came from)
        claudeResponse.biomarkers.forEach(biomarker => {
          allBiomarkersWithMeta.push({
            biomarker,
            testDate: claudeResponse.patientInfo.testDate,
            pdfIndex: i
          });
        });
        
        // Collect test dates
        if (claudeResponse.patientInfo.testDate) {
          testDates.push(claudeResponse.patientInfo.testDate);
        }
        
        // Use first patient info as primary
        if (!primaryPatientInfo && claudeResponse.patientInfo.name) {
          primaryPatientInfo = claudeResponse.patientInfo;
        }
        
        // Match with optimal ranges
        const analysisResults = matchBiomarkersWithRanges(claudeResponse.biomarkers);
        
        // Store individual analysis info (for future multi-analysis support)
        allAnalyses.push({
          patientInfo: claudeResponse.patientInfo,
          results: analysisResults,
          fileName: processedPdf.fileName,
          panelName: claudeResponse.panelName,
        });
      }
      
      // Combine all biomarkers and match with ranges - 85-90%
      setProcessingMessage('Combining biomarkers from all documents...');
      setProcessingProgress(85);
      
      // Deduplicate biomarkers - keep most recent or first valid value
      const biomarkerMap = new Map<string, { biomarker: ExtractedBiomarker; testDate: string | null; pdfIndex: number }>();
      
      for (const item of allBiomarkersWithMeta) {
        const normalizedName = item.biomarker.name.toLowerCase().trim();
        
        if (!biomarkerMap.has(normalizedName)) {
          // First occurrence, add it
          biomarkerMap.set(normalizedName, item);
        } else {
          const existing = biomarkerMap.get(normalizedName)!;
          
          // Replace if existing is N/A but new one has a value
          if (existing.biomarker.value === 'N/A' && item.biomarker.value !== 'N/A') {
            biomarkerMap.set(normalizedName, item);
          }
          // If both have values, prefer the one with more recent date
          else if (existing.biomarker.value !== 'N/A' && item.biomarker.value !== 'N/A') {
            if (item.testDate && existing.testDate) {
              // Compare dates, keep more recent
              if (new Date(item.testDate) > new Date(existing.testDate)) {
                biomarkerMap.set(normalizedName, item);
              }
            }
            // If dates not available, keep first one (no change needed)
          }
        }
      }
      
      const deduplicatedBiomarkers = Array.from(biomarkerMap.values()).map(item => item.biomarker);
      const combinedResults = matchBiomarkersWithRanges(deduplicatedBiomarkers);
      
      // Determine if we should save as one or multiple analyses
      const uniqueDates = [...new Set(testDates)];
      const hasMixedDates = uniqueDates.length > 1;
      
      // If Supabase enabled, save analysis - 90-100%
      setProcessingProgress(90);
      if (isSupabaseEnabled && primaryPatientInfo) {
        if (hasMixedDates) {
          // Save each PDF as separate analysis (different lab visits)
          setProcessingMessage(`Saving ${allAnalyses.length} analyses from different dates...`);
          
          for (let i = 0; i < allAnalyses.length; i++) {
            const analysis = allAnalyses[i];
            
            // Update progress for each save
            const saveProgress = 90 + ((i + 1) / allAnalyses.length) * 10;
            setProcessingProgress(Math.round(saveProgress));
            
            // Match or create client
            const matchResult = await matchOrCreateClient(analysis.patientInfo);
            
            let clientId: string;
            let clientName: string;
            
            if (matchResult.client) {
              clientId = matchResult.client.id;
              clientName = matchResult.client.full_name;
            } else if (analysis.patientInfo.name) {
              const newClient = await autoCreateClient(analysis.patientInfo);
              if (!newClient) {
                console.error(`Failed to create client for ${analysis.patientInfo.name}`);
                continue;
              }
              clientId = newClient.id;
              clientName = newClient.full_name;
            } else {
              continue;
            }
            
            // Save individual analysis
            await createAnalysis(clientId, analysis.results, analysis.patientInfo.testDate);
            savedCount++;
            
            setSelectedClientId(clientId);
            setSelectedClientName(clientName);
          }
        } else {
          // Save as single combined analysis (same lab visit, multiple panels)
          setProcessingMessage('Saving combined analysis...');
          
          const matchResult = await matchOrCreateClient(primaryPatientInfo);
          
          let clientId: string;
          let clientName: string;
          
          if (matchResult.client) {
            clientId = matchResult.client.id;
            clientName = matchResult.client.full_name;
          } else if (primaryPatientInfo.name) {
            const newClient = await autoCreateClient(primaryPatientInfo);
            if (!newClient) {
              throw new Error('Failed to create client');
            }
            clientId = newClient.id;
            clientName = newClient.full_name;
          } else {
            throw new Error('No patient information found');
          }
          
          // Save combined analysis
          await createAnalysis(clientId, combinedResults, primaryPatientInfo.testDate);
          savedCount = 1;
          
          setSelectedClientId(clientId);
          setSelectedClientName(clientName);
        }
      }
      
      setExtractedAnalyses(allAnalyses);
      setSavedAnalysesCount(savedCount);
      
      // Always show combined results for display
      setResults(combinedResults);
      
      // Complete!
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
    setState('upload');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Mito Analysis</h1>
              <p className="text-sm text-muted-foreground">
                Clinical Pathology Analysis Portal
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="analysis" className="w-full">
          <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-4 mb-8">
            <TabsTrigger value="analysis" className="gap-2">
              <FileText className="h-4 w-4" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-2">
              <Users className="h-4 w-4" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="benchmarks" className="gap-2">
              <SettingsIcon className="h-4 w-4" />
              Benchmarks
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <SettingsIcon className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-8">
          {/* Hero Section */}
          {state === 'upload' && (
            <div className="text-center max-w-2xl mx-auto mb-8">
              <h2 className="text-2xl font-bold mb-3">
                Automated Biomarker Analysis
              </h2>
              <p className="text-muted-foreground">
                Upload clinical pathology reports and patient information will be automatically detected.
                Get instant comparison against optimal reference ranges for all 57 biomarkers.
              </p>
            </div>
          )}

          {/* Summary Badge (after processing) */}
          {(state === 'results') && extractedAnalyses.length > 0 && (
            <div className="max-w-2xl mx-auto">
              <div className="p-4 bg-secondary rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-semibold">
                    {extractedAnalyses.length === 1 
                      ? 'Processed 1 document'
                      : `Combined ${extractedAnalyses.length} documents`}
                  </span>
                </div>
                {savedAnalysesCount > 0 && (
                  <div className="text-sm text-muted-foreground">
                    ✅ Saved {savedAnalysesCount} analysis{savedAnalysesCount > 1 ? 'es' : ''} to {selectedClientName}'s record
                  </div>
                )}
                {extractedAnalyses.length > 1 && (
                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    <div className="font-medium">Panels processed:</div>
                    <div className="flex flex-wrap gap-2">
                      {extractedAnalyses.map((analysis, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {analysis.panelName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
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

          {/* Step 1: PDF Upload */}
          {state === 'upload' && (
            <PdfUploader
              onFilesSelected={handleFilesSelected}
              onAnalyze={handleAnalyze}
              isProcessing={false}
            />
          )}

          {/* Step 2: Processing */}
          {state === 'processing' && (
            <LoadingState message={processingMessage} progress={processingProgress} />
          )}

          {/* Step 3: Results */}
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
          </TabsContent>

          <TabsContent value="clients">
            <ClientLibrary />
          </TabsContent>

          <TabsContent value="benchmarks">
            <BenchmarkManager />
          </TabsContent>

          <TabsContent value="settings">
            <Settings />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>
            Mito Clinical Pathology Analysis Portal | Powered by Claude AI
          </p>
          <p className="mt-2">
            For informational purposes only. Always consult with healthcare professionals.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
