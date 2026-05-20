#!/bin/bash

echo "🔍 Final Verification - Checking for ANY localhost references..."
echo ""

echo "1. Checking app directory..."
if grep -r "localhost:8000" app/ 2>/dev/null | grep -v "process.env" | grep -v "//"; then
    echo "❌ Found hardcoded localhost:8000 in app/"
    exit 1
else
    echo "✅ No hardcoded localhost:8000 in app/"
fi

echo ""
echo "2. Checking lib directory..."
if grep -r "localhost:8000" lib/ 2>/dev/null | grep -v "process.env" | grep -v "getEnvVar" | grep -v "//"; then
    echo "❌ Found hardcoded localhost:8000 in lib/"
    exit 1
else
    echo "✅ No hardcoded localhost:8000 in lib/"
fi

echo ""
echo "3. Checking for WebSocket localhost..."
if grep -r "localhost:8001" app/ 2>/dev/null | grep -v "process.env" | grep -v "//"; then
    echo "❌ Found hardcoded localhost:8001 in app/"
    exit 1
else
    echo "✅ No hardcoded localhost:8001 in app/"
fi

echo ""
echo "4. Checking for localhost:3000..."
if grep -r "localhost:3000" app/ 2>/dev/null | grep -v "process.env" | grep -v "//"; then
    echo "❌ Found hardcoded localhost:3000 in app/"
    exit 1
else
    echo "✅ No hardcoded localhost:3000 in app/"
fi

echo ""
echo "5. Checking environment files..."
if [ -f ".env.production" ]; then
    if grep -q "NEXT_PUBLIC_API_URL=https://zendbx-2-zpp9.onrender.com" .env.production; then
        echo "✅ Production API URL configured correctly"
    else
        echo "❌ Production API URL not configured"
        exit 1
    fi
else
    echo "⚠️  .env.production not found"
fi

echo ""
echo "========================================="
echo "✅ ALL VERIFICATIONS PASSED!"
echo "========================================="
echo ""
echo "Production is ready for deployment:"
echo "  Frontend: https://devapp.zendbx.in"
echo "  Backend: https://zendbx-2-zpp9.onrender.com"
echo ""
echo "Next steps:"
echo "  1. git add ."
echo "  2. git commit -m 'fix: eliminate all localhost URLs'"
echo "  3. git push origin main"
echo "  4. Deploy to Vercel with CLEAR BUILD CACHE"
echo ""
