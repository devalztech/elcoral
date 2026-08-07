# Elcoral backend — FastAPI
# Built for use as a Pterodactyl egg Docker image (custom egg pointing at this image),
# or standalone `docker build` / `docker run`.

FROM python:3.12-slim

WORKDIR /home/container

# System deps for psycopg2 / asyncpg builds
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x docker-entrypoint.sh

# Pterodactyl runs containers as a non-root "container" user (UID 999) by convention
RUN useradd -u 999 -m container && chown -R container:container /home/container
USER container

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Runs `alembic upgrade head` before handing off to CMD, so the schema is
# never stale regardless of which startup path is used. Safe to keep even
# though Pterodactyl's Startup Command (python app/main.py) bypasses the
# Docker ENTRYPOINT/CMD entirely and runs its own equivalent migration
# step in-process — this only matters if that Startup Command ever
# changes back to running the image's CMD directly.
ENTRYPOINT ["./docker-entrypoint.sh"]

# Pterodactyl eggs typically override this via the Startup Command variable,
# but this is the sane default for `docker run` / local testing.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
