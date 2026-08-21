"""
Comprehensive test suite for Iterative AutoFix feature

Tests:
1. Single column error (created_on → created_at)
2. Four-column error (main iterative test)
3. Unfixable error (should return HTTP 400)
4. Valid query (no AutoFix needed)
5. Regression test (customer_name never → customer_id)
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"
PROJECT_ID = None  # Will be set dynamically
API_KEY = None      # Will be set dynamically

def login_and_get_token():
    """Login and get authentication token"""
    print("\n" + "="*80)
    print("AUTHENTICATION")
    print("="*80)
    
    # Use the account we just created
    test_account = {"email": "testuser999@example.com", "password": "Test123!"}
    
    print(f"Logging in with: {test_account['email']}")
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=test_account
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("access_token")
        print(f"✅ Login successful")
        print(f"   Token: {token[:30]}...")
        return token
    
    print(f"❌ Login failed: {response.text}")
    return None

def get_project_id(token):
    """Get first available project ID or create one"""
    print("\n" + "="*80)
    print("GET PROJECT")
    print("="*80)
    
    response = requests.get(
        f"{BASE_URL}/api/projects",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to get projects: {response.text}")
        return None
    
    projects = response.json()
    
    if not projects:
        print("No projects found, creating test project...")
        
        # Create a test project
        create_response = requests.post(
            f"{BASE_URL}/api/projects",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "AutoFix Test Project",
                "description": "Project for testing iterative AutoFix feature"
            }
        )
        
        if create_response.status_code in [200, 201]:
            project = create_response.json()
            project_id = project["id"]
            print(f"✅ Created project: {project['name']}")
            print(f"   ID: {project_id}")
            return project_id
        else:
            print(f"❌ Failed to create project: {create_response.text}")
            return None
    
    project = projects[0]
    project_id = project["id"]
    print(f"✅ Using project: {project['name']}")
    print(f"   ID: {project_id}")
    return project_id

def ensure_customers_table(token, project_id):
    """Create customers table if it doesn't exist"""
    print("\n" + "="*80)
    print("SETUP: Create customers table")
    print("="*80)
    
    create_sql = """
    CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    insert_sql = """
    INSERT INTO customers (name, email, phone, created_at)
    VALUES 
        ('John Doe', 'john@example.com', '555-0001', NOW() - INTERVAL '1 day'),
        ('Jane Smith', 'jane@example.com', '555-0002', NOW() - INTERVAL '2 days'),
        ('Bob Johnson', 'bob@example.com', '555-0003', NOW() - INTERVAL '3 days')
    ON CONFLICT (email) DO NOTHING;
    """
    
    # Create table
    response = requests.post(
        f"{BASE_URL}/api/projects/{project_id}/query",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "sql": create_sql,
            "question": "Create customers table",
            "enable_autofix": False
        }
    )
    
    if response.status_code not in [200, 201]:
        print(f"❌ Failed to create table: {response.text}")
        return False
    
    print("✅ Customers table created/verified")
    
    # Insert test data
    response = requests.post(
        f"{BASE_URL}/api/projects/{project_id}/query",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "sql": insert_sql,
            "question": "Insert test data",
            "enable_autofix": False
        }
    )
    
    if response.status_code not in [200, 201]:
        print(f"❌ Failed to insert data: {response.text}")
        return False
    
    print("✅ Test data inserted")
    return True

def test_single_column_error(token, project_id):
    """
    TEST 1: Single column error
    Query: SELECT c.name, c.email, c.created_on FROM customers c;
    Expected: created_on → created_at
    Expected: HTTP 200, auto_fixed=True, FIXED_AND_VERIFIED
    """
    print("\n" + "="*80)
    print("TEST 1: Single Column Error")
    print("="*80)
    
    sql = "SELECT c.name, c.email, c.created_on FROM customers c;"
    print(f"SQL: {sql}")
    
    response = requests.post(
        f"{BASE_URL}/api/projects/{project_id}/query",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "sql": sql,
            "question": "Test single column error",
            "enable_autofix": True
        }
    )
    
    print(f"\nStatus Code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ TEST 1 FAILED: Expected HTTP 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    
    print(f"auto_fixed: {data.get('auto_fixed')}")
    print(f"verification_status: {data.get('verification_status')}")
    print(f"original_sql: {data.get('original_sql', 'N/A')[:80]}...")
    print(f"fixed_sql: {data.get('fixed_sql', 'N/A')[:80]}...")
    print(f"rows: {len(data.get('rows', []))}")
    
    # Validate
    if not data.get('auto_fixed'):
        print("❌ TEST 1 FAILED: auto_fixed should be True")
        return False
    
    if data.get('verification_status') != 'FIXED_AND_VERIFIED':
        print(f"❌ TEST 1 FAILED: verification_status should be FIXED_AND_VERIFIED, got {data.get('verification_status')}")
        return False
    
    if 'created_at' not in data.get('fixed_sql', ''):
        print("❌ TEST 1 FAILED: fixed_sql should contain 'created_at'")
        return False
    
    if len(data.get('rows', [])) == 0:
        print("❌ TEST 1 FAILED: Should return rows")
        return False
    
    print("✅ TEST 1 PASSED")
    return True

def test_four_column_error(token, project_id):
    """
    TEST 2: Four-column error (MAIN ITERATIVE TEST)
    Query: SELECT c.customer_name, c.email_address, c.phone_number, c.created_on FROM customers c ORDER BY c.created_on DESC;
    Expected iterations:
    - Iteration 1: customer_name → name
    - Iteration 2: email_address → email
    - Iteration 3: phone_number → phone
    - Iteration 4: created_on → created_at
    Expected: HTTP 200, auto_fixed=True, FIXED_AND_VERIFIED
    """
    print("\n" + "="*80)
    print("TEST 2: Four-Column Error (MAIN ITERATIVE TEST)")
    print("="*80)
    
    sql = """SELECT
