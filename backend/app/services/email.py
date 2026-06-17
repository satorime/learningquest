"""Email delivery.

Sends via SMTP when SMTP_HOST is configured; otherwise logs the message to the
backend console (dev mode) so flows like email verification can be tested
without a mail provider.
"""
import logging
import smtplib
from email.message import EmailMessage

from app.config import (
    APP_NAME, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM,
    SMTP_USE_TLS,
)

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str) -> bool:
    """Send an email. Returns True if actually dispatched via SMTP."""
    if not SMTP_HOST:
        logger.info(
            "[DEV EMAIL — not sent, SMTP unconfigured]\nTo: %s\nSubject: %s\n%s",
            to, subject, body,
        )
        return False

    msg = EmailMessage()
    msg["From"] = SMTP_FROM or SMTP_USER
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to send email to %s: %s", to, exc)
        return False


def send_verification_code(to: str, code: str, minutes: int) -> bool:
    return send_email(
        to,
        f"{APP_NAME} verification code",
        f"Welcome to {APP_NAME}!\n\n"
        f"Your verification code is: {code}\n\n"
        f"It expires in {minutes} minutes. "
        f"If you didn't request this, you can ignore this email.",
    )


def send_email_change_code(to: str, code: str, minutes: int) -> bool:
    return send_email(
        to,
        f"{APP_NAME} email change confirmation",
        f"Use this code to confirm changing your {APP_NAME} email address to "
        f"this one:\n\n"
        f"    {code}\n\n"
        f"It expires in {minutes} minutes. "
        f"If you didn't request this change, you can ignore this email and your "
        f"address will stay the same.",
    )
