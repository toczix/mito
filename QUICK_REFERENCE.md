# Mito Biomarker Analysis - Quick Reference Guide

## File Location Reference

### Frontend Components
- **Upload**: `/src/components/PdfUploader.tsx` - File upload UI with validation
- **Results**: `/src/components/AnalysisResults.tsx` - Display biomarker analysis
- **Confirmation**: `/src/components/ClientConfirmation.tsx` - User review of data
- **Main Page**: `/src/pages/HomePage.tsx` - State management & orchestration

### Processing Services
- **PDF Processing**: `/src/lib/pdf-processor.ts` - Text extraction & image conversion
- **Claude AI**: `/src/lib/claude-service.ts` - Biomarker extraction via LLM
- **Biomarker Matching**: `/src/lib/analyzer.ts` - Match values with optimal ranges
- **Client Matching**: `/src/lib/client-matcher.ts` - Find/create client records

### Database Operations
- **Analysis Service**: `/src/lib/analysis-service.ts` - Save results to DB
- **Client Service**: `/src/lib/client-service.ts` - Manage client records
- **Supabase Config**: `/src/lib/supabase.ts` - Database types & API key storage

### Backend
- **Edge Function**: `/supabase/functions/analyze-biomarkers/index.ts` - Claude API calls
- **Database Schema**: `/sql/supabase-setup.sql` - Table definitions

---

## Data Flow Steps

### 1. Upload (5-10 seconds)
```
User selects files → PdfUploader validates → Files stored in state
```

### 2. Processing (30-120 seconds depending on file count/size)
```
processPdfFile() → Extract text or convert to images
                ↓
extractBiomarkersFromPdfs() → Batch 10 files per request
                ↓
Edge Function (analyze-biomarkers) → Claude AI extraction
                ↓
consolidatePatientInfo() → Merge data from multiple files
```

### 3. Confirmation (User action)
```
Show patient info + discrepancies → User reviews & confirms
                ↓
Client matching algorithm → Find existing or create new
```

### 4. Analysis Creation (10-30 seconds)
```
matchBiomarkersWithRanges() → Match with optimal ranges
                ↓
createAnalysis() → Save to database
                ↓
Display results to user
```

---

## Key Functions & Where to Find Them

| Function | File | Purpose |
|----------|------|---------|
| `processMultiplePdfs()` | pdf-processor.ts | Extract text from files |
| `extractBiomarkersFromPdfs()` | claude-service.ts | Call Claude AI to extract biomarkers |
| `consolidatePatientInfo()` | claude-service.ts | Merge patient data from multiple files |
| `matchOrCreateClient()` | client-matcher.ts | Find existing client or prepare creation |
| `autoCreateClient()` | client-matcher.ts | Create new client in database |
| `matchBiomarkersWithRanges()` | analyzer.ts | Match values with optimal ranges |
| `createAnalysis()` | analysis-service.ts | Save analysis to database |
| `getClientAnalyses()` | analysis-service.ts | Retrieve client's analyses |

---

## Database Tables

### `clients`
Stores patient/client information
- `id`: Unique identifier
- `full_name`: Patient name
- `date_of_birth`: DOB (nullable)
- `gender`: male/female/other (nullable)
- `status`: active/past
- `user_id`: Owner (if authenticated)

### `analyses`
Stores biomarker analysis results
- `id`: Unique identifier
- `client_id`: Link to client
- `lab_test_date`: Date from lab report (not upload date)
- `results`: JSON array of biomarker values
- `summary`: Summary stats (total, measured, missing)
- `user_id`: Owner (if authenticated)

---

## Common Customizations

### Add a New Biomarker
1. Add to `/src/lib/biomarkers.ts` in benchmark list
2. Include male and female optimal ranges
3. Claude prompt in Edge Function already handles extraction

### Change File Size Limit
- Client-side: `PdfUploader.tsx` line 94 (50MB)
- Server-side: Edge Function line 144 (20MB)

### Modify Batch Size
- `claude-service.ts` line 651: `BATCH_SIZE = 10`
- Smaller = more API calls but faster feedback
- Larger = fewer calls but more risk if batch fails

### Adjust Progress Messages
- `HomePage.tsx` lines 61-104: Update `setProcessingMessage()` calls

### Change Match Confidence Thresholds
- `client-matcher.ts` lines 137-156: Adjust confidence score thresholds

---

## Troubleshooting Common Issues

### "File processing timeout"
- File is too large or complex
- Solution: Increase timeout in Edge Function (line 237, currently 300s)

