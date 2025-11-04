# Deployment Quick Start

**⚡ Fast-track guide for deploying authentication to production**

For detailed information, see [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md).

## Prerequisites (5 minutes)

1. **Environment variables in `.env.local`:**
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   VITE_AUTH_DISABLED=true  # Keep this until after migration
   ```

2. **Dependencies installed:**
   ```bash
   npm install
   ```

3. **Verify readiness:**
   ```bash
   npm run verify-deployment
   ```

## Step-by-Step Deployment (30-45 minutes)

### Step 1: Backup Database (2 minutes)
```bash
supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql
```

**✅ Checkpoint:** Backup file exists with content

---

### Step 2: Apply Migrations (5 minutes)

```bash
# Apply all migrations
supabase db push

# Or manually run each migration:
# psql $DATABASE_URL -f supabase/migrations/20251104000001_fix_settings_schema.sql
# psql $DATABASE_URL -f supabase/migrations/20251104000002_enable_auth_safely.sql
# psql $DATABASE_URL -f supabase/migrations/20251104000004_create_audit_logs.sql
```

**Verify in database:**
```sql
-- Check helper functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN (
  'safely_enable_rls',
  'assign_data_to_practitioner',
  'verify_auth_migration'
);
-- Should return 3 rows

-- Check audit_logs table exists
SELECT COUNT(*) FROM audit_logs;
-- Should work (returns 0)
```

**✅ Checkpoint:** All 3 functions exist, audit_logs table exists

---

### Step 3: Practitioner Sign Up (5 minutes)

**Option A: Via Application (Recommended)**
1. Temporarily set `VITE_AUTH_DISABLED=false` in `.env.local`
2. Run `npm run build && npm run preview`
3. Visit `http://localhost:4173`
4. Have practitioner sign up with `chris@mitobio.co`
5. Check email and click magic link
6. Verify login works
7. Set `VITE_AUTH_DISABLED=true` again

**Option B: Via Supabase Dashboard**
1. Go to Supabase Dashboard > Authentication > Users
2. Click "Invite User"
3. Enter `chris@mitobio.co`
4. User receives invitation email

**Verify in Supabase:**
- Dashboard > Authentication > Users
- Should see `chris@mitobio.co` listed

**✅ Checkpoint:** Practitioner account exists in auth.users

---

### Step 4: Assign Data to Practitioner (5 minutes)

```bash
# Preview what will be assigned (dry run)
npm run assign-clients:dry-run chris@mitobio.co

# Assign data
npm run assign-clients chris@mitobio.co
```

**Expected output:**
```
✅ Assignment completed:
  Clients assigned:           X
  Analyses assigned:          X
  Custom benchmarks assigned: X
  Settings created:           Yes

✅ All records have been assigned
```

**Verify in database:**
```sql
-- Should return 0, 0, 0
SELECT
  (SELECT COUNT(*) FROM clients WHERE user_id IS NULL) as null_clients,
  (SELECT COUNT(*) FROM analyses WHERE user_id IS NULL) as null_analyses,
  (SELECT COUNT(*) FROM custom_benchmarks WHERE user_id IS NULL) as null_benchmarks;
```

**✅ Checkpoint:** All NULL user_id counts are 0

---

### Step 5: Enable Row Level Security (2 minutes)

In Supabase SQL Editor:
```sql
SELECT safely_enable_rls();
```

**Expected result:**
```
SUCCESS: RLS enabled on all tables. Data isolation is now active.
```

**Verify:**
```sql
SELECT * FROM verify_auth_migration();
```

All checks should show **PASS**.

**✅ Checkpoint:** RLS enabled, all verification checks pass

---

### Step 6: Enable Authentication in App (5 minutes)

1. **Update `.env.local`:**
   ```bash
   VITE_AUTH_DISABLED=false
   # Or just remove the line entirely
   ```

2. **Build:**
   ```bash
   npm run build
   ```

3. **Test locally:**
   ```bash
   npm run preview
   ```

4. **Verify login flow:**
   - Visit `http://localhost:4173`
   - Should see login page
   - Enter `chris@mitobio.co`
   - Check email for magic link
   - Click link, should redirect to app
   - Should see practitioner email in header
   - Should see their clients

**✅ Checkpoint:** Local testing successful

---

### Step 7: Deploy to Production (10 minutes)

