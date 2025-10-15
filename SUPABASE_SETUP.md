# Supabase Setup Guide for Mito Analysis (Passwordless Internal Tool)

## Overview
This is a simplified, passwordless setup for internal use. No authentication required - just data storage and sync.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in and create a new project
3. Wait for the project to finish setting up (1-2 minutes)

## Step 2: Get Your Credentials

1. Go to your Project Settings → API
2. Copy your:
   - **Project URL** (e.g., `https://xxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## Step 3: Configure Environment Variables

Already done! Your `.env.local` file contains:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 4: Run Database Schema

1. Go to Supabase Dashboard → **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of **`supabase-schema-simple.sql`**
4. Paste and click "Run"

This creates:
- ✅ `settings` table (stores Claude API key)
- ✅ `custom_benchmarks` table (your custom biomarker ranges)
- ✅ `clients` table (patient records with active/past status)
- ✅ `analyses` table (biomarker analysis history)

## Step 5: Restart Your App

```bash
npm run dev
```

## Features Enabled

### 🔑 API Key Sync
- Claude API key stored in Supabase
- Syncs across all your devices
- No need to re-enter

### 📊 Custom Benchmarks Sync
- Custom biomarker ranges stored in database
- Access from any device
- Backup protection

### 👥 Client Library
- Create and manage client records
- **Active Clients** - current patients
- **Past Clients** - archived patients
- Full contact info and notes

### 📈 Analysis History
- Save every biomarker analysis
- View historical results per client
- Track changes over time
- Add notes to each analysis

## Database Tables

### `settings`
Single row storing global settings (API key)

### `custom_benchmarks`
Your custom biomarker optimal ranges

### `clients`
Patient/client records with:
- Full name, email, DOB
- Gender (for range selection)
- Status: 'active' or 'past'
- Tags and notes

### `analyses`
Biomarker analysis results:
- Linked to specific client
- Full JSON results
- Automatic summary stats
- Timestamped

## Security Notes

- No authentication = no password management
- All data accessible with your anon key
- For internal/beta use only
- Can add authentication later if needed

## Troubleshooting

**Can't connect to Supabase?**
- Check `.env.local` has correct URL and key
- Restart dev server after adding `.env.local`
- Check Supabase project is active

**Tables not created?**
- Make sure you ran the entire `supabase-schema-simple.sql` file
- Check SQL Editor for error messages
- Verify all tables exist in Table Editor

## Optional: Authentication (Future)

If you want to add authentication later, we can:
1. Enable Supabase Auth
2. Add login/signup UI
3. Enable Row Level Security (RLS)
4. Multi-practitioner support

For now, enjoy the simple passwordless internal tool! 🚀
