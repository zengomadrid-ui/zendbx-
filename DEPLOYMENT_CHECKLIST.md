# ZenDBX Production Deployment Checklist

## ✅ Completed Tasks

### 1. Frontend URL Configuration
- ✅ Replaced all hardcoded `http://localhost:8000` URLs with environment variables
- ✅ Updated 22 frontend files to use `process.env.NEXT_PUBLIC_API_URL`
- ✅ Fixed import page to use correct environment variable
- ✅ Updated `.env.production` with production backend URL: `https://zendbx-2-zpp9.onrender.com`
- ✅ Updated `.env.local` for local development

### 2. Backend CORS Configuration
- ✅ Updated `backend/app/main.py` to allow `https://devapp.zendbx.in`
- ✅ Updated `backend/.env.production` with correct ALLOWED_ORIGINS
- ✅ CORS now allows both development and production domains

### 3. Backend Docker Configuration
- ✅ Created `backend/Dockerfile` to force Python 3.11.9
- ✅ Updated `render.yaml` to use Docker runtime
- ✅ Fixed all Python dependency compilation issues

## 🚀 Deployment Steps

### Step 1: Deploy Backend to Render

1. **Commit and push changes:**
   ```bash
   git add .
   git commit -m "fix: Update CORS and environment configuration for production"
   git push origin main
   ```

2. **Render will automatically deploy** (if auto-deploy is enabled)
   - Or manually trigger deployment from Render dashboard
   - Wait for build to complete
   - Verify deployment at: https://zendbx-2-zpp9.onrender.com

3. **Verify backend health:**
   - Visit: https://zendbx-2-zpp9.onrender.com/health
   - Should return: `{"status": "healthy", "database": "connected", ...}`

### Step 2: Deploy Frontend to Vercel

1. **Vercel will automatically deploy** from GitHub
   - Or manually trigger from Vercel dashboard
   - Build should complete successfully

2. **Verify environment variables in Vercel:**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Ensure `NEXT_PUBLIC_API_URL` is set to: `https://zendbx-2-zpp9.onrender.com`
   - Ensure `NEXT_PUBLIC_APP_URL` is set to: `https://devapp.zendbx.in`

3. **Verify frontend:**
   - Visit: https://devapp.zendbx.in
   - Test login/signup functionality
   - Check browser console for any CORS errors

### Step 3: Test End-to-End

1. **Test Authentication:**
   - Sign up a new user
   - Log in
   - Verify token is stored

2. **Test API Calls:**
   - Create a new project
   - View projects list
   - Test SQL editor
   - Test database operations

3. **Check for Errors:**
   - Open browser DevTools → Network tab
   - Verify all API calls go to `https://zendbx-2-zpp9.onrender.com`
   - No `localhost:8000` calls should appear
   - No CORS errors should appear

## 🔧 Configuration Files Updated

### Frontend
- `frontend/.env.production` - Production API URL
- `frontend/.env.local` - Local development API URL
- `frontend/app/**/*.tsx` - 22 files with hardcoded URLs fixed

### Backend
- `backend/app/main.py` - CORS configuration
- `backend/.env.production` - Production CORS origins
- `backend/Dockerfile` - Python 3.11.9 configuration
- `render.yaml` - Docker runtime configuration

## 🌐 Production URLs

- **Frontend:** https://devapp.zendbx.in
- **Backend API:** https://zendbx-2-zpp9.onrender.com
- **Backend Health:** https://zendbx-2-zpp9.onrender.com/health
- **API Docs:** https://zendbx-2-zpp9.onrender.com/docs

## 🔍 Troubleshooting

### If CORS errors persist:

1. **Check backend logs on Render:**
   - Verify ALLOWED_ORIGINS includes `https://devapp.zendbx.in`
   - Check if ENVIRONMENT is set to "production"

2. **Check frontend environment:**
   - Verify Vercel environment variables
   - Check browser console for actual API URL being called

3. **Verify backend CORS middleware:**
   ```python
   # Should allow:
   allowed_origins = [
       "https://devapp.zendbx.in",
       # ... other origins
   ]
   ```

### If API calls still go to localhost:

1. **Clear browser cache and hard reload** (Ctrl+Shift+R)
2. **Check Vercel build logs** for environment variable injection
3. **Verify no hardcoded URLs remain:**
   ```bash
   cd frontend
   grep -r "localhost:8000" app/
   ```

### If backend deployment fails:

1. **Check Render build logs** for Python/Docker errors
2. **Verify Dockerfile** is using Python 3.11.9
3. **Check render.yaml** is using `type: docker`

## 📝 Environment Variables Reference

### Frontend (Vercel)
```env
NEXT_PUBLIC_API_URL=https://zendbx-2-zpp9.onrender.com
NEXT_PUBLIC_APP_URL=https://devapp.zendbx.in
NEXT_PUBLIC_WS_URL=wss://zendbx-2-zpp9.onrender.com
NEXT_PUBLIC_ENVIRONMENT=production
```

### Backend (Render)
```env
ENVIRONMENT=production
ALLOWED_ORIGINS=["https://devapp.zendbx.in","https://zendbx.in","https://www.zendbx.in"]
DATABASE_URL=<your-production-database-url>
SECRET_KEY=<your-secret-key>
```

## ✨ Success Criteria

- ✅ Frontend loads at https://devapp.zendbx.in
- ✅ Backend responds at https://zendbx-2-zpp9.onrender.com
- ✅ No CORS errors in browser console
- ✅ No localhost:8000 calls in Network tab
- ✅ Authentication works (signup/login)
- ✅ Projects can be created and viewed
- ✅ SQL editor executes queries
- ✅ All API calls succeed

## 🎉 Next Steps After Deployment

1. Monitor error logs on both Render and Vercel
2. Set up proper monitoring (Sentry, LogRocket, etc.)
3. Configure production database backups
4. Set up SSL certificates (should be automatic on Vercel/Render)
5. Configure custom domain if needed
6. Set up CI/CD pipelines for automated testing
