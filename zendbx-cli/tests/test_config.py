"""Tests for configuration management"""

import pytest
from pathlib import Path
from zendbx.models.config import DatabaseConfig, PreferencesConfig, ZenDBXConfig
from zendbx.config import ConfigManager


class TestDatabaseConfig:
    """Test database configuration model"""
    
    def test_valid_config(self):
        """Test creating valid database config"""
        config = DatabaseConfig(
            host="localhost",
            port=5432,
            database="testdb",
            user="testuser",
        )
        
        assert config.host == "localhost"
        assert config.port == 5432
        assert config.database == "testdb"
        assert config.user == "testuser"
    
    def test_invalid_port(self):
        """Test port validation"""
        with pytest.raises(ValueError):
            DatabaseConfig(
                host="localhost",
                port=99999,  # Invalid port
                database="testdb",
                user="testuser",
            )


class TestZenDBXConfig:
    """Test main configuration"""
    
    def test_connection_string(self):
        """Test connection string generation"""
        config = ZenDBXConfig(
            database=DatabaseConfig(
                host="localhost",
                port=5432,
                database="testdb",
                user="testuser",
                password="testpass",
            )
        )
        
        conn_str = config.get_connection_string()
        assert "postgresql://" in conn_str
        assert "testuser" in conn_str
        assert "testdb" in conn_str
    
    def test_default_preferences(self):
        """Test default preferences"""
        config = ZenDBXConfig()
        
        assert config.preferences.autofix_mode == "interactive"
        assert config.preferences.output_format == "rich"
        assert config.preferences.log_level == "INFO"
