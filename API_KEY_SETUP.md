# Claude API Key Setup (Secure - Edge Function)

⚠️ **IMPORTANT:** The API key is now stored **server-side only** using Supabase Edge Functions. It is **NEVER exposed** to the browser or practitioners.

---

## Quick Start

1. Install Supabase CLI
2. Set API key as Supabase secret
3. Deploy Edge Function
4. Done! API key is secure.

**Detailed instructions:** See [EDGE_FUNCTION_SETUP.md](EDGE_FUNCTION_SETUP.md)

---

## TL;DR Commands

```bash
# Install CLI
brew install supabase/tap/supabase

# Login and link
supabase login
supabase link --project-ref your-project-ref

# Set secret (server-side only - NEVER in .env!)
supabase secrets set CLAUDE_API_KEY=sk-ant-your-key

# Deploy Edge Function
supabase functions deploy analyze-biomarkers

# ✅ Done! API key is secure
```

---

## What You DON'T Need Anymore

❌ **Remove from `.env`:** `VITE_CLAUDE_API_KEY`
❌ **Remove from Vercel:** `VITE_CLAUDE_API_KEY` environment variable
❌ **Don't add to frontend:** API key never touches browser

---

## What You DO Need

✅ In Supabase secrets: `CLAUDE_API_KEY`
✅ In `.env` (frontend): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
✅ Edge Function deployed: `analyze-biomarkers`

---

## Security Comparison

### OLD WAY (INSECURE - DO NOT USE)
```env
# .env file
VITE_CLAUDE_API_KEY=sk-ant-... ❌ Exposed to browser!
```

```javascript
// Frontend code
const client = new Anthropic({
  apiKey: import.meta.env.VITE_CLAUDE_API_KEY, // ❌ Visible in DevTools
  dangerouslyAllowBrowser: true, // ❌ Red flag!
});
```

**Problem:** Anyone can open DevTools → Network tab → copy API key

### NEW WAY (SECURE - CURRENT)
```bash
# Supabase secret (server-side only)
supabase secrets set CLAUDE_API_KEY=sk-ant-... ✅ Never sent to browser
```

```javascript
// Frontend code
const { data } = await supabase.functions.invoke('analyze-biomarkers', {
  body: { processedPdf }, // ✅ No API key in browser
});
```

**Benefit:** API key stays on server, practitioners can't access it

---

## Rotating the API Key

```bash
# Update the secret
supabase secrets set CLAUDE_API_KEY=sk-ant-new-key

# Redeploy function
supabase functions deploy analyze-biomarkers

# ✅ Done! No frontend changes needed
```

---

## Troubleshooting

**"Claude API key not configured"**
```bash
supabase secrets list  # Check if secret exists
supabase secrets set CLAUDE_API_KEY=sk-ant-...
supabase functions deploy analyze-biomarkers
```

**"Function not found"**
```bash
supabase functions list  # Check deployment
supabase functions deploy analyze-biomarkers
```

**See full troubleshooting:** [EDGE_FUNCTION_SETUP.md](EDGE_FUNCTION_SETUP.md#troubleshooting)

---

## Cost

- Supabase Edge Functions: 500K invocations/month (free tier)
- Claude API: ~$0.01-0.02 per 8-PDF analysis (unchanged)

---

**For complete setup instructions, see:** [EDGE_FUNCTION_SETUP.md](EDGE_FUNCTION_SETUP.md)
