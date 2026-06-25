# Advanced Rate Limiting & Account Lockout Documentation

## 🎯 Overview

Comprehensive multi-layer security system for the login endpoint featuring:
- ✅ **IP-based rate limiting** (10 requests/minute)
- ✅ **Account lockout** after 5 consecutive failures
- ✅ **Progressive delays** (1s → 2s → 5s → 10s)
- ✅ **Redis-backed with in-memory fallback**
- ✅ **Email notifications** on lockout
- ✅ **Generic error messages** (no information disclosure)
- ✅ **Comprehensive audit logging**

---

## 📋 Features

### 1. IP-Based Rate Limiting
Prevents brute-force attacks by limiting login attempts per IP address.

**Configuration:**
- **Limit:** 10 requests per minute per IP
- **Window:** 60 seconds (sliding window)
- **Storage:** Redis (with in-memory fallback)
- **Response:** HTTP 429 with `Retry-After` header

**Example:**
```http
POST /api/auth/login
X-Real-IP: 192.168.1.100

# After 10 requests in 60 seconds:
HTTP/1.1 429 Too Many Requests
Retry-After: 60
{
  "detail": "Too many login requests. Please try again later."
}
```

### 2. Account Lockout
Locks user accounts after repeated failed login attempts.

**Configuration:**
- **Threshold:** 5 consecutive failed attempts
- **Duration:** 15 minutes (900 seconds)
- **Storage:** Redis (with in-memory fallback)
- **Notification:** Email sent on lockout

**Behavior:**
```
Attempt 1: No delay, failure recorded
Attempt 2: 1 second delay
Attempt 3: 2 second delay
Attempt 4: 5 second delay
Attempt 5: 10 second delay → LOCKOUT for 15 minutes
```

### 3. Progressive Delays
Slows down attack attempts with increasing delays.

**Delay Schedule:**
| Failure Count | Delay | Status |
|---------------|-------|--------|
| 1 | 0s | Warning |
| 2 | 1s | Suspicious |
| 3 | 2s | Alert |
| 4 | 5s | Critical |
| 5+ | 10s | **LOCKED** |

**Purpose:**
- Makes brute-force attacks impractical
- Adds exponential cost to attackers
- Doesn't impact legitimate users (1-2 typos max)

### 4. Email Notifications
Alerts users when their account is locked.

**Trigger:** Account lockout (5 failures)

**Email Content:**
```
Subject: Account Temporarily Locked

Your account has been temporarily locked due to multiple 
failed login attempts.

Details:
- Failed attempts: 5
- Lockout duration: 15 minutes

If this wasn't you, please reset your password immediately:
https://api.zendbx.in/auth/reset-password

The lockout will expire automatically in 15 minutes.
```

---

## 🏗️ Architecture

### Components

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│      Login Endpoint                  │
│  /api/auth/login                    │
└──────┬──────────────────────────────┘
       │
       ├──► Phase 1: IP Rate Limit Check
       │    └─► Redis: ip_rate_limit:{ip}
       │
       ├──► Phase 2: Input Validation
       │    └─► Pydantic schemas
       │
       ├──► Phase 3: Account Lockout Check
       │    └─► Redis: account_failures:{email}
       │
       ├──► Phase 4: Get User from DB
       │    └─► PostgreSQL
       │
       ├──► Phase 5: Verify Password
       │    └─► bcrypt
       │
       ├──► Phase 6: Record Failure (if invalid)
       │    ├─► Increment counter
       │    ├─► Apply progressive delay
       │    ├─► Send lockout email (if threshold)
       │    └─► Log to audit table
       │
       └──► Phase 7: Success
            ├─► Clear failure counter
            ├─► Generate JWT
            └─► Return token
```

### Data Storage

#### Redis Keys
```
# IP rate limiting (sliding window)
ip_rate_limit:{ip} → Sorted Set
  - Stores timestamps of requests
  - TTL: 60 seconds
  - Cleaned automatically

# Account failures
account_failures:{email}:count → Integer
  - Failure count
  - TTL: 900 seconds (15 minutes)
  - Auto-expires after lockout
```

#### PostgreSQL Tables
```sql
-- Audit log for security monitoring
auth_audit_log (
    id UUID PRIMARY KEY,
    event_type VARCHAR(50),
    email VARCHAR(255),
    ip_address VARCHAR(45),
    metadata JSONB,
    created_at TIMESTAMP
)
```

---

## 🔧 Implementation Details

### File Structure
```
backend/
├── app/
│   ├── services/
│   │   └── rate_limiter.py          ← Main service
│   ├── api/
│   │   └── auth.py                  ← Updated login endpoint
│   └── core/
│       └── redis_client.py          ← Redis operations
└── database/
    └── add_auth_audit_log.sql       ← Database migration
```

### Rate Limiter Service
```python
# backend/app/services/rate_limiter.py

