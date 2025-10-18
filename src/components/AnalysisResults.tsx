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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { generateSummary, getValueStatus } from '@/lib/analyzer';
import type { AnalysisResult } from '@/lib/biomarkers';
import { Copy, Download, CheckCircle2, XCircle, AlertCircle, Save } from 'lucide-react';
import { isSupabaseEnabled } from '@/lib/supabase';
import { getActiveClients } from '@/lib/client-service';
import { createAnalysis } from '@/lib/analysis-service';
import type { Client } from '@/lib/supabase';

interface AnalysisResultsProps {
  results: AnalysisResult[];
  onReset?: () => void;
  selectedClientId?: string;
  selectedClientName?: string;
  gender?: 'male' | 'female';
}

export function AnalysisResults({ results, onReset, selectedClientId: preSelectedClientId, selectedClientName: preSelectedClientName, gender = 'male' }: AnalysisResultsProps) {
  const [copied, setCopied] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [manualClientId, setManualClientId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  
  // Inline editing state
  const [editableResults, setEditableResults] = useState<AnalysisResult[]>(results);
  const [editingCell, setEditingCell] = useState<{index: number, field: 'value' | 'unit'} | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const summary = generateSummary(editableResults);

  useEffect(() => {
    if (isSupabaseEnabled && !preSelectedClientId) {
      loadClients();
    }
  }, [preSelectedClientId]);

  // Update editable results when original results change
  useEffect(() => {
    setEditableResults(results);
  }, [results]);

  // Handle editing
  const startEditing = (index: number, field: 'value' | 'unit', currentValue: string) => {
    setEditingCell({ index, field });
    setEditValue(currentValue);
  };

  const saveEdit = () => {
    if (editingCell) {
      const newResults = [...editableResults];
      if (editingCell.field === 'value') {
        newResults[editingCell.index].hisValue = editValue;
      } else {
        newResults[editingCell.index].unit = editValue;
      }
      setEditableResults(newResults);
      setEditingCell(null);
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  async function loadClients() {
    const activeClients = await getActiveClients();
    setClients(activeClients);
  }

  async function handleSaveToClient() {
    if (!manualClientId) {
      alert('Please select a client');
      return;
    }

    setIsSaving(true);
    const analysis = await createAnalysis(manualClientId, editableResults, notes);
    setIsSaving(false);

    if (analysis) {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveDialogOpen(false);
        setSaveSuccess(false);
        setManualClientId('');
        setNotes('');
      }, 1500);
    } else {
      alert('Failed to save analysis. Please try again.');
    }
  }

  const copyToClipboard = () => {
    // Generate markdown table with edited results
    const markdown = generateMarkdownTable(editableResults, preSelectedClientName, gender);
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsMarkdown = () => {
    const markdown = generateMarkdownTable(editableResults, preSelectedClientName, gender);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in-range':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 font-medium px-3 py-1 flex items-center gap-1.5 w-fit mx-auto">
            <CheckCircle2 className="h-3.5 w-3.5" />
            In Range
          </Badge>
        );
      case 'out-of-range':
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-400 font-semibold px-3 py-1 flex items-center gap-1.5 w-fit mx-auto">
            <XCircle className="h-3.5 w-3.5" />
            Out of Range
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  /**
   * Highlight the active unit range in the optimal range string
   * Makes it easier to see which range is being used for comparison
   */
  const highlightActiveRange = (optimalRange: string, unit: string) => {
    if (!unit || !optimalRange) return optimalRange;

    // Normalize the unit for matching
    const normalizedUnit = unit.replace(/umol/gi, 'µmol')
      .replace(/ug/gi, 'µg')
      .replace(/uIU/gi, 'µIU')
      .replace(/uL/gi, 'µL');

    // Escape special regex characters
    const escapedUnit = normalizedUnit.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

    // Try to find parenthetical range with this unit (e.g., "(0.68-1.13 mg/dL)")
    const parenthesesPattern = new RegExp(`(\\([^)]*${escapedUnit}[^)]*\\))`, 'i');
    const parenthesesMatch = optimalRange.match(parenthesesPattern);
    
    if (parenthesesMatch) {
      // Highlight the parenthetical range
      const parts = optimalRange.split(parenthesesMatch[0]);
      return (
        <>
          {parts[0]}
          <span className="font-semibold text-gray-900 bg-blue-50 px-1.5 py-0.5 rounded">
            {parenthesesMatch[0]}
          </span>
          {parts[1]}
        </>
      );
    }

    // Try to find primary range with this unit (e.g., "162-240 mg/dL")
    const unitPattern = new RegExp(`([\\d.]+\\s*-\\s*[\\d.]+\\s*${escapedUnit}(?:\\s|$|\\(|,))`, 'i');
    const unitMatch = optimalRange.match(unitPattern);
    
    if (unitMatch) {
      const parts = optimalRange.split(unitMatch[0]);
      return (
        <>
          <span className="font-semibold text-gray-900 bg-blue-50 px-1.5 py-0.5 rounded">
            {unitMatch[0].trim()}
          </span>
          {parts[1]}
        </>
      );
    }

    // Try to find < or > or ≤ formats with the unit
    const operatorPattern = new RegExp(`([<>≤]\\s*[\\d.]+\\s*${escapedUnit})`, 'i');
    const operatorMatch = optimalRange.match(operatorPattern);
    
    if (operatorMatch) {
      const parts = optimalRange.split(operatorMatch[0]);
      return (
        <>
          {parts[0]}
          <span className="font-semibold text-gray-900 bg-blue-50 px-1.5 py-0.5 rounded">
            {operatorMatch[0]}
          </span>
          {parts[1]}
        </>
      );
    }

    // No match found, return as-is
    return optimalRange;
  };

  return (
    <TooltipProvider>
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Complete</CardTitle>
          <CardDescription>
            {preSelectedClientName ? `Biomarker analysis for ${preSelectedClientName}` : 'Biomarker analysis'}
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

          {/* Diagnostic Info - Warning if data is missing */}
          {summary.missingBiomarkers > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <div>
                  <strong>{summary.missingBiomarkers} biomarker(s)</strong> were not found in the uploaded reports and are marked as N/A.
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer hover:underline font-medium">View missing biomarkers</summary>
                  <ul className="mt-2 ml-4 list-disc space-y-1">
                    {results.filter(r => r.hisValue === 'N/A').map(r => (
                      <li key={r.biomarkerName}>{r.biomarkerName}</li>
                    ))}
                  </ul>
                </details>
                <div className="text-xs text-muted-foreground mt-2">
                  💡 <strong>Tip:</strong> Check the browser console (F12 → Console) for detailed extraction logs showing what biomarkers were found in each document and how they were matched.
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {isSupabaseEnabled && !preSelectedClientId && (
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
                      <Select value={manualClientId} onValueChange={setManualClientId}>
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
                        disabled={isSaving || !manualClientId}
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
            All 57 biomarkers with values compared against optimal ranges for {gender === 'female' ? 'females' : 'males'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 text-center">#</TableHead>
                  <TableHead className="min-w-[180px]">Biomarker Name</TableHead>
                  <TableHead className="min-w-[100px] text-right">Value</TableHead>
                  <TableHead className="min-w-[80px]">Unit</TableHead>
                  <TableHead className="min-w-[220px]">Optimal Range ({gender === 'female' ? 'Female' : 'Male'})</TableHead>
                  <TableHead className="w-[180px] text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editableResults.map((result, index) => {
                  const status = getValueStatus(result.hisValue, result.optimalRange, result.unit);
                  const isNA = result.hisValue === 'N/A';
                  const isOutOfRange = status === 'out-of-range';
                  const isEditingValue = editingCell?.index === index && editingCell?.field === 'value';
                  const isEditingUnit = editingCell?.index === index && editingCell?.field === 'unit';

                  return (
                    <TableRow 
                      key={index} 
                      className={`
                        ${isNA ? 'bg-muted/30' : ''} 
                        ${isOutOfRange ? 'bg-red-50/50 hover:bg-red-50/70' : 'hover:bg-muted/50'}
                      `}
                    >
                      <TableCell className="font-medium text-muted-foreground text-center py-4">
                        {index + 1}
                      </TableCell>
                      <TableCell className={`font-medium py-4 ${isOutOfRange ? 'text-gray-900' : ''}`}>
                        {result.biomarkerName}
                      </TableCell>
                      <TableCell className={`
                        font-mono text-right py-4
                        ${isNA ? 'text-muted-foreground' : ''} 
                        ${isOutOfRange ? 'font-bold text-red-700 text-base' : 'font-semibold'}
                      `}>
                        {isEditingValue ? (
                          <Input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={saveEdit}
                            autoFocus
                            className="w-24 h-8 text-sm text-right font-mono"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(index, 'value', result.hisValue)}
                            className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                            title="Click to edit"
                          >
                            {!isNA && result.testDate ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="border-b border-dashed border-gray-400 hover:border-gray-600">
                                    {result.hisValue}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    Tested on: <span className="font-semibold">{formatDate(result.testDate)}</span>
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              result.hisValue
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm py-4">
                        {isEditingUnit ? (
                          <Input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={saveEdit}
                            autoFocus
                            className="w-20 h-8 text-sm"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(index, 'unit', result.unit)}
                            className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                            title="Click to edit"
                          >
                            {result.unit}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 py-4">
                        {highlightActiveRange(result.optimalRange, result.unit)}
                      </TableCell>
                      <TableCell className="py-4">
                        {!isNA && getStatusBadge(status)}
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
    </TooltipProvider>
  );
}

/**
 * Generate markdown table from results
 */
function generateMarkdownTable(results: AnalysisResult[], clientName?: string, gender: 'male' | 'female' = 'male'): string {
  let markdown = '# Biomarker Analysis Results\n\n';
  if (clientName) {
    markdown += `**Patient:** ${clientName}\n`;
  }
  markdown += `**Date:** ${new Date().toLocaleDateString()}\n\n`;
  
  markdown += '## Comprehensive Biomarker Analysis\n\n';
  const genderLabel = gender === 'female' ? 'Female' : 'Male';
  markdown += `| Biomarker Name | Value | Unit | Optimal Range (${genderLabel}) |\n`;
  markdown += '|:---------------|:------|:-----|:-------------------------------|\n';

  for (const result of results) {
    markdown += `| ${result.biomarkerName} | ${result.hisValue} | ${result.unit} | ${result.optimalRange} |\n`;
  }

  markdown += '\n---\n';
  markdown += '*Generated by Mito Clinical Pathology Analysis Portal*\n';

  return markdown;
}

