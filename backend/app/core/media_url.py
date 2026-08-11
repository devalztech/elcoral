"""
Turns a raw Telegram storage ref (e.g. "482") into a URL the frontend can
drop straight into <img src> / <video src> — the frontend never needs to
know Telegram is involved. See app/routers/media.py for the route this
points at, and app/core/telegram_storage.py for how refs are created.
"""

import base64
import hashlib
import hmac
import os
import time

from app.core.config import settings

# How long a signed media URL stays valid. Long enough that an open tab
# keeps rendering, short enough that a leaked URL stops working; any page
# load re-signs, so this is invisible in normal use.
MEDIA_URL_TTL_SECONDS = 7 * 24 * 60 * 60
# Small leeway so a link signed by a slightly-ahead worker is not rejected.
CLOCK_SKEW_SECONDS = 60


def _current_public_url() -> str:
    # PUBLIC_API_URL, if set, always wins — useful once a stable domain
    # (named Cloudflare tunnel) is set up, since that URL never changes.
    if settings.public_api_url:
        return settings.public_api_url

    # Until then: read the live Quick Tunnel URL from the same file
    # main.py's _start_cloudflare_tunnel() writes on every boot. This
    # changes automatically with zero manual env var updates — no need to
    # restart twice (once for the new tunnel, again to load a manually
    # updated env var) every time the container restarts.
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    url_file = os.path.join(repo_root, ".bin", "tunnel_url.txt")
    try:
        with open(url_file) as f:
            return f.read().strip()
    except FileNotFoundError:
        return ""


def _sign(ref: str, expires_at: int) -> str:
    digest = hmac.new(
        settings.jwt_secret_key.encode(),
        f"{ref}.{expires_at}".encode(),
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def sign_media_ref(ref: str, ttl_seconds: int = MEDIA_URL_TTL_SECONDS) -> tuple[int, str]:
    """Return (expiry, signature) for a storage ref."""
    expires_at = int(time.time()) + ttl_seconds
    return expires_at, _sign(ref, expires_at)


def verify_media_signature(ref: str, expires_at: int | None, signature: str | None) -> bool:
    """
    True only for a signature this server issued, for this exact ref, that
    has not expired. Storage refs are short sequential ids, so without this
    check anyone could walk /api/media/1..N and read other people's private
    chat photos — the signature is what makes a ref unguessable.
    """
    if not ref or not signature or not expires_at:
        return False
    if expires_at + CLOCK_SKEW_SECONDS < int(time.time()):
        return False
    return hmac.compare_digest(_sign(ref, int(expires_at)), signature)


def media_ref_to_url(ref: str | None) -> str | None:
    """
    A ready-to-embed, signature-protected media URL.

    The signature travels in the query string because browsers cannot send
    an Authorization header for <img src> / <video src>, so a bearer token
    on the media route would simply break every image.
    """
    if not ref:
        return None
    base = _current_public_url()
    expires_at, signature = sign_media_ref(str(ref))
    return f"{base}/api/media/{ref}?exp={expires_at}&sig={signature}"
