"""Centralized application configuration loaded from environment variables.

All secrets and environment-specific values are read here so the rest of the
codebase imports from a single source of truth instead of calling os.getenv
ad hoc. In production, SECRET_KEY must be provided or startup fails loudly.
"""
import os
import logging
import secrets
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Environment: "development" | "production"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_PRODUCTION = ENVIRONMENT == "production"


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"Required environment variable {name!r} is not set. "
            f"Set it in your environment or .env file."
        )
    return value


# --- Security / JWT ---------------------------------------------------------
_secret = os.getenv("SECRET_KEY")
if not _secret:
    if IS_PRODUCTION:
        raise RuntimeError(
            "SECRET_KEY environment variable must be set in production."
        )
    # Dev fallback: ephemeral key (tokens won't survive a restart — fine for dev)
    _secret = secrets.token_hex(32)
    logger.warning(
        "SECRET_KEY not set; using an ephemeral development key. "
        "Set SECRET_KEY in your .env for stable sessions."
    )
SECRET_KEY = _secret

ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# --- Google OAuth (Phase 1) -------------------------------------------------
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
# Used for the Drive authorization-code flow (teacher "Connect Google Drive").
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_DRIVE_REDIRECT_URI = os.getenv(
    "GOOGLE_DRIVE_REDIRECT_URI", "http://localhost:8002/api/drive/callback"
)
# Fernet key (44-char urlsafe base64) used to encrypt teacher Drive refresh
# tokens at rest. Generate with: Fernet.generate_key().decode()
DRIVE_TOKEN_ENC_KEY = os.getenv("DRIVE_TOKEN_ENC_KEY")
# Where to send the teacher back after the Drive OAuth callback.
FRONTEND_URL = (os.getenv("FRONTEND_URL") or "http://localhost:3000").rstrip("/")

# --- Default admin bootstrap (Phase 0 seed) ---------------------------------
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@learningquest.local")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")

_admin_pw = os.getenv("ADMIN_PASSWORD")
if not _admin_pw:
    if IS_PRODUCTION:
        raise RuntimeError(
            "ADMIN_PASSWORD environment variable must be set in production."
        )
    _admin_pw = "admin123"
    logger.warning(
        "ADMIN_PASSWORD not set; using an insecure development default. "
        "Set ADMIN_PASSWORD in your .env."
    )
ADMIN_PASSWORD = _admin_pw

# --- CORS -------------------------------------------------------------------
_cors = os.getenv("CORS_ORIGINS")
if _cors:
    CORS_ORIGINS = [o.strip() for o in _cors.split(",") if o.strip()]
else:
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

# Optional regex for additional allowed origins (e.g. your own Vercel project).
# No broad default — set it to something like
# r"https://your-app-[a-z0-9]+\.vercel\.app" instead of matching every Vercel site.
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX") or None

# --- Database ---------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_CONNECTION_STRING")

# --- Password reset ---------------------------------------------------------
RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "60"))

# --- Email verification + SMTP ----------------------------------------------
APP_NAME = os.getenv("APP_NAME", "LearningQuest")
VERIFICATION_CODE_EXPIRE_MINUTES = int(
    os.getenv("VERIFICATION_CODE_EXPIRE_MINUTES", "15")
)
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM") or SMTP_USER
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

# --- AI quiz import (Groq) --------------------------------------------------
# Used to extract questions/choices/answers from an uploaded PDF/Word document.
# Get a free key at https://console.groq.com (it's OpenAI-compatible).
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# --- File storage (submission attachments) ----------------------------------
# "local"  -> store files on disk under static/ (served at /static; dev default)
# "gdrive" -> upload into the class teacher's connected Google Drive
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local").lower()

if STORAGE_BACKEND == "gdrive" and not (
    GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and DRIVE_TOKEN_ENC_KEY
):
    raise RuntimeError(
        "STORAGE_BACKEND=gdrive requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET "
        "and DRIVE_TOKEN_ENC_KEY."
    )
