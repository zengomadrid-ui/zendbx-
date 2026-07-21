from pydantic_settings import BaseSettings
from typing import List, Union
import json
import os

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "ZENDBX"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False  # Default to False for production safety
    ENVIRONMENT: str = "production"  # Default to production
    
    # Database - NO LOCALHOST DEFAULT!
    # In production, this MUST be set via environment variable
    DATABASE_URL: str = ""
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # ============================================
    # PHASE 4: ISOLATED DATABASE CONNECTIONS
    # ============================================
    
    # Platform database connection (trusted - has auth access)
    # Uses zendbx_platform role
    PLATFORM_DATABASE_URL: str = ""
    
    # Provisioner database connection (elevated - has CREATEROLE)
    # Uses zendbx_provisioner role
    PROVISIONER_DATABASE_URL: str = ""
    
    # Project credential encryption key
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    PROJECT_CREDENTIAL_ENCRYPTION_KEY: str = ""
    
    # Fail-closed behavior for project database operations
    # If True: Fall back to DATABASE_URL if project credentials not found (INSECURE)
    # If False: Fail immediately if project credentials not found (SECURE)
    ALLOW_INSECURE_PROJECT_DB_FALLBACK: bool = False
    
    # ============================================
    
    # Security
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Groq AI (FREE & FAST!)
    GROQ_API_KEY: str = ""
    DEFAULT_AI_MODEL: str = "llama-3.1-8b-instant"
    
    # Google Gemini AI (Backup)
    GEMINI_API_KEY: str = ""
    
    # OpenRouter AI (Backup)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    
    # CORS - Allow multiple origins for development
    ALLOWED_ORIGINS: Union[List[str], str] = "*"
    
    @property
    def get_allowed_origins(self) -> Union[List[str], str]:
        """Parse ALLOWED_ORIGINS if it's a JSON string, or return as-is"""
        if self.ALLOWED_ORIGINS == "*":
            return ["*"]
        if isinstance(self.ALLOWED_ORIGINS, str):
            try:
                return json.loads(self.ALLOWED_ORIGINS)
            except json.JSONDecodeError:
                return ["http://localhost:3000"]
        return self.ALLOWED_ORIGINS
    
    # OAuth Configuration
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:3000"  # Frontend URL for OAuth redirects
    OAUTH_REDIRECT_URI: str = "http://localhost:3000/callback"
    BACKEND_URL: str = "http://localhost:8000"  # Backend URL for OAuth callbacks
    OAUTH_ENCRYPTION_KEY: str = ""  # Fernet encryption key for OAuth client secrets
    
    # File Upload
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_FILE_TYPES: List[str] = [".csv", ".json", ".xlsx"]
    UPLOAD_DIR: str = "./uploads"
    
    # Query Settings
    QUERY_TIMEOUT_SECONDS: int = 10
    MAX_ROWS_RETURNED: int = 1000
    ENABLE_QUERY_CACHE: bool = True
    CACHE_TTL_SECONDS: int = 300
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    
    # WebSocket Server
    WEBSOCKET_SERVER_URL: str = "http://localhost:3002"
    ENABLE_REALTIME: bool = False  # Disabled by default for production safety

    # MinIO / Object Storage (kept for local dev reference only)
    MINIO_ENDPOINT: str = ""
    MINIO_ACCESS_KEY: str = ""
    MINIO_SECRET_KEY: str = ""
    MINIO_SECURE: bool = False
    MINIO_PUBLIC_URL: str = ""

    # Backblaze B2 (production object storage)
    B2_KEY_ID: str = ""               # Backblaze Application Key ID
    B2_APPLICATION_KEY: str = ""      # Backblaze Application Key
    B2_BUCKET_NAME: str = "zendbx-storage"
    B2_REGION: str = "us-east-005"
    B2_ENDPOINT: str = ""            # e.g. https://s3.us-east-005.backblazeb2.com
    B2_ENDPOINT_URL: str = ""        # alias — set automatically from B2_ENDPOINT if blank
    B2_PUBLIC_URL: str = ""          # e.g. https://f005.backblazeb2.com/file/zendbx

    @property
    def b2_endpoint_url(self) -> str:
        """Return B2_ENDPOINT_URL, falling back to B2_ENDPOINT."""
        return self.B2_ENDPOINT_URL or self.B2_ENDPOINT

    @property
    def b2_public_url(self) -> str:
        """Derive public URL from endpoint if not explicitly set."""
        if self.B2_PUBLIC_URL:
            return self.B2_PUBLIC_URL
        # Convert https://s3.us-east-005.backblazeb2.com → https://f005.backblazeb2.com/file/<bucket>
        region = self.B2_REGION or "us-east-005"
        region_num = region.split("-")[-1]  # "005"
        return f"https://f{region_num}.backblazeb2.com/file/{self.B2_BUCKET_NAME}"
    
    # Domain Configuration for Wildcard Subdomains
    BASE_DOMAIN: str = "zendbx.in"  # Production domain
    ENABLE_SUBDOMAIN_ROUTING: bool = True  # Enable project.zendbx.in routing
    
    # Email Configuration
    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USER: str = ""  # zendbx@gmail.com
    EMAIL_PASSWORD: str = ""  # App-specific password
    EMAIL_FROM: str = "ZenDBX <zendbx@gmail.com>"
    EMAIL_USE_TLS: bool = True
    
    class Config:
        # Never load a .env file in production.
        # Check both the raw os.environ AND the default — if ENVIRONMENT is
        # explicitly set to "production" OR if we're clearly not in a local dev
        # environment (no .env file exists), skip .env loading entirely.
        # This prevents a stale .env with localhost from overriding Render env vars.
        _env = os.getenv("ENVIRONMENT", "")
        env_file = ".env" if _env not in ("production", "prod") and os.path.exists(".env") else None
        env_file_encoding = 'utf-8'
        case_sensitive = True
        extra = "ignore"
    
    def validate_required_settings(self):
        """Validate that required settings are configured"""
        errors = []
        
        if not self.DATABASE_URL:
            errors.append("DATABASE_URL is required but not set")
        elif "localhost" in self.DATABASE_URL or "127.0.0.1" in self.DATABASE_URL:
            if self.ENVIRONMENT == "production":
                errors.append(f"DATABASE_URL contains localhost in production: {self.DATABASE_URL}")
        
        if not self.SECRET_KEY:
            errors.append("SECRET_KEY is required but not set")
        elif len(self.SECRET_KEY) < 32:
            errors.append(f"SECRET_KEY must be at least 32 characters (current: {len(self.SECRET_KEY)})")
        
        if errors:
            error_msg = "\n".join([f"  ❌ {err}" for err in errors])
            raise ValueError(f"\n🚨 Configuration Errors:\n{error_msg}\n\nSet these environment variables in Render Dashboard.")
        
        return True

