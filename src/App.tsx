import { useState } from 'react';
import { PdfUploader } from '@/components/PdfUploader';
import { LoadingState } from '@/components/LoadingState';
import { AnalysisResults } from '@/components/AnalysisResults';
import { ClientSelector } from '@/components/ClientSelector';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { processMultiplePdfs } from '@/lib/pdf-processor';
import { extractBiomarkersFromPdfs } from '@/lib/claude-service';
import { matchBiomarkersWithRanges } from '@/lib/analyzer';
import { createAnalysis } from '@/lib/analysis-service';
import type { AnalysisResult } from '@/lib/biomarkers';
import { AlertCircle, Activity, FileText, Settings as SettingsIcon, Users, UserCircle } from 'lucide-react';
import { BenchmarkManager } from '@/components/BenchmarkManager';
import { ClientLibrary } from '@/components/ClientLibrary';
import { Settings } from '@/components/Settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

type AppState = 'client-select' | 'upload' | 'processing' | 'results' | 'error';

const API_KEY_STORAGE_KEY = 'mito_claude_api_key';

function App() {
  const [state, setState] = useState<AppState>('client-select');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClientName, setSelectedClientName] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string>('Processing...');

  const handleClientSelected = (clientId: string, clientName: string) => {
    setSelectedClientId(clientId);
    setSelectedClientName(clientName);
    setState('upload');
  };

  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('Please select at least one PDF file');
      return;
    }

    // Check if API key exists
    const currentApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (!currentApiKey) {
      setError('Please set your Claude API key in the Settings tab first.');
      setState('error');
      return;
    }

    setState('processing');
    setError(null);

    try {
      // Step 1: Process PDFs (extract text only - much cheaper!)
      setProcessingMessage('Extracting text from PDFs...');
      const processedPdfs = await processMultiplePdfs(files);
      
      // Step 2: Extract biomarkers using Claude
      setProcessingMessage('Analyzing documents with Claude AI...');
      const currentApiKey = localStorage.getItem(API_KEY_STORAGE_KEY) || '';
      const claudeResponse = await extractBiomarkersFromPdfs(currentApiKey, processedPdfs);
      
      // Step 3: Match with optimal ranges
      setProcessingMessage('Matching biomarkers with optimal ranges...');
      const analysisResults = matchBiomarkersWithRanges(claudeResponse.biomarkers);
      
      // Step 4: Auto-save to client if selected
      if (selectedClientId) {
        setProcessingMessage('Saving results to client record...');
        await createAnalysis(selectedClientId, analysisResults);
      }
      
      // Step 5: Display results
      setResults(analysisResults);
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
    setState('upload');
  };

  const handleStartOver = () => {
    setFiles([]);
    setResults([]);
    setError(null);
    setSelectedClientId('');
    setSelectedClientName('');
    setState('client-select');
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
          {state === 'client-select' && (
            <div className="text-center max-w-2xl mx-auto mb-8">
              <h2 className="text-2xl font-bold mb-3">
                Automated Biomarker Analysis
              </h2>
              <p className="text-muted-foreground">
                Upload clinical pathology reports and get instant comparison against 
                optimal reference ranges for all 57 biomarkers.
              </p>
            </div>
          )}

          {/* Client Badge (after selection) */}
          {(state === 'upload' || state === 'processing' || state === 'results') && selectedClientName && (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Analysis for:</span>
                  <Badge variant="default" className="text-base">{selectedClientName}</Badge>
                </div>
                {state === 'upload' && (
                  <button
                    onClick={handleStartOver}
                    className="text-sm text-muted-foreground hover:text-foreground underline"
                  >
                    Change Client
                  </button>
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

          {/* Step 1: Client Selection */}
          {state === 'client-select' && (
            <ClientSelector onClientSelected={handleClientSelected} />
          )}

          {/* Step 2: PDF Upload */}
          {state === 'upload' && (
            <PdfUploader
              onFilesSelected={handleFilesSelected}
              onAnalyze={handleAnalyze}
              isProcessing={false}
            />
          )}

          {/* Step 3: Processing */}
          {state === 'processing' && (
            <LoadingState message={processingMessage} />
          )}

          {/* Step 4: Results */}
          {state === 'results' && (
            <div className="space-y-4">
              {selectedClientId && (
                <Alert className="max-w-7xl mx-auto">
                  <AlertDescription className="flex items-center gap-2">
                    ✅ <strong>Results saved to {selectedClientName}'s record</strong>
                  </AlertDescription>
                </Alert>
              )}
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
