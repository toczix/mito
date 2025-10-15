# Supabase Setup Guide for Mito Analysis

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

## Step 2: Run Database Schema

1. Go to your Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase-schema.sql`
3. Paste and run it in the SQL Editor

This will create:
- `practitioners` table (your practitioner account)
- `api_keys` table (encrypted API key storage)
- `custom_benchmarks` table (your custom biomarker ranges)
- `clients` table (patient/client records)
- `analyses` table (biomarker analysis history)

## Step 3: Enable Email Authentication

1. Go to Authentication → Providers
2. Enable Email provider
3. Configure email templates (optional)

## Step 4: Configure Environment Variables

Create a file `.env.local` in the project root with:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace with your actual values from Supabase Dashboard → Settings → API

## Step 5: Test the Connection

1. Run `npm run dev`
2. You should see a login/signup screen
3. Create an account
4. Your practitioner profile will be automatically created

## Database Structure

### Tables Overview

**practitioners**
- Stores practitioner (user) information
- Auto-created when you sign up

**api_keys**
- Stores encrypted Claude API keys
- One per practitioner
- Syncs across all your devices

**custom_benchmarks**
- Your custom biomarker ranges
- Can override defaults
- Synced across devices

**clients**
- Patient/client records
- `status`: 'active' or 'past'
- Stores basic client info

**analyses**
- Biomarker analysis results for each client
- Stores full JSON results
- Linked to specific client
- Timestamped for history

## Security Features

- **Row Level Security (RLS)**: You can only see your own data
- **Encrypted API Keys**: Keys are never exposed
- **Authentication Required**: Must be logged in to access any data
- **Auto-sync**: All changes sync automatically across devices

## Next Steps

After setup, you can:
1. Login/Signup in the app
2. Your API key will be stored securely
3. Custom benchmarks sync across all your devices
4. Create clients and save their analyses
5. View analysis history for each client

