end is fully functional when all tests pass!** 🎉

- Verify endpoint URL

### 500 Internal Server Error
- Check backend logs
- Verify database connection
- Check if database exists

### AI Features Not Working
- Verify OPENROUTER_API_KEY in .env
- Check OpenRouter account has credits
- Try different AI model

---

## Success Criteria

✅ All tests pass
✅ Database created for each project
✅ Tables created successfully
✅ Data inserted and retrieved
✅ SQL queries execute
✅ AI converts natural language to SQL
✅ Query history logged
✅ Saved queries work

---

**Back -d '{"sql":"SELECT * FROM customers"}'

# 6. AI Query (requires OpenRouter API key)
curl -X POST http://localhost:8000/api/projects/$PROJECT_ID/ai/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"Show me all customers","model":"gpt-4"}'
```

---

## Troubleshooting

### 401 Unauthorized
- Check if token is valid
- Token might be expired (24 hours)
- Login again to get new token

### 404 Not Found
- Check if project_id is correct
- Check if table existstable_name":"customers","columns":[{"name":"id","type":"number","primary_key":true},{"name":"name","type":"string","nullable":false}]}'

# 4. Insert Data
curl -X POST http://localhost:8000/api/$PROJECT_ID/tables/customers/rows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"id":1,"name":"John Doe"}}'

# 5. Query Data
curl -X POST http://localhost:8000/api/projects/$PROJECT_ID/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
 6","full_name":"Test User"}' \
  | jq -r '.access_token')

echo "Token: $TOKEN"

# 2. Create Project
PROJECT_ID=$(curl -s -X POST http://localhost:8000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","description":"Testing"}' \
  | jq -r '.id')

echo "Project ID: $PROJECT_ID"

# 3. Create Table
curl -X POST http://localhost:8000/api/$PROJECT_ID/tables \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{" YOUR_ACCESS_TOKEN"
```

---

## Test 19: Delete Project

### Using cURL
```bash
curl -X DELETE http://localhost:8000/api/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Verify in pgAdmin
The project database should be deleted from PostgreSQL.

---

## Complete Test Flow

Here's a complete test sequence:

```bash
# 1. Signup
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@nexora.ai","password":"test12345OJECT_ID/tables/customers/rows/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "age": 31
    }
  }'
```

---

## Test 17: Delete Row

### Using cURL
```bash
curl -X DELETE http://localhost:8000/api/PROJECT_ID/tables/customers/rows/3 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Test 18: Delete Table

### Using cURL
```bash
curl -X DELETE http://localhost:8000/api/PROJECT_ID/tables/customers \
  -H "Authorization: Bearerp://localhost:8000/api/projects/PROJECT_ID/query/history?limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Expected Response
```json
[
  {
    "id": "history-uuid",
    "question": null,
    "sql_query": "SELECT * FROM customers WHERE age > 25",
    "status": "success",
    "execution_time_ms": 15,
    "rows_returned": 2,
    "error_message": null,
    "created_at": "2024-03-30T..."
  },
  ...
]
```

---

## Test 16: Update Row

### Using cURL
```bash
curl -X PUT http://localhost:8000/api/PRrs",
  "description": "Get all customers over 25",
  "sql_query": "SELECT * FROM customers WHERE age > 25",
  "tags": ["customers", "active"],
  "is_favorite": false,
  "run_count": 0,
  "created_at": "2024-03-30T...",
  "updated_at": "2024-03-30T..."
}
```

---

## Test 14: List Saved Queries

### Using cURL
```bash
curl -X GET http://localhost:8000/api/projects/PROJECT_ID/query/saved \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Test 15: Get Query History

### Using cURL
```bash
curl -X GET "httalphabetically by name"
  ]
}
```

---

## Test 13: Save Query

### Using cURL
```bash
curl -X POST http://localhost:8000/api/projects/PROJECT_ID/query/save \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Active Customers",
    "description": "Get all customers over 25",
    "sql_query": "SELECT * FROM customers WHERE age > 25",
    "tags": ["customers", "active"]
  }'
```

### Expected Response
```json
{
  "id": "query-uuid",
  "name": "Active CustomeOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT name, email FROM customers WHERE age > 30 ORDER BY name"
  }'
```

### Expected Response
```json
{
  "sql": "SELECT name, email FROM customers WHERE age > 30 ORDER BY name",
  "explanation": "This query selects customer names and emails for customers over 30 years old, sorted alphabetically by name",
  "steps": [
    "Filter customers where age is greater than 30",
    "Select only name and email columns",
    "Sort results  older than 25",
    "model": "gpt-4"
  }'
```

### Expected Response
```json
{
  "question": "Show me all customers older than 25",
  "sql": "SELECT * FROM customers WHERE age > 25",
  "explanation": "This query retrieves all customer records where the age is greater than 25",
  "confidence": 0.85
}
```

**Note**: Requires OPENROUTER_API_KEY in .env

---

## Test 12: Explain SQL Query

### Using cURL
```bash
curl -X POST http://localhost:8000/api/projects/PROJECT_ID/ai/explain \
  -H "Authorization: Bearer Y", "updated_at"],
  "rows": [
    {"id": 1, "name": "John Doe", "email": "john@example.com", "age": 30, ...},
    {"id": 3, "name": "Bob Johnson", "email": "bob@example.com", "age": 35, ...}
  ],
  "row_count": 2,
  "execution_time_ms": 15
}
```

