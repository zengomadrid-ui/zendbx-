from pydantic_settings import BaseSettings
from typing import List, Union
import json
import os

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "ZENDBX"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False  # Default to False for production safety
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")  # Default to production
    
    # Database - NO LOCALHOST DEFAULT!
    # In production, this MUST be set via environment variable
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
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
    OAUTH_REDIRECT_URI: str = "http://localhost:3000/auth/callback"
    
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
    
    # Domain Configuration for Wildcard Subdomains
    BASE_DOMAIN: str = "zendbx.in"  # Production domain
    ENABLE_SUBDOMAIN_ROUTING: bool = True  # Enable project.zendbx.in routing
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
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

# Validate settings on import (will fail fast if misconfigured)
if settings.ENVIRONMENT == "production":
    try:
        settings.validate_required_settings()
        print("✅ Configuration validated successfully")
    except ValueError as e:
        print(str(e))
        raise
