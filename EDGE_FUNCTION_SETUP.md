# Supabase Edge Function Setup

## Overview

The Claude API key is now **completely secure** and stored server-side only. The frontend calls a Supabase Edge Function which handles Claude API requests, ensuring the API key is never exposed to the browser.

### Security Benefits

✅ **API key never sent to browser** - stays on server
✅ **No `dangerouslyAllowBrowser`** - proper server-side usage
✅ **Auth-protected** - only logged-in users can call
✅ **Rate limiting** - Supabase provides built-in protection
✅ **Audit trail** - All requests logged server-side

---

## Setup Instructions

### 1. Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Windows (PowerShell)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
brew install supabase/tap/supabase
```

Verify installation:
```bash
supabase --version
```

### 2. Link Your Supabase Project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

Get your project ref from: Supabase Dashboard → Settings → General → Reference ID

### 3. Set the Claude API Key Secret

The API key is stored as a Supabase secret (not an environment variable):

```bash
# Set the secret (will prompt for value)
supabase secrets set CLAUDE_API_KEY

# Or set it directly
supabase secrets set CLAUDE_API_KEY=sk-ant-api03-your-key-here
```

**Important:** Use `CLAUDE_API_KEY` (NOT `VITE_CLAUDE_API_KEY`)

Verify it was set:
```bash
supabase secrets list
```

### 4. Deploy the Edge Function

From your project root:

```bash
# Deploy the function
supabase functions deploy analyze-biomarkers

# Check deployment status
supabase functions list
```

You should see:
```
analyze-biomarkers    deployed    2024-xx-xx
```

### 5. Test the Edge Function

```bash
# Get your project URL
supabase status

# Test the function (replace with your project URL)
curl -X POST \
  'https://your-project-ref.supabase.co/functions/v1/analyze-biomarkers' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"processedPdf": {"fileName": "test.pdf", "extractedText": "Test data", "pageCount": 1}}'
```

### 6. Update Frontend Environment Variables

Remove the old `VITE_CLAUDE_API_KEY` from your `.env`:

```env
# OLD - REMOVE THIS
# VITE_CLAUDE_API_KEY=sk-ant-...

# KEEP THESE
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The Claude API key is now **only** in Supabase secrets, never in your `.env` or frontend code.

### 7. Deploy Your Frontend

```bash
npm run build
git add .
git commit -m "Move Claude API to secure Edge Function"
git push
```

---

## Updating the API Key

To rotate or update the Claude API key:

```bash
# Update the secret
supabase secrets set CLAUDE_API_KEY=sk-ant-new-key-here

# Redeploy the function (picks up new secret)
supabase functions deploy analyze-biomarkers
```

No code changes or frontend redeployment needed!

---

## Monitoring & Debugging

### View Edge Function Logs

```bash
# Real-time logs
supabase functions logs analyze-biomarkers --tail

# Recent logs
supabase functions logs analyze-biomarkers
```

### Check Secrets

```bash
# List all secrets (values are hidden)
supabase secrets list

# Unset a secret
supabase secrets unset CLAUDE_API_KEY
```

### Test Locally

```bash
# Start Supabase locally
supabase start

# Serve the function locally
supabase functions serve analyze-biomarkers

# Test it
curl -X POST \
  'http://localhost:54321/functions/v1/analyze-biomarkers' \
  -H 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"processedPdf": ...}'
```

---

## Troubleshooting

### "Claude API key not configured" Error

**Problem:** Edge Function returns error about missing API key.

**Solution:**
```bash
# Check if secret exists
supabase secrets list

# If missing, set it
supabase secrets set CLAUDE_API_KEY=sk-ant-your-key

# Redeploy
supabase functions deploy analyze-biomarkers
```

### "Unauthorized" Error

**Problem:** Users get 401 Unauthorized when analyzing PDFs.

**Solution:**
- User must be logged in with magic link
- Check that Supabase auth is enabled
- Verify `VITE_SUPABASE_ANON_KEY` is correct in frontend `.env`

### Function Not Found

**Problem:** Frontend gets 404 when calling Edge Function.

**Solution:**
```bash
# Check if function is deployed
supabase functions list

# If not deployed
supabase functions deploy analyze-biomarkers

# Verify the URL is correct (should be /functions/v1/analyze-biomarkers)
```

### Slow Response Times

**Problem:** Edge Function is slow.

**Solution:**
- Edge Functions cold-start can take 1-2 seconds
- After first call, subsequent calls are fast
- Consider upgrading Supabase plan for better performance

---

## Cost Considerations

### Supabase Edge Functions

- **Free Tier:** 500,000 function invocations/month
- **Pro Plan:** Unlimited invocations
- Typical usage: ~10-50 invocations per practitioner per day

### Claude API

- Charged by Anthropic based on tokens processed
- Edge Function doesn't add extra cost
- ~$0.01-0.02 per 8-PDF analysis (same as before)

---

## Security Comparison

### Before (Client-Side)

```javascript
// ❌ API key in browser bundle
const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
const client = new Anthropic({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true, // ⚠️ Security risk
});
```

- Key visible in DevTools Network tab
- Key embedded in JavaScript bundle
- Anyone with browser access can extract key

### After (Edge Function)

```javascript
// ✅ API key on server only
const { data } = await supabase.functions.invoke('analyze-biomarkers', {
  body: { processedPdf },
});
```

- Key never sent to browser
- Key stored in Supabase secrets
- Only authenticated users can call function
- Server-side execution

---

## File Structure

```
mito/
├── supabase/
│   ├── config.toml                    # Supabase config
│   └── functions/
│       └── analyze-biomarkers/
│           └── index.ts               # Edge Function code
├── src/
│   └── lib/
│       └── claude-service.ts          # Calls Edge Function
└── .env                               # No VITE_CLAUDE_API_KEY needed!
```

---

## Next Steps

1. ✅ Deploy Edge Function: `supabase functions deploy analyze-biomarkers`
2. ✅ Set secret: `supabase secrets set CLAUDE_API_KEY`
3. ✅ Remove `VITE_CLAUDE_API_KEY` from `.env`
4. ✅ Test with a real PDF upload
5. ✅ Monitor logs: `supabase functions logs analyze-biomarkers --tail`

---

**You're all set!** The Claude API key is now completely secure and hidden from practitioners.
