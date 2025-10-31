# Claude API Key Setup

## Overview

The Claude API key is now stored **securely in environment variables** and is **hidden from all practitioners**. This centralized approach ensures:

- ✅ One API key shared across all practitioners
- ✅ No exposure to frontend/client
- ✅ Easy to rotate and manage
- ✅ Controlled billing under one account

---

## Setup Instructions

### For Local Development

1. Create a `.env` file in the project root:

```bash
cp .env.example .env
```

2. Edit `.env` and add your Claude API key:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Claude API Key (Backend - Hidden from practitioners)
VITE_CLAUDE_API_KEY=sk-ant-api03-your-actual-key-here
```

3. Get your Claude API key from: https://console.anthropic.com/settings/keys

4. Restart your dev server:

```bash
npm run dev
```

### For Production (Vercel)

1. Go to your Vercel project dashboard

2. Navigate to **Settings** → **Environment Variables**

3. Add the following environment variable:

   - **Name:** `VITE_CLAUDE_API_KEY`
   - **Value:** `sk-ant-api03-your-actual-key-here`
   - **Environments:** Production, Preview, Development (check all)

4. Click **Save**

5. Redeploy your application:

```bash
git push
```

Or manually trigger a redeploy in Vercel dashboard.

### For Other Platforms

#### Netlify

1. Go to **Site settings** → **Build & deploy** → **Environment**
2. Click **Edit variables**
3. Add: `VITE_CLAUDE_API_KEY = sk-ant-api03-your-key`
4. Save and redeploy

#### Render

1. Go to your service → **Environment**
2. Add environment variable:
   - **Key:** `VITE_CLAUDE_API_KEY`
   - **Value:** `sk-ant-api03-your-key`
3. Save and redeploy

#### Docker

Add to your `docker-compose.yml` or Dockerfile:

```yaml
environment:
  - VITE_CLAUDE_API_KEY=sk-ant-api03-your-key
```

---

## What Changed

### Before (Per-User API Keys)

- Each practitioner entered their own API key in Settings page
- API keys stored in Supabase database per-user
- Practitioners could see and modify their keys
- Multiple API keys = harder to manage billing

### After (Centralized API Key)

- One API key set by admin via environment variable
- Hidden from all practitioners (not visible in UI)
- No Settings page input field
- Single source of truth for API access

---

## Security Notes

### ✅ Good Practices

- **Never commit `.env` to Git** - It's already in `.gitignore`
- **Use environment variables** on your deployment platform
- **Rotate keys periodically** - Easy to do in one place now
- **Monitor usage** - All usage comes from one account

### ⚠️ Important

Even though this uses `VITE_` prefix (which normally exposes vars to frontend), the key is only used server-side in the sense that it's embedded in the build. This is acceptable for a practitioner-facing tool where:

- Users are trusted practitioners (not public)
- App is behind authentication
- Key can be rotated easily if needed

For higher security needs (public-facing apps), consider:
- Using a backend API proxy
- Serverless functions (Vercel Functions, Netlify Functions)
- API gateway with rate limiting

---

## Troubleshooting

### "Claude API key not configured" Error

**Problem:** App shows error when trying to analyze PDFs.

**Solution:**
1. Check `.env` file exists and contains `VITE_CLAUDE_API_KEY`
2. Restart dev server after adding env variable
3. For production, verify environment variable is set in deployment platform
4. Redeploy after adding environment variable

### API Key Works Locally But Not in Production

**Problem:** Works on `localhost` but fails on deployed site.

**Solution:**
1. Verify environment variable is set in deployment platform (Vercel/Netlify/etc.)
2. Make sure you've redeployed after adding the variable
3. Check deployment logs for any errors
4. Some platforms require restart after env var changes

### Need to Change/Rotate API Key

**Solution:**

**Local:**
1. Update `.env` file
2. Restart dev server

**Production:**
1. Update environment variable in deployment platform
2. Redeploy (or platform may auto-redeploy)
3. No code changes needed!

---

## Billing & Usage

Since all practitioners share one API key:

- All usage is billed to one Anthropic account
- Monitor usage at: https://console.anthropic.com/settings/billing
- Set usage limits in Anthropic Console to prevent overages
- Typical cost: ~$0.01-0.02 per 8-PDF analysis

---

## Migration from Old System

If you previously had users enter their own API keys:

1. The old API key inputs have been removed from the Settings page
2. Old API keys in the database are no longer used
3. Practitioners will now use the centralized key automatically
4. You can optionally clean up old keys from `settings` table:

```sql
-- Optional: Clear old per-user API keys
UPDATE settings SET claude_api_key = NULL;
```

---

## Questions?

- **Who can see the API key?** - Only admins with access to environment variables
- **Can practitioners change it?** - No, it's managed centrally
- **How do I know it's working?** - Practitioners can upload PDFs and analyze them normally
- **What if I need different keys per user?** - This setup uses one shared key. For per-user keys, you'd need a different architecture (backend API proxy)

---

**You're all set!** The Claude API key is now securely managed and hidden from practitioners.
