"""Secure storage for financial records using encryption."""

import json
import os
from pathlib import Path
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
import base64


class SecureStorage:
    """Handles encrypted storage of financial data."""

    def __init__(self, vault_path: str, password: str):
        """Initialize secure storage.
        
        Args:
            vault_path: Path to the vault file
            password: Password for encryption
        """
        self.vault_path = Path(vault_path)
        self.password = password
        self._cipher = None
        self._salt = None
        self._initialize_encryption()

    def _initialize_encryption(self):
        """Initialize encryption with password-based key derivation."""
        salt_file = self.vault_path.with_suffix('.salt')
        
        if salt_file.exists():
            with open(salt_file, 'rb') as f:
                self._salt = f.read()
        else:
            self._salt = os.urandom(16)
            salt_file.parent.mkdir(parents=True, exist_ok=True)
            with open(salt_file, 'wb') as f:
                f.write(self._salt)
        
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self._salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.password.encode()))
        self._cipher = Fernet(key)

    def save(self, data: dict):
        """Encrypt and save data to vault.
        
        Args:
            data: Dictionary to save
        """
        json_data = json.dumps(data, indent=2)
        encrypted_data = self._cipher.encrypt(json_data.encode())
        
        self.vault_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.vault_path, 'wb') as f:
            f.write(encrypted_data)

    def load(self) -> dict:
        """Load and decrypt data from vault.
        
        Returns:
            Dictionary of decrypted data
        """
        if not self.vault_path.exists():
            return {}
        
        with open(self.vault_path, 'rb') as f:
            encrypted_data = f.read()
        
        decrypted_data = self._cipher.decrypt(encrypted_data)
        return json.loads(decrypted_data.decode())

    def exists(self) -> bool:
        """Check if vault file exists."""
        return self.vault_path.exists()
