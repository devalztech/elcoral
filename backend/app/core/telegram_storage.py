"""
Media storage backed by a private Telegram channel, accessed via Telethon
(MTProto, logged in as a user — not the Bot API) to avoid the Bot API's
50MB upload limit.

How it works:
  - One shared TelegramClient connects on app startup using a pre-generated
    StringSession (see scripts/generate_telegram_session.py — run once,
    interactively, from Termux or any real terminal; the resulting string
    goes into the TELEGRAM_SESSION env var so no login is ever needed here).
  - Uploading a file sends it as a message to a private storage channel
    (TELEGRAM_CHANNEL_ID) and returns that message's id. That id is what
    gets stored in Postgres as a "ref" (e.g. profiles.photo_ref,
    posts.media_refs) — it's a compact pointer, not a real URL.
  - Downloading re-fetches the message by id and streams the file bytes
    back out. FastAPI routes wrap this so the frontend just sees a normal
    URL like GET /api/media/{ref} and never needs to know Telegram is
    involved.

This module deliberately knows nothing about profiles or posts — it's a
generic ref-in/bytes-out storage layer, so it can be reused for DMs later
without changes here.
"""

import io
import json
import logging
import os
import uuid
from dataclasses import dataclass

from telethon import TelegramClient
from telethon.sessions import StringSession

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")

_client: TelegramClient | None = None


class TelegramStorageError(Exception):
    """Raised for any storage failure — callers should turn this into a 502/503, not leak internals."""


@dataclass
class UploadResult:
    ref: str  # what gets stored in Postgres, e.g. "482"
    mime_type: str
    size_bytes: int


def _require_client() -> TelegramClient:
    if _client is None or not settings.telegram_configured:
        raise TelegramStorageError(
            "Telegram storage is not configured (missing TELEGRAM_API_ID / "
            "TELEGRAM_API_HASH / TELEGRAM_SESSION / TELEGRAM_CHANNEL_ID)."
        )
    return _client


async def start():
    """Call once on app startup. No-ops quietly if not configured yet, so
    the rest of the app still boots — routes that need storage check
    settings.telegram_configured themselves and return a clean error."""
    global _client

    if not settings.telegram_configured:
        logger.warning("Telegram storage not configured — media upload/download will be unavailable.")
        return

    _client = TelegramClient(
        StringSession(settings.telegram_session),
        settings.telegram_api_id,
        settings.telegram_api_hash,
    )
    try:
        await _client.connect()
        if not await _client.is_user_authorized():
            logger.error(
                "Telegram session is present but not authorized — regenerate "
                "TELEGRAM_SESSION with scripts/generate_telegram_session.py"
            )
            _client = None
            return
        logger.info("Telegram storage connected.")
    except Exception:
        logger.exception("Failed to connect Telegram storage client")
        _client = None


async def stop():
    global _client
    if _client is not None:
        await _client.disconnect()
        _client = None


# ---------------------------------------------------------------- local ----
# Development / self-hosted fallback. When Telegram credentials are absent
# the app still needs working uploads (otherwise every photo, avatar, post
# and DM attachment fails), so bytes are written to .bin/media instead and
# the ref is the file name. Refs are prefixed "l_" so the two backends can
# coexist: an old Telegram ref stays numeric and still routes to Telegram.
LOCAL_PREFIX = "l_"


def _local_dir() -> str:
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    path = os.path.join(repo_root, ".bin", "media")
    os.makedirs(path, exist_ok=True)
    return path


def _local_upload(file_bytes: bytes, filename: str, mime_type: str) -> UploadResult:
    ref = f"{LOCAL_PREFIX}{uuid.uuid4().hex}"
    folder = _local_dir()
    with open(os.path.join(folder, ref), "wb") as fh:
        fh.write(file_bytes)
    with open(os.path.join(folder, f"{ref}.json"), "w") as fh:
        json.dump({"mime_type": mime_type, "filename": filename}, fh)
    return UploadResult(ref=ref, mime_type=mime_type, size_bytes=len(file_bytes))


def _local_download(ref: str) -> tuple[bytes, str]:
    folder = _local_dir()
    path = os.path.join(folder, os.path.basename(ref))
    if not os.path.exists(path):
        raise TelegramStorageError(f"No media found for ref={ref}")
    meta_path = f"{path}.json"
    mime_type = "application/octet-stream"
    if os.path.exists(meta_path):
        try:
            with open(meta_path) as fh:
                mime_type = json.load(fh).get("mime_type") or mime_type
        except Exception:
            pass
    with open(path, "rb") as fh:
        return fh.read(), mime_type


async def upload(file_bytes: bytes, filename: str, mime_type: str) -> UploadResult:
    if not settings.telegram_configured:
        return _local_upload(file_bytes, filename, mime_type)

    client = _require_client()

    buf = io.BytesIO(file_bytes)
    # Telethon infers photo-vs-document partly from the file object's name/
    # extension. A bare BytesIO with no .name was making it fall back to
    # "document" even for real images, regardless of force_document below —
    # setting .name here is what actually fixes images showing up as
    # generic file attachments instead of real photos in the channel.
    buf.name = filename

    try:
        message = await client.send_file(
            settings.telegram_channel_id,
            file=buf,
            force_document=not mime_type.startswith(("image/", "video/")),
        )
    except Exception as e:
        logger.exception("Telegram upload failed")
        raise TelegramStorageError("Upload failed") from e

    return UploadResult(ref=str(message.id), mime_type=mime_type, size_bytes=len(file_bytes))


async def download(ref: str) -> tuple[bytes, str]:
    """Returns (file_bytes, mime_type)."""
    if ref.startswith(LOCAL_PREFIX):
        return _local_download(ref)

    client = _require_client()
    try:
        message = await client.get_messages(settings.telegram_channel_id, ids=int(ref))
        if message is None or not message.media:
            raise TelegramStorageError(f"No media found for ref={ref}")
        buf = io.BytesIO()
        await client.download_media(message, file=buf)
        mime_type = getattr(getattr(message, "file", None), "mime_type", None) or "application/octet-stream"
        return buf.getvalue(), mime_type
    except TelegramStorageError:
        raise
    except Exception as e:
        logger.exception(f"Telegram download failed for ref={ref}")
        raise TelegramStorageError("Download failed") from e
