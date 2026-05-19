from pydantic import BaseSettings
from typing import List, Union
import json

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "ZENDBX"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/nexora_main"
    DATABASE_POOL_SIZE: int = 10  # Reduced for Windows stability
    DATABASE_MAX_OVERFLOW: int = 5  # Reduced for Windows stability
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
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
    ENABLE_REALTIME: bool = True
    
    # Domain Configuration for Wildcard Subdomains
    BASE_DOMAIN: str = "zendbx.in"  # Production domain
    ENABLE_SUBDOMAIN_ROUTING: bool = True  # Enable project.zendbx.in routing
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