---

## Test 11: AI Natural Language Query

### Using cURL
```bash
curl -X POST http://localhost:8000/api/projects/PROJECT_ID/ai/query \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Show me all customers
      "created_at": "2024-03-30T...",
      "updated_at": "2024-03-30T..."
    },
    ...
  ],
  "total": 3,
  "limit": 10,
  "offset": 0
}
```

---

## Test 10: Execute SQL Query

### Using cURL
```bash
curl -X POST http://localhost:8000/api/projects/PROJECT_ID/query \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT * FROM customers WHERE age > 25"
  }'
```

### Expected Response
```json
{
  "columns": ["id", "name", "email", "age", "created_at "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": {"id": 3, "name": "Bob Johnson", "email": "bob@example.com", "age": 35}}'
```

---

## Test 9: Get Table Data

### Using cURL
```bash
curl -X GET "http://localhost:8000/api/PROJECT_ID/tables/customers/rows?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Expected Response
```json
{
  "rows": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "age": 30,json" \
  -d '{
    "data": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "age": 30
    }
  }'
```

### Insert More Rows
```bash
# Row 2
curl -X POST http://localhost:8000/api/PROJECT_ID/tables/customers/rows \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": {"id": 2, "name": "Jane Smith", "email": "jane@example.com", "age": 25}}'

# Row 3
curl -X POST http://localhost:8000/api/PROJECT_ID/tables/customers/rows \
  -H, "nullable": true}
    ]
  }'
```

### Expected Response
```json
{
  "table_name": "customers",
  "columns": [...],
  "row_count": 0,
  "size_bytes": 0,
  "created_at": null
}
```

### Verify in pgAdmin
1. Connect to project database (proj_abc12345)
2. Expand Tables
3. You should see `customers` table

---

## Test 8: Insert Data

### Using cURL
```bash
curl -X POST http://localhost:8000/api/PROJECT_ID/tables/customers/rows \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/,
    ...
  }
]
```

---

## Test 7: Create Table

### Using cURL
```bash
curl -X POST http://localhost:8000/api/PROJECT_ID/tables \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "customers",
    "columns": [
      {"name": "id", "type": "number", "primary_key": true},
      {"name": "name", "type": "string", "nullable": false},
      {"name": "email", "type": "string", "nullable": false, "unique": true},
      {"name": "age", "type": "number"tive",
  "created_at": "2024-03-30T...",
  "updated_at": "2024-03-30T..."
}
```

**Save the `id` and `database_name`!**

### Verify in pgAdmin
1. Open pgAdmin
2. Refresh databases
3. You should see new database: `proj_abc12345`

---

## Test 6: List Projects

### Using cURL
```bash
curl -X GET http://localhost:8000/api/projects \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Expected Response
```json
[
  {
    "id": "project-uuid",
    "name": "My First Project",
    "database_name": "proj_abc12345"..."
}
```

---

## Test 5: Create Project (Creates New Database!)

### Using cURL
```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"My First Project\",\"description\":\"Testing Nexora AI\"}"
```

### Expected Response
```json
{
  "id": "project-uuid",
  "user_id": "user-uuid",
  "name": "My First Project",
  "description": "Testing Nexora AI",
  "database_name": "proj_abc12345",
  "status": "ac -d "{\"email\":\"test@nexora.ai\",\"password\":\"test123456\"}"
```

### Expected Response
Same as signup response with new token.

---

## Test 4: Get Current User

### Using cURL
```bash
curl -X GET http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Expected Response
```json
{
  "id": "uuid-here",
  "email": "test@nexora.ai",
  "full_name": "Test User",
  "avatar_url": null,
  "is_active": true,
  "is_verified": false,
  "plan": "free",
  "created_at": "2024-03-30T# Expected Response
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "uuid-here",
    "email": "test@nexora.ai",
    "full_name": "Test User",
    "is_active": true,
    "is_verified": false,
    "plan": "free",
    "created_at": "2024-03-30T..."
  }
}
```

**Save the `access_token` for next tests!**

---

## Test 3: User Login

### Using cURL
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
 0T00:00:00Z"
}
```

---

## Test 2: User Registration

### Using cURL
```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@nexora.ai\",\"password\":\"test123456\",\"full_name\":\"Test User\"}"
```

### Using Swagger UI
1. Go to http://localhost:8000/docs
2. Find `POST /api/auth/signup`
3. Click "Try it out"
4. Enter:
```json
{
  "email": "test@nexora.ai",
  "password": "test123456",
  "full_name": "Test User"
}
```
5. Click "Execute"

##tes

- Backend running at http://localhost:8000
- PostgreSQL database initialized
- OpenRouter API key configured (for AI features)

## Testing Tools

You can use any of these:
1. **Swagger UI**: http://localhost:8000/docs (easiest)
2. **cURL**: Command line
3. **Postman**: GUI tool
4. **Thunder Client**: VS Code extension

---

## Test 1: Health Check

### Using Browser
Visit: http://localhost:8000/health

### Expected Response
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-03-3# Nexora AI Backend - Testing Guide

Complete step-by-step guide to test all backend features.

## Prerequisi