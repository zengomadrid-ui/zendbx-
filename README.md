# ZENDBX - Complete Backend-as-a-Service Platform

> PostgreSQL + Auto-Generated APIs + AI-Powered SQL + Authentication

A production-ready backend platform with multi-tenant architecture, built-in authentication, auto-generated REST APIs, and AI-powered database management.

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

### 1. Database Setup
```sql
-- Create main database in PostgreSQL
CREATE DATABASE zendbx_main;

-- Run initialization script
psql -U postgres -d zendbx_main -f backend/database/init_main_database.sql
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Configure .env file
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# Configure .env.local
cp .env.local.example .env.local
```

### 4. Start Application
```bash
# Windows
START.bat

# Or manually:
# Terminal 1: cd backend && python -m uvicorn app.main:app --reload
# Terminal 2: cd frontend && npm run dev
```

Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## ✨ Features

### 🔐 Authentication & Security
- **JWT Authentication** - Secure token-based auth (Supabase-style)
- **OAuth Integration** - Google, GitHub login support
- **Row Level Security (RLS)** - PostgreSQL RLS enforcement on all APIs
- **MFA Support** - Two-factor authentication
- **Session Management** - Active session tracking and control
- **RBAC** - Role-based access control

### 🗄️ Database Management
- **Multi-tenant Architecture** - Isolated database per project
- **SQL Editor** - Professional editor with syntax highlighting
- **Table Management** - Visual table editor with inline editing
- **Schema Designer** - Create and modify database schemas
- **Functions & Triggers** - Manage PostgreSQL functions and triggers
- **Backup & Restore** - Automated database backups

### 🚀 Auto-Generated APIs
- **REST API** - Instant CRUD endpoints for all tables
- **API Keys** - Anon and Service Role keys
- **Query Parameters** - Filtering, sorting, pagination
- **API Playground** - Interactive API testing interface

### 🤖 AI-Powered Features
- **Natural Language to SQL** - Convert questions to queries
- **Query Explanations** - Understand what SQL does
- **Error Fixing** - AI suggests fixes for failed queries
- **Query Optimization** - Performance improvement suggestions

### 📊 Developer Tools
- **Query History** - Track all executed queries
- **Saved Queries** - Reusable query templates
- **CSV Import/Export** - Bulk data operations
- **Real-time Updates** - WebSocket support for live data
- **Audit Logging** - Complete activity tracking

## 📁 Project Structure

```
nexora-ai/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── core/           # Core functionality
│   │   ├── models/         # Pydantic schemas
│   │   └── services/       # Business logic
│   └── database/           # SQL scripts
├── frontend/               # Next.js frontend
│   ├── app/               # App router pages
│   └── components/        # React components
└── .kiro/                 # Specifications
```

## 🎯 Usage

### Creating a Project
1. Sign up / Log in
2. Go to Projects page
3. Click "New Project"
4. Enter project name and description

### Running SQL Queries
1. Select a project
2. Go to SQL Editor
3. Write your SQL (supports multi-statement queries)
4. Click Run or press Ctrl+Enter

### Managing Tables
1. Go to Table Editor
2. View all tables in your project
3. Click a table to view data
4. Use Delete button to remove tables

### Using AI Features
1. Go to SQL Editor
2. Type a natural language question
3. AI generates the SQL query
4. Review and execute

## 🔧 Configuration

### Backend (.env)
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/zendbx_main
SECRET_KEY=your-secret-key
OPENROUTER_API_KEY=your-openrouter-key
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 📚 API Documentation

Visit http://localhost:8000/docs for interactive API documentation.

## 🛠️ Tech Stack

- **Backend**: FastAPI, PostgreSQL, asyncpg
- **Frontend**: Next.js 14, React, TailwindCSS
- **AI**: OpenRouter (GPT-4, Claude, Llama)
- **Auth**: JWT tokens

## 🙏 Acknowledgments

- Inspired by Supabase and WowSQL
- Powered by OpenRouter AI
- Built with FastAPI and Next.js

