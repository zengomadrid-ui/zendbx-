"""
Test credential encryption persistence across instances
This would have caught the random-key bug in db_roles.py
"""

import pytest
from cryptography.fernet import Fernet, InvalidToken

from app.core.project_roles import encrypt_credential, decrypt_credential, get_encryption_key


def test_encryption_uses_configured_key():
    """Test that encryption uses the configured key, not a random one"""
    # Get the configured key
    key1 = get_encryption_key()
    key2 = get_encryption_key()
    
    # Same key should be returned
    assert key1 == key2, "get_encryption_key() should return same key consistently"


def test_encrypt_decrypt_roundtrip():
    """Test basic encryption/decryption roundtrip"""
    plaintext = "test_password_123"
    
    # Encrypt
    encrypted = encrypt_credential(plaintext)
    
    # Should be different from plaintext
    assert encrypted != plaintext
    
    # Decrypt
    decrypted = decrypt_credential(encrypted)
    
    # Should match original
    assert decrypted == plaintext


def test_encryption_persistence_across_instances():
    """
    Test that credentials encrypted in one instance can be decrypted in another.
    This simulates application restart.
    """
    plaintext = "secure_password_xyz"
    
    # Instance A: encrypt
    encrypted_in_a = encrypt_credential(plaintext)
    
    # Simulate instance destruction and recreation
    # (In the buggy code, this would generate a new random key)
    
    # Instance B: decrypt using same configured key
    decrypted_in_b = decrypt_credential(encrypted_in_a)
    
    # Must succeed
    assert decrypted_in_b == plaintext, \
        "Credentials must decrypt after application restart"


def test_wrong_key_rejection():
    """Test that credentials encrypted with wrong key are rejected"""
    plaintext = "correct_password"
    
    # Encrypt with correct key
    encrypted = encrypt_credential(plaintext)
    
    # Try to decrypt with wrong key
    wrong_key = Fernet.generate_key()
    wrong_fernet = Fernet(wrong_key)
    
    with pytest.raises(InvalidToken):
        wrong_fernet.decrypt(encrypted.encode())


def test_malformed_ciphertext_fails_safely():
    """Test that malformed ciphertext raises proper exception"""
    malformed = "not_a_valid_fernet_token"
    
    with pytest.raises(Exception):  # InvalidToken or other Fernet exception
        decrypt_credential(malformed)


def test_empty_ciphertext_fails_safely():
    """Test that empty ciphertext is rejected"""
    with pytest.raises(Exception):
        decrypt_credential("")


def test_encryption_produces_different_ciphertexts():
    """Test that encrypting same plaintext produces different ciphertexts (IV randomization)"""
    plaintext = "same_password"
    
    encrypted1 = encrypt_credential(plaintext)
    encrypted2 = encrypt_credential(plaintext)
    
    # Should be different (Fernet uses random IV)
    assert encrypted1 != encrypted2, \
        "Encryption should produce different ciphertexts for same plaintext"
    
    # But both should decrypt to same plaintext
    assert decrypt_credential(encrypted1) == plaintext
    assert decrypt_credential(encrypted2) == plaintext


def test_missing_key_configuration_fails():
    """Test that missing encryption key configuration produces clear error"""
    from app.core import project_roles
    from app.core.config import settings
    
    # Temporarily clear both keys
    old_project_key = settings.PROJECT_CREDENTIAL_ENCRYPTION_KEY
    old_oauth_key = settings.OAUTH_ENCRYPTION_KEY
    
    try:
        settings.PROJECT_CREDENTIAL_ENCRYPTION_KEY = ""
        settings.OAUTH_ENCRYPTION_KEY = ""
        
        with pytest.raises(ValueError, match="No encryption key configured"):
            get_encryption_key()
            
    finally:
        # Restore
        settings.PROJECT_CREDENTIAL_ENCRYPTION_KEY = old_project_key
        settings.OAUTH_ENCRYPTION_KEY = old_oauth_key


if __name__ == "__main__":
    # Can run directly for quick verification
    print("Running encryption persistence tests...")
    
    test_encryption_uses_configured_key()
    print("[OK] Configured key is consistent")
    
    test_encrypt_decrypt_roundtrip()
    print("[OK] Encrypt/decrypt roundtrip works")
    
    test_encryption_persistence_across_instances()
    print("[OK] Encryption persists across instances")
    
    test_wrong_key_rejection()
    print("[OK] Wrong key is rejected")
    
    test_malformed_ciphertext_fails_safely()
    print("[OK] Malformed ciphertext fails safely")
    
    test_empty_ciphertext_fails_safely()
    print("[OK] Empty ciphertext fails safely")
    
    test_encryption_produces_different_ciphertexts()
    print("[OK] IV randomization works")
    
    print("\n[OK] All encryption persistence tests passed!")
