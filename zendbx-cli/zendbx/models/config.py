"""Configuration models for ZenDBX CLI"""

from typing import Optional, Literal
from pathlib import Path
from pydantic import BaseModel, Field, SecretStr, field_validator
import yaml


class DatabaseConfig(BaseModel):
    """Database connection configuration"""
    host: str = Field(default="localhost", description="Database host")
    port: int = Field(default=5432, description="Database port")
    database: str = Field(description="Database name")
    user: str = Field(description="Database user")
    password: Optional[SecretStr] = Field(default=None, description="Database password")
    ssl_mode: str = Field(default="prefer", description="SSL mode")
    
    @field_validator("port")
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not 1 <= v <= 65535:
            raise ValueError("Port must be between 1 and 65535")
        return v


class PreferencesConfig(BaseModel):
    """User preferences configuration"""
    autofix_mode: Literal["interactive", "auto", "suggest"] = Field(
        default="interactive",
        description="SQL autofix mode"
    )
    output_format: Literal["rich", "json", "plain"] = Field(
        default="rich",
        description="Output format"
    )
    backup_path: Path = Field(
        default=Path("./backups"),
        description="Default backup directory"
    )
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        description="Logging level"
    )
    show_query_time: bool = Field(
        default=True,
        description="Show query execution time"
    )
    max_rows_display: int = Field(
        default=100,
        description="Maximum rows to display"
    )


class ZenDBXConfig(BaseModel):
    """Main ZenDBX configuration"""
    database: Optional[DatabaseConfig] = None
    preferences: PreferencesConfig = Field(default_factory=PreferencesConfig)
    api_endpoint: Optional[str] = Field(
        default=None,
        description="ZenDBX API endpoint for cloud features"
    )
    api_key: Optional[SecretStr] = Field(
        default=None,
        description="ZenDBX API key"
    )
    
    @classmethod
    def from_yaml(cls, path: Path) -> "ZenDBXConfig":
        """Load configuration from YAML file"""
        if not path.exists():
            return cls()
        
        with open(path, "r") as f:
            data = yaml.safe_load(f) or {}
        
        return cls(**data)
    
    def to_yaml(self, path: Path) -> None:
        """Save configuration to YAML file"""
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # Convert to dict and handle SecretStr
        data = self.model_dump(mode="json", exclude_none=True)
        
        # Convert SecretStr to plain string for YAML
        if self.database and self.database.password:
            if "database" not in data:
                data["database"] = {}
            data["database"]["password"] = self.database.password.get_secret_value()
        
        if self.api_key:
            data["api_key"] = self.api_key.get_secret_value()
        
        with open(path, "w") as f:
            yaml.dump(data, f, default_flow_style=False, sort_keys=False)
    
    def get_connection_string(self) -> str:
        """Get PostgreSQL connection string"""
        if not self.database:
            raise ValueError("Database configuration not set")
        
        password = ""
        if self.database.password:
            password = f":{self.database.password.get_secret_value()}"
        
        return (
            f"postgresql://{self.database.user}{password}"
            f"@{self.database.host}:{self.database.port}/{self.database.database}"
        )
