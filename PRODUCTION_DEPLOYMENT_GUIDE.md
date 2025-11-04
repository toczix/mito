# Production Deployment Guide: Enabling Authentication

This guide walks through the complete process of safely enabling authentication in production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Migration Steps](#migration-steps)
4. [Data Assignment](#data-assignment)
5. [Enabling RLS](#enabling-rls)
6. [Application Configuration](#application-configuration)
7. [Verification](#verification)
8. [Rollback Procedure](#rollback-procedure)
9. [Post-Deployment Monitoring](#post-deployment-monitoring)

## Prerequisites

### Required Access
- [ ] Supabase project admin access
- [ ] Database connection string
- [ ] Supabase service role key
- [ ] Production environment access

### Required Tools
- [ ] Supabase CLI installed (`brew install supabase/tap/supabase`)
- [ ] Node.js and npm installed
- [ ] tsx installed (`npm install -g tsx`)
- [ ] Database migration tool access

### Environment Variables
Create a `.env.local` file with:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_AUTH_DISABLED=true  # Will change to false after deployment
```

## Pre-Deployment Checklist

### 1. Backup Database
```bash
# Create a full database backup
supabase db dump -f backup-$(date +%Y%m%d).sql

# Or use Supabase dashboard:
# Settings > Database > Database Backups > Download
```

### 2. Verify Current State
```sql
-- Check for existing data
SELECT
  (SELECT COUNT(*) FROM clients) as clients_count,
  (SELECT COUNT(*) FROM analyses) as analyses_count,
  (SELECT COUNT(*) FROM custom_benchmarks) as benchmarks_count;

-- Check for NULL user_ids
SELECT
  (SELECT COUNT(*) FROM clients WHERE user_id IS NULL) as null_clients,
  (SELECT COUNT(*) FROM analyses WHERE user_id IS NULL) as null_analyses,
  (SELECT COUNT(*) FROM custom_benchmarks WHERE user_id IS NULL) as null_benchmarks;
```

### 3. Ensure Practitioner Account Exists
Practitioner must sign up before data assignment:
1. Temporarily deploy with auth enabled (VITE_AUTH_DISABLED=false)
2. Have practitioner visit the app and sign up with their email
3. Verify account in Supabase: Authentication > Users
4. Note their email address for data assignment

## Migration Steps

### Step 1: Apply Settings Table Fix
```bash
# Push migration to fix settings table schema
supabase db push

# Or manually run:
psql $DATABASE_URL -f supabase/migrations/20251104000001_fix_settings_schema.sql
```

**Verify:**
```sql
-- Check settings table structure
\d settings

-- Should show user_id as PRIMARY KEY
-- Should NOT have hardcoded UUID
```

### Step 2: Apply Safe Authentication Migration
```bash
# Apply the comprehensive auth migration
supabase db push

# Or manually run:
psql $DATABASE_URL -f supabase/migrations/20251104000002_enable_auth_safely.sql
```

**Verify:**
```sql
-- Check that helper functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN (
  'safely_enable_rls',
  'assign_data_to_practitioner',
  'verify_auth_migration'
);

-- Should return all 3 functions
```

### Step 3: Apply Audit Logging Migration
```bash
# Apply audit logging migration
supabase db push

# Or manually run:
psql $DATABASE_URL -f supabase/migrations/20251104000004_create_audit_logs.sql
```

**Verify:**
```sql
-- Check audit_logs table exists
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'audit_logs';

-- Check audit triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'audit_%';
```

## Data Assignment

### Option 1: Using CLI Script (Recommended)

```bash
# Dry run first to preview changes
npx tsx scripts/assign-clients.ts --dry-run chris@mitobio.co

# Review output, then run actual assignment
npx tsx scripts/assign-clients.ts chris@mitobio.co
```

**Expected Output:**
```
========================================
CLIENT ASSIGNMENT SCRIPT
========================================

🔍 Pre-assignment validation...

Records without user_id:
  Clients:           X
  Analyses:          X
  Custom Benchmarks: X

✓ Found user: chris@mitobio.co (uuid)

📝 Assigning data...

✅ Assignment completed:
  Clients assigned:           X
  Analyses assigned:          X
  Custom benchmarks assigned: X
  Settings created:           Yes

🔍 Post-assignment verification...

✅ All records have been assigned

========================================
✅ SUCCESS: Data assignment complete
========================================
```

### Option 2: Using Database Function

```sql
-- Assign all unassigned data to practitioner
SELECT * FROM assign_data_to_practitioner('chris@mitobio.co');

-- Verify assignment
SELECT * FROM verify_auth_migration();
```

### Post-Assignment Verification

```sql
-- Verify no NULL user_ids remain
SELECT
  (SELECT COUNT(*) FROM clients WHERE user_id IS NULL) as null_clients,
  (SELECT COUNT(*) FROM analyses WHERE user_id IS NULL) as null_analyses,
  (SELECT COUNT(*) FROM custom_benchmarks WHERE user_id IS NULL) as null_benchmarks;

-- All counts should be 0

-- Verify data assigned to practitioner
SELECT u.email,
  (SELECT COUNT(*) FROM clients WHERE user_id = u.id) as clients,
  (SELECT COUNT(*) FROM analyses WHERE user_id = u.id) as analyses,
  (SELECT COUNT(*) FROM custom_benchmarks WHERE user_id = u.id) as benchmarks
FROM auth.users u
WHERE email = 'chris@mitobio.co';
```

## Enabling RLS

⚠️ **CRITICAL**: Only enable RLS after ALL data has been assigned to users.

### Enable Row Level Security

```sql
-- Use the safe function to enable RLS
SELECT safely_enable_rls();

-- Expected output:
-- "SUCCESS: RLS enabled on all tables. Data isolation is now active."
```

If you see an error about NULL user_ids, do NOT proceed. Go back to [Data Assignment](#data-assignment).

### Verify RLS is Active

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('clients', 'analyses', 'custom_benchmarks', 'settings');

-- All should show rowsecurity = true

-- Check RLS policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('clients', 'analyses', 'custom_benchmarks', 'settings')
ORDER BY tablename, policyname;

-- Should see 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
```

## Application Configuration

### Update Environment Variables

```bash
# Update .env.local
VITE_AUTH_DISABLED=false

# Or remove the line entirely (defaults to enabled)
```

### Deploy Frontend

```bash
# Build and test locally first
npm run build
npm run preview

# Test login flow
# - Visit http://localhost:4173
# - Should see login page
# - Try logging in with practitioner email
# - Check email for magic link
# - Verify successful login

# Deploy to production
# (Your deployment process - Vercel, Netlify, etc.)
git add .
git commit -m "Enable authentication in production"
git push origin main
```

## Verification

### Functional Testing Checklist

- [ ] **Login Flow**
  - [ ] Login page appears when not authenticated
  - [ ] Magic link email sent successfully
  - [ ] Magic link redirects to application
  - [ ] User sees their email in header

- [ ] **Data Access**
  - [ ] Practitioner can see their assigned clients
  - [ ] Practitioner can create new clients
  - [ ] Practitioner can view/edit/delete their clients
  - [ ] Practitioner cannot see other users' data

- [ ] **Analyses**
  - [ ] Can upload PDF and create analysis
  - [ ] Can view historical analyses
  - [ ] Can update/delete analyses

- [ ] **Custom Benchmarks**
  - [ ] Can view benchmarks
  - [ ] Can create/edit benchmarks

- [ ] **Logout**
  - [ ] Logout button works
  - [ ] Redirects to login page
  - [ ] Cannot access data after logout

### Database Verification

```sql
-- Run the comprehensive verification function
SELECT * FROM verify_auth_migration();

-- All checks should show PASS
```

### Audit Log Verification

```sql
-- Check recent audit logs
SELECT * FROM recent_audit_activity LIMIT 20;

-- Should see login, client creation, etc.

-- Check for failed actions
SELECT * FROM failed_audit_actions;

-- Should be empty or minimal
```

## Rollback Procedure

If anything goes wrong, you can safely rollback:

### Step 1: Disable Authentication in App

```bash
# Update .env.local
VITE_AUTH_DISABLED=true

# Rebuild and redeploy
npm run build
# Deploy
```

### Step 2: Rollback Database (Optional)

⚠️ **WARNING**: This will disable RLS but preserve all data and user_id assignments.

```sql
-- Run rollback migration
psql $DATABASE_URL -f supabase/migrations/20251104000003_rollback_auth.sql

-- Verify rollback state
SELECT * FROM verify_rollback_state();
```

### Step 3: Restore from Backup (Emergency Only)

If you need to completely revert:

```bash
# Restore from backup file
psql $DATABASE_URL < backup-YYYYMMDD.sql
```

## Post-Deployment Monitoring

### Monitor for Issues

1. **Error Logs**
   ```sql
   -- Check for failed audit actions
   SELECT * FROM failed_audit_actions
   WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

2. **User Activity**
   ```sql
   -- Monitor user logins
   SELECT user_email, action, created_at
   FROM audit_logs
   WHERE action IN ('login', 'logout', 'login_failed')
   AND created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
   ```

3. **Application Errors**
   - Check browser console for JavaScript errors
   - Monitor error tracking service (if configured)
   - Check localStorage for error_log

### Health Checks

Run these daily for the first week:

```sql
-- Daily health check
SELECT
  tablename,
  (SELECT COUNT(*) FROM clients WHERE user_id IS NULL) as null_clients,
  (SELECT COUNT(*) FROM analyses WHERE user_id IS NULL) as null_analyses,
  (SELECT COUNT(*) FROM custom_benchmarks WHERE user_id IS NULL) as null_benchmarks,
  (SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours') as daily_audit_logs;
```

### Performance Monitoring

Monitor query performance with RLS enabled:

```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%clients%' OR query LIKE '%analyses%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Troubleshooting

### Issue: Users can't see their data

**Solution:**
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'clients';

-- Verify user_id assignment
SELECT c.id, c.full_name, c.user_id, u.email
FROM clients c
LEFT JOIN auth.users u ON c.user_id = u.id
WHERE c.user_id IS NOT NULL;
```

### Issue: Authentication not working

**Solution:**
1. Check `VITE_AUTH_DISABLED` environment variable
2. Verify Supabase project settings (Auth > Configuration)
3. Check email provider configuration
4. Review browser console for errors

### Issue: Permission denied errors

**Solution:**
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('clients', 'analyses', 'custom_benchmarks');

-- Check if user session is valid
-- (Run this in Supabase SQL Editor as authenticated user)
SELECT auth.uid(), auth.email();
```

## Support

If you encounter issues not covered in this guide:

1. Check error logs: `SELECT * FROM failed_audit_actions`
2. Review localStorage: `localStorage.getItem('error_log')`
3. Check Supabase logs: Dashboard > Database > Logs
4. Consult database functions: `SELECT * FROM verify_auth_migration()`

## Summary Checklist

- [ ] Database backed up
- [ ] Migrations applied successfully
- [ ] Practitioner account created
- [ ] Data assigned to practitioner
- [ ] RLS enabled via `safely_enable_rls()`
- [ ] All verification checks pass
- [ ] Application deployed with auth enabled
- [ ] Functional testing complete
- [ ] Monitoring in place
- [ ] Rollback plan documented and tested

---

**Last Updated:** 2025-11-04
**Migration Version:** 20251104000002
