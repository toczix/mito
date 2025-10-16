# White Blood Cell Percentage Ranges Update

## Problem Identified
Lab reports often show WBC differential counts (Basophils, Eosinophils, Lymphocytes, Monocytes, Neutrophils) as **percentages (%)** rather than **absolute counts (×10³/µL)**. The system was only configured to handle absolute counts, causing unit mismatch errors and false "Out of Range" indicators.

## What Was Fixed

### 1. Updated Biomarker Definitions (`src/lib/biomarkers.ts`)
All 5 WBC differential biomarkers now include BOTH percentage and absolute count ranges:

| Biomarker | Updated Range |
|-----------|---------------|
| **Basophils** | `0-1 % (≤ 0.09 ×10³/µL)` |
| **Eosinophils** | `1-4 % (0.0-0.3 ×10³/µL)` |
| **Lymphocytes** | `20-40 % (1.1-3.1 ×10³/µL)` |
| **Monocytes** | `2-8 % (0.3-0.5 ×10³/µL)` |
| **Neutrophils** | `40-70 % (3.0-4.5 ×10³/µL)` |

Each biomarker now:
- ✅ Lists `%` as the first (primary) unit in the units array
- ✅ Includes percentage range as primary with absolute count in parentheses
- ✅ Works with the unit-aware comparison logic

### 2. Updated Database Seed File (`sql/supabase-seed-benchmarks.sql`)
The SQL seed file has been updated with the same ranges for consistency across all data sources.

### 3. Created Migration Script (`sql/supabase-migration-wbc-percentage-ranges.sql`)
A migration script is provided to update existing database benchmarks if you're using Supabase.

## Important: Old Analysis Results

**Saved analysis results will still show OLD ranges** because they contain a snapshot of the biomarker ranges at the time of analysis. This is by design - each analysis is a historical record.

To see the new ranges, you need to:

### Option 1: Re-analyze (Recommended)
1. Upload the same lab PDF again
2. This will create a new analysis with updated ranges
3. The system will detect duplicate lab test dates and offer to update the existing analysis

### Option 2: View Fresh Analysis
1. Upload a new lab report
2. All new analyses will use the updated ranges automatically

## For Supabase Users

If you're using Supabase and want to update the benchmark definitions in your database:

1. Run the migration script:
   ```sql
   -- Execute this in your Supabase SQL editor
   \i sql/supabase-migration-wbc-percentage-ranges.sql
   ```

2. Or manually run the seed file to refresh all benchmarks:
   ```sql
   \i sql/supabase-seed-benchmarks.sql
   ```

The seed file uses `ON CONFLICT ... DO UPDATE` so it will safely update existing benchmarks without losing data.

## Technical Details

### Unit-Aware Comparison Logic
The `isValueInRange()` function now:
1. Extracts the unit from the biomarker value
2. Searches for a matching range with that unit in the optimal range string
3. Prioritizes parenthetical ranges (e.g., "(0-1 %)" matches first for "%" unit)
4. Falls back to the first range if no unit-specific match is found

### Range Format Examples
```
Value: "1 %"
Unit: "%"
Optimal Range: "0-1 % (≤ 0.09 ×10³/µL)"
Matched Range: "0-1 %" ✓
Status: IN RANGE ✓

Value: "0.05 ×10³/µL"
Unit: "×10³/µL"
Optimal Range: "0-1 % (≤ 0.09 ×10³/µL)"
Matched Range: "≤ 0.09 ×10³/µL" ✓
Status: IN RANGE ✓
```

## Verification

After deploying these changes:

1. ✅ Basophils at 1% → Shows as IN RANGE
2. ✅ Eosinophils at 3% → Shows as IN RANGE
3. ✅ Lymphocytes at 30% → Shows as IN RANGE
4. ✅ Monocytes at 5% → Shows as IN RANGE
5. ✅ Neutrophils at 55% → Shows as IN RANGE

All values within the percentage ranges will correctly validate, and absolute count values will still work as before.

## Files Modified

1. `src/lib/biomarkers.ts` - Core biomarker definitions
2. `src/lib/analyzer.ts` - Unit-aware comparison logic (previous commit)
3. `src/components/AnalysisResults.tsx` - Pass unit to comparison function (previous commit)
4. `sql/supabase-seed-benchmarks.sql` - Database seed data
5. `sql/supabase-migration-wbc-percentage-ranges.sql` - Migration script (NEW)

## Future Considerations

If other biomarkers report with multiple unit types, the same pattern can be applied:
1. Add all unit types to the `units` array
2. Format the range string with all unit ranges (primary first, alternates in parentheses)
3. The existing unit-aware logic will handle it automatically