c.customer_name,
c.email_address,
c.phone_number,
c.created_on
FROM customers c
ORDER BY c.created_on DESC;"""
    
    print(f"SQL:\n{sql}")
    
    response = requests.post(
        f"{BASE_URL}/api/projects/{project_id}/query",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "sql": sql,
            "question": "Test four column error",
            "enable_autofix": True
        }
    )
    
    print(f"\nStatus Code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ TEST 2 FAILED: Expected HTTP 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    
    print(f"auto_fixed: {data.get('auto_fixed')}")
    print(f"verification_status: {data.get('verification_status')}")
    print(f"original_sql:\n{data.get('original_sql', 'N/A')}")
    print(f"fixed_sql:\n{data.get('fixed_sql', 'N/A')}")
    print(f"rows: {len(data.get('rows', []))}")
    
    # Validate
    if not data.get('auto_fixed'):
        print("❌ TEST 2 FAILED: auto_fixed should be True")
        return False
    
    if data.get('verification_status') != 'FIXED_AND_VERIFIED':
        print(f"❌ TEST 2 FAILED: verification_status should be FIXED_AND_VERIFIED, got {data.get('verification_status')}")
        return False
    
    fixed_sql = data.get('fixed_sql', '')
    
    # Check all transformations are present
    required_columns = ['name', 'email', 'phone', 'created_at']
    for col in required_columns:
        if col not in fixed_sql:
            print(f"❌ TEST 2 FAILED: fixed_sql should contain '{col}'")
            print(f"fixed_sql: {fixed_sql}")
            return False
    
    # Check original columns are NOT present
    forbidden_columns = ['customer_name', 'email_address', 'phone_number', 'created_on']
    for col in forbidden_columns:
        if col in fixed_sql:
            print(f"❌ TEST 2 FAILED: fixed_sql should NOT contain '{col}'")
            print(f"fixed_sql: {fixed_sql}")
            return False
    
    if len(data.get('rows', [])) == 0:
        print("❌ TEST 2 FAILED: Should return rows")
        return False
    
    print("✅ TEST 2 PASSED")
    return True

def test_unfixable_error(token, project_id):
    """
    TEST 3: Unfixable error
    Query: SELECT c.nonexistent_xyz_123 FROM customers c;
    Expected: HTTP 400
    """
    print("\n" + "="*80)
    print("TEST 3: Unfixable Error")
    print("="*80)
    
    sql = "SELECT c.nonexistent_xyz_123 FROM customers c;"
    print(f"SQL: {sql}")
    
    response = requests.post(
        f"{BASE_URL}/api/projects/{project_id}/query",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "sql": sql,
            "question": "Test unfixable error",
            "enable_autofix": True
        }
    )
    
    print(f"\nStatus Code: {response.status_code}")
    
    if response.status_code != 400:
        print(f"❌ TEST 3 FAILED: Expected HTTP 400, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    print("✅ TEST 3 PASSED: Correctly returned HTTP 400 for unfixable error")
    return True

def test_valid_query(token, project_id):
    """
    TEST 4: Valid query (no AutoFix needed)
    Query: SELECT c.name, c.email, c.created_at FROM customers c;
    Expected: HTTP 200, auto_fixed=False
    """
    print("\n" + "="*80)
    print("TEST 4: Valid Query (No AutoFix Needed)")
    print("="*80)
    
    sql = "SELECT c.name, c.email, c.created_at FROM customers c;"
    print(f"SQL: {sql}")
    
    response = requests.post(
        f"{BASE_URL}/api/projects/{project_id}/query",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "sql": sql,
            "question": "Test valid query",
            "enable_autofix": True
        }
    )
    
    print(f"\nStatus Code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ TEST 4 FAILED: Expected HTTP 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    
    print(f"auto_fixed: {data.get('auto_fixed')}")
    print(f"rows: {len(data.get('rows', []))}")
    
    if data.get('auto_fixed'):
        print("❌ TEST 4 FAILED: auto_fixed should be False for valid query")
        return False
    
    if len(data.get('rows', [])) == 0:
        print("❌ TEST 4 FAILED: Should return rows")
        return False
    
    print("✅ TEST 4 PASSED")
    return True

def test_regression_customer_id(token, project_id):
    """
    TEST 5: Regression test
    Query: SELECT c.customer_name FROM customers c;
    Expected: customer_name → name (NOT customer_id)
    Expected: HTTP 200, auto_fixed=True, FIXED_AND_VERIFIED
    """
    print("\n" + "="*80)
    print("TEST 5: Regression Test (customer_name should NOT map to customer_id)")
    print("="*80)
    
    sql = "SELECT c.customer_name FROM customers c;"
    print(f"SQL: {sql}")
    
    response = requests.post(
        f"{BASE_URL}/api/projects/{project_id}/query",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "sql": sql,
            "question": "Test regression",
            "enable_autofix": True
        }
    )
    
    print(f"\nStatus Code: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ TEST 5 FAILED: Expected HTTP 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    
    print(f"auto_fixed: {data.get('auto_fixed')}")
    print(f"verification_status: {data.get('verification_status')}")
    print(f"fixed_sql: {data.get('fixed_sql', 'N/A')}")
    
    fixed_sql = data.get('fixed_sql', '')
    
    # Check that customer_name was mapped to 'name', NOT 'customer_id' or 'id'
    if 'customer_id' in fixed_sql.lower():
        print("❌ TEST 5 FAILED: customer_name was incorrectly mapped to customer_id")
        return False
    
    if '.id' in fixed_sql.lower() and 'name' not in fixed_sql.lower():
        print("❌ TEST 5 FAILED: customer_name was incorrectly mapped to id")
        return False
    
    if 'name' not in fixed_sql.lower():
        print("❌ TEST 5 FAILED: customer_name should be mapped to 'name'")
        return False
    
    print("✅ TEST 5 PASSED: customer_name correctly mapped to 'name'")
    return True

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("ITERATIVE AUTOFIX - COMPREHENSIVE TEST SUITE")
    print("="*80)
    
    # Step 1: Login
    token = login_and_get_token()
    if not token:
        print("\n❌ Cannot proceed without authentication")
        return
    
    # Step 2: Get project
    project_id = get_project_id(token)
    if not project_id:
        print("\n❌ Cannot proceed without project")
        return
    
    # Step 3: Setup
    if not ensure_customers_table(token, project_id):
        print("\n❌ Cannot proceed without customers table")
        return
    
    # Step 4: Run tests
    results = []
    
    results.append(("TEST 1: Single Column Error", test_single_column_error(token, project_id)))
    results.append(("TEST 2: Four-Column Error (MAIN)", test_four_column_error(token, project_id)))
    results.append(("TEST 3: Unfixable Error", test_unfixable_error(token, project_id)))
    results.append(("TEST 4: Valid Query", test_valid_query(token, project_id)))
    results.append(("TEST 5: Regression Test", test_regression_customer_id(token, project_id)))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = 0
    failed = 0
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal: {passed + failed} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED! 🎉")
    else:
        print(f"\n⚠️  {failed} TEST(S) FAILED")

if __name__ == "__main__":
    main()

