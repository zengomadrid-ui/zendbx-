# Nexora AI Backend - Quick Start Guide

## Prerequisites

- Python 3.10 or higher
- PostgreSQL 15+ (with pgAdmin installed)
- OpenRouter API key (get from https://openrouter.ai/keys)

## Setup Steps

### 1. Database Setup (Already Done ✓)

You've already created the `nexora_main` database in pgAdmin. Great!

### 2. Create Environment File

```bash
cd backend
copy .env.example .env
```

### 3. Configure .env File

Open `.env` and update these values:

```env
# Update with your PostgreSQL password
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/nexora_main

# Get from https://openrouter.ai/keys
OPENROUTER_API_KEY=your_actual_api_key_here

# Generate secure key: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=your_generated_secret_key
```

### 4. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 5. Initialize Database Schema

Run the SQL script in pgAdmin:

1. Open pgAdmin
2. Connect to `nexora_main` database
3. Open Query Tool
4. Load and execute: `database/init_main_database.sql`

### 6. Start the Backend Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The server will start at: http://localhost:8000

### 7. Test the API

Open your browser and visit:
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

## API Endpoints Overview

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project (creates new database)
- `GET /api/projects/{id}` - Get project details
- `DELETE /api/projects/{id}` - Delete project

### Tables
- `GET /api/{project_id}/tables` - List tables
- `POST /api/{project_id}/tables` - Create table
- `GET /api/{project_id}/tables/{name}/rows` - Get table data
- `POST /api/{project_id}/tables/{name}/rows` - Insert row

### SQL Queries
- `POST /api/projects/{id}/query` - Execute SQL query
- `GET /api/projects/{id}/query/history` - Query history
- `POST /api/projects/{id}/query/save` - Save query
- `GET /api/projects/{id}/query/saved` - List saved queries

### AI Features (Natural Language to SQL)
- `POST /api/projects/{id}/ai/query` - Convert question to SQL
- `POST /api/projects/{id}/ai/explain` - Explain SQL query
- `GET /api/projects/{id}/ai/suggest` - Get query suggestions

## Testing the Backend

### 1. Create a User

```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456",
    "full_name": "Test User"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456"
  }'
```

Save the `access_token` from the response.

### 3. Create a Project

```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "My First Project",
    "description": "Testing Nexora AI"
  }'
```

This will create a new PostgreSQL database for your project!

### 4. Create a Table

```bash
curl -X POST http://localhost:8000/api/PROJECT_ID/tables \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "table_name": "customers",
    "columns": [
      {"name": "id", "type": "number", "primary_key": true},
      {"name": "name", "type": "string", "nullable": false},
      {"name": "email", "type": "string", "nullable": false, "unique": true}
    ]
  }'
```

### 5. Ask AI to Generate SQL

```bash
curl -X POST http://localhost:8000/api/projects/PROJECT_ID/ai/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "question": "Show me all customers",
    "model": "gpt-4"
  }'
```

## Architecture

```
Main Database (nexora_main)
├── users
├── projects
├── query_history
└── saved_queries

Project Databases (created dynamically)
├── proj_abc123 (User's Project 1)
│   ├── customers (user-created table)
│   └── orders (user-created table)
└── proj_def456 (User's Project 2)
    └── products (user-created table)
```

## Next Steps

1. Connect the frontend to this backend
2. Test all API endpoints
3. Add your OpenRouter API key for AI features
4. Start building your database projects!

## Troubleshooting

### Database Connection Error
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Ensure nexora_main database exists

### Import Errors
- Run: `pip install -r requirements.txt`
- Check Python version: `python --version` (should be 3.10+)

### OpenRouter API Errors
- Verify OPENROUTER_API_KEY in .env
- Check API key at https://openrouter.ai/keys
- Ensure you have credits in your OpenRouter account

## Support

For issues or questions, check:
- API Documentation: http://localhost:8000/docs
- Architecture docs: `.kiro/specs/nexora-ai/`
