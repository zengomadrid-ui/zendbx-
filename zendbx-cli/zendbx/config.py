"""Configuration management for ZenDBX CLI"""

import os
from pathlib import Path
from typing import Optional
from .models.config import ZenDBXConfig
from .utils.errors import ConfigError


class ConfigManager:
    """Manages ZenDBX configuration files"""
    
    def __init__(self):
        self.home_dir = Path.home() / ".zendbx"
        self.global_config_path = self.home_dir / "config.yaml"
        self.local_config_path = Path.cwd() / ".zendbx" / "config.yaml"
        
    def get_config_path(self, use_local: bool = True) -> Path:
        """Get the appropriate config file path"""
        if use_local and self.local_config_path.exists():
            return self.local_config_path
        return self.global_config_path
    
    def load_config(self, use_local: bool = True) -> ZenDBXConfig:
        """Load configuration from file"""
        config_path = self.get_config_path(use_local)
        
        if not config_path.exists():
            return ZenDBXConfig()
        
        try:
            return ZenDBXConfig.from_yaml(config_path)
        except Exception as e:
            raise ConfigError(f"Failed to load configuration: {e}")
    
    def save_config(self, config: ZenDBXConfig, use_local: bool = False) -> None:
        """Save configuration to file"""
        config_path = self.local_config_path if use_local else self.global_config_path
        
        try:
            config.to_yaml(config_path)
        except Exception as e:
            raise ConfigError(f"Failed to save configuration: {e}")
    
    def config_exists(self, use_local: bool = True) -> bool:
        """Check if configuration file exists"""
        config_path = self.get_config_path(use_local)
        return config_path.exists()
    
    def get_connection_string(self) -> str:
        """Get database connection string from config or environment"""
        # Try environment variable first
        env_conn_string = os.getenv("ZENDBX_DATABASE_URL")
        if env_conn_string:
            return env_conn_string
        
        # Try config file
        config = self.load_config()
        if config.database:
            return config.get_connection_string()
        
        raise ConfigError(
            "No database configuration found. "
            "Run 'zendbx init' or set ZENDBX_DATABASE_URL environment variable."
        )
    
    def ensure_directories(self) -> None:
        """Ensure configuration directories exist"""
        self.home_dir.mkdir(parents=True, exist_ok=True)
        self.local_config_path.parent.mkdir(parents=True, exist_ok=True)


# Global config manager instance
config_manager = ConfigManager()
