# Benchmarks Page - Complete Technical Breakdown

## Overview
The Benchmarks Page is a management interface for viewing, editing, and managing biomarker optimal ranges used in lab test analysis. It allows users to customize reference ranges for male and female patients, with support for importing/exporting and resetting to defaults.

---

## Page Structure

### File Organization
- **Main Page**: `src/pages/BenchmarksPage.tsx` (simple wrapper that renders BenchmarkManager)
- **Core Component**: `src/components/BenchmarkManager.tsx` (358 lines - contains all functionality)
- **Data Layer**: `src/lib/benchmark-storage.ts` (125 lines - localStorage persistence)
- **Biomarker Definitions**: `src/lib/biomarkers.ts` (54 predefined biomarkers)

---

## Component Architecture

### BenchmarksPage Component (`src/pages/BenchmarksPage.tsx`)
**Purpose**: Simple routing wrapper

```typescript
import { BenchmarkManager } from '@/components/BenchmarkManager';

export function BenchmarksPage() {
  return <BenchmarkManager />;
}
```

---

## Core Component: BenchmarkManager

### State Management

#### Primary State Variables
```typescript
const [benchmarks, setBenchmarks] = useState<CustomBiomarker[]>(getAllBenchmarks());
// Stores all benchmarks (default + custom), initialized from localStorage

const [searchTerm, setSearchTerm] = useState('');
// Search filter for biomarker names and categories

const [isDialogOpen, setIsDialogOpen] = useState(false);
// Controls visibility of add/edit dialog

const [editingBenchmark, setEditingBenchmark] = useState<CustomBiomarker | null>(null);
// Stores the benchmark being edited (null for new entries)

const [error, setError] = useState<string | null>(null);
// Error message display
```

#### Form State
```typescript
const [formData, setFormData] = useState({
  name: '',          // Biomarker name (e.g., "Vitamin D")
  maleRange: '',     // Optimal range for males (e.g., "125-225 nmol/L")
  femaleRange: '',   // Optimal range for females (optional, defaults to male range)
  units: '',         // Comma-separated units (e.g., "nmol/L, ng/mL")
  category: '',      // Category like "Vitamins", "Hormones", etc.
});
```

### Data Structure: CustomBiomarker Interface

```typescript
interface CustomBiomarker {
  id: string;                    // Unique identifier ("default-{index}" or "custom-{timestamp}")
  name: string;                  // Biomarker name
  maleRange: string;             // Male optimal range
  femaleRange: string;           // Female optimal range
  units: string[];               // Array of acceptable units
  category?: string;             // Optional category
  aliases?: string[];            // Alternative names for matching
  isCustom: boolean;             // true for user-added, false for system defaults
}
```

### Key Functions

#### 1. Data Loading (`refreshBenchmarks`)
```typescript
const refreshBenchmarks = () => {
  setBenchmarks(getAllBenchmarks());
};
```
- Reloads benchmarks from localStorage
- Called after any create/update/delete operation

#### 2. Search Filtering (`filteredBenchmarks`)
```typescript
const filteredBenchmarks = useMemo(() => {
  if (!searchTerm) return benchmarks;
  const term = searchTerm.toLowerCase();
  return benchmarks.filter(
    b => b.name.toLowerCase().includes(term) ||
         b.category?.toLowerCase().includes(term)
  );
}, [benchmarks, searchTerm]);
```
- Filters benchmarks by name or category
- Case-insensitive search
- Returns all benchmarks if search is empty

#### 3. Add New Benchmark (`handleAdd`)
```typescript
const handleAdd = () => {
  setEditingBenchmark(null);
  setFormData({ name: '', maleRange: '', femaleRange: '', units: '', category: '' });
  setIsDialogOpen(true);
  setError(null);
};
```
- Opens dialog for new benchmark
- Clears form data
- Sets editingBenchmark to null

#### 4. Edit Existing Benchmark (`handleEdit`)
```typescript
const handleEdit = (benchmark: CustomBiomarker) => {
  setEditingBenchmark(inputBenchmark);
  setFormData({
    name: benchmark.name,
    maleRange: benchmark.maleRange || '',
    femaleRange: benchmark.femaleRange || '',
    units: benchmark.units.join(', '),  // Converts array to comma-separated string
    category: benchmark.category || '',
  });
  setIsDialogOpen(true);
  setError(null);
};
```
- Pre-fills form with existing benchmark data
- Converts units array to comma-separated string
- Can edit both custom and default benchmarks (editing defaults creates custom overrides)

