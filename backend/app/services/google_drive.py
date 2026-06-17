"""Google Drive REST client for teacher-connected storage.

Raw REST via `requests` (same style as the Supabase code in storage.py) so we
don't pull in the heavier google-api-python-client. Scope is `drive.file`: the
app can only see folders/files it created or that the teacher explicitly picked.
"""
import json
import logging
import secrets
import urllib.parse

import requests

from app.config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_DRIVE_REDIRECT_URI,
)

logger = logging.getLogger(__name__)

_TIMEOUT = 30
_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
_FILES_URL = "https://www.googleapis.com/drive/v3/files"
_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
_FOLDER_MIME = "application/vnd.google-apps.folder"
SCOPES = "https://www.googleapis.com/auth/drive.file openid email"


class DriveError(Exception):
    pass


def is_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


# --- OAuth ------------------------------------------------------------------
def consent_url(state: str) -> str:
    """The Google consent screen URL for the Drive authorization-code flow."""
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_DRIVE_REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",       # we need a refresh token
        "prompt": "consent",            # force a refresh token every time
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{_AUTH_URL}?{urllib.parse.urlencode(params)}"


def exchange_code(code: str) -> dict:
    """Trade an auth code for tokens. Returns {refresh_token, access_token, email}."""
    resp = requests.post(
        _TOKEN_URL,
        data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_DRIVE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=_TIMEOUT,
    )
    if resp.status_code != 200:
        raise DriveError(f"Token exchange failed ({resp.status_code}): {resp.text}")
    data = resp.json()
    access = data.get("access_token")
    refresh = data.get("refresh_token")
    if not refresh:
        raise DriveError("Google did not return a refresh token (re-consent required).")
    email = None
    try:
        info = requests.get(
            _USERINFO_URL,
            headers={"Authorization": f"Bearer {access}"},
            timeout=_TIMEOUT,
        )
        if info.status_code == 200:
            email = info.json().get("email")
    except Exception:  # noqa: BLE001 - email is best-effort
        pass
    return {"refresh_token": refresh, "access_token": access, "email": email}


def refresh_access_token(refresh_token: str) -> str:
    resp = requests.post(
        _TOKEN_URL,
        data={
            "refresh_token": refresh_token,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "grant_type": "refresh_token",
        },
        timeout=_TIMEOUT,
    )
    if resp.status_code != 200:
        raise DriveError(f"Token refresh failed ({resp.status_code}): {resp.text}")
    token = resp.json().get("access_token")
    if not token:
        raise DriveError("Token refresh response missing access_token")
    return token


# --- Drive operations -------------------------------------------------------
def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def ensure_folder(token: str, name: str, parent_id: str | None) -> str:
    """Find a folder by name under parent (or root), creating it if missing."""
    q = (
        f"name = '{_escape(name)}' and mimeType = '{_FOLDER_MIME}' "
        f"and trashed = false"
    )
    if parent_id:
        q += f" and '{parent_id}' in parents"
    resp = requests.get(
        _FILES_URL,
        headers=_auth(token),
        params={"q": q, "fields": "files(id,name)", "pageSize": 1,
                "spaces": "drive"},
        timeout=_TIMEOUT,
    )
    if resp.status_code == 200:
        files = resp.json().get("files", [])
        if files:
            return files[0]["id"]
    elif resp.status_code not in (200,):
        logger.warning("Drive folder lookup failed (%s): %s", resp.status_code, resp.text)

    metadata = {"name": name, "mimeType": _FOLDER_MIME}
    if parent_id:
        metadata["parents"] = [parent_id]
    create = requests.post(
        _FILES_URL,
        headers={**_auth(token), "Content-Type": "application/json"},
        params={"fields": "id"},
        json=metadata,
        timeout=_TIMEOUT,
    )
    if create.status_code not in (200, 201):
        raise DriveError(f"Create folder failed ({create.status_code}): {create.text}")
    return create.json()["id"]


def upload_file(token: str, parent_id: str, name: str, content: bytes,
                mime: str | None) -> dict:
    """Upload bytes into a folder. Returns {id, webViewLink}."""
    mime = mime or "application/octet-stream"
    boundary = f"lq{secrets.token_hex(16)}"
    metadata = {"name": name, "parents": [parent_id]}
    body = (
        f"--{boundary}\r\n"
        "Content-Type: application/json; charset=UTF-8\r\n\r\n"
        f"{json.dumps(metadata)}\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + content + f"\r\n--{boundary}--".encode()

    resp = requests.post(
        _UPLOAD_URL + "&fields=id,webViewLink",
        headers={**_auth(token),
                 "Content-Type": f"multipart/related; boundary={boundary}"},
        data=body,
        timeout=_TIMEOUT,
    )
    if resp.status_code not in (200, 201):
        raise DriveError(f"Upload failed ({resp.status_code}): {resp.text}")
    data = resp.json()
    return {"id": data["id"], "webViewLink": data.get("webViewLink", "")}


def share_with(token: str, file_id: str, email: str) -> None:
    """Give a person reader access (best-effort, no notification email)."""
    if not email:
        return
    try:
        requests.post(
            f"{_FILES_URL}/{file_id}/permissions",
            headers={**_auth(token), "Content-Type": "application/json"},
            params={"sendNotificationEmail": "false"},
            json={"role": "reader", "type": "user", "emailAddress": email},
            timeout=_TIMEOUT,
        )
    except Exception as exc:  # noqa: BLE001 - sharing is best-effort
        logger.warning("Drive share failed for %s: %s", file_id, exc)


def delete_file(token: str, file_id: str) -> None:
    resp = requests.delete(
        f"{_FILES_URL}/{file_id}", headers=_auth(token), timeout=_TIMEOUT
    )
    if resp.status_code not in (200, 204, 404):
        raise DriveError(f"Delete failed ({resp.status_code}): {resp.text}")


def folder_link(folder_id: str) -> str:
    return f"https://drive.google.com/drive/folders/{folder_id}"
