"""Symmetric encryption for secrets stored at rest (e.g. Drive refresh tokens).

Uses Fernet (AES-128-CBC + HMAC) with the key from DRIVE_TOKEN_ENC_KEY. If the
key is unset we raise on use so a misconfiguration fails loudly rather than
silently storing plaintext.
"""
from functools import lru_cache

from app.config import DRIVE_TOKEN_ENC_KEY


class CryptoError(Exception):
    pass


@lru_cache(maxsize=1)
def _fernet():
    if not DRIVE_TOKEN_ENC_KEY:
        raise CryptoError(
            "DRIVE_TOKEN_ENC_KEY is not set. Generate one with "
            "`python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\"` and put it in .env."
        )
    from cryptography.fernet import Fernet
    try:
        return Fernet(DRIVE_TOKEN_ENC_KEY.encode())
    except Exception as exc:  # noqa: BLE001
        raise CryptoError(f"Invalid DRIVE_TOKEN_ENC_KEY: {exc}") from exc


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
