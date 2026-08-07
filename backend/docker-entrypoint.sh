#!/bin/sh
# Shared entrypoint for both startup paths:
#   - Pterodactyl panel's fixed command: python app/main.py (migrations
#     already handled in-process there via _run_migrations(), see main.py)
#   - The Dockerfile's own CMD (uvicorn app.main:app ...), which never
#     passes through __main__ in main.py and would otherwise skip
#     migrations entirely.
#
# This script exists so both paths are covered without duplicating the
# migration logic. If the panel's Startup Command is ever changed away
# from `python app/main.py` to something that runs this image's CMD
# directly, migrations still run first.
set -e

if [ "$SKIP_MIGRATIONS" = "1" ]; then
    echo "[entrypoint] SKIP_MIGRATIONS=1 set — skipping alembic upgrade head"
else
    echo "[entrypoint] running alembic upgrade head..."
    # python -m alembic, not the bare `alembic` command — see the
    # matching comment in app/main.py's _run_migrations() for why the
    # console script isn't reliably on PATH in this environment.
    python -m alembic upgrade head
    echo "[entrypoint] up to date"
fi

exec "$@"