### "No biomarkers found"
- Document isn't a lab report or text extraction failed
- Claude fallback to Vision API should handle this
- Check if image quality is too low (< 800x600 resolution)

### "Analysis not saving to database"
- Supabase not configured or auth token expired
- Solution: Check `isSupabaseEnabled` flag
- Falls back to client-side analysis only

### "Duplicate analyses created"
- Multiple uploads of same test date for same client
- Solution: `createAnalysis()` checks and updates existing (line 55-59)
- Use `deleteDuplicateAnalyses()` to clean up if needed

### "Client matching not finding existing client"
- Name similarity too low (< 0.5 normalized Levenshtein distance)
- Solution: Increase match threshold or use manual selection
- Check `findBestMatch()` scoring algorithm

---

## Testing Endpoints

### Test Edge Function (curl)
```bash
curl -X POST https://your-project.supabase.co/functions/v1/analyze-biomarkers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"processedPdf": {...}}'
```

### Test Supabase Connection
```typescript
// In browser console
import { supabase } from '@/lib/supabase'
supabase.from('clients').select('count').then(r => console.log(r))
```

---

## Performance Optimization Tips

1. **Batch Processing**: Already groups 10 files per request
2. **Image Fallback**: Only triggered if text extraction < 50 chars/page
3. **Cached Sessions**: User lookups don't make network requests
4. **Server-side Search**: Client search uses ilike for fast filtering
5. **Deduplication**: Prevents duplicate biomarkers and analyses

---

## Security Considerations

1. **Claude API Key**: Stored on server-side in Supabase secrets, never sent to client
2. **Authentication**: Optional (disable with `VITE_AUTH_DISABLED=true`)
3. **RLS Policies**: Implement Row-Level Security if storing per-user data
4. **File Validation**: Client validates type, size, content before upload
5. **Edge Function Auth**: Can require authentication (set `REQUIRE_AUTH=true`)

---

## Configuration Checklist

- [ ] Supabase URL in `.env.local` (`VITE_SUPABASE_URL`)
- [ ] Supabase anon key in `.env.local` (`VITE_SUPABASE_ANON_KEY`)
- [ ] Claude API key in Supabase secrets (`CLAUDE_API_KEY`)
- [ ] Edge Function deployed (`supabase functions deploy`)
- [ ] Database tables created (`supabase/migrations/...`)
- [ ] RLS policies configured (if using auth)
- [ ] Environment variable `VITE_AUTH_DISABLED` if not using auth

---

## Key Files to Review for Understanding

1. **Data Flow**: Read `HomePage.tsx` (main orchestration)
2. **Claude Integration**: Check `claude-service.ts` (API calls & retry logic)
3. **Database Schema**: Look at `supabase-setup.sql` (table structure)
4. **Business Logic**: Review `analyzer.ts` (biomarker matching algorithm)

---

## Common Error Messages & Causes

| Error | Cause | Solution |
|-------|-------|----------|
| "Supabase not configured" | Missing env vars | Set `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` |
| "Claude API key not configured" | Edge Function secret not set | Add `CLAUDE_API_KEY` to Supabase secrets |
| "Not authenticated" | Auth token expired | Re-login or disable auth |
| "File too large" | Exceeds 20MB | Split into smaller files |
| "Request timeout" | Processing took > 300s | Reduce file size or increase timeout |
| "Invalid JSON from Claude" | Response parsing failed | Check console for raw response |
| "Database insert failed" | RLS policy preventing write | Check row-level security policies |

---

## Version Information

- **Claude Model**: claude-haiku-4-5-20251001 (fast & affordable)
- **Supabase SDK**: Latest (@supabase/supabase-js)
- **React**: 18+
- **TypeScript**: 5+
- **Vite**: Latest

---

## Support & Debugging

### Enable Debug Logging
All major functions log to browser console with emojis:
- 📄: Document processing
- 🚀: API calls
- ✅: Success
- ❌: Errors
- ⏳: Loading/waiting
- 📊: Data processing

Open browser DevTools (F12) and filter by these emojis

### Check Raw Claude Response
```typescript
// In HomePage.tsx after analysis completes
console.log(extractedAnalyses)  // See all Claude responses
sessionStorage.getItem('lastClaudeError')  // See any parse errors
```

### Validate Biomarker Extraction
Look at `console.table()` outputs showing:
- Extracted biomarker names
- Matched ranges
- Missing biomarkers

