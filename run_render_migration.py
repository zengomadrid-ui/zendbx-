"""
Run migration on Render production database
"""
import requests

# Your Render backend URL
RENDER_URL = "https://zendbx-2-zpp9.onrender.com"  # Actual Render URL

print("🔄 Running storage migration on Render production database...")
print(f"URL: {RENDER_URL}/api/admin/run-storage-migration")

try:
    response = requests.post(f"{RENDER_URL}/api/admin/run-storage-migration", timeout=30)
    
    if response.status_code == 200:
        print("✅ Migration completed successfully!")
        print(response.json())
    else:
        print(f"❌ Migration failed with status {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"❌ Error: {e}")
