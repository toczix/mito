# Timeline & Trends View - Complete Technical Breakdown

## Overview
The Timeline & Trends View is a dual-view interface within the Client History Dialog that allows users to visualize biomarker test history over time. It features a chronological timeline view and interactive trend graphs for tracking biomarker changes.

---

## Component Structure

### Main Integration Point
**File**: `src/components/ClientLibrary.tsx` (lines 37-50, 563-671)

**Dialog States**:
```typescript
const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
const [selectedClient, setSelectedClient] = useState<Client | null>(null);
const [clientAnalyses, setClientAnalyses] = useState<Analysis[]>([]);
const [loadingHistory, setLoadingHistory] = useState(false);
```

### Core Components
1. **BiomarkerTrends.tsx** - Individual trend graph component
2. **BiomarkerTrendsGrid.tsx** - Grid layout for multiple trends
3. **Tabs UI** - Timeline/Trends tab switcher
4. **ClientLibrary.tsx** - Timeline rendering logic

---

## Data Structure

### Analysis Interface
```typescript
interface Analysis {
  id: string;                    // Unique identifier
  client_id: string;            // Client relationship
  lab_test_date: string | null; // Actual test date from lab (YYYY-MM-DD)
  analysis_date: string;        // Upload/creation timestamp
  results: any;                 // JSON array of biomarker results
  summary: {                    // Automatically calculated stats
    totalBiomarkers: number;
    measuredBiomarkers: number;
    missingBiomarkers: number;
  } | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

### Analysis Result Structure
```typescript
interface AnalysisResult {
  biomarkerName: string;  // e.g., "Vitamin D"
  hisValue: string;        // Patient's value (or "N/A")
  unit: string;           // Measurement unit
  optimalRange: string;   // Reference range (gender-specific)
  testDate?: string;      // YYYY-MM-DD format
}
```

### DataPoint Interface (for trends)
```typescript
interface DataPoint {
  date: string;           // YYYY-MM-DD format
  value: number;          // Parsed numeric value
  displayDate: string;    // Formatted date (e.g., "Jan 15, 2024")
}
```

---

## Timeline View

### Layout Structure

#### Tab Container
```typescript
<Tabs defaultValue="timeline" className="w-full">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="timeline">Timeline</TabsTrigger>
    <TabsTrigger value="trends">Trends</TabsTrigger>
  </TabsList>
  
  <TabsContent value="timeline" className="space-y-4 py-4">
    {/* Timeline content */}
  </TabsContent>
</Tabs>
```

### Empty States

#### Loading State
```typescript
{loadingHistory && (
  <div className="text-center py-8 text-muted-foreground">
    Loading history...
  </div>
)}
```

#### No Data State
```typescript
{clientAnalyses.length === 0 && (
  <div className="text-center py-12">
    <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
    <p className="text-muted-foreground">
      No analysis history found for this client yet.
    </p>
  </div>
)}
```

### Timeline Rendering Logic

#### Map Over Analyses
```typescript
{clientAnalyses.map((analysis, index) => {
  // Determine test date (prefer lab_test_date, fallback to analysis_date)
  const testDate = analysis.lab_test_date 
    ? new Date(analysis.lab_test_date).toLocaleDateString()
    : new Date(analysis.analysis_date).toLocaleDateString();
  
  // Get biomarker counts
  const measuredCount = analysis.summary?.measuredBiomarkers || 0;
  const totalCount = analysis.summary?.totalBiomarkers || 0;
  
  return (
    // Timeline item rendering
  );
})}
```

### Timeline Item Structure

#### Container with Vertical Line
```typescript
<div key={analysis.id} className="relative pb-6">
  {/* Timeline line connector */}
  {index < clientAnalyses.length - 1 && (
    <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />
  )}
  
  <div className="flex gap-4">
    {/* Timeline dot + Card */}
  </div>
</div>
```

#### Timeline Dot
```typescript
<div className="relative flex-shrink-0">
  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
    {index + 1}
  </div>
</div>
```
- **Size**: 32px (w-8 h-8)
- **Shape**: Circular (rounded-full)
- **Color**: Primary theme color
- **Content**: Sequential number (1, 2, 3...)
- **Position**: Fixed, creates timeline reference

#### Analysis Card Content
```typescript
<Card className="flex-1">
  <CardContent className="p-4">
    <div className="space-y-3">
      {/* Header section */}
      {/* Biomarker preview */}
    </div>
  </CardContent>
