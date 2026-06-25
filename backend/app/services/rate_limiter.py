"""
Advanced Rate Limiting and Account Lockout Service
Provides IP-based rate limiting, account lockout, and progressive delays
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Tuple, Optional
import logging
from app.core.redis_client import redis_client
from app.core.database import execute_on_main_db

logger = logging.getLogger(__name__)

# ============================================
# CONFIGURATION
# ============================================

class RateLimitConfig:
    """Rate limiting configuration"""
    
    # IP-based rate limiting (requests per minute)
    IP_LOGIN_LIMIT = 10
    IP_LOGIN_WINDOW = 60  # seconds
    
    # Account lockout (consecutive failures)
    ACCOUNT_LOCKOUT_THRESHOLD = 5
    ACCOUNT_LOCKOUT_DURATION = 900  # 15 minutes in seconds
    
    # Progressive delay configuration (seconds)
    PROGRESSIVE_DELAYS = {
        1: 0,      # No delay
        2: 1,      # 1 second
        3: 2,      # 2 seconds
        4: 5,      # 5 seconds
        5: 10,     # 10 seconds (then lockout)
    }
    
    # Tracking windows
    FAILURE_TRACKING_WINDOW = 900  # 15 minutes


# ============================================
# RATE LIMITER SERVICE
# ============================================

class RateLimiterService:
    """
    Comprehensive rate limiting service with:
    - IP-based request rate limiting
    - Account-based lockout after failed attempts
    - Progressive delays
    - Redis-backed with fallback to in-memory
    """
    
    def __init__(self):
        # In-memory fallback (only used if Redis unavailable)
        self._ip_requests: dict = {}  # {ip: [(timestamp, ...)]}
        self._account_failures: dict = {}  # {email: {"count": int, "locked_until": datetime}}
        
    # ============================================
    # IP-BASED RATE LIMITING
    # ============================================
    
    async def check_ip_rate_limit(self, ip: str) -> Tuple[bool, Optional[int]]:
        """
        Check if IP has exceeded rate limit
        
        Returns:
            (allowed, retry_after_seconds)
        """
        if not ip or ip == "unknown":
            return True, None
        
        try:
            if redis_client.enabled:
                return await self._check_ip_rate_limit_redis(ip)
            else:
                return await self._check_ip_rate_limit_memory(ip)
        except Exception as e:
            logger.error(f"Error checking IP rate limit: {e}")
            # Fail open (allow request) to prevent blocking legitimate users
            return True, None
    
    async def _check_ip_rate_limit_redis(self, ip: str) -> Tuple[bool, Optional[int]]:
        """Check IP rate limit using Redis"""
        key = f"ip_rate_limit:{ip}"
        now = datetime.now().timestamp()
        window_start = now - RateLimitConfig.IP_LOGIN_WINDOW
        
        try:
            pipe = redis_client.redis.pipeline()
            # Remove old entries
            pipe.zremrangebyscore(key, 0, window_start)
            # Count current requests
            pipe.zcard(key)
            # Add current request
            pipe.zadd(key, {str(now): now})
            # Set expiry
            pipe.expire(key, RateLimitConfig.IP_LOGIN_WINDOW)
            
            results = await pipe.execute()
            request_count = results[1]
            
            if request_count >= RateLimitConfig.IP_LOGIN_LIMIT:
                retry_after = RateLimitConfig.IP_LOGIN_WINDOW
                logger.warning(f"IP rate limit exceeded: {ip} ({request_count} requests)")
                return False, retry_after
            
            return True, None
            
        except Exception as e:
            logger.error(f"Redis IP rate limit error: {e}")
            return True, None
    
    async def _check_ip_rate_limit_memory(self, ip: str) -> Tuple[bool, Optional[int]]:
        """Check IP rate limit using in-memory cache (fallback)"""
        now = time.time()
        window_start = now - RateLimitConfig.IP_LOGIN_WINDOW
        
        # Clean old entries
        if ip in self._ip_requests:
            self._ip_requests[ip] = [
                ts for ts in self._ip_requests[ip] if ts > window_start
            ]
        else:
            self._ip_requests[ip] = []
        
        # Add current request
        self._ip_requests[ip].append(now)
        
        # Check limit
        request_count = len(self._ip_requests[ip])
        if request_count > RateLimitConfig.IP_LOGIN_LIMIT:
            retry_after = RateLimitConfig.IP_LOGIN_WINDOW
            logger.warning(f"IP rate limit exceeded (memory): {ip} ({request_count} requests)")
            return False, retry_after
        
        return True, None
    
    # ============================================
    # ACCOUNT LOCKOUT & PROGRESSIVE DELAYS
    # ============================================
    
    async def check_account_lockout(self, email: str) -> Tuple[bool, Optional[int], int]:
        """
        Check if account is locked out
        
        Returns:
            (allowed, retry_after_seconds, failure_count)
        """
        try:
            if redis_client.enabled:
                return await self._check_account_lockout_redis(email)
            else:
                return await self._check_account_lockout_memory(email)
        except Exception as e:
            logger.error(f"Error checking account lockout: {e}")
            return True, None, 0
    
    async def _check_account_lockout_redis(self, email: str) -> Tuple[bool, Optional[int], int]:
        """Check account lockout using Redis"""
        key = f"account_failures:{email}"
        
        try:
            # Get failure count
            failure_count = await redis_client.get_counter(key, "count")
            
            # Check if locked out
            if failure_count >= RateLimitConfig.ACCOUNT_LOCKOUT_THRESHOLD:
                # Get TTL to determine when lockout expires
                ttl = await redis_client.redis.ttl(f"quota:{key}:{datetime.now().strftime('%Y-%m')}:count")
                if ttl > 0:
                    logger.warning(f"Account locked out: {email} ({failure_count} failures, {ttl}s remaining)")
                    return False, ttl, failure_count
            
            return True, None, failure_count
            
        except Exception as e:
            logger.error(f"Redis account lockout check error: {e}")
            return True, None, 0
    
    async def _check_account_lockout_memory(self, email: str) -> Tuple[bool, Optional[int], int]:
        """Check account lockout using in-memory cache (fallback)"""
        if email not in self._account_failures:
            return True, None, 0
        
        account_data = self._account_failures[email]
        failure_count = account_data.get("count", 0)
        locked_until = account_data.get("locked_until")
        
        # Check if still locked
        if locked_until and datetime.now() < locked_until:
            retry_after = int((locked_until - datetime.now()).total_seconds())
            logger.warning(f"Account locked out (memory): {email} ({failure_count} failures, {retry_after}s remaining)")
            return False, retry_after, failure_count
        
        # Lockout expired, reset count
        if locked_until and datetime.now() >= locked_until:
            self._account_failures[email] = {"count": 0, "locked_until": None}
            return True, None, 0
        
        return True, None, failure_count
    
    async def record_failed_login(self, email: str, ip: str) -> Tuple[int, Optional[int]]:
        """
        Record a failed login attempt
        
        Returns:
            (failure_count, progressive_delay_seconds)
        """
        try:
            if redis_client.enabled:
                return await self._record_failed_login_redis(email, ip)
            else:
                return await self._record_failed_login_memory(email, ip)
        except Exception as e:
            logger.error(f"Error recording failed login: {e}")
            return 0, None
    
    async def _record_failed_login_redis(self, email: str, ip: str) -> Tuple[int, Optional[int]]:
        """Record failed login in Redis"""
        key = f"account_failures:{email}"
        
        try:
            # Increment failure counter with TTL
            failure_count = await redis_client.increment_counter(
                key,
                "count",
                amount=1,
                ttl=RateLimitConfig.FAILURE_TRACKING_WINDOW
            )
            
            # Calculate progressive delay
            delay = RateLimitConfig.PROGRESSIVE_DELAYS.get(
                failure_count,
                RateLimitConfig.PROGRESSIVE_DELAYS[5]  # Max delay
            )
            
            logger.info(f"Failed login recorded: {email} (count: {failure_count}, delay: {delay}s, ip: {ip})")
            
            # Log to database for audit trail
            await self._log_failed_attempt_to_db(email, ip, failure_count)
            
            return failure_count, delay
            
        except Exception as e:
            logger.error(f"Redis record failed login error: {e}")
            return 0, None
    
    async def _record_failed_login_memory(self, email: str, ip: str) -> Tuple[int, Optional[int]]:
        """Record failed login in memory (fallback)"""
        if email not in self._account_failures:
            self._account_failures[email] = {"count": 0, "locked_until": None}
        
        # Increment counter
        self._account_failures[email]["count"] += 1
        failure_count = self._account_failures[email]["count"]
        
        # Set lockout if threshold reached
        if failure_count >= RateLimitConfig.ACCOUNT_LOCKOUT_THRESHOLD:
            locked_until = datetime.now() + timedelta(seconds=RateLimitConfig.ACCOUNT_LOCKOUT_DURATION)
            self._account_failures[email]["locked_until"] = locked_until
        
        # Calculate progressive delay
        delay = RateLimitConfig.PROGRESSIVE_DELAYS.get(
            failure_count,
            RateLimitConfig.PROGRESSIVE_DELAYS[5]
        )
        
        logger.info(f"Failed login recorded (memory): {email} (count: {failure_count}, delay: {delay}s, ip: {ip})")
        
        # Log to database
        await self._log_failed_attempt_to_db(email, ip, failure_count)
        
        return failure_count, delay
    
    async def clear_failed_attempts(self, email: str) -> bool:
        """Clear failed login attempts (on successful login)"""
        try:
            if redis_client.enabled:
                key = f"account_failures:{email}"
                await redis_client.reset_counter(key, "count")
            else:
                if email in self._account_failures:
                    self._account_failures[email] = {"count": 0, "locked_until": None}
            
            logger.info(f"Cleared failed attempts for: {email}")
            return True
            
        except Exception as e:
            logger.error(f"Error clearing failed attempts: {e}")
            return False
    
    async def apply_progressive_delay(self, delay_seconds: Optional[int]):
        """Apply progressive delay (async sleep)"""
        if delay_seconds and delay_seconds > 0:
            logger.info(f"Applying progressive delay: {delay_seconds}s")
            await asyncio.sleep(delay_seconds)
    
    # ============================================
    # AUDIT LOGGING
    # ============================================
    
    async def _log_failed_attempt_to_db(self, email: str, ip: str, failure_count: int):
        """Log failed attempt to database for audit trail"""
        try:
            await execute_on_main_db(
                """
                INSERT INTO auth_audit_log (
                    event_type, email, ip_address, metadata, created_at
                )
                VALUES ($1, $2, $3, $4, NOW())
                """,
                "failed_login_attempt",
                email,
                ip,
                {
                    "failure_count": failure_count,
                    "lockout_threshold": RateLimitConfig.ACCOUNT_LOCKOUT_THRESHOLD
                }
            )
        except Exception as e:
            # Don't fail the request if audit logging fails
            logger.error(f"Failed to log auth audit: {e}")
    
    # ============================================
    # EMAIL NOTIFICATIONS
    # ============================================
    
    async def send_lockout_notification(self, email: str, failure_count: int):
        """
        Send email notification when account is locked
        
        TODO: Integrate with email service (SendGrid, AWS SES, etc.)
        """
        try:
            # Generate unlock token or link
            unlock_link = f"https://api.zendbx.in/auth/unlock?email={email}"
            
            logger.warning(
                f"🔒 Account locked: {email}",
                extra={
                    "email": email,
                    "failure_count": failure_count,
                    "lockout_duration": RateLimitConfig.ACCOUNT_LOCKOUT_DURATION,
                    "unlock_link": unlock_link
                }
            )
            
            # TODO: Send actual email
            # Example email content:
            message = f"""
            Your account has been temporarily locked due to multiple failed login attempts.
            
            Details:
            - Failed attempts: {failure_count}
            - Lockout duration: {RateLimitConfig.ACCOUNT_LOCKOUT_DURATION // 60} minutes
            
            If this wasn't you, please reset your password immediately:
            {unlock_link}
            
            The lockout will expire automatically in 15 minutes.
            """
            
            # For now, just log it
            logger.info(f"Lockout notification: {email}")
            print(f"\n📧 LOCKOUT EMAIL (not sent - configure email service):")
            print(f"To: {email}")
            print(f"Subject: Account Temporarily Locked")
            print(message)
            
        except Exception as e:
            logger.error(f"Error sending lockout notification: {e}")


# ============================================
# SINGLETON INSTANCE
# ============================================

rate_limiter = RateLimiterService()
