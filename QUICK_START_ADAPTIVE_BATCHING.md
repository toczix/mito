# Quick Start: Adaptive Batch Processing

**Status**: ✅ Ready to test
**Build**: ✅ Passing

## Immediate Next Steps

### 1. Run Dev Server

```bash
npm run dev
```

### 2. Test with Sample Files

Upload a mix of lab reports to test the system:

**Recommended test set**:
- 2-3 small text-based reports (~100 KB each)
- 2-3 image-based scans (~2-4 MB each)
- 1 blank/invalid document (to test filtering)
- 1 large scan (>6 MB to test rejection)

### 3. Monitor Console Output

Open browser console (F12) and look for:

```
🚀 Starting Adaptive Batch Processing
Total files: 8

📋 Filtered 8 documents: 7 processable, 1 skipped
⏭️ Skipping "blank.pdf": Empty document

⚠️ Skipping oversized file: huge_scan.pdf - File size 8.3 MB exceeds 6 MB limit

📦 Created 2 adaptive batch(es) from 6 file(s)
   Batch 1: 3 files, 9.2 MB, ~42,300 tokens [mixed]
   Batch 2: 3 files, 5.8 MB, ~28,100 tokens [text-heavy]

🚀 Processing adaptive batch 1/2 [mixed]
📊 Batch Metrics [batch_1731428432_x7k2p9]
├─ Files: 3
├─ Payload: 9.20 MB
├─ Est. Tokens: 42,300
├─ Duration: 35.2s
└─ Status: ✅ Success

⏸️ Adaptive delay: 3.5s before next batch...

🚀 Processing adaptive batch 2/2 [text-heavy]
✅ Batch 2/2 completed in 18.7s

📊 Processing Summary:
   ✅ Successful: 6
   ❌ Failed: 0
   ⏭️  Skipped: 1
   ⚠️  Too Large: 1
```

### 4. Check Telemetry

In browser console after upload:

```javascript
import { logTelemetrySummary } from '/src/lib/analytics-queries'
logTelemetrySummary()
```

**Expected output**:
```
📊 Batch Processing Telemetry
Total Batches: 2
Success Rate: 100%
Avg Duration: 27.0s
Avg Payload: 7.5 MB
Timeouts: 0
Rate Limits: 0

Recent 2 batches:
┌──────┬───────┬────────┬────────┬───────────┬────────┬───────┐
│ id   │ files │ sizeMB │ tokens │ durationS │ status │ error │
├──────┼───────┼────────┼────────┼───────────┼────────┼───────┤
│ bat…│   3   │  9.20  │ 42,300 │   35.2    │   ✅   │   -   │
│ bat…│   3   │  5.80  │ 28,100 │   18.7    │   ✅   │   -   │
└──────┴───────┴────────┴────────┴───────────┴────────┴───────┘
```

### 5. Test Edge Cases

**Batch failure scenario** (simulate by disconnecting network mid-upload):

Expected behavior:
```
❌ Batch 1/2 failed: Network error
🔄 Retrying 5 files individually...
✅ Individual retry succeeded: report1.pdf
✅ Individual retry succeeded: report2.pdf
❌ Individual retry failed: report3.pdf
...
```

## Key Indicators of Success

✅ **Pre-filtering works**:
- Empty files skipped with reason in console
- `⏭️ Skipping` messages appear

✅ **Adaptive batching works**:
- Variable batch sizes (not always 10)
- Batch types detected (text-heavy, image-heavy, mixed)
- `📦 Created X adaptive batch(es)` message

✅ **Telemetry works**:
- `📊 Batch Metrics` appears after each batch
- `logTelemetrySummary()` returns data

✅ **Split-retry works**:
- If batch fails, see `🔄 Retrying X files individually...`
- Some files succeed, some fail individually

## Common Issues & Fixes

### Issue: All files skipped

**Cause**: Files don't match lab report patterns

**Fix**: Check `src/lib/document-filter.ts` lines 11-46 for keywords. Add custom keywords if needed.

### Issue: Batches timing out

**Cause**: Batches still too large for network/processing

**Fix**: Reduce batch size in `src/lib/adaptive-batching.ts`:
```typescript
const DEFAULT_CONFIG = {
  maxFiles: 5,           // ← Change from 10 to 5
  maxPayloadMB: 8,       // ← Change from 12 to 8
  maxEstimatedTokens: 50000  // ← Change from 75000 to 50000
};
```

### Issue: No telemetry data

**Cause**: `logTelemetrySummary()` not imported correctly

**Fix**:
```javascript
// In browser console
import { logTelemetrySummary } from '/src/lib/analytics-queries'
logTelemetrySummary()
```

### Issue: Too many files rejected as oversized

**Cause**: 6 MB limit too strict

**Fix**: Increase limit in `src/lib/document-filter.ts` line 168:
```typescript
const MAX_SINGLE_FILE_BYTES = 8 * 1024 * 1024;  // ← Change to 8 MB
```

## Performance Tuning

### For Slow Networks

Reduce batch sizes to avoid timeouts:

```typescript
// src/lib/adaptive-batching.ts
const DEFAULT_CONFIG = {
  maxFiles: 5,
  maxPayloadMB: 8,
  maxEstimatedTokens: 50000
};
```

### For Fast Networks

Increase batch sizes for maximum throughput:

```typescript
// src/lib/adaptive-batching.ts
const DEFAULT_CONFIG = {
  maxFiles: 15,  // ← Increase (but watch timeouts)
  maxPayloadMB: 14,  // ← Keep under 15 MB API limit
  maxEstimatedTokens: 100000  // ← Increase
};
```

## Testing Checklist

- [ ] Upload single file → Processes successfully
- [ ] Upload 5 files → Creates adaptive batches
- [ ] Upload 25+ files → Multiple batches with delays
- [ ] Upload blank PDF → Skipped with reason
- [ ] Upload 8MB file → Rejected as oversized
- [ ] Check console → See all expected logs
- [ ] Run `logTelemetrySummary()` → See stats
- [ ] Verify biomarkers extracted correctly
- [ ] Verify analysis created successfully

## What to Monitor

### First 10 Uploads

Watch for:
- **Success rate**: Should be >85%
- **Skip rate**: 10-20% is normal (empty/invalid docs)
- **Timeout rate**: <10% (lower batch size if higher)
- **Average duration**: 20-60s per batch

### After 50 Uploads

Run analytics:
```javascript
import { getBatchStats } from '/src/lib/analytics-queries'
const stats = getBatchStats()
console.log(stats)
```

Tune configuration based on:
- If `timeoutCount > 5`: Reduce batch size
- If `rateLimitCount > 0`: Increase delays
- If `successRate < 85%`: Investigate errors

## Deployment

Once testing is complete:

```bash
# Build for production
npm run build

# Deploy (your standard deployment process)
# No Edge Function changes needed

# Monitor first production uploads
# Run telemetry after each batch
```

## Getting Help

**Console not showing logs?**
- Check browser console is set to "Verbose" level
- Refresh page and retry upload

**Unexpected behavior?**
- Copy console output
- Check `ADAPTIVE_BATCHING.md` troubleshooting section
- Review code comments in relevant files

**Performance issues?**
- Run `logTelemetrySummary()` to see metrics
- Check network tab for slow requests
- Verify Edge Function isn't timing out (check Supabase logs)

---

**Ready to go!** Start with a small test upload and work up to larger batches.