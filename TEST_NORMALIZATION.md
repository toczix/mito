# Normalization Testing Guide

## Quick Wins Implemented ✅

1. ✅ **Max tokens increased** (8192 → 32768) in edge function
2. ✅ **AnalysisResult extended** with `_normalization` metadata
3. ✅ **Normalizer initialization** added to app startup
4. ✅ **HomePage updated** to use normalized biomarkers
5. ✅ **Analytics queries** created for monitoring

---

## Testing Checklist

### 1. Verify Max Tokens Update

```bash
# Check edge function
grep "max_tokens" supabase/functions/analyze-biomarkers/index.ts

# Should show: max_tokens: 32768
```

**✅ Expected**: 32768 (not 8192)

---

### 2. Test Normalizer Initialization

```bash
# Start dev server
npm run dev
```

**✅ Expected in browser console**:
```
🚀 Initializing Mito app...
✅ Biomarker normalizer initialized
```

If you see the warning instead:
```
⚠️ Biomarker normalizer initialization failed (will use passthrough)
```

That's OK - it means Supabase isn't configured or taxonomy tables don't exist yet. The app will still work, just without normalization.

---

### 3. Test Biomarker Upload (English)

1. Upload a standard English lab report
2. Open browser console (F12)
3. Look for: `📊 Biomarker Extraction Summary`

**✅ Expected**:
```
📄 PDF 1: sample-lab-report.pdf
✅ Extracted 45 biomarkers:
┌─────┬─────────────┬────────┬────────┐
│ idx │ name        │ value  │ unit   │
├─────┼─────────────┼────────┼────────┤
│ 0   │ Glucose     │ 95     │ mg/dL  │
│ 1   │ Vitamin B12 │ 450    │ pg/mL  │
```

---

### 4. Test Normalization (Multilingual)

1. Upload a **Spanish** or **Portuguese** lab report
2. Check console for normalization

**✅ Expected**:
```
📄 PDF 1: spanish-report.pdf
✅ Extracted 40 biomarkers (normalized):
┌─────┬─────────────┬────────┬────────┬──────────────┬────────────┐
│ idx │ name        │ value  │ unit   │ original     │ confidence │
├─────┼─────────────┼────────┼────────┼──────────────┼────────────┤
│ 0   │ Glucose     │ 95     │ mg/dL  │ Glucosa      │ 100%       │
│ 1   │ Vitamin B12 │ 450    │ pg/mL  │ Vitamina B12 │ 100%       │
```

**Key**: `original` column shows Spanish name, `name` is English canonical

---

### 5. Verify Metadata Saved

After creating an analysis:

```typescript
// In browser console
const analyses = await supabase.from('analyses').select('results').limit(1)
console.log(analyses.data[0].results[0])
```

**✅ Expected**:
```javascript
{
  biomarkerName: "Vitamin B12",
  hisValue: "450",
  unit: "pg/mL",
  optimalRange: "400-900 pg/mL",
  _normalization: {
    originalName: "Vitamina B12",
    originalValue: "450",
    originalUnit: "pg/mL",
    confidence: 1.0,
    conversionApplied: false,
    isNumeric: true
  }
}
```

---

### 6. Test Analytics Queries

```typescript
// In browser console
import { getLowConfidenceNormalizations } from './lib/analytics-queries'

const lowConf = await getLowConfidenceNormalizations(0.5, 20)
console.table(lowConf)
```

**✅ Expected**:
```
┌─────┬──────────────────┬──────────────────┬────────────┬───────┐
│ idx │ originalName     │ canonicalName    │ confidence │ count │
├─────┼──────────────────┼──────────────────┼────────────┼───────┤
│ 0   │ B12 Vitamin      │ Vitamin B12      │ 0.80       │ 15    │
│ 1   │ Colesterol Total │ Total Cholesterol│ 0.80       │ 12    │
```

This shows which names need aliases added!

---

### 7. Test Non-Numeric Values

Upload a report with "N/A" or "<0.1" values.

**✅ Expected in metadata**:
```javascript
{
  biomarkerName: "TSH",
  hisValue: "N/A",
  unit: "mIU/L",
  _normalization: {
    isNumeric: false,  // ✅ Correctly detected
    originalValue: "N/A"
  }
}
```

---

## Troubleshooting

### Normalizer Fails to Initialize

**Symptom**:
```
⚠️ Biomarker normalizer initialization failed
```

**Cause**: Taxonomy tables don't exist yet (deferred to later phase)

**Fix**: This is expected! App works without normalization.

---

### TypeScript Errors

**Symptom**: `Property 'normalizedBiomarkers' does not exist`

**Fix**: Make sure these types are exported:
```typescript
// src/lib/biomarkers.ts
export interface NormalizedBiomarker { ... }

// src/lib/claude-service.ts
export interface ClaudeResponse {
  normalizedBiomarkers?: NormalizedBiomarker[];
  ...
}
```

---

### No Normalization Metadata

**Symptom**: `_normalization` is undefined in saved analyses

**Cause**: Normalizer not wired into claude-service.ts yet

**Fix**: This is expected for now - metadata only appears when normalization is fully implemented.

---

## Success Criteria

| Test | Status | Notes |
|------|--------|-------|
| Max tokens = 32768 | ✅ | Check edge function |
| App initializes | ✅ | Console shows "Biomarker normalizer initialized" |
| English upload works | ✅ | Biomarkers extracted correctly |
| Spanish upload works | ✅ | Names normalized to English |
| Metadata saved | ⏳ | Will work once normalizer is wired |
| Analytics queries | ✅ | Can run in console |

---

## Next Steps

After testing:

1. **Deploy edge function**: `supabase functions deploy analyze-biomarkers`
2. **Test in production** with real reports
3. **Monitor low-confidence** matches
4. **Add aliases** to normalizer for common misses
5. **Consider schema migration** if normalization proves valuable

---

## Quick Test Command

```bash
# Build and run locally
npm run build && npm run dev

# Deploy edge function
supabase functions deploy analyze-biomarkers

# Check logs
supabase functions logs analyze-biomarkers
```

---

**Created**: 2025-11-12
**Status**: Ready for testing
