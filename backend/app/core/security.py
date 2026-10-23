import hashlib
import os
import hmac

def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-HMAC-SHA256 with a random salt."""
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"{salt.hex()}${key.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a salt$key hash."""
    try:
        parts = hashed.split("$")
        if len(parts) != 2:
            return False
        salt = bytes.fromhex(parts[0])
        key = bytes.fromhex(parts[1])
        computed_key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(key, computed_key)
    except Exception:
        return False