#### 5. Delete Benchmark (`handleDelete`)
```typescript
const handleDelete = (benchmark: CustomBiomarker) => {
  if (!benchmark.isCustom) {
    setError('Cannot delete default benchmarks...');
    return;
  }
  if (confirm(`Delete benchmark "${benchmark.name}"?`)) {
    deleteCustomBenchmark(benchmark.id);
    refreshBenchmarks();
  }
};
```
- Only allows deletion of custom benchmarks
- Shows confirmation dialog
- Prevents deletion of system defaults

#### 6. Save Benchmark (`handleSave`)
```typescript
const handleSave = () => {
  // Validation
  if (!formData.name || !formData.maleRange) {
    setError('Name and Male Range are required');
    return;
  }

  const benchmarkData = {
    name: formData.name,
    maleRange: formData.maleRange,
    femaleRange: formData.femaleRange || formData.maleRange,  // Defaults to male range
    optimalRange: formData.maleRange,  // Legacy compatibility
    units: formData.units.split(',').map(u => u.trim()).filter(Boolean),  // Parse comma-separated units
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
```
- Validates required fields (name, maleRange)
- Auto-populates femaleRange if empty
- Parses comma-separated units string to array
- Handles both create and update operations

#### 7. Export Benchmarks (`handleExport`)
```typescript
const handleExport = () => {
  const json = exportBenchmarks();  // Gets all benchmarks as JSON string
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
```
- Creates downloadable JSON file
- Filename includes current date
- Triggers browser download

#### 8. Import Benchmarks (`handleImport`)
```typescript
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
```
- Opens file picker for JSON files
- Reads file content and imports benchmarks
- Shows error on invalid format

#### 9. Reset to Defaults (`handleReset`)
```typescript
const handleReset = () => {
  if (confirm('Reset all benchmarks to defaults? This will delete all custom benchmarks.')) {
    resetToDefaults();
    refreshBenchmarks();
  }
};
```
- Confirms before action
- Deletes all custom benchmarks
- Keeps only system defaults

---

## UI Layout Structure

### Main Container
```typescript
<div className="w-full max-w-7xl mx-auto space-y-6">
  {/* Card containing all content */}
</div>
```
- Centered container with max width
- Vertical spacing between elements

### Card Component Structure

#### Card Header
```typescript
<CardHeader>
  <CardTitle>Benchmark Management</CardTitle>
  <CardDescription>
    Manage biomarker optimal ranges for male and female patients
  </CardDescription>
</CardHeader>
```

#### Card Content (4 sections)

##### 1. Actions Bar
```typescript
<div className="flex flex-wrap items-center gap-3">
  {/* Search Input */}
  <div className="relative flex-1 min-w-[200px]">
    <Search icon />
    <Input placeholder="Search benchmarks..." />
  </div>
  
  {/* Action Buttons */}
  <Button onClick={handleAdd}>Add Benchmark</Button>
  <Button onClick={handleExport}>Export</Button>
  <Button onClick={handleImport}>Import</Button>
  <Button onClick={handleReset}>Reset</Button>
</div>
```
- Responsive flex layout
- Search bar with icon on left
- Four action buttons in a row

##### 2. Error Display
```typescript
{error && (
  <Alert variant="destructive">
    <AlertCircle icon />
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```
- Only visible when error exists
- Red destructive styling
- Error icon on left

##### 3. Statistics Display
```typescript
<div className="flex gap-4 text-sm text-muted-foreground">
  <span>Total: {benchmarks.length}</span>
  <span>Custom: {benchmarks.filter(b => b.isCustom).length}</span>
  <span>Default: {benchmarks.filter(b => !b.isCustom).length}</span>
</div>
```
- Three inline statistics
- Muted text color
- Shows counts dynamically

##### 4. Data Table
```typescript
<div className="rounded-md border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>#</TableHead>
        <TableHead>Biomarker Name</TableHead>
        <TableHead>Category</TableHead>
        <TableHead>Male Range</TableHead>
        <TableHead>Female Range</TableHead>
        <TableHead>Units</TableHead>
        <TableHead>Type</TableHead>
        <TableHead>Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {/* Table rows */}
    </TableBody>
  </Table>
</div>
```

