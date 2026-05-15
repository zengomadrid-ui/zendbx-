# Wildcard Subdomain Setup for ZenDBX
## Project URLs: `project-name-id.zendbx.in`

This guide explains how to set up wildcard subdomain routing so each project gets its own subdomain like `my-todo-app-a18a05a0.zendbx.in`.

## 🎯 What You Get

### Before (Path-based)
```
http://localhost:8000/p/ramos-test-1-c0538580
```

### After (Subdomain-based)
```
Development: http://ramos-test-1-c0538580.localhost:8000
Production:  https://ramos-test-1-c0538580.zendbx.in
```

## 🌐 DNS Configuration

### 1. Add Wildcard DNS Record

In your DNS provider (Cloudflare, Route53, etc.), add:

```
Type: A
Name: *
Value: Your-Server-IP
TTL: Auto or 300
```

This creates a wildcard record that routes ALL subdomains to your server.

### 2. Verify DNS Propagation

```bash
# Test wildcard DNS
nslookup test-project.zendbx.in
nslookup another-project.zendbx.in

# Should both resolve to your server IP
```

## 🔧 Nginx Configuration

### Update Nginx for Wildcard Subdomains

```bash
sudo nano /etc/nginx/sites-available/zendbx.in
```

Add this configuration:

```nginx
# Wildcard subdomain for project APIs
server {
    listen 80;
    listen [::]:80;
    server_name *.zendbx.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name *.zendbx.in;

    # Use wildcard SSL certificate
    ssl_certificate /etc/letsencrypt/live/zendbx.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zendbx.in/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    # Extract subdomain and pass to backend
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 SSL Certificate for Wildcard

### Option 1: Let's Encrypt Wildcard Certificate

```bash
# Install certbot with DNS plugin (example for Cloudflare)
sudo apt-get install certbot python3-certbot-dns-cloudflare

# Create Cloudflare credentials file
sudo nano /root/.secrets/cloudflare.ini
```

Add your Cloudflare API token:
```ini
dns_cloudflare_api_token = your-cloudflare-api-token
```

Secure the file:
```bash
sudo chmod 600 /root/.secrets/cloudflare.ini
```

Get wildcard certificate:
```bash
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  -d zendbx.in \
  -d *.zendbx.in
```

### Option 2: Manual DNS Challenge

```bash
sudo certbot certonly --manual --preferred-challenges dns -d zendbx.in -d *.zendbx.in
```

Follow the prompts to add TXT records to your DNS.

## 🔧 Backend Configuration

The backend is already configured! Just ensure your `.env` has:

```env
# Production
BASE_DOMAIN=zendbx.in
ENABLE_SUBDOMAIN_ROUTING=true
ENVIRONMENT=production

# Development
BASE_DOMAIN=localhost
ENABLE_SUBDOMAIN_ROUTING=true
ENVIRONMENT=development
```

## 🧪 Testing

### 1. Test Locally (Development)

For local testing, you need to edit your hosts file:

**Windows:** `C:\Windows\System32\drivers\etc\hosts`
**Linux/Mac:** `/etc/hosts`

Add:
```
127.0.0.1 test-project-12345678.localhost
127.0.0.1 another-project-87654321.localhost
```

Then test:
```bash
curl http://test-project-12345678.localhost:8000/rest/v1/users
```

### 2. Test in Production

```bash
# Test project subdomain
curl https://my-project-a18a05a0.zendbx.in/rest/v1/users \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Should return project data
```

## 📋 How It Works

### 1. Project Creation

When a user creates a project named "My Todo App", the system:
- Generates slug: `my-todo-app-a18a05a0` (name + first 8 chars of UUID)
- Stores slug in database
- Returns API URLs:
  - Subdomain: `https://my-todo-app-a18a05a0.zendbx.in`
  - Path: `https://api.zendbx.in/p/my-todo-app-a18a05a0`

### 2. Request Routing

When a request comes to `my-todo-app-a18a05a0.zendbx.in`:

1. **Nginx** receives request and forwards to backend with `Host` header
2. **Middleware** extracts subdomain from `Host` header
3. **Database lookup** resolves slug to project ID
4. **Project database** connection is established
5. **Request processed** with project context

### 3. Routing Priority

