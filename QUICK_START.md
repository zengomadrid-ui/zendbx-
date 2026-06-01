# Quick Start Guide

## Services Running

### 1. MinIO (Storage)
```bash
# Status
docker ps | findstr minio

# Access Console
http://localhost:9001
Username: minioadmin
Password: minioadmin
```

### 2. Backend (API)
```bash
# Should already be running on port 8000
# If not, start with:
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend (Dashboard)
```bash
# Start if not running:
cd frontend
npm run dev
# Access at: http://localhost:3000
```

## Test Storage Upload

1. Open: http://localhost:3000
2. Login with your credentials
3. Go to: **Dashboard → Storage → Buckets**
4. Click on a bucket (or create one)
5. **Upload a file** - it will save to MinIO!

## Verify Upload in MinIO

1. Open MinIO Console: http://localhost:9001
2. Login: minioadmin / minioadmin
3. Click **Buckets → zendbx-storage**
4. Browse your uploaded files

## Stop/Start Services

### Stop All
```bash
# Stop MinIO
docker-compose down

# Stop Backend (Ctrl+C in terminal)

# Stop Frontend (Ctrl+C in terminal)
```

### Start All
```bash
# Start MinIO
docker-compose up -d

# Start Backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start Frontend
cd frontend
npm run dev
```

## Ports

- **Frontend**: 3000
- **Backend**: 8000
- **MinIO API**: 9000
- **MinIO Console**: 9001
- **PostgreSQL**: 5432

## Storage Features

✅ File upload/download
✅ File deletion
✅ File renaming
✅ Storage quotas
✅ Public/private buckets
✅ MIME type validation
✅ File size limits per plan
✅ Storage analytics

## Need Help?

- **MinIO Setup**: See `MINIO_SETUP_COMPLETE.md`
- **Backend Guide**: See `backend/QUICKSTART.md`
- **Full README**: See `README.md`