**Table Columns:**
1. **#** - Row number (index + 1)
2. **Biomarker Name** - Font weight medium, full name
3. **Category** - Small text, muted if empty
4. **Male Range** - Standard text
5. **Female Range** - Standard text
6. **Units** - Shows first 2 units, "..." if more
7. **Type** - Badge (Custom vs Default)
8. **Actions** - Edit/Delete buttons (right-aligned)

**Row Rendering:**
```typescript
{filteredBenchmarks.map((benchmark, index) => (
  <TableRow key={benchmark.id}>
    <TableCell>{index + 1}</TableCell>
    <TableCell className="font-medium">{benchmark.name}</TableCell>
    <TableCell>{benchmark.category || '-'}</TableCell>
    <TableCell>{benchmark.maleRange}</TableCell>
    <TableCell>{benchmark.femaleRange}</TableCell>
    <TableCell>
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
        <Button variant="ghost" size="sm" onClick={() => handleEdit(benchmark)}>
          <Pencil icon />
        </Button>
        {benchmark.isCustom && (
          <Button variant="ghost" size="sm" onClick={() => handleDelete(benchmark)}>
            <Trash2 icon />
          </Button>
        )}
      </div>
    </TableCell>
  </TableRow>
))}
```

**Empty State:**
```typescript
{filteredBenchmarks.length === 0 && (
  <TableRow>
    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
      No benchmarks found
    </TableCell>
  </TableRow>
)}
```

---

## Dialog Component (Add/Edit Modal)

### Dialog Structure
```typescript
<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
  <DialogContent className="sm:max-w-[600px]">
    <DialogHeader>
      <DialogTitle>
        {editingBenchmark ? 'Edit Benchmark' : 'Add New Benchmark'}
      </DialogTitle>
      <DialogDescription>
        {/* Dynamic description based on edit vs add */}
      </DialogDescription>
    </DialogHeader>

    {/* Form Fields */}
    <div className="space-y-4 py-4">
      {/* Form inputs */}
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
```

### Form Fields Layout

#### 1. Biomarker Name (Single Column)
```typescript
<div className="space-y-2">
  <label className="text-sm font-medium">Biomarker Name *</label>
  <Input
    placeholder="e.g., Vitamin D"
    value={formData.name}
    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
    disabled={!!editingBenchmark && !editingBenchmark.isCustom}
  />
</div>
```
- Required field
- Disabled when editing non-custom benchmarks

#### 2. Male/Female Ranges (Two Columns)
```typescript
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
```
- 2-column grid layout
- Male range required
- Female range optional with helper text

#### 3. Units (Single Column)
```typescript
<div className="space-y-2">
  <label className="text-sm font-medium">Units</label>
  <Input
    placeholder="e.g., nmol/L, ng/mL"
    value={formData.units}
    onChange={(e) => setFormData({ ...formData, units: e.target.value })}
  />
  <p className="text-xs text-muted-foreground">Separate multiple units with commas</p>
</div>
```
- Accepts comma-separated units
- Parsed into array on save

#### 4. Category (Single Column)
```typescript
<div className="space-y-2">
  <label className="text-sm font-medium">Category</label>
  <Input
    placeholder="e.g., Vitamins, Hormones"
    value={formData.category}
    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
  />
</div>
```

---

## Data Persistence Layer

### Storage Key
```typescript
const CUSTOM_BENCHMARKS_KEY = 'mito_custom_benchmarks';
```

### API Functions (benchmark-storage.ts)

#### `getAllBenchmarks()`
- Returns combined array of default + custom benchmarks
- Defaults from `biomarkers.ts` (54 predefined biomarkers)
- Customs from localStorage
- Custom benchmarks override defaults by name (Map merge)

#### `getCustomBenchmarks()`
- Reads from localStorage
- Returns empty array if not found
- Handles parse errors gracefully

#### `saveCustomBenchmarks(benchmarks)`
- Writes to localStorage
- Throws error on failure

#### `addCustomBenchmark(benchmark)`
- Generates unique ID: `custom-${Date.now()}`
- Sets `isCustom: true`
- Appends to existing customs
- Returns new benchmark

#### `updateCustomBenchmark(id, updates)`
- Finds benchmark by ID
- Merges updates with existing data
- Saves to localStorage

#### `deleteCustomBenchmark(id)`
- Filters out benchmark by ID
- Saves updated array

