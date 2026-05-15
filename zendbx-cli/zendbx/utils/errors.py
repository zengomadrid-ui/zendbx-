"""Custom exceptions for ZenDBX CLI"""


class ZenDBXError(Exception):
    """Base exception for ZenDBX CLI"""
    pass


class ConfigError(ZenDBXError):
    """Configuration related errors"""
    pass


class DatabaseError(ZenDBXError):
    """Database connection and operation errors"""
    pass


class ConnectionError(DatabaseError):
    """Database connection errors"""
    pass


class SQLError(DatabaseError):
    """SQL execution errors"""
    pass


class ValidationError(ZenDBXError):
    """Input validation errors"""
    pass


class BackupError(ZenDBXError):
    """Backup and restore errors"""
    pass


class AuthenticationError(ZenDBXError):
    """Authentication errors"""
    pass
