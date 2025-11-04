import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { generateSummary, getValueStatus } from '@/lib/analyzer';
import type { AnalysisResult } from '@/lib/biomarkers';
import { getBiomarkerFullName, getBiomarkerDisplayName } from '@/lib/biomarkers';
import { Copy, Download, CheckCircle2, XCircle, AlertCircle, Save, Info } from 'lucide-react';
import { isSupabaseEnabled } from '@/lib/supabase';
import { getActiveClients } from '@/lib/client-service';
import { createAnalysis } from '@/lib/analysis-service';
import type { Client } from '@/lib/supabase';
import { getBiomarkerInfo, hasBiomarkerInfo, type BiomarkerInfo } from '@/lib/biomarker-info';
import { BiomarkerInfoDialog } from './BiomarkerInfoDialog';
import { getAllBenchmarks } from '@/lib/benchmark-storage';

interface AnalysisResultsProps {
  results: AnalysisResult[];
  onReset?: () => void;
  selectedClientId?: string;
  selectedClientName?: string;
  gender?: 'male' | 'female';
  documentCount?: number;
  savedAnalysesCount?: number;
  patientInfoDiscrepancies?: string[];
}

export function AnalysisResults({
  results,
  onReset,
  selectedClientId: preSelectedClientId,
  selectedClientName: preSelectedClientName,
  gender = 'male',
  documentCount = 0,
  savedAnalysesCount = 0,
  patientInfoDiscrepancies = []
}: AnalysisResultsProps) {
  const [copied, setCopied] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [manualClientId, setManualClientId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // View mode filter state
  const [viewMode, setViewMode] = useState<'all' | 'out-of-range'>('all');

  // Inline editing state
  const [editableResults, setEditableResults] = useState<AnalysisResult[]>(results);
  const [editingCell, setEditingCell] = useState<{index: number, field: 'value' | 'unit'} | null>(null);
  const [editValue, setEditValue] = useState('');

  // Biomarker info dialog state
  const [biomarkerInfoDialogOpen, setBiomarkerInfoDialogOpen] = useState(false);
  const [selectedBiomarkerInfo, setSelectedBiomarkerInfo] = useState<{
    info: BiomarkerInfo;
    value: string;
    unit: string;
    optimalRange: string;
    status: 'in-range' | 'out-of-range' | 'unknown';
  } | null>(null);

  // Filter results based on view mode
  const filteredResults = useMemo(() => {
    if (viewMode === 'all') return editableResults;
    return editableResults.filter(result => {
      if (result.hisValue === 'N/A') return false; // Don't show N/A values in out-of-range filter
      const status = getValueStatus(result.hisValue, result.optimalRange, result.unit);
      return status === 'out-of-range';
    });
  }, [editableResults, viewMode]);

  const summary = generateSummary(editableResults);

  // Load benchmarks for custom reasons
  const benchmarks = useMemo(() => getAllBenchmarks(), []);

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
    // Generate markdown table with filtered results
    const markdown = generateMarkdownTable(filteredResults, preSelectedClientName, gender, viewMode);
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsMarkdown = () => {
    const markdown = generateMarkdownTable(filteredResults, preSelectedClientName, gender, viewMode);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const suffix = viewMode === 'out-of-range' ? '-out-of-range' : '';
    a.download = `biomarker-analysis${suffix}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBiomarkerClick = (result: AnalysisResult) => {
    // Find the biomarker config to get custom reasons
    const biomarkerConfig = benchmarks.find(b => b.name === result.biomarkerName);
    const info = getBiomarkerInfo(result.biomarkerName, biomarkerConfig);
    if (info) {
      const status = getValueStatus(result.hisValue, result.optimalRange, result.unit);
      setSelectedBiomarkerInfo({
        info,
        value: result.hisValue,
        unit: result.unit,
        optimalRange: result.optimalRange,
        status
      });
      setBiomarkerInfoDialogOpen(true);
    }
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
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Summary Card - Compact Version */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Analysis Complete</CardTitle>
              <CardDescription className="text-sm mt-1">
                {preSelectedClientName ? `Biomarker analysis for ${preSelectedClientName}` : 'Biomarker analysis'}
              </CardDescription>
            </div>
            {savedAnalysesCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">Saved</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Stats - More Compact */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center p-3 bg-secondary rounded-lg">
              <p className="text-2xl font-bold">{summary.totalBiomarkers}</p>
              <p className="text-xs text-muted-foreground">Total Biomarkers</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-700">{summary.measuredBiomarkers}</p>
              <p className="text-xs text-blue-600">Measured</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{summary.inRangeCount}</p>
              <p className="text-xs text-green-600">In Range</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-700">{summary.outOfRangeCount}</p>
              <p className="text-xs text-red-600">Out of Range</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-700">{summary.missingBiomarkers}</p>
              <p className="text-xs text-gray-600">Missing</p>
            </div>
          </div>

          {/* Diagnostic Info - Warning if data is missing - More Compact */}
          {summary.missingBiomarkers > 0 && (
            <Alert className="py-3 [&>svg]:top-3.5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <details className="text-sm">
                  <summary className="cursor-pointer hover:underline font-medium">
                    {summary.missingBiomarkers} biomarker(s) were not found in the uploaded reports
                  </summary>
                  <ul className="mt-2 ml-4 list-disc space-y-0.5 text-xs">
                    {results.filter(r => r.hisValue === 'N/A').map(r => (
                      <li key={r.biomarkerName}>{r.biomarkerName}</li>
                    ))}
                  </ul>
                  <div className="text-xs text-muted-foreground mt-2">
                    💡 Check the browser console (F12 → Console) for detailed extraction logs.
                  </div>
                </details>
              </AlertDescription>
            </Alert>
          )}

          {/* View Mode Filter */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={viewMode === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('all')}
              className="text-xs"
            >
              All ({editableResults.length})
            </Button>
            <Button
              variant={viewMode === 'out-of-range' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('out-of-range')}
              className="text-xs"
            >
              Out of Range ({summary.outOfRangeCount})
            </Button>
          </div>

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
              {copied ? 'Copied!' : viewMode === 'out-of-range' ? 'Copy Out of Range' : 'Copy Markdown Table'}
            </Button>
            <Button onClick={downloadAsMarkdown} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              {viewMode === 'out-of-range' ? 'Download Out of Range' : 'Download as Markdown'}
            </Button>
            {onReset && (
              <Button onClick={onReset} variant="outline">
                Analyze New Reports
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Comprehensive Biomarker Analysis</CardTitle>
          <CardDescription>
            {viewMode === 'out-of-range'
              ? `Showing ${filteredResults.length} out-of-range biomarkers for ${gender === 'female' ? 'females' : 'males'}`
              : `All ${editableResults.length} biomarkers with values compared against optimal ranges for ${gender === 'female' ? 'females' : 'males'}`
            }
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
                {filteredResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {viewMode === 'out-of-range'
                        ? 'No out-of-range values found. All measured biomarkers are within optimal ranges!'
                        : 'No biomarkers to display'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResults.map((result, index) => {
                  const status = getValueStatus(result.hisValue, result.optimalRange, result.unit);
                  const isNA = result.hisValue === 'N/A';
                  const isOutOfRange = status === 'out-of-range';
                  const isEditingValue = editingCell?.index === index && editingCell?.field === 'value';
                  const isEditingUnit = editingCell?.index === index && editingCell?.field === 'unit';
                  const biomarkerConfig = benchmarks.find(b => b.name === result.biomarkerName);
                  const hasInfo = hasBiomarkerInfo(result.biomarkerName, biomarkerConfig);

                  // Determine if value is high or low
                  let valueDirection: 'high' | 'low' | null = null;
                  if (isOutOfRange && result.hisValue !== 'N/A') {
                    const numValue = parseFloat(result.hisValue);
                    const rangeMatch = result.optimalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
                    const lessThanMatch = result.optimalRange.match(/[<≤]\s*(\d+\.?\d*)/);
                    const greaterThanMatch = result.optimalRange.match(/[>≥]\s*(\d+\.?\d*)/);

                    if (rangeMatch && !isNaN(numValue)) {
                      const minRange = parseFloat(rangeMatch[1]);
                      const maxRange = parseFloat(rangeMatch[2]);
                      valueDirection = numValue > maxRange ? 'high' : numValue < minRange ? 'low' : null;
                    } else if (lessThanMatch && !isNaN(numValue)) {
                      const threshold = parseFloat(lessThanMatch[1]);
                      valueDirection = numValue > threshold ? 'high' : null;
                    } else if (greaterThanMatch && !isNaN(numValue)) {
                      const threshold = parseFloat(greaterThanMatch[1]);
                      valueDirection = numValue < threshold ? 'low' : null;
                    }
                  }

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
                        <div className="flex items-start gap-2">
                          <div className="flex flex-col flex-1">
                            <span className="font-semibold">{result.biomarkerName}</span>
                            {getBiomarkerFullName(result.biomarkerName) && (
                              <span className="text-xs text-muted-foreground mt-0.5">
                                {getBiomarkerFullName(result.biomarkerName)}
                              </span>
                            )}
                          </div>
                          {hasInfo && isOutOfRange && valueDirection && (
                            <div className="flex items-center gap-1.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleBiomarkerClick(result)}
                                    className="flex-shrink-0 p-1 rounded-full hover:bg-blue-100 text-blue-600 transition-colors"
                                    aria-label={`View information about ${result.biomarkerName}`}
                                  >
                                    <Info className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Click for detailed information</p>
                                </TooltipContent>
                              </Tooltip>
                              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                valueDirection === 'high'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {valueDirection}
                              </span>
                            </div>
                          )}
                        </div>
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
                }))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Miscellaneous Information - Compact */}
      {(documentCount > 0 || patientInfoDiscrepancies.length > 0) && (
        <details className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
          <summary className="cursor-pointer hover:underline font-medium flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />
            Processing Information ({documentCount} {documentCount === 1 ? 'document' : 'documents'} analyzed)
          </summary>
          <div className="mt-3 space-y-2 text-xs pl-5">
            {patientInfoDiscrepancies.length > 0 && (
              <div>
                <p className="font-semibold mb-1">Patient info consolidated from multiple documents:</p>
                <ul className="space-y-0.5">
                  {patientInfoDiscrepancies.map((discrepancy, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{discrepancy}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Biomarker Information Dialog */}
      <BiomarkerInfoDialog
        open={biomarkerInfoDialogOpen}
        onOpenChange={setBiomarkerInfoDialogOpen}
        biomarkerInfo={selectedBiomarkerInfo?.info || null}
        currentValue={selectedBiomarkerInfo?.value}
        unit={selectedBiomarkerInfo?.unit}
        optimalRange={selectedBiomarkerInfo?.optimalRange}
        status={selectedBiomarkerInfo?.status}
      />
    </div>
    </TooltipProvider>
  );
}

/**
 * Generate markdown table from results
 */
function generateMarkdownTable(
  results: AnalysisResult[],
  clientName?: string,
  gender: 'male' | 'female' = 'male',
  viewMode: 'all' | 'out-of-range' = 'all'
): string {
  let markdown = '# Biomarker Analysis Results\n\n';
  if (clientName) {
    markdown += `**Patient:** ${clientName}\n`;
  }
  markdown += `**Date:** ${new Date().toLocaleDateString()}\n`;
  if (viewMode === 'out-of-range') {
    markdown += `**Filter:** Out of Range Values Only\n`;
  }
  markdown += '\n';

  markdown += '## Comprehensive Biomarker Analysis\n\n';
  const genderLabel = gender === 'female' ? 'Female' : 'Male';
  markdown += `| Biomarker Name | Value | Unit | Optimal Range (${genderLabel}) |\n`;
  markdown += '|:---------------|:------|:-----|:-------------------------------|\n';

  for (const result of results) {
    const displayName = getBiomarkerDisplayName(result.biomarkerName);
    markdown += `| ${displayName} | ${result.hisValue} | ${result.unit} | ${result.optimalRange} |\n`;
  }

  markdown += '\n---\n';
  markdown += '*Generated by Mito Clinical Pathology Analysis Portal*\n';

  return markdown;
}

