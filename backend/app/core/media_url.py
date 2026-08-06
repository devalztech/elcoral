"""
Turns a raw Telegram storage ref (e.g. "482") into a URL the frontend can
drop straight into <img src> / <video src> — the frontend never needs to
know Telegram is involved. See app/routers/media.py for the route this
points at, and app/core/telegram_storage.py for how refs are created.
"""

import os

from app.core.config import settings


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


def media_ref_to_url(ref: str | None) -> str | None:
    if not ref:
        return None
    base = _current_public_url()
    return f"{base}/api/media/{ref}"