#### `resetToDefaults()`
- Removes CUSTOM_BENCHMARKS_KEY from localStorage
- Effectively deletes all custom benchmarks

#### `exportBenchmarks()`
- Returns JSON string of all benchmarks
- Pretty-printed with 2-space indentation

#### `importBenchmarks(jsonString)`
- Parses JSON
- Filters to keep only `isCustom: true` benchmarks
- Replaces existing custom benchmarks

---

## Default Biomarkers Data

### Structure
54 predefined biomarkers in categories:
- **Liver Function**: ALP, ALT, AST, GGT, Total Bilirubin
- **Kidney Function**: BUN, Creatinine, eGFR
- **White Blood Cells**: Basophils, Eosinophils, Lymphocytes, Monocytes, Neutrophils, WBC
- **Red Blood Cells**: HCT, Hemoglobin, MCH, MCHC, MCV, RBC, RDW
- **Blood Cells**: Platelets
- **Electrolytes**: Bicarbonate, Chloride, Potassium, Sodium
- **Protein**: Albumin, Globulin, Total Protein
- **Metabolic**: Fasting Glucose, Fasting Insulin, HbA1C
- **Lipids**: HDL Cholesterol, LDL Cholesterol, Total Cholesterol, Triglycerides
- **Thyroid**: Free T3, Free T4, TSH, TPO Antibodies, Thyroglobulin Antibodies
- **Hormones**: SHBG
- **Vitamins**: Serum Folate, Vitamin B12, Vitamin D
- **Minerals**: Calcium, Phosphorus, Serum Magnesium
- **Iron Studies**: Ferritin, Serum Iron, TIBC, Transferrin Saturation %
- **Enzymes**: LDH
- **Cardiovascular**: Homocysteine

### Example Biomarker Object
```typescript
{
  name: "Vitamin D (25-Hydroxy D)",
  maleRange: "125-225 nmol/L (50-90 ng/mL)",
  femaleRange: "125-225 nmol/L (50-90 ng/mL)",
  units: ["nmol/L", "ng/mL"],
  category: "Vitamins",
  aliases: ["Vitamin D", "Vit D", "25-OH Vitamin D", ...]
}
```

---

## Visual Design Elements

### Icons Used (from lucide-react)
- `Plus` - Add button
- `Pencil` - Edit button
- `Trash2` - Delete button
- `Download` - Export button
- `Upload` - Import button
- `RotateCcw` - Reset button
- `Search` - Search input
- `AlertCircle` - Error alert
- `X` - Dialog close button

### Button Variants
- `default` - Primary actions (Add, Save)
- `outline` - Secondary actions (Export, Import, Reset, Cancel)
- `ghost` - Icon-only actions (Edit, Delete)

### Badge Variants
- `default` - Custom benchmark badge (blue)
- `secondary` - Default benchmark badge (gray)

### Color Classes
- `text-muted-foreground` - Secondary text (stats, placeholders)
- `text-destructive` - Error/deletion actions
- `destructive` - Error alert variant

### Layout Classes
- `flex flex-wrap` - Responsive button group
- `grid grid-cols-2` - Two-column form layout
- `space-y-4` - Vertical spacing
- `gap-3` - Button gap
- `max-w-7xl` - Maximum container width
- `mx-auto` - Center alignment

---

## User Interactions Flow

### Adding a Benchmark
1. Click "Add Benchmark" button
2. Dialog opens with empty form
3. Fill required fields (name, male range)
4. Optionally fill female range, units, category
5. Click "Add Benchmark" button
6. Dialog closes, table refreshes
7. New benchmark appears with "Custom" badge

### Editing a Default Benchmark
1. Click edit icon on default benchmark
2. Dialog opens with pre-filled form
3. Name field is disabled
4. Modify ranges/units/category
5. Click "Save Changes"
6. Creates custom override with same name
7. Custom version replaces default in view

### Editing a Custom Benchmark
1. Click edit icon on custom benchmark
2. Dialog opens with all fields editable
3. Modify any field
4. Click "Save Changes"
5. Updates existing custom benchmark

### Deleting a Benchmark
1. Click delete icon on custom benchmark
2. Confirmation dialog appears
3. Confirm deletion
4. Benchmark removed from table
5. Can't delete default benchmarks (trash icon hidden)

### Searching
1. Type in search box
2. Table filters in real-time
3. Searches by name or category
4. Case-insensitive
5. Shows "No benchmarks found" if empty

