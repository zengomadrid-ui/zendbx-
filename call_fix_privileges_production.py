"""
Call the production API endpoint to fix all project privileges
Works with Render free tier (no shell access needed)
"""
import requests
import json

# Production backend URL
BACKEND_URL = "https://zendbx-2-zpp9.onrender.com"  # Update if different
SECRET_KEY = "zendbx-prod-secret-8f4d2a9c7b1e5f6d3a8c1b9"  # Your production SECRET_KEY

print("=" * 80)
print("FIXING PRODUCTION SQL EDITOR PRIVILEGES")
print("=" * 80)
print(f"\nBackend: {BACKEND_URL}")
print(f"Endpoint: /admin/fix-all-privileges")
print("\nThis will grant ALL privileges to all project roles")
print("=" * 80)

input("\nPress Enter to continue or Ctrl+C to cancel...")

try:
    print("\nSending request...")
    
    response = requests.post(
        f"{BACKEND_URL}/admin/fix-all-privileges",
        headers={
            "X-Admin-Secret": SECRET_KEY,
            "Content-Type": "application/json"
        },
        timeout=120
    )
    
    print(f"Status Code: {response.status_code}\n")
    
    if response.status_code == 200:
        data = response.json()
        
        print("=" * 80)
        print("✅ SUCCESS!")
        print("=" * 80)
        print(f"Status: {data.get('status')}")
        print(f"Message: {data.get('message')}")
        print(f"\nTotal projects: {data.get('total_projects')}")
        print(f"Fixed: {data.get('fixed')}")
        print(f"Already OK: {data.get('already_ok')}")
        print(f"Failed: {data.get('failed')}")
        
        if data.get('projects'):
            print(f"\nProject Details:")
            for proj in data['projects']:
                status_icon = {
                    'fixed': '✅',
                    'already_ok': 'ℹ️',
                    'error': '❌',
                    'verification_failed': '⚠️'
                }.get(proj['status'], '❓')
                
                print(f"  {status_icon} {proj['name']}: {proj['status']}")
                if 'error' in proj:
                    print(f"     Error: {proj['error']}")
        
        print("\n" + "=" * 80)
        
        if data.get('failed', 0) == 0:
            print("🎉 ALL PROJECTS FIXED!")
            print("\nSQL Editor is now working on devapp.zendbx.in!")
            print("\nTest it:")
            print("  1. Open https://devapp.zendbx.in")
            print("  2. Select any project")
            print("  3. Go to SQL Editor")
            print("  4. Run: CREATE TABLE test (id INT);")
            print("  5. Should work without permission errors!")
        else:
            print(f"⚠️  {data.get('failed')} projects had issues")
            print("Check the error details above")
        
        print("=" * 80)
        
    elif response.status_code == 403:
        print("=" * 80)
        print("❌ AUTHENTICATION FAILED")
        print("=" * 80)
        print("The SECRET_KEY is incorrect.")
        print("Update SECRET_KEY in this script with your production value.")
        
    else:
        print("=" * 80)
        print("❌ ERROR")
        print("=" * 80)
        try:
            error_data = response.json()
            print(json.dumps(error_data, indent=2))
        except:
            print(response.text)
    
except requests.exceptions.Timeout:
    print("\n❌ Request timed out (this is normal for many projects)")
    print("Wait 1 minute and check if SQL Editor works")
    
except requests.exceptions.ConnectionError as e:
    print(f"\n❌ Connection failed: {e}")
    print("\nPossible causes:")
    print("  1. Backend URL is incorrect")
    print("  2. Backend is not deployed yet")
    print("  3. Network issue")
    
except Exception as e:
    print(f"\n❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
