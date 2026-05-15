# ZenDBX - Complete Documentation

> **Last Updated:** April 24, 2026  
> **Version:** 1.0.0  
> **Status:** Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [What We Built](#what-we-built)
3. [Architecture](#architecture)
4. [Core Features](#core-features)
5. [Technology Stack](#technology-stack)
6. [Getting Started](#getting-started)
7. [Feature Documentation](#feature-documentation)
8. [API Reference](#api-reference)
9. [Security](#security)
10. [Deployment](#deployment)
11. [Unique Selling Points](#unique-selling-points)
12. [Roadmap](#roadmap)

---

## 🎯 Overview

**ZenDBX** is a complete Backend-as-a-Service (BaaS) platform that provides everything developers need to build modern applications:

- **PostgreSQL Database** - Multi-tenant architecture with isolated databases per project
- **Auto-Generated REST APIs** - Instant CRUD endpoints for all tables
- **Authentication System** - JWT-based auth with OAuth support (Google, GitHub)
- **Real-time Updates** - WebSocket-powered live data synchronization
- **Team Collaboration** - Built-in chat and role-based access control
- **AI-Powered Features** - Natural language to SQL conversion
- **Database Management** - Visual editors for tables, functions, triggers, and schema

### The Vision

ZenDBX aims to be the fastest way to build a production-ready backend - combining the power of Supabase with the collaboration features of Slack, all in one platform.

---

## 🏗️ What We Built

### Platform Components


#### 1. Backend (FastAPI + Python)
- **Framework:** FastAPI 0.104+
- **Database:** PostgreSQL 15+ with asyncpg
- **Authentication:** JWT tokens with bcrypt password hashing
- **AI Integration:** OpenRouter API (GPT-4, Claude, Llama)
- **Real-time:** PostgreSQL LISTEN/NOTIFY + WebSocket broadcasting
- **API Documentation:** Auto-generated with Swagger/OpenAPI

#### 2. Frontend (Next.js 14 + React)
- **Framework:** Next.js 14 with App Router
- **UI Library:** React 18 with TypeScript
- **Styling:** TailwindCSS with custom design system
- **State Management:** React Query for server state
- **Code Editor:** Monaco Editor for SQL editing
- **Real-time:** Socket.io client for WebSocket connections

#### 3. WebSocket Server (Node.js + Socket.io)
- **Framework:** Express.js + Socket.io
- **Purpose:** Real-time event broadcasting
- **Features:** Channel-based pub/sub, connection management
- **Performance:** <100ms latency for database events

#### 4. Database Architecture
- **Main Database:** `zendbx_main` - Platform metadata and user accounts
- **Project Databases:** Dynamically created per project (e.g., `proj_abc123`)
- **Isolation:** Complete data separation between projects
- **Extensions:** uuid-ossp, pg_stat_statements, pg_trgm

---

## 🏛️ Architecture

### Multi-Tenant Architecture (Supabase-Style)

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Landing Page │  │  Dashboard   │  │  SQL Editor  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Table Editor │  │  Team Chat   │  │  Auth Pages  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/REST + WebSocket
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (FastAPI)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ API Layer                                            │   │
│  │  • Authentication (JWT)    • Projects Management    │   │
│  │  • Table Operations        • SQL Query Execution    │   │
│  │  • AI Service              • Team Collaboration     │   │
│  │  • Real-time Events        • Backup/Restore         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Core Services                                        │   │
│  │  • Database Router         • RLS Enforcer           │   │
│  │  • Security Layer          • RBAC System            │   │
│  │  • AI Service              • Audit Logger           │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬──────────────────┐
        ▼                         ▼                  ▼
┌──────────────────┐    ┌──────────────────┐  ┌─────────────┐
│   PostgreSQL     │    │ WebSocket Server │  │ OpenRouter  │
│                  │    │   (Socket.io)    │  │  (AI APIs)  │
│  Main Database:  │    │                  │  │             │
│  • users         │    │  • Broadcasting  │  │  • GPT-4    │
│  • projects      │    │  • Pub/Sub       │  │  • Claude   │
│  • api_keys      │    │  • Channels      │  │  • Llama    │
│  • audit_logs    │    └──────────────────┘  └─────────────┘
│                  │
│  Project DBs:    │
│  • proj_abc123   │ ← User's Project 1
│  • proj_def456   │ ← User's Project 2
│  • proj_xyz789   │ ← User's Project 3
└──────────────────┘
```

### Data Flow Examples

#### User Creates a Project
```
1. User clicks "New Project" in UI
2. Frontend → POST /api/projects
3. Backend generates unique DB name (proj_abc123)
4. Backend executes: CREATE DATABASE proj_abc123
5. Backend stores metadata in main database
6. Backend initializes project DB with extensions
7. Backend generates API keys (anon_key, service_role_key)
8. Frontend receives project details + API keys
9. User can now create tables in their project
```

#### User Creates a Table
```
1. User designs table in Table Editor
2. Frontend → POST /api/{project_id}/db/tables
3. Backend connects to project database (proj_abc123)
4. Backend executes: CREATE TABLE customers (...)
5. Backend stores table metadata
6. Backend creates realtime trigger (optional)
7. Frontend refreshes table list
8. Table is ready for data
```

#### Real-time Data Updates
```
1. User inserts data: INSERT INTO users VALUES (...)
2. PostgreSQL trigger fires: NOTIFY db_change
3. Backend listener receives notification
4. Backend broadcasts to WebSocket server
5. WebSocket server publishes to channel: table:users
6. All subscribed clients receive update instantly
7. Frontend updates UI in real-time
```

---


## ✨ Core Features

### 1. Authentication & Security

#### JWT-Based Authentication
- **Email/Password:** Secure signup and login with bcrypt hashing
- **OAuth Integration:** Google and GitHub login support
- **JWT Tokens:** Stateless authentication with configurable expiration
- **Session Management:** Track active sessions, force logout
- **MFA Support:** Two-factor authentication with TOTP
- **Password Reset:** Secure password recovery flow

#### Row Level Security (RLS)
- **PostgreSQL RLS:** Native database-level security
- **Automatic Enforcement:** Applied to all REST API calls
- **Policy Management:** Visual policy editor in dashboard
- **User Context:** Automatic user_id injection in queries
- **Service Role Bypass:** Admin access with service_role_key

#### Role-Based Access Control (RBAC)
- **Three Roles:** Admin, Editor, Viewer
- **Project-Level:** Permissions scoped to individual projects
- **Team Management:** Invite unlimited team members
- **Audit Logging:** Track all permission changes

**Implementation Files:**
- `backend/app/core/security.py` - JWT and password hashing
- `backend/app/core/rls_enforcer.py` - RLS policy enforcement
- `backend/app/core/rbac.py` - Role-based access control
- `backend/app/api/auth.py` - Authentication endpoints
- `backend/app/api/public_auth_v2.py` - Public auth API (Supabase-style)

---

### 2. Database Management

#### Visual Table Editor
- **Create Tables:** Drag-and-drop column designer
- **Edit Data:** Inline editing with validation
- **Column Types:** Support for all PostgreSQL types
- **Constraints:** PRIMARY KEY, UNIQUE, NOT NULL, FOREIGN KEY
- **Indexes:** Create and manage indexes visually

#### SQL Editor
- **Monaco Editor:** Professional code editor with syntax highlighting
- **Multi-Statement:** Execute multiple queries at once
- **Query History:** Track all executed queries
- **Saved Queries:** Reusable query templates
- **AI Assistance:** Natural language to SQL conversion

#### Schema Visualizer
- **Visual Graph:** See all tables and relationships
- **Interactive:** Click tables to view details
- **Relationship Detection:** Automatic foreign key visualization
- **Export:** Generate schema diagrams

#### Functions & Triggers
- **Create Functions:** PL/pgSQL function editor
- **Manage Triggers:** Visual trigger configuration
- **Event Types:** INSERT, UPDATE, DELETE, TRUNCATE
- **Timing:** BEFORE, AFTER, INSTEAD OF
- **Examples:** Auto-timestamps, audit logs, validation

**Implementation Files:**
- `backend/app/api/db_tables.py` - Table CRUD operations
- `backend/app/api/db_functions.py` - Function management
- `backend/app/api/db_triggers.py` - Trigger management
- `backend/app/api/db_schema.py` - Schema visualization
- `backend/app/services/db_manager.py` - Core DB operations
- `backend/app/services/schema_parser.py` - Schema parsing

---

### 3. Auto-Generated REST APIs

#### Instant CRUD Endpoints
Every table automatically gets:
- `GET /rest/v1/{table}` - List records with filtering
- `POST /rest/v1/{table}` - Create record
- `PATCH /rest/v1/{table}?id=eq.{id}` - Update record
- `DELETE /rest/v1/{table}?id=eq.{id}` - Delete record

#### Query Parameters (PostgREST-style)
```bash
# Filtering
GET /rest/v1/users?age=gt.25&status=eq.active

# Sorting
GET /rest/v1/users?order=created_at.desc

# Pagination
GET /rest/v1/users?limit=10&offset=20

# Select specific columns
GET /rest/v1/users?select=id,name,email

# Relationships (coming soon)
GET /rest/v1/users?select=*,posts(*)
```

#### API Keys
- **Anon Key:** Public key for client-side use (respects RLS)
- **Service Role Key:** Admin key that bypasses RLS
- **Automatic Generation:** Created with each project
- **JWT-Based:** Keys are actually JWT tokens

**Implementation Files:**
- `backend/app/api/rest_v1.py` - REST API endpoints
- `backend/app/api/project_api.py` - Project-specific APIs
- `backend/app/api/api_keys.py` - API key management
- `backend/app/services/auto_table.py` - Auto-table creation

---

### 4. Real-time Updates

#### PostgreSQL LISTEN/NOTIFY
- **Database Triggers:** Automatically created on tables
- **Event Types:** INSERT, UPDATE, DELETE
- **Payload:** Full row data (old and new)
- **Latency:** <100ms from database to client

#### WebSocket Broadcasting
- **Channel-Based:** Subscribe to specific tables
- **Pub/Sub Pattern:** Multiple clients can subscribe
- **Connection Management:** Auto-reconnect on disconnect
- **Health Monitoring:** Connection status tracking

#### Frontend Integration
```javascript
// Subscribe to table updates
socket.emit('subscribe', 'table:users');

// Listen for changes
socket.on('db_change', (event) => {
  console.log(event.type);  // INSERT, UPDATE, DELETE
  console.log(event.table); // users
  console.log(event.new);   // New row data
  console.log(event.old);   // Old row data (UPDATE/DELETE)
});
```

**Implementation Files:**
- `backend/app/api/realtime.py` - Realtime API endpoints
- `backend/app/services/realtime_listener.py` - PostgreSQL listener
- `backend/database/realtime_triggers.sql` - Trigger functions
- `websocket-server/server.js` - WebSocket server
- `websocket-server/handlers/broadcast.js` - Broadcasting logic

---

### 5. Team Collaboration

#### Built-in Chat
- **Project-Scoped:** Chat per project
- **Real-time:** Instant message delivery
- **Persistent:** Message history stored
- **User Presence:** See who's online
- **Typing Indicators:** See who's typing

#### Team Management
- **Invite Members:** By email address
- **Role Assignment:** Admin, Editor, Viewer
- **Permission Control:** Fine-grained access control
- **Member List:** See all team members
- **Remove Members:** Revoke access anytime

#### Collaboration Features
- **Shared SQL Editor:** Multiple users can work together
- **Activity Feed:** See what team members are doing
- **Audit Logs:** Track all changes
- **Notifications:** Get notified of important events

**Implementation Files:**
- `backend/app/api/team.py` - Team management API
- `backend/database/add_team_collaboration.sql` - Team schema
- `websocket-server/handlers/chat.js` - Chat functionality
- `frontend/app/(dashboard)/dashboard/team/page.tsx` - Team UI

---

### 6. AI-Powered Features

#### Natural Language to SQL
```javascript
// User types: "Show me all users who signed up this month"
// AI generates:
SELECT * FROM users 
WHERE created_at >= date_trunc('month', CURRENT_DATE)
ORDER BY created_at DESC;
```

#### Query Explanation
```javascript
// User provides SQL
// AI explains:
"This query retrieves all customer records where the age 
is greater than 25, sorted by creation date in descending order."
```

#### Error Fixing
```javascript
// User's query fails
// AI suggests:
"You have a syntax error. Try: SELECT * FROM users (not SELCT)"
```

#### Supported AI Models
- **GPT-4:** Best for complex queries
- **Claude:** Great for explanations
- **Llama:** Fast and cost-effective
- **Gemini:** Google's latest model

**Implementation Files:**
- `backend/app/api/ai.py` - AI API endpoints
- `backend/app/services/ai_service.py` - AI integration
- `frontend/app/(dashboard)/dashboard/ai-builder/page.tsx` - AI UI

---

### 7. Data Import/Export

#### CSV Import
- **Auto-Detection:** Infer column types from data
- **Data Cleaning:** Remove duplicates, skip empty rows
- **Preview:** See first 10 rows before import
- **Validation:** Check data quality
- **Bulk Insert:** Efficient batch insertion

#### Backup & Restore
- **Automated Backups:** Daily backups of project databases
- **Manual Backups:** On-demand backup creation
- **Point-in-Time Recovery:** Restore to specific timestamp
- **Download Backups:** Export as .sql.gz files
- **Restore:** One-click restore from backup

**Implementation Files:**
- `backend/app/api/imports.py` - CSV import API
- `backend/app/api/backups.py` - Backup management
- `backend/app/services/backup_service.py` - Backup logic
- `frontend/app/(dashboard)/dashboard/import/page.tsx` - Import UI
- `frontend/app/(dashboard)/dashboard/backups/page.tsx` - Backup UI

---


## 🛠️ Technology Stack

### Backend Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11+ | Backend language |
| FastAPI | 0.104+ | Web framework |
| PostgreSQL | 15+ | Database |
| asyncpg | 0.29+ | Async PostgreSQL driver |
| SQLAlchemy | 2.0+ | ORM (optional) |
| Pydantic | 2.0+ | Data validation |
| python-jose | 3.3+ | JWT tokens |
| passlib | 1.7+ | Password hashing |
| bcrypt | 4.0+ | Password hashing algorithm |
| httpx | 0.25+ | HTTP client for AI APIs |

### Frontend Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.0+ | React framework |
| React | 18.2+ | UI library |
| TypeScript | 5.0+ | Type safety |
| TailwindCSS | 3.3+ | Styling |
| React Query | 5.0+ | Server state management |
| Monaco Editor | 0.44+ | Code editor |
| Socket.io Client | 4.6+ | WebSocket client |
| Recharts | 2.10+ | Data visualization |

### WebSocket Server
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | 4.18+ | Web server |
| Socket.io | 4.6+ | WebSocket library |
| CORS | 2.8+ | Cross-origin support |
| dotenv | 16.3+ | Environment config |

### Database Extensions
| Extension | Purpose |
|-----------|---------|
| uuid-ossp | UUID generation |
| pg_stat_statements | Query statistics |
| pg_trgm | Text search |
| pgcrypto | Encryption functions |

---

## 🚀 Getting Started

### Prerequisites
- **PostgreSQL 15+** installed and running
- **Python 3.11+** with pip
- **Node.js 18+** with npm
- **Git** for version control

### Installation Steps

#### 1. Clone Repository
```bash
git clone <repository-url>
cd zendbx
```

#### 2. Database Setup
```bash
# Create main database
psql -U postgres
CREATE DATABASE zendbx_main;
\q

# Initialize schema
psql -U postgres -d zendbx_main -f backend/database/init_main_database.sql
```

#### 3. Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings:
# - DATABASE_URL
# - SECRET_KEY
# - OPENROUTER_API_KEY (for AI features)

# Start backend
uvicorn app.main:app --reload --port 8000
```

#### 4. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:8000

# Start frontend
npm run dev
```

#### 5. WebSocket Server Setup
```bash
cd websocket-server

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env if needed (default port: 3002)

# Start WebSocket server
npm start
```

### Access the Application
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **WebSocket:** ws://localhost:3002

### Quick Start Script (Windows)
```bash
# Run all services at once
START.bat
```

---

## 📚 Feature Documentation

### Authentication System

#### Signup Flow
```bash
POST /v1/auth/{project_id}/signup
Headers:
  Authorization: Bearer {ANON_KEY}
  Content-Type: application/json
Body:
  {
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }

Response:
  {
    "access_token": "eyJhbGc...",
    "token_type": "bearer",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "provider": "email"
    }
  }
```

#### Login Flow
```bash
POST /v1/auth/{project_id}/login
Headers:
  Authorization: Bearer {ANON_KEY}
  Content-Type: application/json
Body:
  {
    "email": "user@example.com",
    "password": "SecurePass123!"
  }

Response:
  {
    "access_token": "eyJhbGc...",
    "token_type": "bearer",
    "user": { ... }
  }
```

#### OAuth Flow
```bash
# 1. Initiate OAuth
GET /api/oauth/{provider}/authorize?project_id={project_id}
# Redirects to provider (Google/GitHub)

# 2. Callback
GET /api/oauth/{provider}/callback?code={code}&state={state}
# Returns access_token
```

**Documentation:** See `GETTING_STARTED.md` for complete auth guide

---

### Database Operations

#### Create Table
```bash
POST /api/{project_id}/db/tables
Headers:
  Authorization: Bearer {USER_TOKEN}
Body:
  {
    "table_name": "customers",
    "columns": [
      {
        "name": "id",
        "type": "SERIAL",
        "primary_key": true
      },
      {
        "name": "email",
        "type": "VARCHAR(255)",
        "nullable": false,
        "unique": true
      },
      {
        "name": "name",
        "type": "TEXT"
      }
    ]
  }
```

#### Execute SQL Query
```bash
POST /api/projects/{project_id}/query
Headers:
  Authorization: Bearer {USER_TOKEN}
Body:
  {
    "sql": "SELECT * FROM customers WHERE age > 25"
  }

Response:
  {
    "columns": ["id", "name", "email", "age"],
    "rows": [
      {"id": 1, "name": "John", "email": "john@example.com", "age": 30},
      {"id": 2, "name": "Jane", "email": "jane@example.com", "age": 28}
    ],
    "row_count": 2,
    "execution_time_ms": 15
  }
```

**Documentation:** See `DATABASE_MANAGEMENT.md` for complete guide

---

### REST API Usage

#### List Records
```bash
GET /rest/v1/users?age=gt.25&order=created_at.desc&limit=10
Headers:
  x-project-id: {PROJECT_ID}
  Authorization: Bearer {ANON_KEY or USER_TOKEN}

Response:
  [
    {"id": 1, "name": "John", "age": 30, "created_at": "2024-01-01T00:00:00Z"},
    {"id": 2, "name": "Jane", "age": 28, "created_at": "2024-01-02T00:00:00Z"}
  ]
```

#### Create Record
```bash
POST /rest/v1/users
Headers:
  x-project-id: {PROJECT_ID}
  Authorization: Bearer {USER_TOKEN}
Body:
  {
    "name": "Bob",
    "email": "bob@example.com",
    "age": 35
  }

Response:
  {
    "id": 3,
    "name": "Bob",
    "email": "bob@example.com",
    "age": 35,
    "created_at": "2024-01-03T00:00:00Z"
  }
```

#### Update Record
```bash
PATCH /rest/v1/users?id=eq.3
Headers:
  x-project-id: {PROJECT_ID}
  Authorization: Bearer {USER_TOKEN}
Body:
  {
    "age": 36
  }

Response:
  {
    "id": 3,
    "name": "Bob",
    "email": "bob@example.com",
    "age": 36,
    "updated_at": "2024-01-04T00:00:00Z"
  }
```

#### Delete Record
```bash
DELETE /rest/v1/users?id=eq.3
Headers:
  x-project-id: {PROJECT_ID}
  Authorization: Bearer {USER_TOKEN}

Response:
  {
    "message": "Record deleted successfully"
  }
```

**Documentation:** See `backend/HYBRID_API_GUIDE.md` for complete API reference

---

### Real-time Subscriptions

#### Frontend Setup
```javascript
import io from 'socket.io-client';

// Connect to WebSocket server
const socket = io('http://localhost:3002');

// Subscribe to table updates
socket.emit('subscribe', 'table:users');

// Listen for changes
socket.on('db_change', (event) => {
  console.log('Database change:', event);
  // event.type: 'INSERT', 'UPDATE', or 'DELETE'
  // event.table: 'users'
  // event.new: new row data
  // event.old: old row data (for UPDATE/DELETE)
  
  // Update your UI
  if (event.type === 'INSERT') {
    addUserToList(event.new);
  } else if (event.type === 'UPDATE') {
    updateUserInList(event.new);
  } else if (event.type === 'DELETE') {
    removeUserFromList(event.old);
  }
});

// Unsubscribe when done
socket.emit('unsubscribe', 'table:users');
```

#### React Hook Example
```typescript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function useRealtimeTable(tableName: string) {
  const [data, setData] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3002');
    
    newSocket.on('connect', () => {
      newSocket.emit('subscribe', `table:${tableName}`);
    });
    
    newSocket.on('db_change', (event) => {
      if (event.table === tableName) {
        if (event.type === 'INSERT') {
          setData(prev => [...prev, event.new]);
        } else if (event.type === 'UPDATE') {
          setData(prev => prev.map(item => 
            item.id === event.new.id ? event.new : item
          ));
        } else if (event.type === 'DELETE') {
          setData(prev => prev.filter(item => 
            item.id !== event.old.id
          ));
        }
      }
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.emit('unsubscribe', `table:${tableName}`);
      newSocket.close();
    };
  }, [tableName]);

  return { data, socket };
}

// Usage
function UsersPage() {
  const { data: users } = useRealtimeTable('users');
  
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

**Documentation:** See `REALTIME_TESTING_GUIDE.md` and `WEBSOCKET_QUICKSTART.md`

---


### Team Collaboration

#### Invite Team Member
```bash
POST /api/projects/{project_id}/invite
Headers:
  Authorization: Bearer {USER_TOKEN}
Body:
  {
    "email": "teammate@example.com",
    "role": "editor"  # admin, editor, or viewer
  }

Response:
  {
    "message": "User invited successfully",
    "member": {
      "user_id": "uuid",
      "email": "teammate@example.com",
      "role": "editor",
      "joined_at": "2024-01-01T00:00:00Z"
    }
  }
```

#### Send Chat Message
```javascript
// Via WebSocket
socket.emit('send_message', {
  channel: 'project:{project_id}',
  message: {
    text: 'Hello team!',
    user_id: 'uuid',
    user_name: 'John Doe'
  }
});

// Receive messages
socket.on('receive_message', (data) => {
  console.log(data.message.text);
  console.log(data.message.user_name);
});
```

**Documentation:** See `HOW_TO_INVITE_TEAM.md` for complete guide

---

### AI Features

#### Natural Language Query
```bash
POST /api/projects/{project_id}/ai/query
Headers:
  Authorization: Bearer {USER_TOKEN}
Body:
  {
    "question": "Show me all customers who signed up this month",
    "model": "gpt-4"
  }

Response:
  {
    "question": "Show me all customers who signed up this month",
    "sql": "SELECT * FROM customers WHERE created_at >= date_trunc('month', CURRENT_DATE)",
    "explanation": "This query retrieves all customer records created in the current month",
    "confidence": 0.95
  }
```

#### Explain SQL Query
```bash
POST /api/projects/{project_id}/ai/explain
Headers:
  Authorization: Bearer {USER_TOKEN}
Body:
  {
    "sql": "SELECT u.name, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.name"
  }

Response:
  {
    "sql": "...",
    "explanation": "This query counts the number of orders for each user by joining the users and orders tables, grouping by user name",
    "steps": [
      "Join users table with orders table",
      "Group results by user name",
      "Count orders for each user"
    ]
  }
```

**Documentation:** See AI-related sections in `backend/TESTING_GUIDE.md`

---

## 🔐 Security

### Authentication Security

#### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

#### Password Hashing
```python
# Using bcrypt with salt rounds
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed = pwd_context.hash("user_password")  # Secure hash
verified = pwd_context.verify("user_password", hashed)  # True
```

#### JWT Tokens
```python
# Token structure
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "authenticated",
  "project_id": "uuid",
  "exp": 1234567890  # Expiration timestamp
}

# Token expiration: 24 hours (configurable)
```

### Row Level Security (RLS)

#### How RLS Works
```sql
-- Enable RLS on table
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own posts
CREATE POLICY "Users can read own posts" ON posts
  FOR SELECT
  USING (user_id::TEXT = auth.current_user_id());

-- Create policy: Users can only insert their own posts
CREATE POLICY "Users can create posts" ON posts
  FOR INSERT
  WITH CHECK (user_id::TEXT = auth.current_user_id());
```

#### RLS Enforcement in API
```python
# Before executing query, set session variables
await conn.execute(f"SET app.current_user_id = '{user_id}'")
await conn.execute(f"SET app.current_role = '{role}'")

# Now RLS policies are enforced automatically
result = await conn.fetch("SELECT * FROM posts")
# User only sees their own posts
```

#### Service Role Bypass
```python
# Service role key bypasses RLS
if role == "service_role":
    # Skip RLS enforcement
    # Full database access
    pass
```

**Documentation:** See `backend/RLS_TESTING_GUIDE.md` and `backend/RLS_QUICK_REFERENCE.md`

### API Security

#### API Key Types
1. **Anon Key** (Public)
   - Used in client-side code
   - Respects RLS policies
   - Limited to authenticated user's data

2. **Service Role Key** (Private)
   - Used in server-side code only
   - Bypasses RLS policies
   - Full database access

#### CORS Configuration
```python
# backend/.env
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Configured in main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Database Security

#### SQL Injection Prevention
```python
# ❌ NEVER do this
query = f"SELECT * FROM users WHERE email = '{email}'"

# ✅ Always use parameterized queries
query = "SELECT * FROM users WHERE email = $1"
result = await conn.fetch(query, email)
```

#### Connection Security
```python
# SSL/TLS for production
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

#### Audit Logging
```python
# All operations are logged
INSERT INTO audit_logs (
  user_id,
  action,
  table_name,
  record_id,
  changes,
  ip_address,
  created_at
) VALUES (...)
```

**Documentation:** See `DEPLOYMENT_CHECKLIST.md` for production security

---

## 🚢 Deployment

### Production Checklist

#### Backend Deployment
- [ ] Set strong SECRET_KEY (64+ characters)
- [ ] Configure production DATABASE_URL with SSL
- [ ] Set ALLOWED_ORIGINS to your domain
- [ ] Enable HTTPS/SSL
- [ ] Set up database backups
- [ ] Configure monitoring and logging
- [ ] Set up error tracking (Sentry)
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Set up health checks

#### Frontend Deployment
- [ ] Set NEXT_PUBLIC_API_URL to production backend
- [ ] Enable production build optimizations
- [ ] Configure CDN for static assets
- [ ] Set up SSL certificate
- [ ] Configure environment variables
- [ ] Enable error tracking
- [ ] Set up analytics
- [ ] Configure caching headers

#### Database Deployment
- [ ] Use managed PostgreSQL (AWS RDS, DigitalOcean, etc.)
- [ ] Enable automated backups
- [ ] Set up replication
- [ ] Configure connection pooling
- [ ] Enable SSL connections
- [ ] Set up monitoring
- [ ] Configure maintenance windows
- [ ] Set up point-in-time recovery

#### WebSocket Server Deployment
- [ ] Deploy to same region as backend
- [ ] Configure load balancing
- [ ] Enable sticky sessions
- [ ] Set up health checks
- [ ] Configure auto-scaling
- [ ] Enable monitoring
- [ ] Set up error tracking

### Deployment Platforms

#### Recommended Platforms

**Backend:**
- Railway (easiest)
- Render
- AWS Elastic Beanstalk
- DigitalOcean App Platform
- Heroku

**Frontend:**
- Vercel (recommended for Next.js)
- Netlify
- Cloudflare Pages
- AWS Amplify

**Database:**
- Supabase (managed PostgreSQL)
- AWS RDS
- DigitalOcean Managed Databases
- Neon (serverless PostgreSQL)

**WebSocket:**
- Railway
- Render
- AWS EC2
- DigitalOcean Droplets

### Environment Variables

#### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/zendbx_main?sslmode=require

# Security
SECRET_KEY=your-super-secret-key-64-characters-minimum
ALLOWED_ORIGINS=https://yourdomain.com

# AI (Optional)
OPENROUTER_API_KEY=your-openrouter-key
GROQ_API_KEY=your-groq-key
GEMINI_API_KEY=your-gemini-key

# WebSocket
WEBSOCKET_SERVER_URL=https://ws.yourdomain.com

# OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=https://ws.yourdomain.com
```

#### WebSocket Server (.env)
```env
PORT=3002
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
```

**Documentation:** See `DEPLOYMENT_CHECKLIST.md` for complete deployment guide

---

## 🎯 Unique Selling Points

### What Makes ZenDBX Different

#### 1. ⚡ Backend in 30 Seconds
- **Fastest Setup:** Create production-ready backend in 30 seconds
- **Zero Configuration:** No DevOps, no complex setup
- **Instant APIs:** Auto-generated REST endpoints
- **Competitor Comparison:** Supabase (2-3 min), Firebase (5+ min)

#### 2. 💬 Built-in Team Chat
- **Unique Feature:** Only BaaS with integrated chat
- **Real-time:** <100ms message delivery
- **Project-Scoped:** Chat per project
- **Persistent:** Message history stored

#### 3. 👥 True Team Collaboration
- **Role-Based Access:** Admin, Editor, Viewer
- **Unlimited Members:** No team size limits
- **Fine-Grained Permissions:** Control who can do what
- **Activity Tracking:** See what team members are doing

#### 4. ⚡ Realtime by Default
- **Zero Configuration:** Every table is realtime automatically
- **Auto-Triggers:** PostgreSQL triggers created automatically
- **<100ms Latency:** Near-instant updates
- **Competitor Comparison:** Supabase requires manual setup

#### 5. 🔐 Enterprise Security Out-of-the-Box
- **Row Level Security:** PostgreSQL RLS on all tables
- **RBAC:** Role-based access control
- **Audit Logging:** Track all changes
- **Production-Ready:** No additional security configuration needed

#### 6. 🧠 AI-Powered
- **Natural Language Queries:** Talk to your database
- **Query Explanations:** Understand what SQL does
- **Error Fixing:** AI suggests fixes
- **Multiple Models:** GPT-4, Claude, Llama, Gemini

#### 7. 🔄 Event-Driven Architecture
- **Automatic Triggers:** Created on every table
- **PostgreSQL LISTEN/NOTIFY:** Native database events
- **WebSocket Broadcasting:** Real-time event distribution
- **No Code Required:** Works automatically

#### 8. 🎨 All-in-One Platform
- **Database:** PostgreSQL with full SQL support
- **Authentication:** JWT + OAuth
- **Real-time:** WebSocket subscriptions
- **Chat:** Built-in team communication
- **APIs:** Auto-generated REST endpoints
- **AI:** Natural language queries
- **Backups:** Automated database backups

### Competitive Comparison

| Feature | ZenDBX | Supabase | Firebase | Appwrite |
|---------|--------|----------|----------|----------|
| Setup Time | 30 sec | 2-3 min | 5+ min | 10+ min |
| Team Chat | ✅ Built-in | ❌ None | ❌ None | ❌ None |
| Realtime | ✅ Auto | ⚠️ Manual | ✅ Auto | ⚠️ Manual |
| SQL Database | ✅ PostgreSQL | ✅ PostgreSQL | ❌ NoSQL | ✅ MariaDB |
| RLS | ✅ Auto | ✅ Manual | ⚠️ Basic | ⚠️ Basic |
| RBAC | ✅ 3-tier | ⚠️ Basic | ⚠️ Basic | ⚠️ Basic |
| AI Assistance | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Team Collab | ✅ Advanced | ⚠️ Basic | ⚠️ Basic | ⚠️ Basic |

**Documentation:** See `ZENDBX_USP_LIST.md` for complete USP analysis

---


## 📖 API Reference

### Authentication Endpoints

#### POST /v1/auth/{project_id}/signup
Create a new user account.

**Headers:**
- `Authorization: Bearer {ANON_KEY}`
- `Content-Type: application/json`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response:** 200 OK
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "provider": "email",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

#### POST /v1/auth/{project_id}/login
Authenticate existing user.

**Headers:**
- `Authorization: Bearer {ANON_KEY}`
- `Content-Type: application/json`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** 200 OK
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": { ... }
}
```

---

#### GET /v1/auth/{project_id}/user
Get current authenticated user.

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`

**Response:** 200 OK
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "provider": "email",
  "created_at": "2024-01-01T00:00:00Z",
  "last_login_at": "2024-01-02T00:00:00Z"
}
```

---

### Project Endpoints

#### GET /api/projects
List all projects for authenticated user.

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`

**Response:** 200 OK
```json
[
  {
    "id": "uuid",
    "name": "My Project",
    "description": "Project description",
    "database_name": "proj_abc123",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

#### POST /api/projects
Create a new project (creates new database).

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`
- `Content-Type: application/json`

**Body:**
```json
{
  "name": "My New Project",
  "description": "Optional description"
}
```

**Response:** 201 Created
```json
{
  "id": "uuid",
  "name": "My New Project",
  "database_name": "proj_abc123",
  "anon_key": "eyJhbGc...",
  "service_role_key": "eyJhbGc...",
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### Database Endpoints

#### GET /api/{project_id}/db/tables
List all tables in project database.

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`

**Response:** 200 OK
```json
[
  {
    "table_name": "users",
    "row_count": 150,
    "size_bytes": 8192,
    "columns": [
      {
        "name": "id",
        "type": "integer",
        "nullable": false,
        "primary_key": true
      },
      {
        "name": "email",
        "type": "character varying",
        "nullable": false,
        "unique": true
      }
    ]
  }
]
```

---

#### POST /api/{project_id}/db/tables
Create a new table.

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`
- `Content-Type: application/json`

**Body:**
```json
{
  "table_name": "customers",
  "columns": [
    {
      "name": "id",
      "type": "SERIAL",
      "primary_key": true
    },
    {
      "name": "email",
      "type": "VARCHAR(255)",
      "nullable": false,
      "unique": true
    },
    {
      "name": "name",
      "type": "TEXT"
    },
    {
      "name": "created_at",
      "type": "TIMESTAMPTZ",
      "default": "NOW()"
    }
  ]
}
```

**Response:** 201 Created
```json
{
  "table_name": "customers",
  "columns": [ ... ],
  "message": "Table created successfully"
}
```

---

#### POST /api/projects/{project_id}/query
Execute SQL query.

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`
- `Content-Type: application/json`

**Body:**
```json
{
  "sql": "SELECT * FROM customers WHERE age > 25 ORDER BY created_at DESC"
}
```

**Response:** 200 OK
```json
{
  "columns": ["id", "name", "email", "age", "created_at"],
  "rows": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "age": 30,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "row_count": 1,
  "execution_time_ms": 15
}
```

---

### REST API Endpoints (Auto-Generated)

#### GET /rest/v1/{table}
List records with filtering, sorting, and pagination.

**Headers:**
- `x-project-id: {PROJECT_ID}`
- `Authorization: Bearer {ANON_KEY or USER_TOKEN}`

**Query Parameters:**
- `{column}=eq.{value}` - Equals
- `{column}=gt.{value}` - Greater than
- `{column}=lt.{value}` - Less than
- `{column}=gte.{value}` - Greater than or equal
- `{column}=lte.{value}` - Less than or equal
- `{column}=like.{pattern}` - Pattern matching
- `order={column}.{asc|desc}` - Sorting
- `limit={number}` - Limit results
- `offset={number}` - Skip results
- `select={columns}` - Select specific columns

**Examples:**
```bash
# Get all users
GET /rest/v1/users

# Get users older than 25
GET /rest/v1/users?age=gt.25

# Get users, sorted by creation date
GET /rest/v1/users?order=created_at.desc

# Get 10 users, skip first 20
GET /rest/v1/users?limit=10&offset=20

# Get only id and name columns
GET /rest/v1/users?select=id,name

# Complex query
GET /rest/v1/users?age=gt.25&status=eq.active&order=created_at.desc&limit=10
```

**Response:** 200 OK
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

#### POST /rest/v1/{table}
Create a new record.

**Headers:**
- `x-project-id: {PROJECT_ID}`
- `Authorization: Bearer {USER_TOKEN}`
- `Content-Type: application/json`

**Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "age": 28
}
```

**Response:** 201 Created
```json
{
  "id": 2,
  "name": "Jane Smith",
  "email": "jane@example.com",
  "age": 28,
  "created_at": "2024-01-02T00:00:00Z"
}
```

---

#### PATCH /rest/v1/{table}?{filter}
Update records matching filter.

**Headers:**
- `x-project-id: {PROJECT_ID}`
- `Authorization: Bearer {USER_TOKEN}`
- `Content-Type: application/json`

**Body:**
```json
{
  "age": 29
}
```

**Example:**
```bash
PATCH /rest/v1/users?id=eq.2
```

**Response:** 200 OK
```json
{
  "id": 2,
  "name": "Jane Smith",
  "email": "jane@example.com",
  "age": 29,
  "updated_at": "2024-01-03T00:00:00Z"
}
```

---

#### DELETE /rest/v1/{table}?{filter}
Delete records matching filter.

**Headers:**
- `x-project-id: {PROJECT_ID}`
- `Authorization: Bearer {USER_TOKEN}`

**Example:**
```bash
DELETE /rest/v1/users?id=eq.2
```

**Response:** 200 OK
```json
{
  "message": "Record deleted successfully",
  "deleted_count": 1
}
```

---

### AI Endpoints

#### POST /api/projects/{project_id}/ai/query
Convert natural language to SQL.

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`
- `Content-Type: application/json`

**Body:**
```json
{
  "question": "Show me all customers who signed up this month",
  "model": "gpt-4"
}
```

**Response:** 200 OK
```json
{
  "question": "Show me all customers who signed up this month",
  "sql": "SELECT * FROM customers WHERE created_at >= date_trunc('month', CURRENT_DATE)",
  "explanation": "This query retrieves all customer records created in the current month",
  "confidence": 0.95
}
```

---

#### POST /api/projects/{project_id}/ai/explain
Explain SQL query in plain English.

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`
- `Content-Type: application/json`

**Body:**
```json
{
  "sql": "SELECT u.name, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.name"
}
```

**Response:** 200 OK
```json
{
  "sql": "...",
  "explanation": "This query counts the number of orders for each user",
  "steps": [
    "Join users table with orders table",
    "Group results by user name",
    "Count orders for each user"
  ]
}
```

---

### Team Endpoints

#### POST /api/projects/{project_id}/invite
Invite team member to project.

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`
- `Content-Type: application/json`

**Body:**
```json
{
  "email": "teammate@example.com",
  "role": "editor"
}
```

**Response:** 200 OK
```json
{
  "message": "User invited successfully",
  "member": {
    "user_id": "uuid",
    "email": "teammate@example.com",
    "role": "editor",
    "joined_at": "2024-01-01T00:00:00Z"
  }
}
```

---

#### GET /api/projects/{project_id}/members
List all team members.

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`

**Response:** 200 OK
```json
[
  {
    "user_id": "uuid",
    "email": "owner@example.com",
    "name": "Project Owner",
    "role": "admin",
    "joined_at": "2024-01-01T00:00:00Z"
  },
  {
    "user_id": "uuid",
    "email": "teammate@example.com",
    "name": "Team Member",
    "role": "editor",
    "joined_at": "2024-01-02T00:00:00Z"
  }
]
```

---

### Backup Endpoints

#### POST /api/projects/{project_id}/backups
Create manual backup.

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`

**Response:** 200 OK
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "filename": "backup_20240101_120000.sql.gz",
  "size_bytes": 1048576,
  "created_at": "2024-01-01T12:00:00Z"
}
```

---

#### GET /api/projects/{project_id}/backups
List all backups.

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`

**Response:** 200 OK
```json
[
  {
    "id": "uuid",
    "filename": "backup_20240101_120000.sql.gz",
    "size_bytes": 1048576,
    "created_at": "2024-01-01T12:00:00Z"
  }
]
```

---

#### POST /api/projects/{project_id}/backups/{backup_id}/restore
Restore from backup.

**Headers:**
- `Authorization: Bearer {USER_TOKEN}`

**Response:** 200 OK
```json
{
  "message": "Backup restored successfully",
  "restored_at": "2024-01-02T12:00:00Z"
}
```

---

## 📊 Database Schema

### Main Database (zendbx_main)

#### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    plan VARCHAR(50) DEFAULT 'free',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### projects
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    database_name VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### api_keys
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    key_type VARCHAR(50) NOT NULL, -- 'anon' or 'service_role'
    key_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### project_members
```sql
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'admin', 'editor', 'viewer'
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);
```

#### query_history
```sql
CREATE TABLE query_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    question TEXT,
    sql_query TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    execution_time_ms INTEGER,
    rows_returned INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### saved_queries
```sql
CREATE TABLE saved_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sql_query TEXT NOT NULL,
    tags TEXT[],
    is_favorite BOOLEAN DEFAULT false,
    run_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### audit_logs
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    action VARCHAR(255) NOT NULL,
    table_name VARCHAR(255),
    record_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### backups
```sql
CREATE TABLE backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    size_bytes BIGINT,
    backup_type VARCHAR(50) DEFAULT 'manual',
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Project Database Template

Each project database is created with:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Auth helper functions
CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS TEXT AS $
BEGIN
  RETURN current_setting('app.current_user_id', true);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.current_role()
RETURNS TEXT AS $
BEGIN
  RETURN current_setting('app.current_role', true);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.is_authenticated()
RETURNS BOOLEAN AS $
BEGIN
  RETURN auth.current_user_id() IS NOT NULL;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.is_service_role()
RETURNS BOOLEAN AS $
BEGIN
  RETURN auth.current_role() = 'service_role';
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Realtime notification function
CREATE OR REPLACE FUNCTION notify_database_change()
RETURNS trigger AS $
DECLARE
  payload JSON;
BEGIN
  payload = json_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'timestamp', NOW(),
    'new', CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
    'old', CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END
  );
  
  PERFORM pg_notify('db_change', payload::text);
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$ LANGUAGE plpgsql;
```

---

