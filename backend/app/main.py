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
from app.routers import auth, lookup, media, onboarding, posts, profile

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
app.include_router(onboarding.router)
app.include_router(profile.router)
app.include_router(posts.router)
app.include_router(media.router)
app.include_router(lookup.router)


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


if __name__ == "__main__":
    # HidenCloud's fixed startup command runs `python app/main.py` directly
    # instead of `uvicorn app.main:app`, so this boots the server manually
    # to match what the Dockerfile's CMD would otherwise do.
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    _start_cloudflare_tunnel(port)
    uvicorn.run(app, host="0.0.0.0", port=port)
