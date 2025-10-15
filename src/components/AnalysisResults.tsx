import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { generateSummary, getValueStatus } from '@/lib/analyzer';
import type { AnalysisResult } from '@/lib/biomarkers';
import { Copy, Download, CheckCircle2, XCircle, HelpCircle, AlertCircle, Save } from 'lucide-react';
import { isSupabaseEnabled } from '@/lib/supabase';
import { getActiveClients } from '@/lib/client-service';
import { createAnalysis } from '@/lib/analysis-service';
import type { Client } from '@/lib/supabase';

interface AnalysisResultsProps {
  results: AnalysisResult[];
  onReset?: () => void;
}

export function AnalysisResults({ results, onReset }: AnalysisResultsProps) {
  const [copied, setCopied] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const summary = generateSummary(results);

  useEffect(() => {
    if (isSupabaseEnabled) {
      loadClients();
    }
  }, []);

  async function loadClients() {
    const activeClients = await getActiveClients();
    setClients(activeClients);
  }

  async function handleSaveToClient() {
    if (!selectedClientId) {
      alert('Please select a client');
      return;
    }

    setIsSaving(true);
    const analysis = await createAnalysis(selectedClientId, results, notes);
    setIsSaving(false);

    if (analysis) {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveDialogOpen(false);
        setSaveSuccess(false);
        setSelectedClientId('');
        setNotes('');
      }, 1500);
    } else {
      alert('Failed to save analysis. Please try again.');
    }
  }

  const copyToClipboard = () => {
    // Generate markdown table
    const markdown = generateMarkdownTable(results);
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsMarkdown = () => {
    const markdown = generateMarkdownTable(results);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biomarker-analysis-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in-range':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'out-of-range':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in-range':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">In Range</Badge>;
      case 'out-of-range':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Out of Range</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Complete</CardTitle>
          <CardDescription>
            Biomarker analysis for Adam Winchester
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-secondary rounded-lg">
              <p className="text-2xl font-bold">{summary.totalBiomarkers}</p>
              <p className="text-sm text-muted-foreground">Total Biomarkers</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-700">{summary.measuredBiomarkers}</p>
              <p className="text-sm text-blue-600">Measured</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{summary.inRangeCount}</p>
              <p className="text-sm text-green-600">In Range</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-700">{summary.outOfRangeCount}</p>
              <p className="text-sm text-red-600">Out of Range</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-700">{summary.missingBiomarkers}</p>
              <p className="text-sm text-gray-600">Missing</p>
            </div>
          </div>

          {/* Warning if data is missing */}
          {summary.missingBiomarkers > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {summary.missingBiomarkers} biomarker(s) were not found in the uploaded reports and are marked as N/A.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {isSupabaseEnabled && (
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Save className="h-4 w-4" />
                    Save to Client
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Analysis to Client</DialogTitle>
                    <DialogDescription>
                      Select a client to save this analysis to their record
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="client">Select Client</Label>
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger id="client">
                          <SelectValue placeholder="Choose a client..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.length === 0 ? (
                            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                              No active clients found.<br />
                              Create a client in the Clients tab first.
                            </div>
                          ) : (
                            clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.full_name}
                                {client.email && ` (${client.email})`}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add any notes about this analysis..."
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setSaveDialogOpen(false)}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveToClient}
                        disabled={isSaving || !selectedClientId}
                        className="gap-2"
                      >
                        {saveSuccess ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Saved!
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            {isSaving ? 'Saving...' : 'Save Analysis'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Button onClick={copyToClipboard} variant="outline" className="gap-2">
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Markdown Table'}
            </Button>
            <Button onClick={downloadAsMarkdown} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download as Markdown
            </Button>
            {onReset && (
              <Button onClick={onReset} variant="outline">
                Analyze New Reports
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Comprehensive Biomarker Analysis</CardTitle>
          <CardDescription>
            All 57 biomarkers with values compared against optimal ranges for males
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="min-w-[200px]">Biomarker Name</TableHead>
                  <TableHead className="min-w-[120px]">His Value</TableHead>
                  <TableHead className="min-w-[100px]">Unit</TableHead>
                  <TableHead className="min-w-[200px]">Optimal Range (Male)</TableHead>
                  <TableHead className="w-32 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => {
                  const status = getValueStatus(result.hisValue, result.optimalRange);
                  const isNA = result.hisValue === 'N/A';

                  return (
                    <TableRow key={index} className={isNA ? 'bg-muted/30' : ''}>
                      <TableCell className="font-medium text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{result.biomarkerName}</TableCell>
                      <TableCell className={`font-mono ${isNA ? 'text-muted-foreground' : 'font-semibold'}`}>
                        {result.hisValue}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{result.unit}</TableCell>
                      <TableCell className="text-sm">{result.optimalRange}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {!isNA && getStatusIcon(status)}
                          {!isNA && getStatusBadge(status)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Generate markdown table from results
 */
function generateMarkdownTable(results: AnalysisResult[]): string {
  let markdown = '# Biomarker Analysis Results\n\n';
  markdown += `**Patient:** Adam Winchester\n`;
  markdown += `**Date:** ${new Date().toLocaleDateString()}\n\n`;
  
  markdown += '## Comprehensive Biomarker Analysis\n\n';
  markdown += '| Biomarker Name | His Value | Unit | Optimal Range (Male) |\n';
  markdown += '|:---------------|:----------|:-----|:---------------------|\n';

  for (const result of results) {
    markdown += `| ${result.biomarkerName} | ${result.hisValue} | ${result.unit} | ${result.optimalRange} |\n`;
  }

  markdown += '\n---\n';
  markdown += '*Generated by Mito Clinical Pathology Analysis Portal*\n';

  return markdown;
}

