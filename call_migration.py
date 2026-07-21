import requests
import json

BACKEND_URL = "https://zendbx-2-zpp9.onrender.com"
SECRET_KEY = "zendbx-prod-secret-8f4d2a9c7b1e5f6d3a8c1b9"

print("="*70)
print("CALLING EMERGENCY MIGRATION ENDPOINT")
print("="*70)
print(f"\nBackend URL: {BACKEND_URL}")
print(f"Endpoint: /emergency/apply-migration-003")
print(f"Secret Key: {SECRET_KEY[:10]}...{SECRET_KEY[-5:]}")
print("\nSending request...")

try:
    response = requests.post(
        f"{BACKEND_URL}/emergency/apply-migration-003",
        headers={
            "X-Admin-Secret": SECRET_KEY,
            "Content-Type": "application/json"
        },
        timeout=30
    )
    
    print(f"\nStatus Code: {response.status_code}")
    print("="*70)
    
    if response.status_code == 200:
        data = response.json()
        print("\n✅ SUCCESS!")
        print("="*70)
        print(f"Status: {data.get('status')}")
        print(f"Message: {data.get('message')}")
        print(f"Table exists after: {data.get('table_exists_after')}")
        print(f"Project count: {data.get('project_count')}")
        
        if data.get('steps'):
            print("\nMigration Steps:")
            for step in data['steps']:
                print(f"  {step}")
        
        print("\n" + "="*70)
        print("🎉 Table Editor should now work!")
        print("Refresh your frontend and try opening the Table Editor.")
        print("="*70)
        
    else:
        print("\n❌ ERROR")
        print("="*70)
        try:
            error_data = response.json()
            print(json.dumps(error_data, indent=2))
        except:
            print(response.text)
        
        if response.status_code == 403:
            print("\n⚠️  Authentication failed - SECRET_KEY might be incorrect")
        elif response.status_code == 404:
            print("\n⚠️  Endpoint not found - backend might not be deployed yet")
    
except requests.exceptions.Timeout:
    print("\n❌ Request timed out")
    print("The migration might still be running. Wait 30 seconds and check Table Editor.")
    
except requests.exceptions.ConnectionError:
    print("\n❌ Connection failed")
    print("Backend might be down or still deploying. Check Render dashboard.")
    
except Exception as e:
    print(f"\n❌ Unexpected error: {e}")
