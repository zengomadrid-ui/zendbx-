"""
Fix RLS BYPASS for all project roles
Removes BYPASSRLS privilege from project roles to enforce RLS policies
"""
import requests
import json

# Production backend
BACKEND_URL = "https://zendbx-2-zpp9.onrender.com"
SECRET_KEY = "zendbx-prod-secret-8f4d2a9c7b1e5f6d3a8c1b9"

def fix_rls_bypass():
    """Remove BYPASSRLS from all project roles"""
    
    print("=" * 80)
    print("FIXING RLS BYPASS ON PROJECT ROLES")
    print("=" * 80)
    print(f"Backend: {BACKEND_URL}")
    print(f"Endpoint: /admin/fix-rls-bypass")
    print("This will remove BYPASSRLS privilege from all project roles")
    print("=" * 80)
    
    input("Press Enter to continue or Ctrl+C to cancel...")
    
    print("\nSending request...")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/fix-rls-bypass",
            headers={
                "Content-Type": "application/json",
                "x-admin-secret": SECRET_KEY
            },
            timeout=60
        )
        
        print(f"Status Code: {response.status_code}")
        print("=" * 80)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ SUCCESS")
            print("=" * 80)
            print(json.dumps(result, indent=2))
            print("=" * 80)
            print(f"\n✅ Fixed {result['fixed']} project roles")
            print(f"✅ {result['already_ok']} roles already correct")
            if result['failed'] > 0:
                print(f"⚠️  {result['failed']} roles failed")
        else:
            print("❌ ERROR")
            print("=" * 80)
            print(response.text)
            
    except Exception as e:
        print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    fix_rls_bypass()
