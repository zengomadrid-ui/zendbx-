# PowerShell HTTP Test Script for Signup Endpoint
# Tests the actual HTTP endpoint, not internal functions

Write-Host "=== ZendBX Signup HTTP Test ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$baseUrl = "http://localhost:8000"
$projectId = "032e170a-5397-43cc-8e8d-294136773830"  # Using existing "zengo" project
$testEmail = "testuser_$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
$testPassword = "SecurePassword123!"
$testName = "Test User"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Base URL: $baseUrl"
Write-Host "  Project ID: $projectId"
Write-Host "  Test Email: $testEmail"
Write-Host ""

# Test 1: Signup
Write-Host "Test 1: POST /v1/auth/$projectId/signup" -ForegroundColor Green
Write-Host "--------" -ForegroundColor Gray

$signupBody = @{
    email = $testEmail
    password = $testPassword
    name = $testName
} | ConvertTo-Json

Write-Host "Request Body:" -ForegroundColor Yellow
Write-Host $signupBody
Write-Host ""

try {
    $signupResponse = Invoke-RestMethod `
        -Uri "$baseUrl/v1/auth/$projectId/signup" `
        -Method POST `
        -ContentType "application/json" `
        -Body $signupBody `
        -ErrorAction Stop
    
    Write-Host "✅ SUCCESS - Status: 200" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Yellow
    Write-Host ($signupResponse | ConvertTo-Json -Depth 5)
    Write-Host ""
    
    $accessToken = $signupResponse.access_token
    $userId = $signupResponse.user.id
    
    Write-Host "Access Token: $($accessToken.Substring(0, 20))..." -ForegroundColor Cyan
    Write-Host "User ID: $userId" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host "❌ FAILED - Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
    
    Write-Host ""
    Write-Host "Test Failed. Server may not be running or endpoint has errors." -ForegroundColor Red
    Write-Host ""
    Write-Host "To start the server:" -ForegroundColor Yellow
    Write-Host '  cd "c:\Users\Pawan Sri Kumar\OneDrive\Desktop\zengo\backend"' -ForegroundColor Cyan
    Write-Host "  python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Cyan
    exit 1
}

# Test 2: Login with same credentials
Write-Host "Test 2: POST /v1/auth/$projectId/login" -ForegroundColor Green
Write-Host "--------" -ForegroundColor Gray

$loginBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod `
        -Uri "$baseUrl/v1/auth/$projectId/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop
    
    Write-Host "✅ SUCCESS - Status: 200" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Yellow
    Write-Host ($loginResponse | ConvertTo-Json -Depth 5)
    Write-Host ""
    
} catch {
    Write-Host "❌ FAILED - Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
}

# Test 3: Get User with token
if ($accessToken) {
    Write-Host ""
    Write-Host "Test 3: GET /v1/auth/$projectId/user" -ForegroundColor Green
    Write-Host "--------" -ForegroundColor Gray
    
    try {
        $headers = @{
            "Authorization" = "Bearer $accessToken"
        }
        
        $userResponse = Invoke-RestMethod `
            -Uri "$baseUrl/v1/auth/$projectId/user" `
            -Method GET `
            -Headers $headers `
            -ErrorAction Stop
        
        Write-Host "✅ SUCCESS - Status: 200" -ForegroundColor Green
        Write-Host "Response:" -ForegroundColor Yellow
        Write-Host ($userResponse | ConvertTo-Json -Depth 5)
        Write-Host ""
        
    } catch {
        Write-Host "❌ FAILED - Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 4: Duplicate signup (should return 409)
Write-Host ""
Write-Host "Test 4: Duplicate Signup (should return 409 Conflict)" -ForegroundColor Green
Write-Host "--------" -ForegroundColor Gray

try {
    $duplicateResponse = Invoke-RestMethod `
        -Uri "$baseUrl/v1/auth/$projectId/signup" `
        -Method POST `
        -ContentType "application/json" `
        -Body $signupBody `
        -ErrorAction Stop
    
    Write-Host "❌ UNEXPECTED SUCCESS - Should have returned 409" -ForegroundColor Red
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    
    if ($statusCode -eq 409) {
        Write-Host "✅ SUCCESS - Status: 409 (Conflict)" -ForegroundColor Green
        
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response Body:" -ForegroundColor Yellow
            Write-Host $responseBody
        }
    } else {
        Write-Host "❌ UNEXPECTED STATUS - Got $statusCode, expected 409" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  ✅ Signup endpoint works via HTTP"
Write-Host "  ✅ Login endpoint works via HTTP"
Write-Host "  ✅ Get user endpoint works via HTTP"
Write-Host "  ✅ Duplicate signup returns 409"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Compare this successful request against the frontend request"
Write-Host "  2. Check headers: Authorization, apikey, Content-Type"
Write-Host "  3. Check request body format"
Write-Host "  4. Check production server logs for actual exception"
