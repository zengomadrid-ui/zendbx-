# CORS Preflight Test Script for ZendBX (PowerShell)
# Tests OPTIONS requests to auth endpoints

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "ZendBX CORS PREFLIGHT TEST" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$BACKEND_URL = "https://api.zendbx.in"
$FRONTEND_ORIGIN = "http://localhost:5173"
$PROJECT_SLUG = "zenhire-718af5ef"
$PROJECT_ID = "718af5ef-8ffb-49ba-b54a-26cc37755d2c"

# Test 1: OPTIONS to signup endpoint
Write-Host "Test 1: OPTIONS /p/$PROJECT_SLUG/v1/auth/$PROJECT_ID/signup" -ForegroundColor Yellow
Write-Host "---------------------------------------"
$url1 = "$BACKEND_URL/p/$PROJECT_SLUG/v1/auth/$PROJECT_ID/signup"

try {
    $response = Invoke-WebRequest -Uri $url1 -Method Options `
        -Headers @{
            "Origin" = $FRONTEND_ORIGIN
            "Access-Control-Request-Method" = "POST"
            "Access-Control-Request-Headers" = "authorization,content-type"
        } -UseBasicParsing

    Write-Host "Status: $($response.StatusCode) $($response.StatusDescription)" -ForegroundColor Green
    Write-Host "Headers:"
    $response.Headers.GetEnumerator() | Where-Object { $_.Key -like "Access-Control-*" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}
Write-Host ""
Write-Host ""

# Test 2: OPTIONS to login endpoint
Write-Host "Test 2: OPTIONS /p/$PROJECT_SLUG/v1/auth/$PROJECT_ID/login" -ForegroundColor Yellow
Write-Host "---------------------------------------"
$url2 = "$BACKEND_URL/p/$PROJECT_SLUG/v1/auth/$PROJECT_ID/login"

try {
    $response = Invoke-WebRequest -Uri $url2 -Method Options `
        -Headers @{
            "Origin" = $FRONTEND_ORIGIN
            "Access-Control-Request-Method" = "POST"
            "Access-Control-Request-Headers" = "authorization,content-type"
        } -UseBasicParsing

    Write-Host "Status: $($response.StatusCode) $($response.StatusDescription)" -ForegroundColor Green
    Write-Host "Headers:"
    $response.Headers.GetEnumerator() | Where-Object { $_.Key -like "Access-Control-*" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}
Write-Host ""
Write-Host ""

# Test 3: OPTIONS to direct auth endpoint (no project prefix)
Write-Host "Test 3: OPTIONS /v1/auth/$PROJECT_ID/signup" -ForegroundColor Yellow
Write-Host "---------------------------------------"
$url3 = "$BACKEND_URL/v1/auth/$PROJECT_ID/signup"

try {
    $response = Invoke-WebRequest -Uri $url3 -Method Options `
        -Headers @{
            "Origin" = $FRONTEND_ORIGIN
            "Access-Control-Request-Method" = "POST"
            "Access-Control-Request-Headers" = "authorization,content-type"
        } -UseBasicParsing

    Write-Host "Status: $($response.StatusCode) $($response.StatusDescription)" -ForegroundColor Green
    Write-Host "Headers:"
    $response.Headers.GetEnumerator() | Where-Object { $_.Key -like "Access-Control-*" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}
Write-Host ""
Write-Host ""

# Expected Results Summary
Write-Host "======================================" -ForegroundColor Green
Write-Host "EXPECTED RESULTS:" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host "✅ HTTP/1.1 200 OK"
Write-Host "✅ Access-Control-Allow-Origin: $FRONTEND_ORIGIN"
Write-Host "✅ Access-Control-Allow-Methods: *"
Write-Host "✅ Access-Control-Allow-Headers: *"
Write-Host "✅ Access-Control-Allow-Credentials: true"
Write-Host ""