## 🚀 Features

### Core Features (Supabase-style)
- ✅ PostgreSQL database per project (multi-tenant isolation)
- ✅ Visual table editor with inline data editing
- ✅ Professional SQL editor with syntax highlighting
- ✅ User authentication (JWT + OAuth)
- ✅ Auto-generated REST API for all tables
- ✅ Query history and saved queries
- ✅ API key management

### AI-Powered Features (Our USP)
- 🤖 Natural language to SQL conversion
- 💡 AI query explanations
- 🎯 Smart query suggestions
- 📊 Data insights (coming soon)
- 📁 CSV auto-import with schema detection (coming soon)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                     │
│  - Landing Page                                              │
│  - Dashboard (Supabase-style UI)                            │
│  - SQL Editor, Table Editor, Projects                       │
│  - AI Natural Language Query Interface                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (FastAPI)                       │
│  - Authentication (JWT)                                      │
│  - Project Management (creates databases)                   │
│  - Table CRUD Operations                                     │
│  - SQL Query Execution                                       │
│  - AI Service (OpenRouter)                                   │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────────┐    ┌──────────────────┐
│   PostgreSQL     │    │   OpenRouter     │
│                  │    │   (AI Models)    │
│  Main Database:  │    │   - GPT-4        │
│  - Users         │    │   - Claude       │
│  - Projects      │    │   - Llama        │
│  - Metadata      │    └──────────────────┘
│                  │
│  Project DBs:    │
│  - proj_abc123   │
│  - proj_def456   │
└──────────────────┘
```

## 📁 Project Structure

```
nexora-ai/
├── frontend/                 # Next.js 14 frontend
│   ├── app/
│   │   ├── (auth)/          # Login, Signup pages
│   │   ├── (dashboard)/     # Dashboard pages
│   │   └── page.tsx         # Landing page
│   └── components/
│       └── landing/         # Landing page components
│
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   │   ├── auth.py     # Authentication
│   │   │   ├── projects.py # Project management
│   │   │   ├── tables.py   # Table operations
│   │   │   ├── queries.py  # SQL execution
│   │   │   └── ai.py       # AI features
│   │   ├── core/           # Core functionality
│   │   │   ├── config.py   # Configuration
│   │   │   ├── database.py # Database connections
│   │   │   └── security.py # Auth & security
│   │   ├── models/         # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   │   └── ai_service.py # AI integration
│   │   └── main.py         # FastAPI app
│   ├── database/
│   │   └── init_main_database.sql # Database schema
│   └── requirements.txt
│
└── .kiro/specs/nexora-ai/  # Planning documents
    ├── requirements.md
    ├── design.md
    ├── complete-architecture.md
    └── database-architecture.md
