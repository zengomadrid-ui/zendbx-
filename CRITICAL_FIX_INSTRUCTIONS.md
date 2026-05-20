# 🚨 CRITICAL FIX INSTRUCTIONS

## Problem Analysis

You're experiencing TWO critical issues:

### Issue 1: Frontend Still Calling Old Backend ❌
```
POST https://zendbx-13.onrender.com/api/projects 500
```
**Root Cause:** Browser is using cached Next.js build files with old URL

### Issue 2: Database Schema Mismatch ❌
```
column "key_type" of relation "api_keys" does not exist
```
**Root Cause:** New backend database (zendbx-2-zpp9) is missing schema migrations

---

## IMMEDIATE FIX - Step by Step

### Step 1: Fix Database Schema on NEW Backend

#### Option A: Using Render Dashboard (RECOMMENDED)

1. Go to https://dashboard.render.com
2. Select your **zendbx-2-zpp9** service
3. Click "Shell" tab
4. Run these commands:

```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# Run the fix
\i /app/backend/database/add_api_keys_columns.sql

# Or paste this directly:
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_type VARCHAR(50);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS encrypted_key TEXT;
CREATE INDEX IF NOT EXISTS idx_api_keys_key_type ON api_keys(key_type);
UPDATE api_keys SET key_type = role WHERE key_type IS NULL;

# Verify
\d api_keys

# Exit
\q
```

#### Option B: Using SQL File (Alternative)

1. Copy the contents of `fix-deployment-issues.sql`
2. Go to Render Dashboard → Your Service → Shell
3. Run: `psql $DATABASE_URL`
4. Paste the SQL and execute

### Step 2: Clear Frontend Build Cache

#### On Your Local Machine:

```bash
cd frontend

# Delete build cache
rm -rf .next

# Delete node_modules/.cache if exists
rm -rf node_modules/.cache

# Verify environment
cat .env.production
# Should show: NEXT_PUBLIC_API_URL=https://zendbx-2-zpp9.onrender.com
```

### Step 3: Update Vercel Environment Variables

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. **UPDATE these for Production:**

| Variable | Current (WRONG) | New (CORRECT) |
|----------|----------------|---------------|
| `NEXT_PUBLIC_API_URL` | `https://zendbx-13.onrender.com` | `https://zendbx-2-zpp9.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | `wss://zendbx-13.onrender.com` | `wss://zendbx-2-zpp9.onrender.com` |

5. Click "Save"

### Step 4: Redeploy Frontend with Clear Cache

#### Option A: Via Vercel Dashboard

1. Go to Vercel Dashboard → Your Project
2. Click "Deployments" tab
3. Click "..." on latest deployment
4. Click "Redeploy"
5. **✅ CHECK "Clear Build Cache"** (CRITICAL!)
6. Click "Redeploy"

#### Option B: Via Git Push

```bash
# Make a small change to force rebuild
git add .
git commit -m "fix: force rebuild with new backend URL"
git push origin main
```

### Step 5: Verify the Fix

#### A. Check Backend Health

```bash
curl https://zendbx-2-zpp9.onrender.com/health
```

Expected:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

#### B. Check Frontend

1. Open https://devapp.zendbx.in in **INCOGNITO/PRIVATE** window
2. Open DevTools (F12) → Network tab
3. Try to create a project
4. **Verify:**
   - ✅ Request goes to `https://zendbx-2-zpp9.onrender.com/api/projects`
   - ❌ NO requests to `https://zendbx-13.onrender.com`
   - ✅ Status 200 or 201 (success)
   - ✅ No "key_type" errors

---

## Quick Verification Commands

### Check Database Schema:
```bash
# On Render Shell
psql $DATABASE_URL -c "\d api_keys"
```

Should show `key_type` and `encrypted_key` columns.

### Check Frontend Build:
```bash
# In your local frontend directory
grep -r "zendbx-13" .next/ 2>/dev/null || echo "✅ No old URLs found"
grep -r "zendbx-2-zpp9" .next/ 2>/dev/null && echo "✅ New URLs found"
```

### Check Vercel Environment:
```bash
# Using Vercel CLI
vercel env ls
```

---

## Troubleshooting

### Still seeing old URL in browser?

1. **Clear browser cache:**
   - Chrome: Ctrl+Shift+Delete → Clear cached images and files
   - Or use Incognito mode

2. **Hard refresh:**
   - Windows: Ctrl+Shift+R
   - Mac: Cmd+Shift+R

3. **Check Vercel deployment logs:**
   - Go to Vercel → Deployments → Click latest → View Function Logs
   - Look for build errors

### Still getting "key_type" error?

1. **Verify you're on the NEW backend:**
   ```bash
   curl https://zendbx-2-zpp9.onrender.com/health
   ```

2. **Check database columns:**
   ```bash
   psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name='api_keys';"
   ```

3. **Re-run migration:**
   ```bash
   psql $DATABASE_URL -f /app/backend/database/add_api_keys_columns.sql
   ```

### Frontend still calling old backend?

1. **Check Vercel environment variables** (most common issue)
2. **Ensure build cache was cleared** during redeploy
3. **Check .env.production** in your repo
4. **Force new deployment** with a code change

---

## Prevention Checklist

After fixing, verify:

- [ ] Database has `key_type` column
- [ ] Database has `encrypted_key` column
- [ ] Vercel env vars point to new backend
- [ ] `.env.production` has new backend URL
- [ ] Frontend build cache cleared
- [ ] Browser shows new URL in Network tab
- [ ] Project creation works
- [ ] No 500 errors
- [ ] No "key_type" errors

---

## Emergency Rollback

If issues persist:

### Rollback to Old Backend:
```bash
# Update Vercel env vars back to:
NEXT_PUBLIC_API_URL=https://zendbx-13.onrender.com
NEXT_PUBLIC_WS_URL=wss://zendbx-13.onrender.com

# Redeploy frontend
```

### Or Fix Old Backend Schema:
```bash
# Connect to old backend
psql <OLD_DATABASE_URL>

# Run migration
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_type VARCHAR(50);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS encrypted_key TEXT;
```

---

## Summary

**Root Causes:**
1. ❌ Frontend cached with old backend URL
2. ❌ New backend missing database columns

**Fixes:**
1. ✅ Run SQL migration on new backend
2. ✅ Update Vercel environment variables
3. ✅ Redeploy frontend with clear cache
4. ✅ Test in incognito mode

**Expected Result:**
- All requests go to `zendbx-2-zpp9.onrender.com`
- Project creation works without errors
- No "key_type" column errors

---

**Need Help?**
1. Check Render logs: https://dashboard.render.com → Your Service → Logs
2. Check Vercel logs: https://vercel.com/dashboard → Your Project → Deployments
3. Check browser console: F12 → Console tab
