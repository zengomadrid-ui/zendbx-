# ZENDBX - Getting Started Guide

## 🚀 Quick Start

ZENDBX is a complete backend-as-a-service platform with built-in authentication, database management, and API generation.

### Prerequisites
- PostgreSQL 15+ installed and running
- Python 3.8+ (for backend)
- Node.js 18+ (for frontend)

### Start the Application

1. **Start Backend:**
   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Default Admin Login
- Email: `pawansrikumar@simplita.ai`
- Password: `Pawan@121`

---

## 📚 Documentation Files

### Essential Guides
- **README.md** - Project overview and architecture
- **DATABASE_SETUP_GUIDE.md** - Database configuration and setup
- **COMPLETE_AUTH_IMPLEMENTATION_GUIDE.md** - Authentication system guide
- **CORS_FIX_SUMMARY.md** - CORS configuration for external apps
- **PROJECT_SUMMARY.md** - Complete project features and status
- **DOCUMENTATION.md** - API documentation and usage

### Backend Guides
- **backend/QUICKSTART.md** - Backend quick start
- **backend/TESTING_GUIDE.md** - Testing guide
- **backend/IMPLEMENTATION_STATUS.md** - Implementation status
- **backend/HYBRID_API_GUIDE.md** - Hybrid API usage

---

## 🔐 Using ZENDBX Authentication

### Step 1: Create a Project
1. Login to ZENDBX dashboard
2. Go to Projects → Create New Project
3. Note your project credentials

### Step 2: Get Your Credentials
Go to Dashboard → API Keys and copy:
- **API URL:** `http://localhost:8000`
- **Project ID:** (UUID shown on page)
- **Anon Key:** (Public key for authentication)

### Step 3: Use in Your Application

See `example_login_page.html` for a complete working example.

```javascript
const CONFIG = {
    API_URL: 'http://localhost:8000',
    PROJECT_ID: 'your-project-id',
    ANON_KEY: 'your-anon-key'
};

// Signup
async function signup(email, password, fullName) {
    const response = await fetch(`${CONFIG.API_URL}/v1/auth/${CONFIG.PROJECT_ID}/signup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.ANON_KEY}`
        },
        body: JSON.stringify({ email, password, full_name: fullName })
    });
    return await response.json();
}

// Login
async function login(email, password) {
    const response = await fetch(`${CONFIG.API_URL}/v1/auth/${CONFIG.PROJECT_ID}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CONFIG.ANON_KEY}`
        },
        body: JSON.stringify({ email, password })
    });
    return await response.json();
}
```

### Step 4: View Users in Dashboard
After users sign up, view them at:
```
http://localhost:3000/dashboard/projects/{project-id}/auth/users
```

---

## 🎯 Key Features

### ✅ Authentication System
- Email/password authentication
- JWT token generation
- Automatic user table creation
- Password hashing (bcrypt)
- OAuth support (Google, GitHub)
- MFA support
- Session management

### ✅ Database Management
- PostgreSQL integration
- Auto-generated APIs
- SQL editor with AI assistance
- Table management
- Query history
- Data import/export

### ✅ Project Management
- Multi-project support
- Isolated databases per project
- API key management
- RBAC (Role-Based Access Control)
- Audit logging

### ✅ Developer Tools
- Interactive API playground
- Auto-generated REST APIs
- Real-time query execution
- AI-powered SQL generation
- Comprehensive documentation

---

## 📁 Project Structure

```
zengo/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/         # API endpoints
│   │   ├── core/        # Core functionality
│   │   ├── models/      # Data models
│   │   └── services/    # Business logic
│   └── database/        # SQL migrations
├── frontend/            # Next.js frontend
│   ├── app/            # App routes
│   └── components/     # React components
└── docs/               # Documentation
```

---

## 🔧 Configuration

### Backend (.env)
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/nexora_main
SECRET_KEY=your-secret-key
GROQ_API_KEY=your-groq-api-key
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🆘 Troubleshooting

### Backend won't start
- Check PostgreSQL is running
- Verify database credentials in `.env`
- Run: `pip install -r requirements.txt`

### Frontend won't start
- Run: `npm install`
- Check port 3000 is available
- Verify `.env.local` exists

### CORS errors
- Check `backend/.env` has correct `ALLOWED_ORIGINS`
- Restart backend after changes
- See `CORS_FIX_SUMMARY.md` for details

### Can't see users in dashboard
- Verify you're using the correct project ID
- Check users are created via `/v1/auth/{project_id}/signup`
- Navigate to: Projects → [Your Project] → Auth → Users

---

## 📞 Support

For issues or questions:
1. Check documentation files
2. Review API docs at http://localhost:8000/docs
3. Check browser console for errors
4. Verify backend logs

---

## 🎉 Example Files

- **example_login_page.html** - Complete authentication example
- Test it by opening in browser
- Users created will appear in ZENDBX dashboard

---

**Built with ❤️ using FastAPI, Next.js, and PostgreSQL**
