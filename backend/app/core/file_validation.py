"""
Server-side upload validation.

The client-supplied ``Content-Type`` on a multipart part is attacker
controlled: anything can be posted as ``image/png``. Everything here
therefore ignores it as a *fact* and treats it only as a *claim* that
must be corroborated by the bytes themselves:

  1. Sniff the real container from magic bytes / structural markers.
  2. Require the sniffed type to match the claimed type (same bucket and
     same concrete type where the format is unambiguous).
  3. For images, additionally decode the header with Pillow so a file
     that merely *starts* with a PNG signature but is malformed (or is a
     polyglot carrying something else) is rejected.
  4. Enforce a per-category size ceiling on top of the global one.

This runs BEFORE anything is handed to Telegram storage.
"""

from __future__ import annotations

import io
import logging

logger = logging.getLogger("uvicorn.error")

try:  # Pillow is required for real image verification; degrade loudly, not silently.
    from PIL import Image

    Image.MAX_IMAGE_PIXELS = 64_000_000  # decompression-bomb guard (~8000x8000)
    _PILLOW = True
except Exception:  # pragma: no cover - only when the dependency is missing
    _PILLOW = False
    logger.warning(
        "Pillow is not installed — image uploads will only be checked by magic bytes. "
        "Install Pillow (see requirements.txt) to re-enable full image verification."
    )


class FileValidationError(Exception):
    """Raised when an upload must be rejected. Message is safe to show a user."""


# --------------------------------------------------------------------------
# Size ceilings
# --------------------------------------------------------------------------
# The global ceiling stays where it was (200MB, for video). Everything else
# gets a much tighter, category-appropriate limit — there is no legitimate
# 200MB avatar, and a large "image" is a cheap way to burn memory.
MAX_UPLOAD_BYTES = 200 * 1024 * 1024
MAX_BYTES_BY_KIND = {
    "image": 25 * 1024 * 1024,
    "video": 200 * 1024 * 1024,
    "audio": 50 * 1024 * 1024,
    "document": 25 * 1024 * 1024,
}

MIN_UPLOAD_BYTES = 4  # anything smaller cannot carry a signature


def kind_for(mime: str) -> str:
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"
    return "document"


# --------------------------------------------------------------------------
# Signature sniffing
# --------------------------------------------------------------------------
# (offset, magic bytes, mime) — ordered most specific first.
_SIGNATURES: list[tuple[int, bytes, str]] = [
    (0, b"\xff\xd8\xff", "image/jpeg"),
    (0, b"\x89PNG\r\n\x1a\n", "image/png"),
    (0, b"GIF87a", "image/gif"),
    (0, b"GIF89a", "image/gif"),
    (0, b"BM", "image/bmp"),
    (0, b"II*\x00", "image/tiff"),
    (0, b"MM\x00*", "image/tiff"),
    (0, b"%PDF-", "application/pdf"),
    (0, b"\x1a\x45\xdf\xa3", "video/x-matroska"),  # Matroska/WebM — refined below
    (0, b"OggS", "audio/ogg"),
    (0, b"fLaC", "audio/flac"),
    (0, b"RIFF", "riff"),  # WAV / AVI / WEBP — refined below
    (0, b"ID3", "audio/mpeg"),
    (0, b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "application/x-ole"),  # legacy Office
    (0, b"PK\x03\x04", "application/zip"),  # zip + all OOXML
    (0, b"{\\rtf", "application/rtf"),
    (0, b"\x00\x00\x00\x18ftyp", "iso-bmff"),
    (0, b"\x00\x00\x00\x1cftyp", "iso-bmff"),
]

# Concrete types a sniffed container is allowed to be presented as.
_CONTAINER_ALIASES: dict[str, set[str]] = {
    "image/tiff": {"image/tiff"},
    "image/bmp": {"image/bmp"},
    "application/zip": {
        "application/zip",
        "application/x-zip-compressed",
        # OOXML documents are zip containers.
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },
    "application/x-ole": {
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
    },
    "iso-bmff": {
        "video/mp4",
        "video/quicktime",
        "audio/mp4",
        "audio/x-m4a",
        "audio/aac",
        "image/heic",
        "image/heif",
        "image/avif",
    },
    "video/x-matroska": {"video/x-matroska", "video/webm", "audio/webm"},
    "audio/ogg": {"audio/ogg"},
    "audio/flac": {"audio/flac"},
    "audio/mpeg": {"audio/mpeg"},
    "audio/wav": {"audio/wav"},
    "video/x-msvideo": {"video/x-msvideo"},
    "image/webp": {"image/webp"},
    "image/jpeg": {"image/jpeg"},
    "image/png": {"image/png"},
    "image/gif": {"image/gif"},
    "application/pdf": {"application/pdf"},
    "application/rtf": {"application/rtf"},
}

# Formats with no reliable signature. These are accepted only when the
# bytes are valid UTF-8 text AND carry nothing that looks like markup or
# a script — a "text/plain" that is actually HTML is a stored-XSS attempt.
_TEXT_TYPES = {"text/plain", "text/csv", "text/markdown"}
_TEXT_RED_FLAGS = (b"<script", b"<iframe", b"<!doctype html", b"<html", b"<?php", b"<svg")