```

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ (for frontend)
- Python 3.10+ (for backend)
- PostgreSQL 15+ (with pgAdmin)
- OpenRouter API key ([get here](https://openrouter.ai/keys))

### Backend Setup

1. **Create Database**
   ```bash
   # In pgAdmin, create database: nexora_main
   # Then run: backend/database/init_main_database.sql
   ```

2. **Configure Environment**
   ```bash
   cd backend
   copy .env.example .env
   # Edit .env with your database credentials and OpenRouter API key
   ```

3. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start Backend**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

   Backend runs at: http://localhost:8000
   API Docs: http://localhost:8000/docs

### Frontend Setup

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure Environment**
   ```bash
   copy .env.local.example .env.local
   # Edit .env.local with backend API URL
   ```

3. **Start Frontend**
   ```bash
   npm run dev
   ```

   Frontend runs at: http://localhost:3000

## 📚 Documentation

### Getting Started
- [Getting Started Guide](GETTING_STARTED.md) - Quick start guide
- [Backend Setup](backend/QUICKSTART.md) - Backend configuration
- [Database Setup](DATABASE_SETUP_GUIDE.md) - Database initialization

### Features
- [Authentication Guide](HOW_IT_WORKS.md) - Auth system overview
- [RLS Implementation](RLS_IMPLEMENTATION_COMPLETE.md) - Row Level Security
- [CSV Import Guide](CSV_IMPORT_GUIDE.md) - Data import/export
- [WebSocket Guide](WEBSOCKET_QUICKSTART.md) - Real-time features

### Development
- [API Documentation](http://localhost:8000/docs) - Interactive API docs
- [Testing Guide](backend/TESTING_GUIDE.md) - Testing procedures
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) - Production deployment

## 🎯 How It Works

### 1. User Creates a Project
```
User clicks "New Project" 
→ Backend creates new PostgreSQL database (proj_abc123)
→ Stores metadata in main database
→ User can now create tables in their project
```

### 2. User Creates Tables
```
User designs table in Table Editor
→ Backend executes CREATE TABLE in project database
→ Table is ready for data
```

### 3. User Queries with Natural Language
```
User types: "Show me all customers who signed up this month"
→ AI converts to SQL: SELECT * FROM customers WHERE created_at >= ...
→ Backend executes query in project database
→ Results displayed in UI
```

## 🔑 Key Features Explained

### Multi-Tenant Database Architecture
- Each project gets its own PostgreSQL database
- Complete data isolation between projects
- Exactly like Supabase's architecture

### AI-Powered Queries
- Uses OpenRouter API (GPT-4, Claude, Llama)
- Converts natural language to SQL
- Provides query explanations
- Suggests useful queries based on schema

### Professional UI
- Supabase-inspired dashboard design
- Dark theme with orange accents
- Resizable panels and sidebars
- Monaco editor for SQL

## 🛠️ Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React Query
- Monaco Editor

### Backend
- FastAPI (Python)
- PostgreSQL 15+
- SQLAlchemy 2.0
- asyncpg
- OpenRouter API

## 📊 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project (creates database)
- `DELETE /api/projects/{id}` - Delete project

### Tables
- `GET /api/{project_id}/tables` - List tables
- `POST /api/{project_id}/tables` - Create table
- `GET /api/{project_id}/tables/{name}/rows` - Get data

### Queries
- `POST /api/projects/{id}/query` - Execute SQL
- `GET /api/projects/{id}/query/history` - Query history
- `POST /api/projects/{id}/query/save` - Save query

### AI Features
- `POST /api/projects/{id}/ai/query` - Natural language to SQL
- `POST /api/projects/{id}/ai/explain` - Explain SQL
- `GET /api/projects/{id}/ai/suggest` - Get suggestions

## 🎨 Design System

### Colors
- Background: `#1c1c1c` (main), `#181818` (panels)
- Borders: `#2a2a2a`
- Accent: Orange (`#f97316`)
- Text: White/Gray

### Components
- Compact 12px top bar
- Resizable sidebars with drag handles
- Professional table editors
- Monaco code editor for SQL

## 🚀 Deployment

### Backend
- Deploy to: Railway, Render, or AWS
- Database: Managed PostgreSQL (AWS RDS, Supabase, etc.)
- Environment variables: Set in platform

### Frontend
- Deploy to: Vercel, Netlify
- Environment variables: Set NEXT_PUBLIC_API_URL

## 📈 Roadmap

- [x] Core authentication
- [x] Project management
- [x] Table editor
- [x] SQL editor
- [x] AI natural language queries
- [ ] CSV upload & auto-import
- [ ] File storage
- [ ] Real-time subscriptions
- [ ] OAuth (Google, GitHub)
- [ ] API key authentication
- [ ] Data insights dashboard
- [ ] Query templates
- [ ] Team collaboration

## 🤝 Contributing

This is a personal project, but suggestions are welcome!

## 📝 License

MIT License

## 🙏 Acknowledgments

- Inspired by Supabase and WowSQL
- Powered by OpenRouter AI
- Built with FastAPI and Next.js

---

**Built with ❤️ for developers who want to query databases naturally**
