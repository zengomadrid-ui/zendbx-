# Production OAuth Setup Guide

## Problem
OAuth login fails on production with error: `relation "oauth_states" does not exist`

This happens because the OAuth database tables haven't been created in the production database yet.

## Solution: Run Migrations from Local Machine

Since Render shell is a paid feature, we'll run the migrations from your local machine.

### Step 1: Get Production Database URL

1. Go to Render Dashboard: https://dashboard.render.com
2. Click on your backend service: `zendbx-2-zpp9`
3. Go to "Environment" tab
4. Find and copy the `DATABASE_URL` value

It should look like:
```
postgresql://username:password@hostname.region.render.com:5432/database_name
```

### Step 2: Install psycopg2 (if not already installed)

```bash
pip install psycopg2-binary
```

### Step 3: Run the Migration Script

**Windows CMD:**
```cmd
set PRODUCTION_DATABASE_URL=postgresql://your-actual-database-url-here
python run_production_migrations.py
```

**Windows PowerShell:**
```powershell
$env:PRODUCTION_DATABASE_URL="postgresql://your-actual-database-url-here"
python run_production_migrations.py
```

**Linux/Mac:**
```bash
export PRODUCTION_DATABASE_URL="postgresql://your-actual-database-url-here"
python run_production_migrations.py
```

### Step 4: Configure Google OAuth Redirect URI

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Navigate to: APIs & Services → Credentials
3. Click on your OAuth 2.0 Client ID
4. Under "Authorized redirect URIs", add:
   ```
   https://zendbx-2-zpp9.onrender.com/api/auth/oauth/google/callback
   ```
5. Click "Save"

### Step 5: Configure OAuth Providers in Production

1. Go to: https://devapp.zendbx.in/login
2. Login with your admin account
3. Navigate to: Dashboard → Authentication → Providers
4. Configure Google OAuth:
   - **Client ID**: `901124681154-p268esfgttab0u2rglvj6f1ktv49dvrg.apps.googleusercontent.com`
   - **Client Secret**: (your Google OAuth client secret)
   - **Redirect URI**: `https://zendbx-2-zpp9.onrender.com/api/auth/oauth/google/callback`
   - **Scopes**: `openid email profile`
   - Enable the provider

### Step 6: Test OAuth Login

1. Go to: https://devapp.zendbx.in/login
2. Click "Continue with Google"
3. Complete the OAuth flow
4. You should be redirected back and logged in successfully

## What the Migration Does

The migration script creates these tables in production:

1. **oauth_provider_settings** - Stores OAuth provider configuration
2. **oauth_states** - Temporary storage for OAuth state tokens and PKCE verifiers
3. **oauth_audit_log** - Audit trail for OAuth operations

It also enhances the existing `oauth_connections` table with additional fields for token refresh and PKCE support.

## Troubleshooting

### Error: "relation 'oauth_connections' does not exist"

If you get this error, you need to run the base OAuth migration first:

```bash
# Run this migration first
psql $PRODUCTION_DATABASE_URL -f backend/database/add_oauth_tables.sql
```

Then run the migration script again.

### Error: "permission denied"

Make sure your database user has permission to create tables. The DATABASE_URL from Render should have the correct permissions.

### Error: "could not connect to server"

Check that:
1. Your DATABASE_URL is correct
2. Your IP is allowed to connect (Render allows connections from anywhere by default)
3. You have internet connectivity

## Verification

After running migrations, verify the tables exist:

```bash
psql $PRODUCTION_DATABASE_URL -c "\dt oauth*"
```

You should see:
- oauth_provider_settings
- oauth_connections
- oauth_states
- oauth_audit_log

## Next Steps After Setup

1. ✅ Migrations completed
2. ✅ Google redirect URI added
3. ✅ OAuth providers configured in UI
4. ✅ Test OAuth login
5. 🎉 OAuth is working in production!
