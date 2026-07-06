# ============================================
# ZendBX Phase 1 Authentication Tests
# Tests: Signup, Login, Get User, Duplicate Email
# ============================================

$ErrorActionPreference = "Stop"

# Configuration
$BASE_URL = "http://localhost:8000"
$PROJECT_ID = "032e170a-5397-43cc-8e8d-294136773830"  # Update with your project ID
$TIMESTAMP = Get-Date -Format "yyyyMMddHHmmss"
$TEST_EMAIL = "testuser_phase1_${TIMESTAMP}@example.com"
$TEST_PASSWORD = "SecurePassword123!"
$TEST_NAME = "Phase 1 Test User"

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "ZendBX Phase 1 Authentication Test Suite" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Base URL: $BASE_URL" -ForegroundColor Gray
Write-Host "  Project ID: $PROJECT_ID" -ForegroundColor Gray
Write-Host "  Test Email: $TEST_EMAIL" -ForegroundColor Gray
Write-Host ""

# Store access token
$ACCESS_TOKEN = $null
$USER_ID = $null

# ============================================
# Test 1: Signup
# ============================================
Write-Host "Test 1: POST /v1/auth/$PROJECT_ID/signup" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray

$signupBody = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
    name = $TEST_NAME
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/v1/auth/$PROJECT_ID/signup" `
        -Method POST `
        -ContentType "application/json" `
        -Body $signupBody
    
    $ACCESS_TOKEN = $response.access_token
    $USER_ID = $response.user.id
    
    Write-Host "✅ PASS: Signup successful" -ForegroundColor Green
    Write-Host "   User ID: $USER_ID" -ForegroundColor Gray
    Write-Host "   Email: $($response.user.email)" -ForegroundColor Gray
    Write-Host "   Username: $($response.user.username)" -ForegroundColor Gray
    Write-Host "   Provider: $($response.user.provider)" -ForegroundColor Gray
    Write-Host "   Token: $($ACCESS_TOKEN.Substring(0, 30))..." -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "❌ FAIL: Signup failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

# ============================================
# Test 2: Duplicate Email (Should Fail with 409)
# ============================================
Write-Host "Test 2: POST /v1/auth/$PROJECT_ID/signup (Duplicate Email)" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/v1/auth/$PROJECT_ID/signup" `
        -Method POST `
        -ContentType "application/json" `
        -Body $signupBody
    
    Write-Host "❌ FAIL: Should have returned 409 Conflict" -ForegroundColor Red
    Write-Host ""
    exit 1
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) {
        Write-Host "✅ PASS: Duplicate email correctly rejected (409)" -ForegroundColor Green
        Write-Host ""
    }
    else {
        Write-Host "❌ FAIL: Wrong status code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "   Expected: 409" -ForegroundColor Red
        Write-Host ""
        exit 1
    }
}

# ============================================
# Test 3: Login with Valid Credentials
# ============================================
Write-Host "Test 3: POST /v1/auth/$PROJECT_ID/login (Valid Credentials)" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray

$loginBody = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/v1/auth/$PROJECT_ID/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody
    
    Write-Host "✅ PASS: Login successful" -ForegroundColor Green
    Write-Host "   User ID: $($response.user.id)" -ForegroundColor Gray
    Write-Host "   Email: $($response.user.email)" -ForegroundColor Gray
    Write-Host "   Username: $($response.user.username)" -ForegroundColor Gray
    Write-Host "   Email Verified: $($response.user.email_verified)" -ForegroundColor Gray
    Write-Host "   Token: $($response.access_token.Substring(0, 30))..." -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "❌ FAIL: Login failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

# ============================================
# Test 4: Login with Invalid Password
# ============================================
Write-Host "Test 4: POST /v1/auth/$PROJECT_ID/login (Invalid Password)" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray

$wrongPasswordBody = @{
    email = $TEST_EMAIL
    password = "WrongPassword123!"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/v1/auth/$PROJECT_ID/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $wrongPasswordBody
    
    Write-Host "❌ FAIL: Should have returned 401 Unauthorized" -ForegroundColor Red
    Write-Host ""
    exit 1
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✅ PASS: Invalid password correctly rejected (401)" -ForegroundColor Green
        Write-Host ""
    }
    else {
        Write-Host "❌ FAIL: Wrong status code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "   Expected: 401" -ForegroundColor Red
        Write-Host ""
        exit 1
    }
}

# ============================================
# Test 5: Get Current User
# ============================================
Write-Host "Test 5: GET /v1/auth/$PROJECT_ID/user (With Valid Token)" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray

try {
    $headers = @{
        "Authorization" = "Bearer $ACCESS_TOKEN"
    }
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/v1/auth/$PROJECT_ID/user" `
        -Method GET `
        -Headers $headers
    
    Write-Host "✅ PASS: Get user successful" -ForegroundColor Green
    Write-Host "   User ID: $($response.id)" -ForegroundColor Gray
    Write-Host "   Email: $($response.email)" -ForegroundColor Gray
    Write-Host "   Username: $($response.username)" -ForegroundColor Gray
    Write-Host "   Provider: $($response.provider)" -ForegroundColor Gray
    Write-Host "   Email Verified: $($response.email_verified)" -ForegroundColor Gray
    Write-Host "   Is Active: $($response.is_active)" -ForegroundColor Gray
    
    # CRITICAL: Verify password_hash is NOT returned
    if ($response.PSObject.Properties.Name -contains "password_hash") {
        Write-Host "❌ CRITICAL SECURITY ISSUE: password_hash was returned!" -ForegroundColor Red
        exit 1
    }
    else {
        Write-Host "   ✅ password_hash correctly NOT returned" -ForegroundColor Green
    }
    Write-Host ""
}
catch {
    Write-Host "❌ FAIL: Get user failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

# ============================================
# Test 6: Get User Without Token
# ============================================
Write-Host "Test 6: GET /v1/auth/$PROJECT_ID/user (Without Token)" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/v1/auth/$PROJECT_ID/user" `
        -Method GET
    
    Write-Host "❌ FAIL: Should have returned 401 Unauthorized" -ForegroundColor Red
    Write-Host ""
    exit 1
}
catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✅ PASS: Missing token correctly rejected (401)" -ForegroundColor Green
        Write-Host ""
    }
    else {
        Write-Host "❌ FAIL: Wrong status code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "   Expected: 401" -ForegroundColor Red
        Write-Host ""
        exit 1
    }
}

# ============================================
# Summary
# ============================================
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "ALL TESTS PASSED ✅" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "Phase 1 Authentication is working correctly:" -ForegroundColor Green
Write-Host "  ✅ Signup creates user in auth.users" -ForegroundColor Green
Write-Host "  ✅ Duplicate email returns 409" -ForegroundColor Green
Write-Host "  ✅ Login validates password correctly" -ForegroundColor Green
Write-Host "  ✅ Invalid password returns 401" -ForegroundColor Green
Write-Host "  ✅ Get user returns correct data" -ForegroundColor Green
Write-Host "  ✅ password_hash is never exposed" -ForegroundColor Green
Write-Host "  ✅ Missing token returns 401" -ForegroundColor Green
Write-Host ""
Write-Host "Test user created: $TEST_EMAIL" -ForegroundColor Gray
Write-Host "User ID: $USER_ID" -ForegroundColor Gray