**Commit changes:**
```bash
git add .
git commit -m "Enable authentication for production

- Applied database migrations (settings, auth, audit logs)
- Assigned all data to chris@mitobio.co
- Enabled RLS with safety checks
- Configured auth toggle via environment variable
- Added error handling and audit logging

Migrations applied:
- 20251104000001_fix_settings_schema.sql
- 20251104000002_enable_auth_safely.sql
- 20251104000004_create_audit_logs.sql

Verified:
- All data assigned (no NULL user_ids)
- RLS enabled and tested
- Authentication flow working
- Audit logging active"

git push origin main
```

**Deploy:**
- Follow your deployment process (Vercel, Netlify, etc.)
- Ensure environment variable `VITE_AUTH_DISABLED=false` is set (or not set)

**✅ Checkpoint:** Application deployed

---

### Step 8: Verify Production (10 minutes)

**Test authentication:**
- [ ] Visit production URL
- [ ] See login page
- [ ] Login with `chris@mitobio.co`
- [ ] Receive magic link email
- [ ] Click link and login successfully
- [ ] See practitioner's clients
- [ ] Create a test client
- [ ] Logout successfully
- [ ] Cannot access app after logout

**Check database:**
```sql
-- View recent activity
SELECT * FROM recent_audit_activity LIMIT 20;
-- Should see login and create_client events

-- Check for errors
SELECT * FROM failed_audit_actions;
-- Should be empty or minimal

-- Verify RLS still enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('clients', 'analyses', 'custom_benchmarks');
-- All should show rowsecurity = true
```

**✅ Checkpoint:** Production working correctly

---

## Quick Verification Commands

```bash
# Before deployment
npm run verify-deployment          # Check readiness

# During deployment
npm run assign-clients:dry-run chris@mitobio.co    # Preview assignment
npm run assign-clients chris@mitobio.co            # Assign data

# After deployment - in database
SELECT safely_enable_rls();        # Enable RLS
SELECT * FROM verify_auth_migration();              # Verify
SELECT * FROM recent_audit_activity LIMIT 20;       # Check logs
```

## Rollback (if needed)

**Quick rollback:**
```bash
# 1. Update .env.local
VITE_AUTH_DISABLED=true

# 2. Rebuild and redeploy
npm run build
git push origin main
```

**Full rollback (with database):**
```sql
-- In Supabase SQL Editor
\i supabase/migrations/20251104000003_rollback_auth.sql

-- Verify rollback
SELECT * FROM verify_rollback_state();
```

## Monitoring

**First 24 hours - check every 4 hours:**
```sql
-- User activity
SELECT user_email, action, created_at
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Failed actions
SELECT * FROM failed_audit_actions
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Data integrity
SELECT
  (SELECT COUNT(*) FROM clients WHERE user_id IS NULL) as null_clients,
  (SELECT COUNT(*) FROM analyses WHERE user_id IS NULL) as null_analyses;
```

## Success Criteria

Deployment is successful when:
- ✅ Practitioner can log in with magic link
- ✅ Practitioner can see all their clients/analyses
- ✅ Practitioner can create/edit/delete data
- ✅ No errors in browser console
- ✅ Audit logs show all activities
- ✅ No NULL user_ids in database
- ✅ RLS enabled and working

## Common Issues

### Issue: "Cannot enable RLS - found NULL user_ids"
**Solution:** Run data assignment again:
```bash
npm run assign-clients chris@mitobio.co
```

### Issue: User can't see their data
**Solution:** Check user_id assignment:
```sql
SELECT c.full_name, c.user_id, u.email
FROM clients c
LEFT JOIN auth.users u ON c.user_id = u.id
LIMIT 10;
```

### Issue: Magic link not working
**Solution:**
1. Check Supabase Auth settings: Dashboard > Authentication > Configuration
2. Verify email provider configured
3. Check email template settings

## Need Help?

- 📖 Full guide: [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md)
- ✅ Checklist: [PRE_DEPLOYMENT_CHECKLIST.md](PRE_DEPLOYMENT_CHECKLIST.md)
- 📋 Summary: [AUTHENTICATION_IMPLEMENTATION_SUMMARY.md](AUTHENTICATION_IMPLEMENTATION_SUMMARY.md)

---

**Total Time:** ~30-45 minutes
**Difficulty:** Medium
**Risk Level:** Low (full rollback available)
