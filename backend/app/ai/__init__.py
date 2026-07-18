"""
AI Assistant Modules
"""
from .intent_classifier import (
    detect_auth_intent,
    detect_profile_intent,
    classify_intent,
    get_auth_recommendation,
    detect_discouraged_patterns
)

__all__ = [
    'detect_auth_intent',
    'detect_profile_intent',
    'classify_intent',
    'get_auth_recommendation',
    'detect_discouraged_patterns'
]
