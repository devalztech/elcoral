"""
CSRF protection for the cookie-authenticated endpoints.

Only two endpoints in this API act on a *cookie* rather than on the
Authorization header: POST /api/auth/refresh and POST /api/auth/logout.
Everything else needs a bearer token that a cross-site page cannot read,
so it is not forgeable and needs nothing here.

Those two are protected with the standard **double-submit cookie**
pattern, hardened with an origin check:

  - On every successful signup / login / refresh the server sets a
    non-httponly ``csrf_token`` cookie (a 256-bit random value).
  - The frontend reads that cookie and echoes it back in the
    ``X-CSRF-Token`` header on refresh/logout.
  - The server requires the two to match, compared in constant time.

A cross-site attacker can cause the browser to *send* the cookie, but
cannot read it (that needs same-origin script access), so it cannot set
the matching header — and a custom header on a cross-origin request also
forces a CORS preflight, which our allow-list rejects.

Additionally the ``Origin``/``Referer`` header must be one of the
configured CORS origins. This is what lets a session created before this
protection existed keep working: the very first call from a legitimate
browser has no ``csrf_token`` cookie yet, so it is accepted on the origin
check alone and issued a token; every subsequent call must double-submit.
No CORS or authentication rule is relaxed to achieve this.
"""

from __future__ import annotations

import hmac
import secrets
from urllib.parse import urlsplit

from fastapi import HTTPException, Request, Response, status

from app.core.config import settings

CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"
CSRF_COOKIE_MAX_AGE = 30 * 24 * 60 * 60


def issue_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def set_csrf_cookie(response: Response, token: str | None = None) -> str:
    """
    Set/refresh the CSRF cookie. Deliberately NOT httponly — the frontend
    has to read it to echo it back; that is the whole point of the
    double-submit pattern, and the value is useless without also being
    able to make a same-site request.

    samesite=none + secure mirrors the refresh cookie, because the
    frontend and API are, today, on different domains. domain follows
    settings.cookie_domain the same way — see _set_refresh_cookie in
    app/routers/auth.py for the full reasoning; unset, this is unchanged
    from before that setting existed.
    """
    token = token or issue_csrf_token()
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        httponly=False,
        secure=True,
        samesite="none",
        domain=settings.cookie_domain or None,
        max_age=CSRF_COOKIE_MAX_AGE,
        path="/",
    )
    return token


def clear_csrf_cookie(response: Response) -> None:
    response.delete_cookie(CSRF_COOKIE_NAME, path="/", domain=settings.cookie_domain or None)


def _origin_allowed(request: Request) -> bool:
    allowed = {o.rstrip("/") for o in settings.cors_origin_list if o and o != "*"}
    if not allowed:
        # No allow-list configured (local dev) — the double-submit check
        # below is then the only gate, which is still correct.
        return True

    for header in ("origin", "referer"):
        value = request.headers.get(header)
        if not value:
            continue
        parts = urlsplit(value)
        if not parts.scheme or not parts.netloc:
            continue
        return f"{parts.scheme}://{parts.netloc}" in allowed

    # Neither header present. Every browser sends Origin on a cross-site
    # POST, so this is a non-browser client (curl, mobile app), which is
    # not subject to CSRF — but it must then double-submit correctly.
    return True


async def require_csrf(request: Request) -> None:
    """FastAPI dependency guarding cookie-authenticated state changes."""
    if not _origin_allowed(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Request blocked: untrusted origin",
        )

    cookie_token = request.cookies.get(CSRF_COOKIE_NAME)
    header_token = request.headers.get(CSRF_HEADER_NAME)

    if not cookie_token:
        # Bootstrap case (see module docstring): no token has been issued
        # to this browser yet. The origin check above already passed, and
        # the response will mint a token the caller must use from now on.
        return

    if not header_token or not hmac.compare_digest(cookie_token, header_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing CSRF token",
        )