settings = Settings()

# Debug: Print environment variable status (SAFE - no secrets printed)
print("\n" + "="*60)
print("ENVIRONMENT VARIABLE CHECK")
print("="*60)
print(f"ENVIRONMENT: {settings.ENVIRONMENT}")
print(f"DATABASE_URL exists: {bool(settings.DATABASE_URL)}")
print(f"DATABASE_URL length: {len(settings.DATABASE_URL) if settings.DATABASE_URL else 0}")

# Parse and show hostname only (never log password)
if settings.DATABASE_URL:
    try:
        from urllib.parse import urlparse as _urlparse
        _p = _urlparse(settings.DATABASE_URL)
        print(f"DATABASE_URL hostname: {_p.hostname}")
        print(f"DATABASE_URL port: {_p.port or 5432}")
    except Exception:
        print("DATABASE_URL: (could not parse)")

print(f"SECRET_KEY exists: {bool(settings.SECRET_KEY)}")
print(f"SECRET_KEY length: {len(settings.SECRET_KEY) if settings.SECRET_KEY else 0}")
print(f"APP_NAME: {settings.APP_NAME}")

# Additional debug: Check raw os.environ
import os as os_module
print(f"\nRaw os.environ check:")
print(f"  DATABASE_URL in os.environ: {'DATABASE_URL' in os_module.environ}")
print(f"  SECRET_KEY in os.environ: {'SECRET_KEY' in os_module.environ}")
print(f"  ENVIRONMENT in os.environ: {'ENVIRONMENT' in os_module.environ}")
print("="*60 + "\n")

# Validate settings on import (will fail fast if misconfigured)
if settings.ENVIRONMENT == "production":
    try:
        settings.validate_required_settings()
        print("✅ Configuration validated successfully")
    except ValueError as e:
        print(str(e))
        raise