</Card>
```

#### Header Section
```typescript
<div className="flex items-start justify-between">
  <div>
    {/* Date display */}
    <div className="flex items-center gap-2 mb-1">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <span className="font-semibold">{testDate}</span>
      {analysis.lab_test_date && (
        <Badge variant="outline" className="text-xs">Lab Test</Badge>
      )}
    </div>
    
    {/* Count info */}
    <p className="text-sm text-muted-foreground">
      {measuredCount} of {totalCount} biomarkers measured
    </p>
  </div>
  
  {/* View Details button */}
  <Button 
    variant="outline" 
    size="sm"
    onClick={() => {
      setSelectedAnalysis(analysis);
      setIsDetailDialogOpen(true);
    }}
  >
    View Details
  </Button>
</div>
```

#### Biomarker Preview Grid
```typescript
{analysis.results && Array.isArray(analysis.results) && (
  <div className="pt-2">
    <p className="text-xs text-muted-foreground mb-2">Key Biomarkers:</p>
    <div className="grid grid-cols-2 gap-2">
      {analysis.results.slice(0, 6).map((result: any, idx: number) => (
        <div key={idx} className="text-xs flex items-center justify-between p-2 bg-muted/50 rounded">
          <span className="font-medium">{result.biomarkerName}</span>
          <span className="text-muted-foreground">{result.hisValue}</span>
        </div>
      ))}
    </div>
    {analysis.results.length > 6 && (
      <p className="text-xs text-muted-foreground text-center mt-2">
        +{analysis.results.length - 6} more biomarkers
      </p>
    )}
  </div>
)}
```

**Features**:
- Shows first 6 biomarkers
- 2-column grid layout
- Each item shows name + value
- Muted background (`bg-muted/50`)
- Displays count of remaining biomarkers

---

## Detail Dialog (Timeline Click)

### Trigger
Clicking "View Details" button on any timeline item opens full analysis details.

### State Management
```typescript
const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
```

### Dialog Structure
```typescript
<Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
  <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Calendar className="h-5 w-5" />
        Analysis Details - {formattedDate}
      </DialogTitle>
      <DialogDescription>
        Complete biomarker results for this lab test
      </DialogDescription>
    </DialogHeader>
    
    {/* Summary cards + Results table */}
  </DialogContent>
</Dialog>
```

### Summary Statistics (3 Cards)
```typescript
<div className="grid grid-cols-3 gap-4">
  {/* Total Biomarkers */}
  <Card>
    <CardContent className="p-4 text-center">
      <div className="text-2xl font-bold text-primary">
        {selectedAnalysis.summary?.totalBiomarkers || 0}
      </div>
      <div className="text-xs text-muted-foreground">Total Biomarkers</div>
    </CardContent>
  </Card>
  
  {/* Measured */}
  <Card>
    <CardContent className="p-4 text-center">
      <div className="text-2xl font-bold text-green-600">
        {selectedAnalysis.summary?.measuredBiomarkers || 0}
      </div>
      <div className="text-xs text-muted-foreground">Measured</div>
    </CardContent>
  </Card>
  
  {/* Not Measured */}
  <Card>
    <CardContent className="p-4 text-center">
      <div className="text-2xl font-bold text-muted-foreground">
        {selectedAnalysis.summary?.missingBiomarkers || 0}
      </div>
      <div className="text-xs text-muted-foreground">Not Measured</div>
    </CardContent>
  </Card>
