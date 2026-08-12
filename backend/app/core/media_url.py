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

# Two different lifetimes, because a public URL and a viewer-bound URL
# fail differently when they leak.
#
# PUBLIC media (no audience — post/profile photos) is meant to be freely
# embeddable, cacheable and shareable, same as before. There is no
# "wrong viewer" for it to leak to, so a long TTL costs nothing and a
# short one would just break shared links and CDN caching for no
# security benefit.
PUBLIC_MEDIA_URL_TTL_SECONDS = 7 * 24 * 60 * 60

# PRIVATE media (audience-bound — DM attachments, community chat/
# discussion/project media) is different: every signed link that exists
# is a standing grant to one specific viewer, independent of whatever
# that viewer's *current* membership/participant status is (see
# app/routers/media.py and get_media's audience check — membership is
# re-checked at read/list time, but a URL already handed out is only
# re-checked by its own signature, not by a live DB lookup). The TTL is
# therefore the actual upper bound on "how stale can access get after
# someone loses access" — see the freshness note below. 15 minutes is
# short enough that a leaked/cached link is only a brief window, long
# enough that normal viewing (an open chat tab, scrolling back through
# history, a slow connection) never visibly breaks: the frontend re-signs
# on every page/list load, so a live session never notices the TTL at
# all — only a *copied-out* link or a *stale* cached page would.
PRIVATE_MEDIA_URL_TTL_SECONDS = 15 * 60

# Kept as an alias: existing call sites and tests that referred to the
# single old constant keep working, and it names the same value a caller
# gets when it does not pass ttl_seconds/audience explicitly.
MEDIA_URL_TTL_SECONDS = PUBLIC_MEDIA_URL_TTL_SECONDS

# Small leeway so a link signed by a slightly-ahead worker is not rejected.
CLOCK_SKEW_SECONDS = 60

# ---------------------------------------------------------------------------
# Authorization freshness — what the short TTL does and does not cover
# ---------------------------------------------------------------------------
# Reducing PRIVATE_MEDIA_URL_TTL_SECONDS is a bound on exposure, not a
# revocation mechanism. Concretely, after a user leaves a conversation,
# is removed/banned from a community, or otherwise loses access to
# something private:
#   - Every LIST/READ endpoint (conversations, community messages, etc.)
#     re-checks membership live and immediately stops returning that
#     content — and therefore stops minting new signed URLs for it. This
#     part is already fully live, not TTL-bound.
#   - Any signed URL that was ALREADY handed out before the access change
#     keeps working for whatever is left of its TTL, because the
#     signature is a self-contained proof ("this server signed `ref` for
#     `audience` before `expires_at`") with no per-request database
#     lookup of current membership. Shortening the TTL from 7 days to 15
#     minutes shrinks that residual window from "up to a week" to "up to
#     15 minutes" — it does not close it to zero.
# Closing it to zero would need one of: a membership/version check on
# every GET /api/media/{ref} (a DB round trip on the hot media-serving
# path, for every image/video/audio byte range request), or an explicit
# revocation list checked on every request (extra state to keep correct
# forever). Given how narrow 15 minutes already is relative to the harm
# (someone who *was* legitimately shown the content a few minutes ago
# keeps seeing that one image/clip a little longer), that cost is not
# justified here — this module intentionally stays TTL-only. If a
# use case ever needs harder guarantees (e.g. "removal must be
# instant"), the right lever is a per-community/per-conversation
# "access_version" counter folded into the signed audience string, so
# revoking bumps the version and every outstanding URL for that
# scope stops verifying immediately, without a DB hit on every read.


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


