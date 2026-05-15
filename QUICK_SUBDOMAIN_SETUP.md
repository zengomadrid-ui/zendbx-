# Quick Subdomain Setup for zendbx.in

## 🎯 Goal
Transform project URLs from:
- ❌ `http://localhost:8000/p/ramos-test-1-c0538580`
- ✅ `https://ramos-test-1-c0538580.zendbx.in`

## ⚡ Quick Setup (3 Steps)

### Step 1: DNS (5 minutes)
Go to your DNS provider and add:
```
Type: A
Name: *
Value: Your-Server-IP
```

### Step 2: SSL Certificate (10 minutes)
```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d zendbx.in -d *.zendbx.in
```

### Step 3: Nginx (5 minutes)
```bash
sudo nano /etc/nginx/sites-available/zendbx.in
```

Add:
```nginx
server {
    listen 443 ssl http2;
    server_name *.zendbx.in;
    
    ssl_certificate /etc/letsencrypt/live/zendbx.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zendbx.in/privkey.pem;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

Reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

## ✅ Test It

```bash
# Test DNS
nslookup test-project.zendbx.in

# Test API
curl https://your-project-slug.zendbx.in/rest/v1/users \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## 📚 Full Documentation
- `WILDCARD_SUBDOMAIN_SETUP.md` - Complete guide
- `SUBDOMAIN_ROUTING_SUMMARY.md` - Implementation details

---

**Time Required**: ~20 minutes  
**Difficulty**: Easy  
**Result**: Professional project URLs! 🚀
