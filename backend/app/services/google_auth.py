"""Google Sign-In: verify the ID token issued by Google Identity Services.

The frontend renders the Google button, receives a `credential` (an ID token
JWT), and POSTs it to /auth/google. We verify it here against Google's public
keys with the official google-auth library and return the decoded claims.
"""
import logging
from app.config import GOOGLE_CLIENT_ID

logger = logging.getLogger(__name__)


class GoogleAuthError(Exception):
    """Raised when a Google ID token cannot be verified."""


def verify_google_id_token(token: str) -> dict:
    """Verify a Google ID token and return its claims.

    Raises GoogleAuthError on any failure (misconfig, invalid/expired token,
    wrong audience, unverified email).
    """
    if not GOOGLE_CLIENT_ID:
        raise GoogleAuthError(
            "Google Sign-In is not configured (GOOGLE_CLIENT_ID unset)."
        )

    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
    except ImportError as exc:  # pragma: no cover - dependency missing
        raise GoogleAuthError(
            "google-auth is not installed. Run: pip install google-auth"
        ) from exc

    try:
        claims = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError as exc:
        logger.warning("Google ID token verification failed: %s", exc)
        raise GoogleAuthError("Invalid or expired Google token.") from exc

    if not claims.get("email"):
        raise GoogleAuthError("Google token did not include an email.")
    if claims.get("email_verified") is False:
        raise GoogleAuthError("Google email is not verified.")

    return claims
