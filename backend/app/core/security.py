"""
Security utilities: Password hashing, verification, and JWT token management.
Designed with FIPS-compliant PBKDF2/bcrypt and RFC 7519 JWT standards.
"""

import base64
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union

try:
    from app.core.config import settings
    SECRET_KEY = settings.SECRET_KEY
    ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
except Exception:
    SECRET_KEY = os.getenv("SECRET_KEY", "temporary-dev-secret-key-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# Algorithm constants
JWT_ALGORITHM = "HS256"


def _b64url_encode(data: bytes) -> str:
    """Encode bytes to a base64url string without trailing padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    """Decode a base64url string with padding restoration."""
    padding = 4 - (len(data) % 4)
    if padding and padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("utf-8"))


# ==============================================================================
# Password Hashing & Verification
# ==============================================================================

def get_password_hash(password: str) -> str:
    """
    Generate a secure salted password hash.
    Uses bcrypt if available, otherwise high-iteration PBKDF2-HMAC-SHA256.
    """
    try:
        import bcrypt
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    except (ImportError, Exception):
        # Secure PBKDF2-HMAC-SHA256 standard fallback (100,000 iterations)
        salt_bytes = os.urandom(16)
        salt_hex = salt_bytes.hex()
        hash_bytes = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt_bytes,
            iterations=100000,
        )
        return f"pbkdf2:sha256:100000${salt_hex}${hash_bytes.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against its hashed representation in constant time.
    """
    if not hashed_password:
        return False

    # Check if hash is bcrypt
    if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            import bcrypt
            return bcrypt.checkpw(
                plain_password.encode("utf-8"),
                hashed_password.encode("utf-8"),
            )
        except Exception:
            pass

    # Check if hash is PBKDF2
    if hashed_password.startswith("pbkdf2:sha256:"):
        try:
            parts = hashed_password.split("$")
            if len(parts) == 3:
                header, salt_hex, expected_hash = parts
                iterations = int(header.split(":")[2])
                salt_bytes = bytes.fromhex(salt_hex)
                computed_hash = hashlib.pbkdf2_hmac(
                    "sha256",
                    plain_password.encode("utf-8"),
                    salt_bytes,
                    iterations=iterations,
                ).hex()
                return hmac.compare_digest(computed_hash, expected_hash)
        except Exception:
            return False

    # Standard fallback comparison
    return False


# ==============================================================================
# JWT Authentication Tokens
# ==============================================================================

def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate an RFC 7519 compliant JSON Web Token (HS256).
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    payload = {
        "sub": str(subject),
        "exp": int(expire.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp()),
    }
    if extra_claims:
        payload.update(extra_claims)

    try:
        import jwt
        return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
    except (ImportError, Exception):
        # RFC 7519 HMAC-SHA256 Token implementation
        header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
        header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        signature = hmac.new(
            SECRET_KEY.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()
        sig_b64 = _b64url_encode(signature)
        return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT access token.
    Returns the payload dictionary if valid and unexpired; otherwise None.
    """
    try:
        import jwt
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except (ImportError, Exception):
        # Validate RFC 7519 token manually
        try:
            parts = token.split(".")
            if len(parts) != 3:
                return None
            header_b64, payload_b64, sig_b64 = parts

            # Verify signature
            signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
            expected_sig = hmac.new(
                SECRET_KEY.encode("utf-8"),
                signing_input,
                hashlib.sha256,
            ).digest()
            expected_sig_b64 = _b64url_encode(expected_sig)

            if not hmac.compare_digest(sig_b64, expected_sig_b64):
                return None

            # Verify expiration
            payload_bytes = _b64url_decode(payload_b64)
            payload = json.loads(payload_bytes.decode("utf-8"))
            exp = payload.get("exp")
            if exp and int(time.time()) > exp:
                return None

            return payload
        except Exception:
            return None
