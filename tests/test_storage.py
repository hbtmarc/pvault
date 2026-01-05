"""Tests for secure storage."""

import tempfile
from pathlib import Path
import pytest

from pvault.storage import SecureStorage


def test_secure_storage_save_and_load():
    """Test saving and loading data."""
    with tempfile.TemporaryDirectory() as tmpdir:
        vault_path = Path(tmpdir) / "test.vault"
        password = "test-password-123"
        
        storage = SecureStorage(str(vault_path), password)
        
        # Save data
        test_data = {"key": "value", "number": 42}
        storage.save(test_data)
        
        # Load data
        loaded_data = storage.load()
        
        assert loaded_data == test_data


def test_secure_storage_empty_vault():
    """Test loading from non-existent vault."""
    with tempfile.TemporaryDirectory() as tmpdir:
        vault_path = Path(tmpdir) / "nonexistent.vault"
        password = "test-password"
        
        storage = SecureStorage(str(vault_path), password)
        data = storage.load()
        
        assert data == {}


def test_secure_storage_exists():
    """Test exists method."""
    with tempfile.TemporaryDirectory() as tmpdir:
        vault_path = Path(tmpdir) / "test.vault"
        password = "test-password"
        
        storage = SecureStorage(str(vault_path), password)
        
        assert not storage.exists()
        
        storage.save({"test": "data"})
        
        assert storage.exists()


def test_secure_storage_encryption():
    """Test that data is actually encrypted."""
    with tempfile.TemporaryDirectory() as tmpdir:
        vault_path = Path(tmpdir) / "test.vault"
        password = "test-password"
        
        storage = SecureStorage(str(vault_path), password)
        
        secret_data = {"secret": "this is confidential"}
        storage.save(secret_data)
        
        # Read raw file content
        with open(vault_path, 'rb') as f:
            encrypted_content = f.read()
        
        # Verify the secret text is not in plain text
        assert b"this is confidential" not in encrypted_content


def test_secure_storage_different_passwords():
    """Test that different passwords produce different encryption."""
    with tempfile.TemporaryDirectory() as tmpdir:
        vault_path = Path(tmpdir) / "test.vault"
        data = {"test": "data"}
        
        # Save with first password
        storage1 = SecureStorage(str(vault_path), "password1")
        storage1.save(data)
        
        # Try to load with different password - should fail
        storage2 = SecureStorage(str(vault_path), "password2")
        
        with pytest.raises(Exception):  # Fernet will raise InvalidToken
            storage2.load()