def _sniff(head: bytes) -> str | None:
    """Best-effort container type from the first bytes. None when unknown."""
    for offset, magic, mime in _SIGNATURES:
        if head[offset : offset + len(magic)] == magic:
            if mime == "riff":
                if head[8:12] == b"WEBP":
                    return "image/webp"
                if head[8:12] == b"WAVE":
                    return "audio/wav"
                if head[8:12] == b"AVI ":
                    return "video/x-msvideo"
                return None
            return mime

    # MP4/MOV/HEIF/AVIF: "ftyp" box at offset 4, any box size.
    if head[4:8] == b"ftyp":
        return "iso-bmff"
    # MP3 frame sync without an ID3 tag.
    if head[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"\xff\xe3"):
        return "audio/mpeg"
    return None


# ISO base-media brands, so an .mp4 cannot be passed off as a .heic and
# vice-versa even though both are ftyp containers.
_ISO_BRANDS: dict[bytes, set[str]] = {
    b"qt  ": {"video/quicktime"},
    b"heic": {"image/heic", "image/heif"},
    b"heix": {"image/heic", "image/heif"},
    b"hevc": {"image/heic", "image/heif"},
    b"mif1": {"image/heic", "image/heif"},
    b"msf1": {"image/heic", "image/heif"},
    b"avif": {"image/avif"},
    b"avis": {"image/avif"},
    b"M4A ": {"audio/mp4", "audio/x-m4a", "audio/aac"},
    b"M4B ": {"audio/mp4", "audio/x-m4a"},
}
_ISO_VIDEO_DEFAULT = {"video/mp4", "video/quicktime", "audio/mp4", "audio/x-m4a"}


def _refine_iso_bmff(head: bytes) -> set[str]:
    """Pin an ftyp container to the concrete types its brand allows."""
    return set(_ISO_BRANDS.get(head[8:12], _ISO_VIDEO_DEFAULT))


def _verify_image(data: bytes, claimed: str) -> None:
    """Decode the image header for real; reject anything Pillow won't open."""
    if not _PILLOW:
        return
    # Pillow has no decoder for HEIC/HEIF/AVIF without plugins — those were
    # already pinned to an ISO-BMFF container by the signature check.
    if claimed in {"image/heic", "image/heif", "image/avif"}:
        return
    try:
        with Image.open(io.BytesIO(data)) as img:
            img.verify()  # structural check, does not decode pixel data
        with Image.open(io.BytesIO(data)) as img:
            img.load()  # full decode: catches truncated / bomb payloads
            if img.width <= 0 or img.height <= 0:
                raise FileValidationError("Image has invalid dimensions")
    except FileValidationError:
        raise
    except Exception:
        raise FileValidationError("File is not a readable image")


def validate_upload(data: bytes, claimed_type: str, filename: str | None = None) -> str:
    """
    Validate ``data`` against ``claimed_type`` (already normalised and
    checked against the allow-list by the caller).

    Returns the MIME type that should actually be stored — derived from the
    bytes wherever the bytes are authoritative, never blindly from the
    client. Raises ``FileValidationError`` on any mismatch.
    """
    size = len(data)
    if size < MIN_UPLOAD_BYTES:
        raise FileValidationError("File is empty or too small to be valid")

    kind = kind_for(claimed_type)
    if size > MAX_BYTES_BY_KIND.get(kind, MAX_UPLOAD_BYTES):
        limit_mb = MAX_BYTES_BY_KIND.get(kind, MAX_UPLOAD_BYTES) // (1024 * 1024)
        raise FileValidationError(f"File too large: {kind} uploads are limited to {limit_mb}MB")

    head = data[:64]

    if claimed_type in _TEXT_TYPES:
        # No signature exists for plain text, so validate it as text.
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            raise FileValidationError("Text file is not valid UTF-8")
        lowered = data[:4096].lower()
        if any(flag in lowered for flag in _TEXT_RED_FLAGS):
            raise FileValidationError("Text file contains markup or scripts and was rejected")
        if _sniff(head) is not None:
            raise FileValidationError("File contents do not match a text file")
        return claimed_type

    sniffed = _sniff(head)
    if sniffed is None:
        raise FileValidationError("Unrecognised file format — the contents could not be verified")

    if sniffed == "iso-bmff":
        allowed = _refine_iso_bmff(head)
    else:
        allowed = _CONTAINER_ALIASES.get(sniffed, {sniffed})
    if claimed_type not in allowed:
        raise FileValidationError(
            "File contents do not match the declared file type and were rejected"
        )

    if kind == "image":
        _verify_image(data, claimed_type)

        # Polyglots: an image can be a structurally valid GIF/PNG/JPEG
        # *and* carry HTML or PHP appended after the image data. It cannot execute the way we serve it (nosniff +
        # CSP sandbox + a non-HTML Content-Type), but there is no
        # legitimate reason for it either, so it is refused, not stored.
        lowered_all = data.lower()
        if any(flag in lowered_all for flag in _TEXT_RED_FLAGS):
            raise FileValidationError(
                "Image contains embedded markup or scripts and was rejected"
            )

    # An image/video/audio must never be stored under a document MIME (and
    # vice-versa): the stored MIME is what Content-Type the media route
    # later serves with.
    return claimed_type