</div>
```

### Complete Results Table
```typescript
<div className="border rounded-lg overflow-hidden">
  <div className="max-h-[400px] overflow-y-auto">
    <table className="w-full">
      <thead className="bg-muted sticky top-0">
        <tr>
          <th className="text-left p-3 font-medium">#</th>
          <th className="text-left p-3 font-medium">Biomarker</th>
          <th className="text-right p-3 font-medium">Value</th>
          <th className="text-right p-3 font-medium">Unit</th>
          <th className="text-right p-3 font-medium">Optimal Range</th>
        </tr>
      </thead>
      <tbody>
        {selectedAnalysis.results.map((result: any, idx: number) => (
          <tr key={idx} className="border-t">
            <td className="p-3 text-muted-foreground">{idx + 1}</td>
            <td className="p-3 font-medium">{result.biomarkerName}</td>
            <td className="p-3 text-right font-mono">
              {result.hisValue === 'N/A' ? (
                <span className="text-muted-foreground">N/A</span>
              ) : (
                result.hisValue
              )}
            </td>
            <td className="p-3 text-right text-sm text-muted-foreground">
              {result.unit}
            </td>
            <td className="p-3 text-right text-sm text-muted-foreground">
              {result.optimalRange}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
```

**Features**:
- Sticky header
- Scrollable body (max 400px height)
- Row-by-row rendering
- Highlighted N/A values
- Mono font for values

---

## Trends View

### Component: BiomarkerTrendsGrid

**File**: `src/components/BiomarkerTrends.tsx` (lines 173-218)

**Props**:
```typescript
interface BiomarkerTrendsGridProps {
  analyses: Analysis[];
  biomarkerNames?: string[];  // Optional override
}
```

### Grid Logic

#### Step 1: Determine Biomarkers to Display
```typescript
const defaultBiomarkers = biomarkerNames || extractCommonBiomarkers(analyses);
```

**Default Behavior**: If no biomarker names provided, extracts most commonly measured biomarkers:
```typescript
function extractCommonBiomarkers(analyses: Analysis[]): string[] {
  const biomarkerCounts: Record<string, number> = {};
  
  analyses.forEach(analysis => {
    if (analysis.results && Array.isArray(analysis.results)) {
      analysis.results.forEach((result: any) => {
        if (result.hisValue !== 'N/A' && !isNaN(parseFloat(result.hisValue))) {
          biomarkerCounts[result.biomarkerName] = 
            (biomarkerCounts[result.biomarkerName] || 0) + 1;
        }
      });
    }
  });
  
  // Return biomarkers measured at least twice, sorted by frequency
  return Object.entries(biomarkerCounts)
    .filter(([_, count]) => count >= 2)  // Must appear in at least 2 analyses
    .sort((a, b) => b[1] - a[1])          // Sort by frequency descending
    .map(([name]) => name);
}
```

#### Step 2: Validation Checks
```typescript
if (analyses.length < 2) {
  return (
    <Card>
      <CardContent className="p-6 text-center text-muted-foreground">
        At least 2 analyses are needed to show trends
      </CardContent>
    </Card>
  );
}

if (defaultBiomarkers.length === 0) {
  return (
    <Card>
      <CardContent className="p-6 text-center text-muted-foreground">
        Not enough data to show trends. Need at least 2 analyses with measurable biomarkers.
      </CardContent>
    </Card>
  );
}
```

#### Step 3: Render Grid
```typescript
return (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Showing {defaultBiomarkers.length} biomarker{defaultBiomarkers.length !== 1 ? 's' : ''} measured in at least 2 analyses
    </p>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {defaultBiomarkers.map(biomarkerName => (
        <BiomarkerTrends
          key={biomarkerName}
          analyses={analyses}
          biomarkerName={biomarkerName}
        />
      ))}
    </div>
  </div>
);
```

**Layout**:
- Responsive grid: 1 column (mobile), 2 columns (tablet), 3 columns (desktop)
- Gap: 16px (`gap-4`)
- Vertical spacing: 16px (`space-y-4`)

---

## Individual Trend Component

### Component: BiomarkerTrends

**File**: `src/components/BiomarkerTrends.tsx` (lines 17-171)

**Props**:
```typescript
interface BiomarkerTrendsProps {
  analyses: Analysis[];
  biomarkerName: string;
}
```

### Data Extraction Logic

#### Step 1: Extract and Parse Data Points
```typescript
const dataPoints: DataPoint[] = analyses
  .map(analysis => {
    // Find this biomarker in analysis results
    const result = analysis.results?.find(
      (r: any) => r.biomarkerName === biomarkerName
    );
    
    // Skip if not found or N/A
    if (!result || result.hisValue === 'N/A') return null;
    
    // Parse numeric value
    const value = parseFloat(result.hisValue);
    if (isNaN(value)) return null;
    
    // Get date (prefer lab_test_date)
    const date = analysis.lab_test_date || analysis.analysis_date;
    
    return {
      date,
      value,
      displayDate: new Date(date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }),
    };
  })
  .filter((dp): dp is DataPoint => dp !== null)
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Oldest to newest
  .reduce((acc, curr) => {
    // Remove duplicates: keep only one entry per unique date
    const existingIndex = acc.findIndex(dp => dp.date === curr.date);
    if (existingIndex === -1) {
      acc.push(curr);
    }
    return acc;
  }, [] as DataPoint[]);
```

**Processing Steps**:
1. Map over all analyses
2. Find matching biomarker by name
3. Filter out N/A values
4. Parse to numeric values
5. Sort chronologically (oldest first)
6. Deduplicate by date (keep first occurrence)

#### Step 2: Handle Empty Data
```typescript
if (dataPoints.length === 0) {
  return (
    <Card>
      <CardContent className="p-6 text-center text-muted-foreground">
        No trend data available for {biomarkerName}
      </CardContent>
    </Card>
  );
}
```

### Trend Calculation

#### Percentage Change
```typescript
const firstValue = dataPoints[0].value;
const lastValue = dataPoints[dataPoints.length - 1].value;
const percentChange = ((lastValue - firstValue) / firstValue) * 100;
```

#### Trend Classification
```typescript
const trend = percentChange > 5 ? 'up' : percentChange < -5 ? 'down' : 'stable';
```

**Thresholds**:
- **Up**: > 5% increase
- **Down**: < -5% decrease
- **Stable**: Between -5% and +5%

### Data Normalization

#### Normalize to 0-100 Scale
```typescript
const values = dataPoints.map(dp => dp.value);
const minValue = Math.min(...values);
const maxValue = Math.max(...values);
const range = maxValue - minValue || 1; // Prevent division by zero

const normalizedPoints = dataPoints.map(dp => ({
  ...dp,
  normalized: ((dp.value - minValue) / range) * 100,
}));
```

**Purpose**: Scales all values to fit within 0-100% for consistent visualization regardless of absolute values.

---

## Trend Card Layout

### Card Header
```typescript
<CardHeader>
  <div className="flex items-center justify-between">
    <CardTitle className="text-lg">{biomarkerName}</CardTitle>
    <div className="flex items-center gap-2">
      {/* Trend badge */}
    </div>
  </div>
</CardHeader>
```

### Trend Badge Display
```typescript
{trend === 'up' && (
  <Badge variant="default" className="gap-1 bg-orange-500">
    <TrendingUp className="h-3 w-3" />
    +{percentChange.toFixed(1)}%
  </Badge>
)}

{trend === 'down' && (
  <Badge variant="default" className="gap-1 bg-blue-500">
    <TrendingDown className="h-3 w-3" />
    {percentChange.toFixed(1)}%
  </Badge>
)}

{trend === 'stable' && (
  <Badge variant="outline" className="gap-1">
    <Minus className="h-3 w-3" />
    Stable
  </Badge>
)}
```

**Visual Indicators**:
- **Up**: Orange badge, TrendingUp icon, positive percentage
- **Down**: Blue badge, TrendingDown icon, negative percentage
- **Stable**: Outline badge, Minus icon, "Stable" text

### Chart Area (SVG)

#### Container
```typescript
<div className="relative h-40 bg-muted/30 rounded-lg p-6">
  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
    {/* SVG content */}
  </svg>
</div>
```

**Dimensions**:
- Height: 160px (`h-40`)
- Background: Muted with 30% opacity
- SVG: Full width/height with 100x100 viewBox

#### Grid Lines
```typescript
{/* Horizontal grid lines */}
<line x1="0" y1="0" x2="100" y2="0" stroke="currentColor" strokeWidth="0.2" opacity="0.2" />
<line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.2" opacity="0.2" />
<line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" strokeWidth="0.2" opacity="0.2" />
```

**Purpose**: Visual reference lines at 0%, 50%, 100% of normalized scale.

#### Trend Line (Polyline)
```typescript
{normalizedPoints.length > 1 && (
  <polyline
    points={normalizedPoints
      .map((dp, i) => {
        const x = (i / (normalizedPoints.length - 1)) * 100;
        const y = 100 - dp.normalized;
        return `${x},${y}`;
      })
      .join(' ')}
    stroke="hsl(var(--primary))"
    strokeWidth="1"
    fill="none"
    vectorEffect="non-scaling-stroke"
  />
)}
```

**Calculation**:
- X coordinate: Distributed evenly across width (0 to 100)
- Y coordinate: Inverted (100 - normalized) because SVG Y=0 is top
- Color: Primary theme color
- Width: 1px (vectorEffect for consistent rendering)

#### Data Points (Circles)
```typescript
{normalizedPoints.map((dp, i) => {
  const x = normalizedPoints.length === 1 ? 50 : (i / (normalizedPoints.length - 1)) * 100;
  const y = 100 - dp.normalized;
  return (
    <circle
      key={i}
      cx={x}
      cy={y}
      r="1.5"
      fill="hsl(var(--primary))"
      stroke="hsl(var(--background))"
      strokeWidth="0.5"
      vectorEffect="non-scaling-stroke"
    />
  );
})}
```

**Special Case**: Single data point centered at x=50

**Styling**:
- Radius: 1.5 units (SVG viewBox scale)
- Fill: Primary color
- Stroke: Background color (creates outline)
- Stroke width: 0.5 units

### Data Table
```typescript
<div className="space-y-1.5 max-h-48 overflow-y-auto">
  {dataPoints.map((dp, i) => (
    <div
      key={i}
      className="flex items-center justify-between text-sm p-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors"
    >
      <span className="text-muted-foreground">{dp.displayDate}</span>
      <span className="font-mono font-semibold">{dp.value.toFixed(2)}</span>
    </div>
  ))}
</div>
```

**Features**:
- Scrollable (max height 192px)
- Date left, value right
- Mono font for numeric values
- Hover effect (background opacity change)
- 2 decimal precision

### Summary Footer
```typescript
<div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
  <span>Min: <strong>{minValue.toFixed(2)}</strong></span>
  <span>Max: <strong>{maxValue.toFixed(2)}</strong></span>
  <span>Latest: <strong>{lastValue.toFixed(2)}</strong></span>
</div>
```

**Display**: Three columns showing min, max, and latest absolute values.

---

## API Integration

### Fetch Client Analyses
**File**: `src/lib/analysis-service.ts`

```typescript
export async function getClientAnalyses(clientId: string): Promise<Analysis[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('client_id', clientId)
    .order('analysis_date', { ascending: false });
  
  if (error) {
    console.error('Error fetching analyses:', error);
    return [];
  }
  
  return data || [];
}
```

**Query Details**:
- Table: `analyses`
- Filter: `client_id` equals provided ID
- Order: `analysis_date` descending (newest first)
- Error handling: Returns empty array on error

### Load History Handler
```typescript
async function loadClientHistory(client: Client) {
  setSelectedClient(client);
  setIsHistoryDialogOpen(true);
  setLoadingHistory(true);
  
  const analyses = await getClientAnalyses(client.id);
  setClientAnalyses(analyses);
  setLoadingHistory(false);
}
```

---

## Visual Design Specifications

### Timeline View

#### Timeline Item
- **Dot size**: 32px × 32px
- **Dot color**: Primary theme
- **Dot number**: Sequential (1, 2, 3...)
- **Connector line**: 2px width (`w-0.5`), vertical
- **Card padding**: 16px (`p-4`)
- **Card spacing**: 16px vertical (`space-y-3`)

#### Date Display
- **Icon**: Calendar (16px)
- **Font**: Semibold
- **Badge**: Outline variant, extra small text

#### Biomarker Preview
- **Grid**: 2 columns
- **Item padding**: 8px (`p-2`)
- **Background**: Muted/50% opacity
- **Text size**: Extra small (`text-xs`)
- **Font**: Medium weight for names

### Trends View

#### Grid Layout
- **Mobile**: 1 column
- **Tablet** (`md:`): 2 columns
- **Desktop** (`lg:`): 3 columns
- **Gap**: 16px (`gap-4`)

#### Trend Card
- **Height**: Auto
- **Header**: Large text (`text-lg`)
- **Chart area**: 160px height
- **Badge**: 12px icon (`h-3 w-3`)

#### Chart
- **Background**: Muted 30% opacity
- **Border radius**: Large (`rounded-lg`)
- **Padding**: 24px (`p-6`)
- **Line color**: Primary
- **Line width**: 1px
- **Point radius**: 1.5 units
- **Grid opacity**: 20%

#### Data Table
- **Max height**: 192px (`max-h-48`)
- **Item padding**: 8px (`p-2`)
- **Background**: Muted 20% opacity
- **Hover**: Muted 40% opacity
- **Text size**: Small (`text-sm`)

#### Summary Footer
- **Text size**: Extra small (`text-xs`)
- **Color**: Muted foreground
- **Border**: Top border (`border-t`)
- **Strong text**: Bold weight

---

## Key Algorithms

### Data Extraction Algorithm
1. Filter analyses containing biomarker
2. Parse numeric values (skip N/A)
3. Extract dates (prefer lab_test_date)
4. Sort chronologically
5. Deduplicate by date

### Trend Calculation Algorithm
```typescript
percentChange = ((lastValue - firstValue) / firstValue) * 100

if (percentChange > 5) → 'up'
else if (percentChange < -5) → 'down'
else → 'stable'
```

### Normalization Algorithm
```typescript
minValue = min(all values)
maxValue = max(all values)
range = maxValue - minValue || 1

normalized = ((value - minValue) / range) * 100
```

### Common Biomarker Extraction Algorithm
1. Count occurrences of each biomarker across all analyses
2. Filter: count >= 2
3. Sort: descending by count
4. Map: return names only

### SVG Coordinate Calculation
```typescript
// X axis: evenly distributed
x = (index / (totalPoints - 1)) * 100

// Y axis: inverted normalized value
y = 100 - normalizedValue

// Single point: center
x = 50
```

---

## Edge Cases Handled

1. **No analyses**: Shows empty state with calendar icon
2. **Loading**: Shows loading text
3. **Insufficient data**: Shows requirement message
4. **N/A values**: Filtered out
5. **Non-numeric values**: Filtered out (isNaN check)
6. **Duplicate dates**: Keep first occurrence
7. **Missing lab_test_date**: Fallback to analysis_date
8. **Single data point**: Center in chart, no line
9. **Zero range**: Prevents division by zero (|| 1)
10. **Empty biomarker list**: Returns empty state

---

## User Interactions

### Timeline View
1. **Click "History"** button on client card
2. **View** chronological analysis list
3. **Click "View Details"** on any analysis
4. **See** full biomarker table
5. **Close** dialog or switch tabs

### Trends View
1. **Switch** to Trends tab
2. **View** automatically selected biomarkers
3. **See** minicharts with trend indicators
4. **Hover** over data table items
5. **Scroll** through data table if many points

### Detail Dialog
1. **Click** any timeline item's "View Details"
2. **View** summary statistics
3. **Scroll** through complete results table
4. **Close** dialog

---

## Dependencies

### External Libraries
- `@radix-ui/react-tabs` - Tab component
- `lucide-react` - Icons (Calendar, TrendingUp, TrendingDown, Minus)

### Internal Components
- Card, CardContent, CardHeader, CardTitle
- Button
- Badge
- Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
- Tabs, TabsList, TabsTrigger, TabsContent

### Internal Services
- `analysis-service.ts` - getClientAnalyses()
- `supabase.ts` - Database types and client

---

## Performance Considerations

### Data Processing
- **Efficient**: Single-pass data extraction
- **Memoization**: None (consider for large datasets)
- **Sorting**: O(n log n) chronological sort
- **Deduplication**: O(n²) worst case (but n is small)

### Rendering
- **SVG**: Lightweight, scalable
- **Virtualization**: None (consider for 100+ analyses)
- **Lazy loading**: Dialog opens on demand

### Optimization Tips
1. Cache biomarker extraction results
2. Memoize normalized points
3. Virtualize timeline items for 50+ analyses
4. Debounce scroll handlers

---

## Summary for AI Design Tool

The Timeline & Trends View is a **sophisticated dual-perspective interface** for visualizing biomarker history:

### Timeline View
- **Visual timeline** with numbered dots and connecting lines
- **Chronological ordering** (newest first in data, oldest to newest in timeline)
- **Preview cards** showing date, biomarker count, and key values
- **Detail dialog** with full biomarker table and summary stats
- **Empty states** for no data and loading

### Trends View
- **Auto-detection** of most commonly measured biomarkers
- **Grid layout** (1/2/3 columns responsive)
- **Minicharts** using SVG (no external chart library)
- **Trend indicators** (up/down/stable with percentage)
- **Data tables** showing all values over time
- **Summary stats** (min/max/latest)

### Key Features
1. **Smart filtering** - Only shows biomarkers with ≥2 measurements
2. **Data normalization** - Scales values to 0-100% for comparison
3. **Trend classification** - Automatic up/down/stable detection
4. **Deduplication** - Handles duplicate dates gracefully
5. **Responsive design** - Works on all screen sizes
6. **Performance** - Lightweight SVG charts
7. **Accessibility** - Clear labels and semantic HTML

The design emphasizes **simplicity and clarity** - no heavy charting libraries, just clean SVG visualizations that make biomarker trends immediately apparent.








