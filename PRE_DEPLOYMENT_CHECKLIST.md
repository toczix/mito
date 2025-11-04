# Pre-Deployment Checklist

Use this checklist before deploying authentication to production.

## Prerequisites

### Access & Credentials
- [ ] Supabase project admin access confirmed
- [ ] Database connection string available
- [ ] Service role key securely stored
- [ ] Production deployment credentials ready
- [ ] Email service configured in Supabase (for magic links)

### Environment Setup
- [ ] `.env.local` file configured with correct values
- [ ] `VITE_SUPABASE_URL` set correctly
- [ ] `VITE_SUPABASE_ANON_KEY` set correctly
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (for scripts)
- [ ] `VITE_AUTH_DISABLED=true` currently set (will change after deployment)

### Tools Installed
- [ ] Supabase CLI installed: `brew install supabase/tap/supabase`
- [ ] Node.js and npm installed
- [ ] tsx installed: `npm install -g tsx` (or use via npx)
- [ ] Git configured and ready

## Code Verification

### Build Status
- [ ] Run `npm install` - all dependencies installed
- [ ] Run `npm run build` - build succeeds without errors
- [ ] No TypeScript errors
- [ ] No ESLint errors (run `npm run lint`)

### Code Review
- [ ] Review [ErrorBoundary.tsx](src/components/ErrorBoundary.tsx) - error handling ready
- [ ] Review [error-handler.ts](src/lib/error-handler.ts) - centralized logging ready
- [ ] Review [audit-logger.ts](src/lib/audit-logger.ts) - audit system ready
- [ ] Review [client-service.ts](src/lib/client-service.ts) - error handling integrated
- [ ] Review [App.tsx](src/App.tsx) - auth flow and logging integrated
- [ ] Review [LoginPage.tsx](src/pages/LoginPage.tsx) - login flow ready

## Database Preparation

### Backup
- [ ] Create full database backup:
  ```bash
  supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql
  ```
- [ ] Verify backup file exists and has content
- [ ] Store backup in secure location
- [ ] Document backup location for team

### Current State Verification
Run these queries and document the results:

```sql
-- Check existing data counts
SELECT
  (SELECT COUNT(*) FROM clients) as clients_count,
  (SELECT COUNT(*) FROM analyses) as analyses_count,
  (SELECT COUNT(*) FROM custom_benchmarks) as benchmarks_count;
```

**Results:**
- Clients: _______
- Analyses: _______
- Benchmarks: _______

```sql
-- Check for NULL user_ids (should be all)
SELECT
  (SELECT COUNT(*) FROM clients WHERE user_id IS NULL) as null_clients,
  (SELECT COUNT(*) FROM analyses WHERE user_id IS NULL) as null_analyses,
  (SELECT COUNT(*) FROM custom_benchmarks WHERE user_id IS NULL) as null_benchmarks;
```

**Results:**
- NULL Clients: _______
- NULL Analyses: _______
- NULL Benchmarks: _______

- [ ] All data counts documented
- [ ] NULL user_id counts documented (should match total counts)

### Migration Files Ready
- [ ] [20251104000001_fix_settings_schema.sql](supabase/migrations/20251104000001_fix_settings_schema.sql) exists
- [ ] [20251104000002_enable_auth_safely.sql](supabase/migrations/20251104000002_enable_auth_safely.sql) exists
- [ ] [20251104000003_rollback_auth.sql](supabase/migrations/20251104000003_rollback_auth.sql) exists
- [ ] [20251104000004_create_audit_logs.sql](supabase/migrations/20251104000004_create_audit_logs.sql) exists
- [ ] All migration files reviewed and understood

## Practitioner Account

### Account Creation
- [ ] Practitioner knows they need to sign up first
- [ ] Practitioner email confirmed: **chris@mitobio.co**
- [ ] Plan for practitioner to sign up:
  - Option A: Temporarily enable auth, have them sign up, then disable
  - Option B: Create account via Supabase dashboard
  - Option C: Wait until deployment, sign up immediately

### Verification Plan
- [ ] Method for verifying practitioner account created
- [ ] Plan to check account in Supabase dashboard: Authentication > Users

## Deployment Plan

### Timing
- [ ] Deployment date/time scheduled: _______________
- [ ] Practitioner availability confirmed for date/time
- [ ] Low-traffic time selected (if applicable)
- [ ] Maintenance window communicated (if needed)

### Communication
- [ ] Stakeholders notified of deployment
- [ ] Practitioner notified of what to expect
- [ ] Support plan in place for first 24-48 hours

### Team Readiness
- [ ] Person responsible for database migrations: _______________
- [ ] Person responsible for application deployment: _______________
- [ ] Person responsible for monitoring: _______________
- [ ] Backup person available: _______________

## Rollback Plan

### Preparation
- [ ] Rollback migration tested (in development/staging)
- [ ] Rollback procedure documented and understood
- [ ] Criteria for triggering rollback defined:
  - [ ] Users cannot log in
  - [ ] Users cannot access their data
  - [ ] Critical errors in application
  - [ ] Data access issues
  - [ ] Other: _______________

### Rollback Steps Understood
- [ ] Know how to set `VITE_AUTH_DISABLED=true`
- [ ] Know how to redeploy application quickly
- [ ] Know how to run rollback migration if needed
- [ ] Know how to restore from backup (last resort)

