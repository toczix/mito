import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  getAllBenchmarks,
  addCustomBenchmark,
  updateCustomBenchmark,
  deleteCustomBenchmark,
  resetToDefaults,
  exportBenchmarks,
  importBenchmarks,
  type CustomBiomarker
} from '@/lib/benchmark-storage';
import { getBiomarkerFullName } from '@/lib/biomarkers';
import { Plus, Pencil, Trash2, Download, Upload, RotateCcw, Search, AlertCircle } from 'lucide-react';

export function BenchmarkManager() {
  const [benchmarks, setBenchmarks] = useState<CustomBiomarker[]>(getAllBenchmarks());
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<CustomBiomarker | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    maleRange: '',
    femaleRange: '',
    units: '',
    category: '',
  });

  const refreshBenchmarks = () => {
    setBenchmarks(getAllBenchmarks());
  };

  const filteredBenchmarks = useMemo(() => {
    if (!searchTerm) return benchmarks;
    const term = searchTerm.toLowerCase();
    return benchmarks.filter(b => {
      const fullName = getBiomarkerFullName(b.name);
      return b.name.toLowerCase().includes(term) ||
             b.category?.toLowerCase().includes(term) ||
             (fullName && fullName.toLowerCase().includes(term));
    });
  }, [benchmarks, searchTerm]);

  const handleAdd = () => {
    setEditingBenchmark(null);
    setFormData({ name: '', maleRange: '', femaleRange: '', units: '', category: '' });
    setIsDialogOpen(true);
    setError(null);
  };

  const handleEdit = (benchmark: CustomBiomarker) => {
    setEditingBenchmark(benchmark);
    setFormData({
      name: benchmark.name,
      maleRange: benchmark.maleRange || '',
      femaleRange: benchmark.femaleRange || '',
      units: benchmark.units.join(', '),
      category: benchmark.category || '',
    });
    setIsDialogOpen(true);
    setError(null);
  };

  const handleDelete = (benchmark: CustomBiomarker) => {
    if (!benchmark.isCustom) {
      setError('Cannot delete default benchmarks. You can only delete custom ones.');
      return;
    }
    
    if (confirm(`Delete benchmark "${benchmark.name}"?`)) {
      deleteCustomBenchmark(benchmark.id);
      refreshBenchmarks();
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.maleRange) {
      setError('Name and Male Range are required');
      return;
    }

    const benchmarkData = {
      name: formData.name,
      maleRange: formData.maleRange,
      femaleRange: formData.femaleRange || formData.maleRange,
      optimalRange: formData.maleRange, // Keep for compatibility
      units: formData.units.split(',').map(u => u.trim()).filter(Boolean),
      category: formData.category,
    };

    try {
      if (editingBenchmark) {
        updateCustomBenchmark(editingBenchmark.id, benchmarkData);
      } else {
        addCustomBenchmark(benchmarkData);
      }
      
      refreshBenchmarks();
      setIsDialogOpen(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save benchmark');
    }
  };

  const handleExport = () => {
    const json = exportBenchmarks();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mito-benchmarks-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        importBenchmarks(text);
        refreshBenchmarks();
        setError(null);
      } catch (err) {
        setError('Failed to import benchmarks. Invalid file format.');
      }
    };
    input.click();
  };

  const handleReset = () => {
    if (confirm('Reset all benchmarks to defaults? This will delete all custom benchmarks.')) {
      resetToDefaults();
      refreshBenchmarks();
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Benchmark Management</CardTitle>
          <CardDescription>
            Manage biomarker optimal ranges for male and female patients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Actions Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search benchmarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Benchmark
            </Button>
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button onClick={handleImport} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button onClick={handleReset} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Total: {benchmarks.length}</span>
            <span>Custom: {benchmarks.filter(b => b.isCustom).length}</span>
            <span>Default: {benchmarks.filter(b => !b.isCustom).length}</span>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="min-w-[200px]">Biomarker Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Male Range</TableHead>
                  <TableHead>Female Range</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead className="w-32">Type</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBenchmarks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No benchmarks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBenchmarks.map((benchmark, index) => (
                    <TableRow key={benchmark.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="font-semibold">{benchmark.name}</span>
                          {getBiomarkerFullName(benchmark.name) && (
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {getBiomarkerFullName(benchmark.name)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {benchmark.category || '-'}
                      </TableCell>
                      <TableCell className="text-sm">{benchmark.maleRange}</TableCell>
                      <TableCell className="text-sm">{benchmark.femaleRange}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {benchmark.units.slice(0, 2).join(', ')}
                        {benchmark.units.length > 2 && '...'}
                      </TableCell>
                      <TableCell>
                        {benchmark.isCustom ? (
                          <Badge variant="default">Custom</Badge>
                        ) : (
                          <Badge variant="secondary">Default</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(benchmark)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {benchmark.isCustom && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(benchmark)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingBenchmark ? 'Edit Benchmark' : 'Add New Benchmark'}
            </DialogTitle>
            <DialogDescription>
              {editingBenchmark?.isCustom
                ? 'Modify the custom benchmark details'
                : editingBenchmark
                ? 'This will create a custom override of the default benchmark'
                : 'Add a new custom biomarker benchmark'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Biomarker Name *</label>
              <Input
                placeholder="e.g., Vitamin D"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={!!editingBenchmark && !editingBenchmark.isCustom}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Male Range *</label>
                <Input
                  placeholder="e.g., 125-225 nmol/L"
                  value={formData.maleRange}
                  onChange={(e) => setFormData({ ...formData, maleRange: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Female Range</label>
                <Input
                  placeholder="e.g., 125-225 nmol/L"
                  value={formData.femaleRange}
                  onChange={(e) => setFormData({ ...formData, femaleRange: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Leave empty to use male range</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Units</label>
              <Input
                placeholder="e.g., nmol/L, ng/mL"
                value={formData.units}
                onChange={(e) => setFormData({ ...formData, units: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Separate multiple units with commas</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Input
                placeholder="e.g., Vitamins, Hormones"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingBenchmark ? 'Save Changes' : 'Add Benchmark'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

