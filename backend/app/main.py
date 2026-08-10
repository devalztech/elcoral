import os
import sys

# HidenCloud's fixed startup command runs this file directly as
# `python /home/container/app/main.py`, which puts app/ (not the repo
# root) on sys.path. That breaks the `from app...` absolute imports
# below. This inserts the parent dir (repo root) onto sys.path so the
# `app` package resolves no matter how this file is invoked.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.core import telegram_storage
from app.routers import (
    admin,
    auth,
    communities,
    community_ws,
    lookup,
    media,
    messages,
    messages_ws,
    onboarding,
    posts,
    profile,
    settings as settings_router,
    social,
)

app = FastAPI(title="Elcoral API", version="0.1.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

if settings.is_production:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["elcoral.com", "*.elcoral.com"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(onboarding.router)
app.include_router(profile.router)
app.include_router(posts.router)
app.include_router(media.router)
app.include_router(lookup.router)
app.include_router(settings_router.router)
app.include_router(social.router)
app.include_router(messages.router)
app.include_router(messages_ws.router)
app.include_router(communities.router)
app.include_router(community_ws.router)


@app.on_event("startup")
async def bootstrap_superadmin():
    """
    Grants the superadmin role to BOOTSTRAP_SUPERADMIN_EMAIL if that
    account exists and doesn't have it yet. This is the only way a role
    is ever created outside the admin API, and it's deliberately
    env-gated, idempotent, and a no-op when the variable is blank.
    """
    email = settings.bootstrap_superadmin_email.strip().lower()
    if not email:
        return

    import logging

    from sqlalchemy import func, select

    from app.core.database import AsyncSessionLocal
    from app.models.admin import AppRole, UserRole
    from app.models.user import User

    log = logging.getLogger("uvicorn.error")
    try:
        async with AsyncSessionLocal() as db:
            user = await db.scalar(select(User).where(func.lower(User.email) == email))
            if user is None:
                log.warning(
                    "BOOTSTRAP_SUPERADMIN_EMAIL=%s has no account yet — sign up first, "
                    "then restart the backend to grant it.",
                    email,
                )
                return
            existing = await db.scalar(
                select(UserRole).where(
                    UserRole.user_id == user.id, UserRole.role == AppRole.superadmin.value
                )
            )
            if existing is None:
                db.add(UserRole(user_id=user.id, role=AppRole.superadmin.value))
                await db.commit()
                log.info("Granted superadmin to %s", email)
    except Exception:  # noqa: BLE001
        # Never let bootstrap failure stop the API from serving traffic.
        log.exception("superadmin bootstrap failed")


@app.on_event("startup")
async def start_telegram_storage():
    # Background task, not awaited — a slow/failed Telegram connect must
    # never delay uvicorn binding the port (same lesson learned earlier
    # with the DB migration step and HidenCloud's startup watchdog).
    import asyncio

    asyncio.create_task(telegram_storage.start())


@app.on_event("shutdown")
async def stop_telegram_storage():
    await telegram_storage.stop()


def _tunnel_url_file():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(repo_root, ".bin", "tunnel_url.txt")


@app.get("/api/health")
async def health():
    tunnel_url = None
    try:
        with open(_tunnel_url_file()) as f:
            tunnel_url = f.read().strip() or None
    except FileNotFoundError:
        pass
    return {"status": "ok", "tunnel_url": tunnel_url}


def _start_cloudflare_tunnel(port: int):
    """
    Runs a Cloudflare named tunnel using a permanent Tunnel Token, giving a
    STABLE public hostname (set once in the Cloudflare dashboard under
    Public Hostname) that survives every container restart — unlike the
    old Quick Tunnel approach (--url flag, no token) which got a random
    new *.trycloudflare.com URL every single boot.

    Requires the CLOUDFLARE_TUNNEL_TOKEN env var, generated once in
    Cloudflare Zero Trust -> Networks -> Tunnels -> Create a tunnel.
    Falls back to the old random Quick Tunnel if the token isn't set, so
    this doesn't break anything for anyone who hasn't set it up yet.
    """
    import logging
    import platform
    import stat
    import subprocess
    import threading
    import time
    import urllib.request

    logger = logging.getLogger("uvicorn.error")

    bin_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".bin")
    os.makedirs(bin_dir, exist_ok=True)
    cloudflared_path = os.path.join(bin_dir, "cloudflared")
    url_file = _tunnel_url_file()

    if not os.path.exists(cloudflared_path):
        machine = platform.machine().lower()
        arch = "arm64" if machine in ("aarch64", "arm64") else "amd64"
        url = f"https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-{arch}"
        logger.info(f"Downloading cloudflared ({arch})...")
        try:
            urllib.request.urlretrieve(url, cloudflared_path)
            st = os.stat(cloudflared_path)
            os.chmod(cloudflared_path, st.st_mode | stat.S_IEXEC)
        except Exception:
            logger.exception("Failed to download cloudflared — public tunnel will not start")
            return

    # Read via `settings` (populated from .env by pydantic-settings) rather
    # than os.environ directly — os.environ only sees real OS/panel env
    # vars, not values that live only in a .env file. Using `settings` here
    # means this works whether the token was set as a HidenCloud panel
    # variable OR just written into .env, instead of silently falling back
    # only in the .env case.
    token = settings.cloudflare_tunnel_token.strip()

    if token:
        cmd = [cloudflared_path, "tunnel", "--no-autoupdate", "run", "--token", token]
        stable_url = settings.public_api_url.strip()
        if stable_url:
            try:
                with open(url_file, "w") as f:
                    f.write(stable_url)
            except Exception:
                logger.exception("Failed to write tunnel_url.txt")
        logger.info("Starting named Cloudflare tunnel (stable hostname)...")
    else:
        cmd = [cloudflared_path, "tunnel", "--url", f"http://localhost:{port}"]
        logger.warning(
            "CLOUDFLARE_TUNNEL_TOKEN not set — falling back to a random Quick "
            "Tunnel URL that changes every restart. Set CLOUDFLARE_TUNNEL_TOKEN "
            "and PUBLIC_API_URL for a permanent URL."
        )

    def _run_forever():
        while True:
            try:
                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                )
                for line in proc.stdout:
                    line = line.strip()
                    if "trycloudflare.com" in line:
                        logger.info(f"Public tunnel URL: {line}")
                        for token_word in line.split():
                            if "trycloudflare.com" in token_word:
                                try:
                                    with open(url_file, "w") as f:
                                        f.write(token_word)
                                except Exception:
                                    logger.exception("Failed to write tunnel_url.txt")
                                break
                    else:
                        logger.info(f"[cloudflared] {line}")
                proc.wait()
                logger.warning("cloudflared exited — restarting tunnel in 5s")
            except Exception:
                logger.exception("cloudflared process failed — retrying in 5s")
            time.sleep(5)

    threading.Thread(target=_run_forever, daemon=True).start()


