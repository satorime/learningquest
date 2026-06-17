"""Local file storage for submission attachments (dev fallback).

Production uses Google Drive (see services/drive_storage.py), routed at upload
time in routes/quiz.py. This module is the on-disk backend used when
STORAGE_BACKEND="local": files are written under static/ and served at /static.

The stored reference is self-describing — a "/static/..." path for local files,
or an "http..." URL/Drive link — so resolve/delete stay backend-agnostic.
"""
import os
import re
import uuid
import logging

logger = logging.getLogger(__name__)

# Local files live here; the value stored on the attachment is "/static/uploads/<key>".
LOCAL_PREFIX = "/static/uploads/"
LOCAL_DIR = os.path.join("static", "uploads")


class StorageError(Exception):
    """Raised when the storage backend fails."""


def _safe_filename(name: str) -> str:
    """Strip path components and unsafe characters from an uploaded filename."""
    name = os.path.basename(name or "file")
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return name[:120] or "file"


def _logical_key(user_id: int, safe_name: str) -> str:
    """A unique, namespaced object key: submissions/<user>/<uuid>_<name>."""
    return f"submissions/{user_id}/{uuid.uuid4().hex}_{safe_name}"


# --- public API -------------------------------------------------------------
def save_upload(user_id: int, filename: str, content: bytes, content_type: str | None) -> dict:
    """Persist bytes locally and return attachment metadata."""
    safe = _safe_filename(filename)
    key = _logical_key(user_id, safe)
    ref = _local_save(key, content)
    return {
        "kind": "file",
        "url": ref,
        "name": safe,
        "mime": content_type,
        "size": len(content),
    }


def resolve_url(ref: str) -> str:
    """Turn a stored reference into a URL a browser can open."""
    if not ref:
        return ref
    if ref.startswith("http://") or ref.startswith("https://"):
        return ref  # external link or Drive webViewLink — already usable
    # Local file — the frontend prefixes the API origin.
    return ref


def delete(ref: str) -> None:
    """Best-effort removal of a stored LOCAL file (no-op for links/Drive)."""
    if not ref or ref.startswith("http://") or ref.startswith("https://"):
        return
    try:
        if ref.startswith(LOCAL_PREFIX) or ref.startswith("/static/"):
            path = ref.lstrip("/")
            if os.path.exists(path):
                os.remove(path)
    except Exception as exc:  # noqa: BLE001 - cleanup is best-effort
        logger.warning("Could not delete stored file %s: %s", ref, exc)


# --- local backend ----------------------------------------------------------
def _local_save(key: str, content: bytes) -> str:
    path = os.path.join(LOCAL_DIR, key.replace("/", os.sep))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(content)
    return LOCAL_PREFIX + key  # e.g. /static/uploads/submissions/3/ab12_essay.pdf