## Documentation Review

### Read and Understood
- [ ] [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) - Complete guide read
- [ ] [AUTHENTICATION_IMPLEMENTATION_SUMMARY.md](AUTHENTICATION_IMPLEMENTATION_SUMMARY.md) - Implementation understood
- [ ] Migration files reviewed
- [ ] Assignment script usage understood

### Key Concepts Clear
- [ ] Understand Row Level Security (RLS)
- [ ] Understand magic link authentication flow
- [ ] Understand data assignment process
- [ ] Understand audit logging
- [ ] Understand error handling
- [ ] Know when to enable RLS (after data assignment!)

## Script Testing

### Assignment Script
- [ ] Review script: [scripts/assign-clients.ts](scripts/assign-clients.ts)
- [ ] Understand dry-run mode
- [ ] Know how to run: `npm run assign-clients:dry-run <email>`
- [ ] Know how to run actual: `npm run assign-clients <email>`
- [ ] Service role key available for script

### Script Dry Run (Optional but Recommended)
If you want to test the script logic before actual deployment:
- [ ] Run dry-run in development: `npm run assign-clients:dry-run chris@mitobio.co`
- [ ] Review output and understand what will happen
- [ ] Verify script logic makes sense

## Monitoring Setup

### Tools Ready
- [ ] Know how to access Supabase logs
- [ ] Know how to check audit_logs table
- [ ] Know how to view recent_audit_activity
- [ ] Know how to check failed_audit_actions
- [ ] Browser console monitoring plan
- [ ] localStorage error log checking plan

### Queries Prepared
Save these queries for quick access during monitoring:

```sql
-- Recent audit activity
SELECT * FROM recent_audit_activity LIMIT 20;

-- Failed actions (security monitoring)
SELECT * FROM failed_audit_actions;

-- Health check
SELECT
  (SELECT COUNT(*) FROM clients WHERE user_id IS NULL) as null_clients,
  (SELECT COUNT(*) FROM analyses WHERE user_id IS NULL) as null_analyses,
  (SELECT COUNT(*) FROM custom_benchmarks WHERE user_id IS NULL) as null_benchmarks;

-- User activity last 24 hours
SELECT user_email, action, created_at
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

- [ ] Monitoring queries saved and tested
- [ ] Know how to access Supabase SQL Editor

## Final Verification

### Pre-Deployment
- [ ] All items in this checklist completed
- [ ] Team briefed and ready
- [ ] Backup verified and accessible
- [ ] Rollback plan clear and ready
- [ ] Monitoring tools prepared
- [ ] Communication sent to stakeholders

### Go/No-Go Decision
- [ ] All critical items checked
- [ ] No blocking issues identified
- [ ] Team agrees to proceed
- [ ] Practitioner ready and available

**Decision:** GO / NO-GO (circle one)

**Signed by:** _______________ **Date:** _______________

## Post-Deployment Verification Plan

Immediately after deployment, verify:

1. **Application Access**
   - [ ] Can access login page
   - [ ] Login page displays correctly
   - [ ] Magic link email sends successfully

2. **Practitioner Login**
   - [ ] Practitioner receives magic link email
   - [ ] Magic link works and logs them in
   - [ ] Practitioner sees their email in header

3. **Data Access**
   - [ ] Practitioner can see their clients
   - [ ] Practitioner can view analyses
   - [ ] Practitioner can create new client
   - [ ] Practitioner can edit existing data

4. **Security**
   - [ ] Logout works correctly
   - [ ] Cannot access data after logout
   - [ ] Login required to access application

5. **Audit Logs**
   - [ ] Login events recorded in audit_logs
   - [ ] Client creation recorded
   - [ ] Recent activity visible

6. **Database**
   - [ ] No NULL user_ids remain
   - [ ] RLS is enabled on all tables
   - [ ] All verification checks pass

### Monitoring Window
- [ ] Monitor for first 2 hours actively
- [ ] Check every 4 hours for first 24 hours
- [ ] Daily check for first week
- [ ] Weekly check for first month

## Emergency Contacts

**Technical Lead:** _______________
**Email:** _______________
**Phone:** _______________

**Database Admin:** _______________
**Email:** _______________
**Phone:** _______________

**Practitioner (User):** chris@mitobio.co
**Phone:** _______________

## Notes

Use this space for any additional notes, concerns, or observations:

---

**Checklist completed by:** _______________
**Date:** _______________
**Time:** _______________

---

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Build and verify
npm run build

# Preview locally
npm run preview

# Assign clients (dry run first!)
npm run assign-clients:dry-run chris@mitobio.co
npm run assign-clients chris@mitobio.co

# Database backup
supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql

# Enable RLS (in database)
SELECT safely_enable_rls();

# Verify migration
SELECT * FROM verify_auth_migration();

# Check audit logs
SELECT * FROM recent_audit_activity LIMIT 20;
```

## Success Criteria

Deployment is considered successful when:
- ✅ Practitioner can log in with magic link
- ✅ Practitioner can access all their data
- ✅ Practitioner can create/edit/delete data
- ✅ No errors in browser console
- ✅ No failed audit logs (except legitimate failures)
- ✅ No NULL user_ids in database
- ✅ RLS enabled and working correctly
- ✅ Audit logs recording all activities

**If all success criteria met:** Deployment successful ✅
**If any criteria not met:** Review issues and consider rollback
