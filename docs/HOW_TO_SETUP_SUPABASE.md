# How to Set Up Supabase (5 Minutes)

## Step 1: Create Supabase Project
1. Go to **[supabase.com](https://supabase.com)** and sign in
2. Click **"New Project"**
3. Fill in:
   - Name: `mito-analysis`
   - Database Password: (create a strong password - save it somewhere)
   - Region: Choose closest to you
4. Click **"Create new project"**
5. **Wait 1-2 minutes** for it to initialize

---

## Step 2: Run the SQL Setup (ONE TIME)

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. In your project, open the file: **`supabase-setup.sql`**
4. **Copy ALL the SQL** (Cmd+A, then Cmd+C)
5. **Paste** into the Supabase SQL Editor
6. Click **"Run"** (or press Cmd+Enter)
7. You should see: **"Success. No rows returned"**

---

## Step 2.5: Seed Default Biomarkers (ONE TIME)

1. In **SQL Editor**, click **"New Query"** again
2. In your project, open the file: **`supabase-seed-benchmarks.sql`**
3. **Copy ALL the SQL** (Cmd+A, then Cmd+C)
4. **Paste** into the Supabase SQL Editor
5. Click **"Run"** (or press Cmd+Enter)
6. You should see: **"Success. No rows returned"** or a count of inserted rows

This populates your database with 96 default biomarker standards! 🎉

---

## Step 3: Get Your Credentials

1. Go to **Settings** → **API** (left sidebar)
2. Find these two values:

   - **Project URL**: Copy the URL (e.g., `https://abc123xyz.supabase.co`)
   - **anon public key**: Copy the key (long string starting with `eyJ...`)

---

## Step 4: Update Your .env.local

1. Open **`.env.local`** in your project
2. Replace the placeholder values with your real credentials:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...YOUR_KEY_HERE
```

3. **Save the file**

---

## Step 5: Restart Your App

In your terminal:
```bash
# Stop the server (Ctrl+C if running)
npm run dev
```

---

## ✅ Verify It Works

1. Open the app in your browser
2. Go to **Clients** tab
3. You should see **"Add Client"** button (not "Supabase is not configured")
4. Go to **Settings** tab
5. You should see "Storage: Supabase (synced across devices)"

---

## 🎉 Done!

You can now:
- ✅ Create client records
- ✅ Save analyses to clients
- ✅ Track patient history
- ✅ API key syncs across devices

---

## 🔍 Verify Database Tables

Optional: Check that tables were created

1. Go to **Table Editor** in Supabase (left sidebar)
2. You should see **4 tables**:
   - `settings` ✓ (1 row)
   - `custom_benchmarks` ✓ (96 rows with all default biomarkers)
   - `clients` ✓ (0 rows - you'll add these)
   - `analyses` ✓ (0 rows - you'll add these)

If you don't see them, run the SQL scripts again (they're safe to run multiple times).

---

## 🆘 Troubleshooting

**Still seeing "Supabase is not configured"?**
- Check `.env.local` has correct values (no quotes needed)
- Make sure you restarted the dev server
- Check browser console for errors

**SQL errors?**
- Make sure you copied the ENTIRE `supabase-setup.sql` file
- Try running it again (safe to run multiple times)

**Tables not showing?**
- Wait a minute and refresh
- Check SQL Editor for error messages