def _run_migrations():
    """
    Runs `alembic upgrade head` before the app serves traffic, so the DB
    schema is never out of sync with the models. Unlike Telegram storage,
    this must be synchronous — serving requests against a stale schema is
    worse than a slightly slower boot.

    To stay compatible with Pterodactyl's startup watchdog (which expects
    the port to bind quickly), this is bounded to a hard timeout via a
    subprocess call rather than importing alembic's Python API in-process.
    If migrations fail or time out, the process exits non-zero instead of
    starting the app half-migrated — Pterodactyl will show the failure in
    the console and the crash loop makes the problem impossible to miss,
    rather than silently serving against the wrong schema.

    Set SKIP_MIGRATIONS=1 as an escape hatch (e.g. to boot once and
    manually inspect state) without touching this code.
    """
    if os.environ.get("SKIP_MIGRATIONS") == "1":
        print("[migrations] SKIP_MIGRATIONS=1 set — skipping alembic upgrade head")
        return

    import subprocess

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print("[migrations] running alembic upgrade head...")
    try:
        # `python -m alembic` instead of the bare `alembic` command: on
        # this panel, packages install to ~/.local (see the "pip install
        # --prefix .local" step in the startup log), which puts the
        # `alembic` console script in ~/.local/bin — a directory that
        # isn't on PATH here even though the package imports fine. Using
        # `sys.executable -m alembic` runs it as a module through the
        # same Python/sys.path that's already resolving `import alembic`
        # successfully in alembic/env.py, so it can't hit this again
        # regardless of where pip decided to put the console script.
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=repo_root,
            timeout=60,
            capture_output=True,
            text=True,
        )
    except subprocess.TimeoutExpired:
        print("[migrations] timed out after 60s — refusing to start app against unknown schema state")
        sys.exit(1)
    except FileNotFoundError:
        print("[migrations] alembic module not found — is it installed? refusing to start")
        sys.exit(1)

    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr)
        print("[migrations] alembic upgrade head failed — refusing to start app")
        sys.exit(1)

    print("[migrations] up to date")


if __name__ == "__main__":
    # HidenCloud's fixed startup command runs `python app/main.py` directly
    # instead of `uvicorn app.main:app`, so this boots the server manually
    # to match what the Dockerfile's CMD would otherwise do.
    import uvicorn

    _run_migrations()

    port = int(os.environ.get("PORT", 8000))
    _start_cloudflare_tunnel(port)
    uvicorn.run(app, host="0.0.0.0", port=port)
