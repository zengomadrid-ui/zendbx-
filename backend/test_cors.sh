#!/bin/bash

# CORS Preflight Test Script for ZendBX
# Tests OPTIONS requests to auth endpoints

echo "======================================"
echo "ZendBX CORS PREFLIGHT TEST"
echo "======================================"
echo ""

# Configuration
BACKEND_URL="https://zendbx-2-zpp9.onrender.com"
FRONTEND_ORIGIN="http://localhost:5173"
PROJECT_SLUG="zenhire-718af5ef"
PROJECT_ID="718af5ef-8ffb-49ba-b54a-26cc37755d2c"

# Test 1: OPTIONS to signup endpoint
echo "Test 1: OPTIONS /p/${PROJECT_SLUG}/v1/auth/${PROJECT_ID}/signup"
echo "---------------------------------------"
curl -X OPTIONS \
  "${BACKEND_URL}/p/${PROJECT_SLUG}/v1/auth/${PROJECT_ID}/signup" \
  -H "Origin: ${FRONTEND_ORIGIN}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -i
echo ""
echo ""

# Test 2: OPTIONS to login endpoint  
echo "Test 2: OPTIONS /p/${PROJECT_SLUG}/v1/auth/${PROJECT_ID}/login"
echo "---------------------------------------"
curl -X OPTIONS \
  "${BACKEND_URL}/p/${PROJECT_SLUG}/v1/auth/${PROJECT_ID}/login" \
  -H "Origin: ${FRONTEND_ORIGIN}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -i
echo ""
echo ""

# Test 3: OPTIONS to direct auth endpoint (no project prefix)
echo "Test 3: OPTIONS /v1/auth/${PROJECT_ID}/signup"
echo "---------------------------------------"
curl -X OPTIONS \
  "${BACKEND_URL}/v1/auth/${PROJECT_ID}/signup" \
  -H "Origin: ${FRONTEND_ORIGIN}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -i
echo ""
echo ""

# Expected Results Summary
echo "======================================"
echo "EXPECTED RESULTS:"
echo "======================================"
echo "✅ HTTP/1.1 200 OK"
echo "✅ Access-Control-Allow-Origin: ${FRONTEND_ORIGIN}"
echo "✅ Access-Control-Allow-Methods: *"
echo "✅ Access-Control-Allow-Headers: *"
echo "✅ Access-Control-Allow-Credentials: true"
echo ""
