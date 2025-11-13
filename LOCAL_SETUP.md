# Local Development Setup

**Status**: ✅ Supabase running locally with Docker

## Quick Start

1. **Set Claude API Key** (one-time setup):
   ```bash
   npx supabase secrets set CLAUDE_API_KEY='sk-ant-your-key-here'
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```

3. **Access Local Services**:
   - App: http://localhost:5173
   - Supabase Studio: http://127.0.0.1:54323
   - API: http://127.0.0.1:54321

## Environment Configuration

Your `.env.local` is configured for **local Supabase** (Docker).

To switch back to production, comment out the local config and uncomment production:
```bash
# LOCAL (currently active)
# VITE_SUPABASE_URL=http://127.0.0.1:54321
# VITE_SUPABASE_ANON_KEY=eyJhbG...

# PRODUCTION (uncomment to use)
VITE_SUPABASE_URL=https://dfgadsjqofgkrclpwgkf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

## Supabase Commands

```bash
# Check status
npx supabase status

# Stop Supabase
npx supabase stop

# Start Supabase
npx supabase start

# Reset database (wipes all data)
npx supabase db reset

# View logs
npx supabase functions logs analyze-biomarkers

# Deploy Edge Functions (to production)
npx supabase functions deploy analyze-biomarkers
```

## Testing Adaptive Batching

1. Start dev server: `npm run dev`
2. Upload lab reports (mix of text PDFs, scanned PDFs, and blank files)
3. Open browser console (F12)
4. Look for these logs:

```
🚀 Starting Adaptive Batch Processing
📋 Filtered 8 documents: 7 processable, 1 skipped
⏭️ Skipping "blank.pdf": Empty document
📦 Created 2 adaptive batch(es) from 7 file(s)
   Batch 1: 5 files, 9.2 MB, ~42,300 tokens [mixed]
   Batch 2: 2 files, 3.1 MB, ~18,500 tokens [text-heavy]
📊 Batch Metrics [batch_1731428432_x7k2p9]
├─ Files: 5
├─ Payload: 9.20 MB
├─ Duration: 35.2s
└─ Status: ✅ Success
```

5. Check telemetry:
```javascript
import { logTelemetrySummary } from '/src/lib/analytics-queries'
logTelemetrySummary()
```

## Database Schema

All migrations applied successfully:
- ✅ Base tables (clients, analyses, custom_benchmarks, settings)
- ✅ Auth migration (user_id columns, RLS policies)
- ✅ Audit logging system
- ✅ Trigger fixes for new user signups

View in Supabase Studio: http://127.0.0.1:54323

## Troubleshooting

### "Claude API key not configured"
Run: `npx supabase secrets set CLAUDE_API_KEY='sk-ant-...'`

### Port conflicts
Stop other services on ports 54321-54324 or change ports in `supabase/config.toml`

### Migrations fail
Reset database: `npx supabase db reset`

### Edge Function not found
The analyze-biomarkers function is at `supabase/functions/analyze-biomarkers/index.ts`

## Next Steps

1. Set Claude API key (see Quick Start above)
2. Test with sample lab reports
3. Monitor adaptive batching logs
4. Check telemetry with `logTelemetrySummary()`

---

**Files Modified**:
- [.env.local](.env.local) - Now points to local Supabase
- [supabase/migrations/20251031155600_create_base_tables.sql](supabase/migrations/20251031155600_create_base_tables.sql) - Base schema
- [supabase/migrations/20251031155612_auth_migration.sql](supabase/migrations/20251031155612_auth_migration.sql) - Auth setup
- [supabase/migrations/20251104000002_enable_auth_safely.sql](supabase/migrations/20251104000002_enable_auth_safely.sql) - Safe auth enablement
- [supabase/migrations/20251110000001_fix_rls_for_triggers.sql](supabase/migrations/20251110000001_fix_rls_for_triggers.sql) - RLS trigger fixes
