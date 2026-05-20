# Backend URL Migration Complete ✅

## Migration Summary

**Old Backend URL:** `https://zendbx-13.onrender.com`  
**New Backend URL:** `https://zendbx-2-zpp9.onrender.com`

## Changes Made

### 1. Frontend Configuration Files ✅

#### `.env.production` (Production)
```env
NEXT_PUBLIC_API_URL=https://zendbx-2-zpp9.onrender.com
NEXT_PUBLIC_APP_URL=https://devapp.zendbx.in
NEXT_PUBLIC_WS_URL=wss://zendbx-2-zpp9.onrender.com
NEXT_PUBLIC_ENVIRONMENT=production
```

#### `.env.local` (Local Development)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=ZenDBX
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 2. Frontend Config File ✅

**File:** `frontend/lib/config.ts`

Updated fallback URLs in production mode:
```typescript
baseUrl: isProduction 
  ? (process.env.NEXT_PUBLIC_API_URL || 'https://zendbx-2-zpp9.onrender.com')
  : getEnvVar('NEXT_PUBLIC_API_URL', 'http://localhost:8000'),
wsUrl: isProduction
  ? (process.env.NEXT_PUBLIC_WS_URL || 'wss://zendbx-2-zpp9.onrender.com')
  : getEnvVar('NEXT_PUBLIC_WS_URL', 'http://localhost:8001'),
```

### 3. Build Cache Cleared ✅

Removed `.next` directory to clear old cached URLs:
```bash
rm -rf frontend/.next
```

### 4. Verification Scripts Updated ✅

- `frontend/verify-no-localhost.js` - Updated to show new URL
- `frontend/final-verification.sh` - Updated to check for new URL

## Deployment Steps

### Step 1: Update Vercel Environment Variables

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

**Update these variables for PRODUCTION:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://zendbx-2-zpp9.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | `wss://zendbx-2-zpp9.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | `https://devapp.zendbx.in` |
| `NEXT_PUBLIC_ENVIRONMENT` | `production` |

### Step 2: Commit and Push Changes

```bash
git add .
git commit -m "fix: migrate to new Render backend URL (zendbx-2-zpp9)

- Update all environment files to use new backend URL
- Clear Next.js build cache
- Update config fallback URLs
- Fix .env.local for local development

Old: https://zendbx-13.onrender.com
New: https://zendbx-2-zpp9.onrender.com"

git push origin main
```

### Step 3: Deploy Frontend to Vercel

**Option A: Automatic Deployment**
- Vercel will auto-deploy when you push to main
- Monitor deployment at: https://vercel.com/dashboard

**Option B: Manual Deployment**
1. Go to Vercel Dashboard
2. Select your project
3. Click "Deployments" tab
4. Click "Redeploy" on the latest deployment
5. **IMPORTANT:** Check "Clear Build Cache"
6. Click "Redeploy"

### Step 4: Verify Deployment

#### A. Check Backend Health
```bash
curl https://zendbx-2-zpp9.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-05-20T..."
}
```

#### B. Check Frontend

1. Open https://devapp.zendbx.in
2. Open Browser DevTools (F12)
3. Go to Network tab
4. Clear network log
5. Try to login or signup
6. **Verify ALL requests go to:** `https://zendbx-2-zpp9.onrender.com`
7. **Verify NO requests go to:** `https://zendbx-13.onrender.com`

#### C. Test API Endpoints

Test these critical endpoints:

```bash
# Health check
curl https://zendbx-2-zpp9.onrender.com/health

# API docs
curl https://zendbx-2-zpp9.onrender.com/docs

# Auth endpoint (should return 422 without body)
curl -X POST https://zendbx-2-zpp9.onrender.com/api/auth/signup \
  -H "Content-Type: application/json"
```

### Step 5: Test End-to-End Flow

1. ✅ Open https://devapp.zendbx.in
2. ✅ Click "Sign Up"
3. ✅ Create a new account
4. ✅ Verify redirect to dashboard
5. ✅ Create a new project
6. ✅ Run a SQL query
7. ✅ Check API keys page
8. ✅ Test authentication flow

**In Browser Network Tab:**
- ✅ All requests should go to `zendbx-2-zpp9.onrender.com`
- ❌ NO requests should go to `zendbx-13.onrender.com`
- ❌ NO requests should go to `localhost:8000`
- ✅ No CORS errors
- ✅ No 401/403 errors

## Debugging

### Issue: Still seeing old URL in browser

**Solution:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+Shift+R)
3. Open in incognito/private window
4. Check Vercel deployment logs for build errors

### Issue: Environment variables not updating

**Solution:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Delete old variables
3. Add new variables
4. Redeploy with "Clear Build Cache" checked

### Issue: CORS errors

**Solution:**
1. Check backend CORS configuration in `backend/app/main.py`
2. Ensure `https://devapp.zendbx.in` is in allowed origins
3. Redeploy backend on Render

### Issue: 404 errors on API calls

**Solution:**
1. Verify backend is running: `curl https://zendbx-2-zpp9.onrender.com/health`
2. Check Render logs for backend errors
3. Verify database connection in Render environment variables

## Rollback Plan

If issues occur, you can rollback:

### Rollback Frontend
1. Go to Vercel Dashboard
2. Click "Deployments"
3. Find previous working deployment
4. Click "..." → "Promote to Production"

### Rollback Backend
1. Go to Render Dashboard
2. Click your service
3. Click "Manual Deploy"
4. Select previous deployment
5. Click "Deploy"

## Verification Checklist

- [x] `.env.production` updated with new URL
- [x] `.env.local` uses localhost for development
- [x] `frontend/lib/config.ts` fallback URLs updated
- [x] `.next` build cache cleared
- [x] Verification scripts updated
- [ ] Vercel environment variables updated
- [ ] Frontend redeployed with clear cache
- [ ] Browser network tab shows new URL only
- [ ] No CORS errors in console
- [ ] Authentication flow works
- [ ] Project creation works
- [ ] API calls succeed

## Support

If you encounter issues:

1. **Check Vercel Logs:** https://vercel.com/dashboard → Your Project → Deployments → View Function Logs
2. **Check Render Logs:** https://dashboard.render.com → Your Service → Logs
3. **Check Browser Console:** F12 → Console tab for errors
4. **Check Network Tab:** F12 → Network tab for failed requests

## Next Steps

After successful deployment:

1. ✅ Monitor error rates in production
2. ✅ Test all critical user flows
3. ✅ Update any external documentation with new URLs
4. ✅ Notify team members of URL change
5. ✅ Update any CI/CD pipelines
6. ✅ Update monitoring/alerting systems

---

**Migration Status:** ✅ COMPLETE  
**Date:** 2026-05-20  
**Old URL:** https://zendbx-13.onrender.com  
**New URL:** https://zendbx-2-zpp9.onrender.com  
**Frontend:** https://devapp.zendbx.in