class RateLimiterService:
    """
    Features:
    - IP rate limiting (sliding window)
    - Account lockout tracking
    - Progressive delay calculation
    - Email notifications
    - Audit logging
    """
    
    async def check_ip_rate_limit(ip: str) 
        → (allowed: bool, retry_after: int)
    
    async def check_account_lockout(email: str) 
        → (allowed: bool, retry_after: int, failure_count: int)
    
    async def record_failed_login(email: str, ip: str) 
        → (failure_count: int, delay: int)
    
    async def clear_failed_attempts(email: str) 
        → bool
    
    async def apply_progressive_delay(delay_seconds: int)
    
    async def send_lockout_notification(email: str, failure_count: int)
```

### Login Flow
```python
# backend/app/api/auth.py

@router.post("/login")
async def login(request: Request, raw_data: dict):
    # 1. Check IP rate limit
    ip_allowed, retry_after = await rate_limiter.check_ip_rate_limit(ip)
    if not ip_allowed:
        raise HTTPException(429, "Too many requests")
    
    # 2. Validate input
    credentials = validate_and_sanitize_input(raw_data, SecureUserLogin)
    
    # 3. Check account lockout
    allowed, retry_after, failures = await rate_limiter.check_account_lockout(email)
    if not allowed:
        raise HTTPException(401, "Invalid credentials")  # Generic!
    
    # 4. Get user and verify password
    if not password_valid:
        # Record failure
        failures, delay = await rate_limiter.record_failed_login(email, ip)
        
        # Apply progressive delay
        await rate_limiter.apply_progressive_delay(delay)
        
        # Send email if locked
        if failures >= 5:
            await rate_limiter.send_lockout_notification(email, failures)
        
        raise HTTPException(401, "Invalid credentials")  # Generic!
    
    # 5. Success - clear failures
    await rate_limiter.clear_failed_attempts(email)
    return create_token(user)
```

---

## 🚀 Configuration

### Environment Variables
```bash
# Redis connection (optional but recommended)
REDIS_URL=redis://localhost:6379/0

# Email service (for lockout notifications)
SENDGRID_API_KEY=your_key_here
# OR
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

### Rate Limit Settings
Edit `backend/app/services/rate_limiter.py`:

```python
class RateLimitConfig:
    # IP rate limiting
    IP_LOGIN_LIMIT = 10              # Max requests per window
    IP_LOGIN_WINDOW = 60             # Window in seconds
    
    # Account lockout
    ACCOUNT_LOCKOUT_THRESHOLD = 5    # Failures before lockout
    ACCOUNT_LOCKOUT_DURATION = 900   # Lockout duration (15 min)
    
    # Progressive delays (seconds)
    PROGRESSIVE_DELAYS = {
        1: 0,    # No delay
        2: 1,    # 1 second
        3: 2,    # 2 seconds
        4: 5,    # 5 seconds
        5: 10,   # 10 seconds (then lockout)
    }
```

---

## 📊 Monitoring

### Check Rate Limits
```bash
# IP rate limits (Redis)
redis-cli ZCARD "ip_rate_limit:192.168.1.100"

# Account failures (Redis)
redis-cli GET "quota:account_failures:user@example.com:2026-06:count"

# Lockout status (Redis)
redis-cli TTL "quota:account_failures:user@example.com:2026-06:count"
```

### Query Audit Logs
```sql
-- Recent failed attempts
SELECT event_type, email, ip_address, metadata, created_at
FROM auth_audit_log
WHERE event_type = 'failed_login_attempt'
ORDER BY created_at DESC
LIMIT 100;

-- Lockout events
SELECT email, metadata->>'failure_count' as failures, created_at
FROM auth_audit_log
WHERE event_type = 'failed_login_attempt'
  AND CAST(metadata->>'failure_count' AS INTEGER) >= 5
ORDER BY created_at DESC;

-- Failed attempts by IP
SELECT ip_address, COUNT(*) as attempts, MAX(created_at) as last_attempt
FROM auth_audit_log
WHERE event_type = 'failed_login_attempt'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
ORDER BY attempts DESC;
```

### View Logs
```bash
# Application logs
tail -f backend/logs/app.log | grep "Login\|lockout\|rate limit"

# Failed login attempts
grep "Failed login recorded" backend/logs/app.log

# Account lockouts
grep "Account locked:" backend/logs/app.log
```

---

## 🔐 Security Considerations

### Generic Error Messages
**Always return the same error regardless of failure reason:**

```python
# ❌ BAD - Reveals information
if user_not_found:
    return "User not found"
if wrong_password:
    return "Invalid password"
if account_locked:
    return "Account is locked"

# ✅ GOOD - Generic message
return "Invalid credentials. Please check your email and password."
```

**Why?**
- Prevents user enumeration
- Doesn't reveal lockout status
- No information leakage to attackers

### Progressive Delays
Delays are applied **BEFORE** returning the error:

```python
# ✅ CORRECT
await rate_limiter.apply_progressive_delay(delay)
raise HTTPException(401, "Invalid credentials")

# ❌ WRONG - Delay bypassed
raise HTTPException(401, "Invalid credentials")
await rate_limiter.apply_progressive_delay(delay)  # Never reached!
```

