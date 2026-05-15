# How to Invite Team Members - Step by Step Guide

## Prerequisites
⚠️ **IMPORTANT**: The person you want to invite MUST be registered in Zendbx first!

### Step 1: Have Your Team Member Register
1. Ask your team member to go to: `http://localhost:3000/signup`
2. They should create an account with their email
3. They should verify their account and login at least once

### Step 2: Invite Them to Your Project

#### Option A: From Team Page
1. Go to sidebar → Click "Team"
2. Click on the project card you want to invite them to
3. In the left panel, you'll see "Invite Form"
4. Enter their **exact email address** (the one they registered with)
5. Select their role:
   - **Admin**: Full access, can manage team
   - **Editor**: Can edit data and send messages
   - **Viewer**: Read-only access
6. Click "Invite" button

#### Option B: From Projects Page
1. Go to sidebar → Click "Projects"
2. Click the "Team" button on any project
3. Follow steps 3-6 from Option A

## Troubleshooting

### Error: "User with email X not found"
**Solution**: The person needs to register first at `/signup`

### Error: "User is already a member"
**Solution**: They're already in the project. Check the members list.

### Error: "Only project admins can invite members"
**Solution**: You need to be an admin. Check your role in the project.

### Can't see the invite form
**Solution**: Make sure you're on the project's team page, not the team overview page.

## Quick Test (For Development)

### Create a Second User Manually
```sql
-- Connect to nexora_main database
-- Run this to create a test user:

INSERT INTO users (email, password_hash, full_name, is_verified, is_active)
VALUES (
    'teammate@test.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aqaaf6o/9u2i', -- password: "password123"
    'Test Teammate',
    true,
    true
);
```

### Then Invite Them
1. Go to your project's team page
2. Enter: `teammate@test.com`
3. Select role: `editor`
4. Click "Invite"

### Login as the New User
1. Open incognito/private window
2. Go to: `http://localhost:3000/login`
3. Login with:
   - Email: `teammate@test.com`
   - Password: `password123`
4. They should now see the project in their projects list!

## API Testing (Advanced)

### Test Invite API Directly
```bash
# Get your token first
TOKEN="your-jwt-token-here"
PROJECT_ID="your-project-id"

# Invite user
curl -X POST http://localhost:8000/api/projects/$PROJECT_ID/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teammate@test.com",
    "role": "editor"
  }'
```

### Check Members
```bash
curl http://localhost:8000/api/projects/$PROJECT_ID/members \
  -H "Authorization: Bearer $TOKEN"
```

## Database Verification

### Check if user exists
```sql
SELECT id, email, full_name, is_verified 
FROM users 
WHERE email = 'teammate@test.com';
```

### Check project members
```sql
SELECT 
    pm.role,
    u.email,
    u.full_name,
    pm.joined_at
FROM project_members pm
JOIN users u ON pm.user_id = u.id
WHERE pm.project_id = 'your-project-id';
```

### Manually add member (if needed)
```sql
INSERT INTO project_members (project_id, user_id, role, invited_by)
VALUES (
    'your-project-id',
    (SELECT id FROM users WHERE email = 'teammate@test.com'),
    'editor',
    'your-user-id'
);
```

## Common Scenarios

### Scenario 1: Invite a Real Person
1. They register at `/signup`
2. You invite them via the Team page
3. They login and see the project

### Scenario 2: Testing Locally
1. Create test user in database (see SQL above)
2. Invite via Team page
3. Login in incognito window to test

### Scenario 3: Multiple Team Members
1. Have each person register
2. Invite them one by one
3. They can all chat in real-time!

## What Happens After Invite?

1. ✅ User is added to `project_members` table
2. ✅ They can see the project in their projects list
3. ✅ They can access based on their role:
   - **Admin**: Manage team, edit data, chat
   - **Editor**: Edit data, chat
   - **Viewer**: View data only
4. ✅ Real-time chat works immediately
5. ✅ RLS policies protect their access

## Need Help?

### Check Backend Logs
Look for errors when clicking "Invite":
```
INFO:     POST /api/projects/{id}/invite
```

### Check Browser Console
Open DevTools (F12) → Console tab
Look for error messages

### Check Network Tab
DevTools → Network tab → Look for the invite request
- Status should be 200 OK
- Response should show success message

## Summary

**The key requirement**: The person MUST be registered in Zendbx before you can invite them!

1. They register → 2. You invite → 3. They login → 4. They see the project ✅
