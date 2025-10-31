# Quick Start: Magic Link Authentication

## What Was Added

✅ **Magic link login** - Users enter email, click link, get logged in (no passwords!)
✅ **Persistent sessions** - Users stay logged in with cookies
✅ **Data isolation** - Each practitioner only sees their own clients
✅ **Chris Voutsas setup** - All existing clients will belong to Chris

---

## 5-Minute Setup

### 1. Run Database Migration (2 min)

Go to [Supabase Dashboard](https://app.supabase.com) → SQL Editor → New Query

Paste the contents of `supabase-auth-migration.sql` and click **Run**.

### 2. Enable Email Auth (1 min)

In Supabase Dashboard:
- Go to **Authentication** → **Providers**
- Make sure **Email** is enabled
- Click **Save**

### 3. Deploy (1 min)

```bash
npm run build
git add .
git commit -m "Add authentication"
git push
```

### 4. Have Chris Sign Up (30 sec)

Send Chris your app URL. He enters his email → clicks magic link → logged in!

### 5. Assign Clients to Chris (30 sec)

```bash
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"

node scripts/assign-clients.js chris@example.com
```

Type `yes` when prompted.

---

## Done!

- Chris can log in and see all his existing clients
- New practitioners can sign up and start with a clean slate
- Everyone's data is isolated
- Sessions persist across browser restarts

See [AUTHENTICATION_SETUP.md](./AUTHENTICATION_SETUP.md) for detailed instructions and troubleshooting.