The middleware checks in this order:
1. **Subdomain** (e.g., `project.zendbx.in`) - Highest priority
2. **Path prefix** (e.g., `/p/project-slug`) - Fallback
3. **Header** (e.g., `x-project-id`) - Legacy support

## 🎨 Frontend Integration

Update your frontend to use subdomain URLs:

```typescript
// Get project API URL
const response = await fetch(`${API_URL}/api/projects/${projectId}/api-urls`);
const { api_url_subdomain } = await response.json();

// Use subdomain URL for API calls
const apiUrl = api_url_subdomain; // https://project-slug.zendbx.in

// Make API calls
fetch(`${apiUrl}/rest/v1/users`, {
  headers: {
    'Authorization': `Bearer ${anonKey}`
  }
});
```

## 🔍 Debugging

### Check DNS Resolution
```bash
nslookup your-project-slug.zendbx.in
# Should return your server IP
```

### Check SSL Certificate
```bash
openssl s_client -connect your-project-slug.zendbx.in:443 -servername your-project-slug.zendbx.in
# Should show valid certificate
```

### Check Backend Logs
```bash
pm2 logs zendbx-backend | grep "subdomain"
# Should show: "Extracted project slug from subdomain: your-project-slug"
```

### Test Middleware
```bash
# Should work with subdomain
curl https://project-slug.zendbx.in/rest/v1/users \
  -H "Authorization: Bearer ANON_KEY"

# Should also work with path
curl https://api.zendbx.in/p/project-slug/rest/v1/users \
  -H "Authorization: Bearer ANON_KEY"

# Should also work with header
curl https://api.zendbx.in/rest/v1/users \
  -H "Authorization: Bearer ANON_KEY" \
  -H "x-project-id: PROJECT_UUID"
```

## 🚨 Common Issues

### Issue 1: Subdomain Not Resolving
**Solution:** Check DNS propagation (can take up to 48 hours)
```bash
dig your-project.zendbx.in
```

### Issue 2: SSL Certificate Error
**Solution:** Ensure wildcard certificate includes `*.zendbx.in`
```bash
sudo certbot certificates
```

### Issue 3: 404 Not Found
**Solution:** Check Nginx configuration and reload
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Issue 4: Project Not Found
**Solution:** Verify project slug exists in database
```sql
SELECT id, slug FROM projects WHERE slug = 'your-project-slug';
```

## 📊 Benefits of Subdomain Routing

### 1. **Professional URLs**
- ✅ `my-app.zendbx.in` (clean, branded)
- ❌ `zendbx.in/p/my-app` (cluttered)

### 2. **Better Isolation**
- Each project feels like its own service
- Easier to implement per-project rate limiting
- Better security boundaries

### 3. **Custom Domains (Future)**
- Easy to add CNAME support
- Users can point `api.myapp.com` → `my-app.zendbx.in`

### 4. **Scalability**
- Can route different projects to different servers
- Load balancing per project
- Geographic distribution

## 🎯 Example Project URLs

```
Project: "Todo App"
Slug: todo-app-a18a05a0

Subdomain URL: https://todo-app-a18a05a0.zendbx.in
├── /rest/v1/tasks          (CRUD operations)
├── /rest/v1/users          (User management)
└── /auth/v1/token          (Authentication)

Path URL (fallback): https://api.zendbx.in/p/todo-app-a18a05a0
├── /rest/v1/tasks
├── /rest/v1/users
└── /auth/v1/token
```

## ✅ Deployment Checklist

- [ ] DNS wildcard record added (`*.zendbx.in`)
- [ ] Wildcard SSL certificate obtained
- [ ] Nginx configured for wildcard subdomains
- [ ] Backend `.env` updated with `BASE_DOMAIN` and `ENABLE_SUBDOMAIN_ROUTING`
- [ ] Backend restarted
- [ ] Test subdomain routing works
- [ ] Test SSL certificate valid
- [ ] Frontend updated to use subdomain URLs
- [ ] Documentation updated

## 🎉 You're Done!

Your projects now have beautiful subdomain URLs like:
- `my-todo-app-a18a05a0.zendbx.in`
- `blog-api-b29c16f1.zendbx.in`
- `ecommerce-c3a7d8e2.zendbx.in`

Much better than `/p/my-todo-app-a18a05a0`! 🚀

---

**Domain**: zendbx.in  
**Feature**: Wildcard Subdomain Routing  
**Status**: ✅ Implemented