def _sign(ref: str, expires_at: int, audience: str = "") -> str:
    digest = hmac.new(
        settings.jwt_secret_key.encode(),
        f"{ref}.{expires_at}.{audience}".encode(),
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def sign_media_ref(
    ref: str, ttl_seconds: int | None = None, audience: str = ""
) -> tuple[int, str]:
    """
    Return (expiry, signature) for a storage ref, optionally bound to one
    viewer.

    ``ttl_seconds`` defaults to PRIVATE_MEDIA_URL_TTL_SECONDS when
    ``audience`` is set and PUBLIC_MEDIA_URL_TTL_SECONDS otherwise, so
    callers that don't care just get the right lifetime for what they're
    signing. Pass it explicitly only to override that (e.g. tests).
    """
    if ttl_seconds is None:
        ttl_seconds = PRIVATE_MEDIA_URL_TTL_SECONDS if audience else PUBLIC_MEDIA_URL_TTL_SECONDS
    expires_at = int(time.time()) + ttl_seconds
    return expires_at, _sign(ref, expires_at, audience)


def verify_media_signature(
    ref: str, expires_at: int | None, signature: str | None, audience: str = ""
) -> bool:
    """
    True only for a signature this server issued, for this exact ref and
    this exact audience, that has not expired.

    A storage ref is NOT a credential: refs are short sequential Telegram
    message ids, so anyone could otherwise walk /api/media/1..N. The
    signature is what makes a ref unguessable, and `audience` is what stops
    a signed link for private material from working for anybody other than
    the account it was issued to.
    """
    if not ref or not signature or not expires_at:
        return False
    if expires_at + CLOCK_SKEW_SECONDS < int(time.time()):
        return False
    return hmac.compare_digest(_sign(ref, int(expires_at), audience), signature)


def media_ref_to_url(ref: str | None, viewer_id=None) -> str | None:
    """
    A ready-to-embed, signature-protected media URL.

    The signature travels in the query string because browsers cannot send
    an Authorization header for <img src> / <video src>, so a bearer token
    on the media route would simply break every image.

    Pass `viewer_id` for anything that is NOT public (DM attachments,
    community chat/discussion/project media). That binds the URL to that
    one account: the media route then also requires proof of who is
    asking, so a copied link is worthless to a different user, AND it
    signs with the short PRIVATE_MEDIA_URL_TTL_SECONDS lifetime instead
    of the long public one (see the constants above for why). Public post
    and profile media is left unbound so it stays embeddable, cacheable,
    and long-lived exactly as before.
    """
    if not ref:
        return None
    base = _current_public_url()
    audience = str(viewer_id) if viewer_id else ""
    expires_at, signature = sign_media_ref(str(ref), audience=audience)
    url = f"{base}/api/media/{ref}?exp={expires_at}&sig={signature}"
    if audience:
        url += f"&aud={audience}"
    return url


# ---------------------------------------------------------------------------
# Media session cookie
# ---------------------------------------------------------------------------
#
# An <img>/<video> request carries no Authorization header, so proving
# "who is asking" for viewer-bound media needs a cookie. This is a
# separate, minimal, httponly cookie holding only `user_id.expiry.hmac` —
# it is NOT a session token: it cannot be exchanged for an access token
# and is only ever consulted by GET /api/media/{ref}.
MEDIA_SESSION_COOKIE = "media_session"
MEDIA_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

# ---------------------------------------------------------------------------
# Browser/PWA compatibility — third-party cookie blocking
# ---------------------------------------------------------------------------
# <img src>, <video src> and <audio src> cannot attach an Authorization
# header — this cookie is the ONLY credential those elements can send for
# viewer-bound media (see _requester_id in app/routers/media.py). That
# only works if the browser actually attaches the cookie to the request,
# and with the frontend (Render) and this API on different registrable
# domains, that request is a genuine third-party/cross-site cookie send
# from the browser's point of view — same-origin-looking URLs in the
# markup do not change that; what matters is the domain relationship
# between the page and the resource.
#
# As of 2026:
#   - Safari (iOS and macOS, including "Add to Home Screen" PWAs, which
#     share Safari's WebKit cookie jar and ITP rules) and Firefox block
#     third-party SameSite=None cookies by default. On these browsers a
#     cross-domain deployment means private media served through <img>/
#     <video>/<audio> silently fails to authenticate — the request goes
#     out with no media_session cookie, get_media() correctly returns
#     401, and the element just fails to render. This is not new in
#     2026; both browsers have done this for years.
#   - Chrome (desktop and Android) still sends third-party cookies by
#     default: Google shut down its cookie-deprecation plan in 2025 and
#     third-party cookies remain, gated behind a per-user choice most
#     users leave on. Chrome is NOT guaranteed, though — a user with
#     that choice turned off hits the same failure as Safari/Firefox.
#
# There is no fix for this that doesn't either weaken the guarantee
# (e.g. accepting the ref alone, or a token in the URL that then gets
# logged/cached/shared) or change the deployment: the actual fix is
# serving the frontend and this API from the SAME registrable domain
# (e.g. app.elcoral.com and api.elcoral.com under one eTLD+1). Cookies
# scoped to a shared parent domain (Domain=.elcoral.com) are same-site
# for BOTH of those hosts — SameSite is computed on the registrable
# domain (eTLD+1), not the exact host — so this is not a Safari/ITP
# workaround, it genuinely stops being a third-party cookie. This is
# already wired up and off by default: see settings.cookie_domain in
# app/core/config.py and DEPLOY.md section 6 for the exact steps. One
# residual caveat worth knowing: there are scattered developer reports
# of Safari's ITP still misbehaving on some cross-subdomain cookie
# setups even when they are spec-same-site, so treat this as "fixes the
# documented, spec-defined third-party case" rather than "eliminates
# every historical Safari quirk" — the frontend fallback UI below is
# what keeps a residual failure non-broken (a clear "unavailable, retry"
# state instead of a silently broken image) if that ever surfaces.


def issue_media_session(user_id) -> str:
    expires_at = int(time.time()) + MEDIA_SESSION_TTL_SECONDS
    payload = f"{user_id}.{expires_at}"
    mac = hmac.new(
        settings.jwt_secret_key.encode(), f"media-session:{payload}".encode(), hashlib.sha256
    ).digest()
    return f"{payload}.{base64.urlsafe_b64encode(mac).decode().rstrip('=')}"


def read_media_session(value: str | None) -> str | None:
    """Return the user id this cookie proves, or None if absent/forged/expired."""
    if not value:
        return None
    try:
        user_id, expires_raw, signature = value.rsplit(".", 2)
        expires_at = int(expires_raw)
    except (ValueError, AttributeError):
        return None
    if expires_at + CLOCK_SKEW_SECONDS < int(time.time()):
        return None
    expected = hmac.new(
        settings.jwt_secret_key.encode(),
        f"media-session:{user_id}.{expires_at}".encode(),
        hashlib.sha256,
    ).digest()
    expected_b64 = base64.urlsafe_b64encode(expected).decode().rstrip("=")
    if not hmac.compare_digest(expected_b64, signature):
        return None
    return user_id
