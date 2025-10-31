# Authentication Setup Guide

## Overview

This guide walks you through setting up magic link authentication for your Mito Analysis application. After setup:
- Practitioners will sign in with their email (no password needed)
- Each practitioner will only see their own clients
- Sessions persist with cookies (stay logged in)
- Chris Voutsas will own all existing client data

---

## Step 1: Run Database Migration

The migration adds user authentication and row-level security to your Supabase database.

### Using Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `supabase-auth-migration.sql`
6. Paste into the SQL editor
7. Click **Run** (or press Cmd/Ctrl + Enter)

You should see: `Success. No rows returned`

### What this migration does:
- ✅ Adds `user_id` column to all tables (clients, analyses, custom_benchmarks, settings)
- ✅ Enables Row Level Security (RLS) so users only see their own data
- ✅ Creates policies to enforce data isolation
- ✅ Sets up automatic settings creation for new users

---

## Step 2: Enable Email Authentication in Supabase

1. Go to **Authentication** → **Providers** in Supabase Dashboard
2. Find **Email** provider
3. Make sure **Enable Email provider** is turned ON
4. Under **Email Auth Settings**:
   - ✅ Enable **Confirm email** (optional, but recommended)
   - ✅ Enable **Secure email change** (recommended)
5. Click **Save**

### Configure Email Templates (Optional but Recommended)

1. Go to **Authentication** → **Email Templates**
2. Select **Magic Link** template
3. Customize the email content if desired
4. Make sure the magic link URL points to your app domain

---

## Step 3: Deploy Your Updated App

The code changes are already in place. Just deploy:

```bash
# Build the app
npm run build

# Deploy to Vercel (if using Vercel)
vercel --prod

# Or push to your Git repo if auto-deploy is enabled
git add .
git commit -m "Add magic link authentication"
git push
```

---

## Step 4: Have Chris Voutsas Sign Up

1. Share your app URL with Chris Voutsas
2. He should enter his email address on the login page
3. He'll receive a magic link email
4. Clicking the link logs him in

**Important:** Have Chris sign up BEFORE running the client assignment script in Step 5!

---

## Step 5: Assign Existing Clients to Chris

Now that Chris has an account, assign all existing client data to him.

### Option A: Using the Node.js Script (Easier)

1. Get your **Supabase Service Role Key**:
   - Go to Supabase Dashboard → **Settings** → **API**
   - Copy the `service_role` key (NOT the `anon` key)
   - ⚠️ Keep this secret! Never commit it to Git

2. Set environment variables and run the script:

```bash
# Set credentials (replace with your actual values)
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key-here"

# Run the script with Chris's email
node scripts/assign-clients.js chris@example.com
```

The script will:
- Find Chris's user account
- Show how many unassigned clients exist
- Ask for confirmation
- Assign all clients, analyses, and benchmarks to Chris

### Option B: Using SQL (Manual)

1. Go to Supabase Dashboard → **SQL Editor**
2. Open `assign-clients-to-practitioner.sql`
3. Follow the instructions in that file:
   - Run Step 1 to find Chris's user ID
   - Replace `<CHRIS_USER_ID>` in the UPDATE statements
   - Uncomment and run the UPDATE statements
   - Run verification queries

---

## Step 6: Test the Authentication

### Test 1: Chris can log in and see his clients

1. Visit your app URL
2. Log out if already logged in
3. Enter Chris's email
4. Check email for magic link
5. Click the link → should be logged in
6. Navigate to **Clients** page
7. Verify all existing clients are visible

### Test 2: New practitioner has isolated data

1. Open app in incognito/private window
2. Enter a different email address (your test email)
3. Click magic link from email
4. You should be logged in
5. Navigate to **Clients** page
6. Should see **NO clients** (empty state)
7. Create a test client
8. Log out and log back in as Chris → Chris should NOT see your test client

### Test 3: Sessions persist

1. Log in as Chris
2. Close browser completely
3. Open browser again and visit the app
4. Should still be logged in (no login page)

---

## Troubleshooting

### "Supabase is not configured" error

**Problem:** The app shows an error about Supabase not being configured.

**Solution:**
- Make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in your environment
- Check `.env` file or Vercel environment variables
- Redeploy after updating environment variables

---

### Magic link emails not arriving

**Problem:** User doesn't receive the magic link email.

**Solutions:**
1. Check spam/junk folder
2. Verify email provider is configured in Supabase:
   - Go to **Project Settings** → **Auth** → **SMTP Settings**
   - By default, Supabase uses their email service (limited)
   - For production, configure your own SMTP (SendGrid, Mailgun, etc.)
3. Check Supabase logs:
   - Go to **Logs** → **Auth Logs**
   - Look for failed email delivery

---

### "No rows returned" error after login

**Problem:** User logs in successfully but can't see any data, even their own clients.

**Solutions:**
1. Check if RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public';
   ```
   Should show `rowsecurity = true` for clients, analyses, etc.

2. Check if user_id was set when creating data:
   ```sql
   SELECT id, full_name, user_id
   FROM clients
   LIMIT 10;
   ```
   Should show user_id values (not NULL)

3. Verify RLS policies exist:
   ```sql
   SELECT schemaname, tablename, policyname
   FROM pg_policies
   WHERE schemaname = 'public';
   ```

---

### User can see other practitioners' clients

**Problem:** Data isolation is not working.

**Solutions:**
1. Make sure you ran the migration completely
2. Check RLS is enabled (see above)
3. Verify policies are correct:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'clients';
   ```
4. Re-run the migration if needed

---

## Adding More Practitioners

After Chris is set up, adding more practitioners is easy:

1. Share the app URL with the new practitioner
2. They enter their email and click the magic link
3. They're automatically set up with a new account
4. They start with zero clients (empty slate)
5. They can create their own clients independently

---

## Rolling Back (Emergency)

If something goes wrong and you need to disable authentication:

### Option 1: Disable RLS temporarily

```sql
-- Disable RLS on all tables (allows access without auth)
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE analyses DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_benchmarks DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
```

⚠️ This makes ALL data visible to everyone! Only use temporarily for debugging.

### Option 2: Revert code changes

```bash
# Revert to before auth was added
git log --oneline  # Find the commit before auth
git checkout <commit-hash>
git push --force  # Only if you're sure!
```

---

## Security Best Practices

1. **Never commit secrets to Git**
   - Add `.env` to `.gitignore`
   - Use environment variables in Vercel/deployment platform

2. **Use HTTPS**
   - Magic links only work over HTTPS
   - Vercel provides this automatically

3. **Email verification**
   - Enable "Confirm email" in Supabase Auth settings
   - Prevents typos and spam signups

4. **Rate limiting**
   - Supabase has built-in rate limiting for auth endpoints
   - Adjust in **Authentication** → **Rate Limits** if needed

---

## Next Steps

After authentication is working:

- [ ] Set up custom email domain (optional)
- [ ] Add user profile pages (name, photo, etc.)
- [ ] Implement password reset flow (if you add passwords later)
- [ ] Add admin dashboard to manage practitioners
- [ ] Set up team workspaces (if multiple practitioners need to share clients)

---

## Support

If you run into issues:

1. Check Supabase logs: Dashboard → **Logs** → **Auth Logs**
2. Check browser console for JavaScript errors
3. Review this guide's troubleshooting section
4. Check Supabase documentation: https://supabase.com/docs/guides/auth

---

**You're all set!** Magic link authentication should now be working with persistent sessions and proper data isolation between practitioners.