### Exporting
1. Click "Export" button
2. JSON file downloads automatically
3. Filename: `mito-benchmarks-YYYY-MM-DD.json`
4. Contains all benchmarks (default + custom)

### Importing
1. Click "Import" button
2. File picker opens
3. Select JSON file
4. Parses and imports custom benchmarks
5. Replaces existing custom benchmarks
6. Shows error if invalid format

### Resetting
1. Click "Reset" button
2. Confirmation dialog appears
3. Confirms deletion of all custom benchmarks
4. Resets to system defaults only

---

## Key Technical Details

### Merging Logic
- Custom benchmarks override defaults by name
- Uses Map for deduplication
- ID remains unique (`custom-{timestamp}` vs `default-{index}`)

### Unit Handling
- Display: comma-separated string ("nmol/L, ng/mL")
- Storage: array of strings (["nmol/L", "ng/mL"])
- Display limit: shows first 2 units, "..." if more

### Female Range Defaulting
- If femaleRange empty, uses maleRange value
- Ensures all benchmarks have both ranges

### Dialog Behavior
- Same dialog for add and edit
- Title changes dynamically
- Form pre-filling differs by mode
- Name disabled when editing non-custom defaults

### Error Handling
- Validation on save (name, maleRange required)
- Try-catch around localStorage operations
- User-friendly error messages
- Error state cleared on success

### Responsive Design
- Flex-wrap for button group
- Table scrolls horizontally on small screens
- Dialog adapts to screen size
- Search bar has minimum width constraint

---

## Dependencies

### React Hooks
- `useState` - Component state management
- `useMemo` - Filtered benchmarks memoization

### External Libraries
- `@radix-ui/react-dialog` - Dialog component
- `lucide-react` - Icon library

### Internal Components
- Card, CardContent, CardHeader, CardTitle, CardDescription
- Button
- Input
- Table, TableBody, TableCell, TableHead, TableHeader, TableRow
- Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
- Alert, AlertDescription
- Badge

### Internal Services
- `benchmark-storage.ts` - All data operations
- `biomarkers.ts` - Default biomarker definitions

---

## Edge Cases Handled

1. **Empty search** - Shows all benchmarks
2. **No benchmarks** - Shows "No benchmarks found" message
3. **Deleting defaults** - Prevents deletion, shows error
4. **Edit non-custom** - Disables name field, creates override
5. **Invalid import** - Shows error message
6. **localStorage errors** - Graceful error handling
7. **Empty female range** - Defaults to male range
8. **Empty units** - Empty array
9. **Many units** - Shows first 2 + "..."
10. **Duplicate names** - Custom overrides default

---

## Design Specifications for Implementation

### Layout Dimensions
- Max container width: `7xl` (80rem/1280px)
- Dialog max width: `600px` on small screens, responsive
- Search bar min width: `200px`
- Table column widths: varies by content

### Spacing
- Card padding: standard
- Form spacing: `space-y-4`
- Button gaps: `gap-3`
- Icon size: `h-4 w-4` (16px)

### Typography
- Titles: `text-lg font-semibold`
- Labels: `text-sm font-medium`
- Helper text: `text-xs text-muted-foreground`
- Stats: `text-sm text-muted-foreground`

### Colors
- Primary: theme colors
- Destructive: red variants
- Muted: gray variants
- Badge custom: default variant (blue)
- Badge default: secondary variant (gray)

### Interactive States
- Hover: opacity changes
- Focus: ring outline
- Disabled: muted colors
- Active: pressed state

---

## Summary for AI Design Tool

The Benchmarks Page is a **comprehensive CRUD interface** for managing 54+ biomarker reference ranges. It features:

1. **Search functionality** - Filter by name or category
2. **Data table** - Shows 8 columns with badge indicators
3. **Dialog modal** - Add/edit form with 5 fields
4. **Import/Export** - JSON file handling
5. **Reset option** - Clear all custom data
6. **Statistics** - Shows total/custom/default counts
7. **Error handling** - User-friendly error messages
8. **Validation** - Required field checks
9. **Custom vs Default** - Visual distinction with badges
10. **Responsive design** - Works on different screen sizes

The design uses a **modern card-based layout** with **shadcn/ui components**, follows **material design principles**, and includes **icon-based actions** for intuitive UX. All data persists to **localStorage** and integrates with the broader application's biomarker analysis system.





