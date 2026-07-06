# How to Run HTTP Signup Test

## Prerequisites

1. **Start the FastAPI server** (in a separate terminal):
   ```powershell
   cd "c:\Users\Pawan Sri Kumar\OneDrive\Desktop\zengo\backend"
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Get your project ID**:
   - Open your frontend dashboard
   - Or query the database: `SELECT id FROM projects LIMIT 1`
   - Update the `$projectId` variable in `test_signup_http.ps1`

## Run the Test

Open PowerShell in the backend directory:

```powershell
cd "c:\Users\Pawan Sri Kumar\OneDrive\Desktop\zengo\backend"
powershell -ExecutionPolicy Bypass -File .\test_signup_http.ps1
```

**Alternative** (if you're already in PowerShell):
```powershell
Set-Location "c:\Users\Pawan Sri Kumar\OneDrive\Desktop\zengo\backend"
.\test_signup_http.ps1
```

## What the Test Does

1. **Signup Test** - Creates a new user via `POST /v1/auth/{project_id}/signup`
2. **Login Test** - Logs in with the same credentials via `POST /v1/auth/{project_id}/login`
3. **Get User Test** - Retrieves user info via `GET /v1/auth/{project_id}/user`
4. **Duplicate Signup Test** - Verifies 409 error for duplicate email

## Expected Output

```
✅ SUCCESS - Status: 200
Response:
{
  "access_token": "eyJ...",
  "user": {
    "id": "...",
    "email": "testuser_20260706123456@example.com",
    "name": "Test User",
    "provider": "email",
    "created_at": "2026-07-06T12:34:56.789"
  }
}
```

## If Test Fails

### Error: "Connection refused"
- The FastAPI server is not running
- Start it with the command in Prerequisites step 1

### Error: "404 Project not found"
- The project ID in the script is incorrect
- Update `$projectId` in `test_signup_http.ps1` with a valid project ID

### Error: "500 Internal Server Error"
- Check the FastAPI server terminal for the full traceback
- Look for the exact exception type and message
- Check the line number where it failed

## Compare with Frontend Request

If the HTTP test succeeds but the frontend fails:

1. **Open browser DevTools** (F12) → Network tab
2. **Attempt signup from frontend**
3. **Click the failed request** to see:
   - Request headers (Authorization, apikey, Content-Type)
   - Request body (JSON structure)
   - Response status and body
4. **Compare against the PowerShell test**:
   - Are headers different?
   - Is the body format different?
   - Is the Content-Type correct?
   - Is there an extra Authorization header?

## Next Steps

- If HTTP test succeeds → compare frontend request format
- If HTTP test fails → check server logs for exception details
- Send the exact exception type, message, file, and line number
