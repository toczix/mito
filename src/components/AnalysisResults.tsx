import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/lib/theme-context';
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
import { getBiomarkerDisplayName } from '@/lib/biomarkers';
import { Copy, Download, CheckCircle2, AlertCircle, Save, Info, TrendingUp, TrendingDown, FileText, RotateCcw, AlertTriangle } from 'lucide-react';
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
  const { theme } = useTheme();
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
          <span 
            className="font-semibold px-1.5 py-0.5 rounded text-purple-600 dark:text-purple-400"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(147, 51, 234, 0.1)' : 'rgba(147, 51, 234, 0.15)' }}
          >
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
          <span 
            className="font-semibold px-1.5 py-0.5 rounded text-purple-600 dark:text-purple-400"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(147, 51, 234, 0.1)' : 'rgba(147, 51, 234, 0.15)' }}
          >
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
          <span 
            className="font-semibold px-1.5 py-0.5 rounded text-purple-600 dark:text-purple-400"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(147, 51, 234, 0.1)' : 'rgba(147, 51, 234, 0.15)' }}
          >
            {operatorMatch[0]}
          </span>
          {parts[1]}
        </>
      );
    }

    // No match found, return as-is
    return optimalRange;
  };

  // Status Badge Helper - returns colored badge based on status
  const getStatusBadge = (status: string, valueDirection: 'high' | 'low' | null) => {
    if (status === 'in-range') {
      return (
        <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 text-[10px] font-medium">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          In Range
        </Badge>
      );
    } else if (status === 'out-of-range') {
      if (valueDirection === 'high') {
        return (
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 text-[10px] font-medium">
            <TrendingUp className="w-3 h-3 mr-1" />
            High
          </Badge>
        );
      } else if (valueDirection === 'low') {
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] font-medium">
            <TrendingDown className="w-3 h-3 mr-1" />
            Low
          </Badge>
        );
      }
    }
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        N/A
      </Badge>
    );
  };

  return (
    <TooltipProvider>
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Analysis Complete</h1>
            <p className="text-sm text-foreground/70">
              {preSelectedClientName && `Biomarker analysis for ${preSelectedClientName} • `}
              {documentCount > 0 && `${documentCount} ${documentCount === 1 ? 'document' : 'documents'} processed`}
              {savedAnalysesCount > 0 && ` • ${savedAnalysesCount} ${savedAnalysesCount === 1 ? 'analysis' : 'analyses'} saved`}
            </p>
          </div>
        </div>

        {/* Patient Info Discrepancies Warning Banner */}
        {patientInfoDiscrepancies && patientInfoDiscrepancies.length > 0 && (
          <Alert className="border-amber-500/50 bg-amber-500/10 dark:bg-amber-500/5 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <AlertDescription>
              <strong className="text-amber-900 dark:text-amber-400">Data discrepancies found</strong>
              <ul className="text-sm mt-2 space-y-1">
                {patientInfoDiscrepancies.map((discrepancy, idx) => (
                  <li key={idx} className="text-amber-800 dark:text-amber-300">• {discrepancy}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Card 1 - Total Biomarkers */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Biomarkers</p>
              <p className="text-2xl font-bold">{summary.totalBiomarkers}</p>
            </div>
          </div>
        </Card>

        {/* Card 2 - Measured */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Measured</p>
              <p className="text-2xl font-bold">{summary.measuredBiomarkers}</p>
            </div>
          </div>
        </Card>

        {/* Card 3 - In Range */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-500/10 p-2 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">In Range</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-500">{summary.inRangeCount}</p>
            </div>
          </div>
        </Card>

        {/* Card 4 - Out of Range */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/10 p-2 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Out of Range</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-500">{summary.outOfRangeCount}</p>
            </div>
          </div>
        </Card>

        {/* Card 5 - Missing */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-muted p-2 rounded-lg">
              <AlertCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Missing</p>
              <p className="text-2xl font-bold">{summary.missingBiomarkers}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Missing Biomarkers Warning */}
      {summary.missingBiomarkers > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10 dark:bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <AlertDescription>
            <details className="text-sm">
              <summary className="cursor-pointer hover:underline font-medium text-amber-900 dark:text-amber-400">
                {summary.missingBiomarkers} biomarker(s) were not found in the uploaded reports
              </summary>
              <ul className="mt-2 ml-4 list-disc space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
                {results.filter(r => r.hisValue === 'N/A').map(r => (
                  <li key={r.biomarkerName}>{r.biomarkerName}</li>
                ))}
              </ul>
              <div className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                💡 Check the browser console (F12 → Console) for detailed extraction logs.
              </div>
            </details>
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* View Mode Filter */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
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
              <Button onClick={onReset} size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Analyze New Reports
              </Button>
            )}
            </div>
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

                  // Get row background color based on status and theme
                  const getRowBackground = () => {
                    const isDark = theme === 'dark';
                    const opacity = isDark ? 0.08 : 0.1;
                    
                    if (status === 'in-range') {
                      return `rgba(34, 197, 94, ${opacity})`; // green
                    } else if (status === 'out-of-range' && valueDirection === 'high') {
                      return `rgba(239, 68, 68, ${opacity})`; // red
                    } else if (status === 'out-of-range' && valueDirection === 'low') {
                      return `rgba(59, 130, 246, ${opacity})`; // blue
                    } else if (status === 'out-of-range' && !valueDirection) {
                      return `rgba(239, 68, 68, ${opacity})`; // red
                    }
                    return undefined;
                  };

                  return (
                    <TableRow 
                      key={index} 
                      style={{
                        backgroundColor: getRowBackground()
                      }}
                      className={`
                        transition-all duration-200
                        ${isNA ? 'opacity-50' : ''}
                        hover:bg-muted/50
                      `}
                    >
                      <TableCell className="font-medium text-muted-foreground text-center py-4">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium py-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-sm">{result.biomarkerName}</span>
                          {hasInfo && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleBiomarkerClick(result)}
                                  className="flex-shrink-0 p-1 rounded-full hover:bg-accent text-primary transition-colors"
                                  aria-label={`View information about ${result.biomarkerName}`}
                                >
                                  <Info className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Click for detailed information</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell 
                        className={`
                          font-mono text-right py-4
                          ${isNA ? 'text-muted-foreground' : ''} 
                          ${isOutOfRange && !isNA ? 'font-bold text-base text-red-600 dark:text-red-400' : 'font-semibold'}
                        `}
                      >
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
                            className="cursor-pointer hover:bg-accent px-2 py-1 rounded transition-colors"
                            title="Click to edit"
                          >
                            {!isNA && result.testDate ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="border-b border-dashed border-muted-foreground/40 hover:border-muted-foreground/60">
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
                            className="cursor-pointer hover:bg-accent px-2 py-1 rounded transition-colors"
                            title="Click to edit"
                          >
                            {result.unit}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm py-4">
                        {highlightActiveRange(result.optimalRange, result.unit)}
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        {getStatusBadge(status, valueDirection)}
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

