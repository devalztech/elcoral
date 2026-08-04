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

# Pterodactyl runs containers as a non-root "container" user (UID 999) by convention
RUN useradd -u 999 -m container && chown -R container:container /home/container
USER container

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Pterodactyl eggs typically override this via the Startup Command variable,
# but this is the sane default for `docker run` / local testing.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