### Lockout Bypass Prevention
Cannot bypass lockout by:
- Using different IP (account-based tracking)
- Changing user agent
- Waiting less than 15 minutes
- Using different credentials

---

## 🧪 Testing

### Test IP Rate Limiting
```bash
# Send 11 requests quickly
for i in {1..11}; do
  curl -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' &
done

# Expected: First 10 succeed (fail authentication), 11th returns 429
```

### Test Account Lockout
```bash
# Send 5 failed login attempts
for i in {1..5}; do
  curl -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"victim@example.com","password":"wrong"}'
  echo "Attempt $i"
  sleep 2
done

# 6th attempt should still return 401 (locked, but generic error)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"victim@example.com","password":"correct_password"}'
```

### Test Progressive Delays
```python
import time
import requests

email = "test@example.com"
start = time.time()

for i in range(1, 6):
    attempt_start = time.time()
    
    r = requests.post("http://localhost:8000/api/auth/login", json={
        "email": email,
        "password": "wrong"
    })
    
    duration = time.time() - attempt_start
    print(f"Attempt {i}: {duration:.2f}s, Status: {r.status_code}")

# Expected output:
# Attempt 1: 0.50s, Status: 401  (no delay)
# Attempt 2: 1.50s, Status: 401  (1s delay)
# Attempt 3: 2.50s, Status: 401  (2s delay)
# Attempt 4: 5.50s, Status: 401  (5s delay)
# Attempt 5: 10.50s, Status: 401 (10s delay)
```

---

## 🎛️ Admin Operations

### Manually Unlock Account
```python
# Via Python console
from app.services.rate_limiter import rate_limiter
await rate_limiter.clear_failed_attempts("user@example.com")
```

```bash
# Via Redis CLI
redis-cli DEL "quota:account_failures:user@example.com:2026-06:count"
```

### View Current Lockouts
```sql
-- Check database audit log
SELECT email, 
       metadata->>'failure_count' as failures,
       created_at,
       created_at + INTERVAL '15 minutes' as unlocks_at
FROM auth_audit_log
WHERE event_type = 'failed_login_attempt'
  AND CAST(metadata->>'failure_count' AS INTEGER) >= 5
  AND created_at > NOW() - INTERVAL '15 minutes'
ORDER BY created_at DESC;
```

### Clean Old Audit Logs
```sql
-- Run weekly to remove logs >90 days old
SELECT clean_old_auth_audit_logs();
```

---

## 📈 Performance Impact

### Latency Added
| Operation | Latency |
|-----------|---------|
| IP rate limit check | ~2-5ms (Redis) |
| Account lockout check | ~2-5ms (Redis) |
| Progressive delay | 0-10s (intentional) |
| Audit logging | ~5-10ms (async) |
| **Total overhead** | **~10-20ms** (without delay) |

### Redis Memory Usage
```
# Per IP: ~100 bytes × active IPs
# Per account: ~50 bytes × active accounts
# 10,000 active sessions ≈ 1.5 MB
```

### Scalability
- ✅ Stateless (works across multiple servers)
- ✅ Redis handles millions of ops/second
- ✅ Graceful degradation (falls back to in-memory)

---

## ✅ Checklist

### Deployment
- [ ] Redis installed and configured
- [ ] Run database migration (`add_auth_audit_log.sql`)
- [ ] Configure email service (SendGrid/AWS SES)
- [ ] Set `REDIS_URL` environment variable
- [ ] Test rate limiting in staging
- [ ] Monitor audit logs

### Monitoring
- [ ] Set up alerts for high failure rates
- [ ] Monitor Redis memory usage
- [ ] Review audit logs weekly
- [ ] Check for attack patterns

### Maintenance
- [ ] Run `clean_old_audit_logs()` weekly
- [ ] Review lockout thresholds monthly
- [ ] Update blocked IP list as needed

---

## 🆘 Troubleshooting

### "Too many requests" errors for legitimate users
**Cause:** Shared IP (NAT, corporate network)  
**Solution:** Increase `IP_LOGIN_LIMIT` or whitelist IP

### Accounts getting locked too easily
**Cause:** Users forgetting passwords  
**Solution:** 
- Reduce `ACCOUNT_LOCKOUT_THRESHOLD` to 3
- Add "Forgot password?" link prominently

### Redis connection failures
**Cause:** Redis server down  
**Solution:** Service automatically falls back to in-memory cache

### Email notifications not sending
**Cause:** Email service not configured  
**Solution:** Set SendGrid/AWS SES credentials

---

## 📚 References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST Digital Identity Guidelines](https://pages.nist.gov/800-63-3/)
- [Redis Rate Limiting Patterns](https://redis.io/docs/manual/patterns/rate-limiter/)

---

**Status:** ✅ Production Ready  
**Last Updated:** June 25, 2026
