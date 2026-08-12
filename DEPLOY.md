# Deploying Elcoral

Backend (FastAPI) deploys on **Pterodactyl**. Frontend (React) deploys on
**Render**. Database is **Neon** (already set up). These are three separate
services talking over HTTPS — nothing shares a host.

## 1. Database (Neon)

Already have this. Just run migrations once, from any machine that can reach
it, before either app goes live:
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# paste your Neon connection string into DATABASE_URL
# generate a secret: python -c "import secrets; print(secrets.token_urlsafe(64))"
alembic revision --autogenerate -m "initial users table"
alembic upgrade head
```

## 2. Backend (FastAPI) — Pterodactyl

Pterodactyl runs each app in its own container via an **egg** (Docker image +
startup command).

**Option A — custom Docker image egg (recommended)**
1. Build and push `backend/Dockerfile`:
   ```bash
   cd backend
   docker build -t yourregistry/elcoral-backend:latest .
   docker push yourregistry/elcoral-backend:latest
   ```
2. In the Pterodactyl admin panel, create a custom egg (or use the "Generic
   Docker Image" egg) pointing at that image.
3. Startup command:
   ```
   uvicorn app.main:app --host 0.0.0.0 --port {{SERVER_PORT}}
   ```
4. Environment variables (Startup tab): `DATABASE_URL` (Neon string),
   `JWT_SECRET_KEY`, `CORS_ORIGINS` (set to your Render frontend URL, e.g.
   `https://elcoral.onrender.com` — no wildcards), `ENVIRONMENT=production`.

**Option B — generic Python egg + Git deploy**
Use a community Python egg, point its Git Repo variable at this repo with
`backend` as the working directory, same startup command and env vars as
above. Slower to iterate with than a prebuilt image but skips maintaining a
registry.

## 3. Frontend (React) — Render

Render builds straight from Git, no Docker image needed for a static site.

1. Push this repo to GitHub/GitLab (if not already).
2. In Render: **New → Static Site**, connect the repo.
3. Settings:
   - **Root directory:** leave blank (repo root, since the workspace needs the root `package.json`)
   - **Build command:** `npm install && npm run build --workspace=frontend`
   - **Publish directory:** `frontend/dist`
4. Add an environment variable if/when the frontend needs to know the
   backend's URL at build time (see step 4 below) — Render calls these
   "Environment Variables" under the service's Settings tab.
5. Render gives you a URL like `https://elcoral.onrender.com` (or attach a
   custom domain under Settings → Custom Domains).

Render auto-deploys on every push to the connected branch, so once this is
wired up, `git push` is the whole deploy step for frontend changes.

## 4. Wiring frontend → backend

In dev, the frontend calls `/api/...` as a relative path — that works
locally because Vite's dev server proxies `/api` to `localhost:8000`. In
production, Render and Pterodactyl are different hosts, so the frontend
needs the backend's real URL: it reads this from `VITE_API_URL` (see
`frontend/.env.example`).

**In Render**, add an environment variable:
```
VITE_API_URL=https://your-pterodactyl-backend-url.example.com
```
(no trailing slash). Vite bakes env vars starting with `VITE_` into the
build at build time, so this must be set **before** Render runs the build
command — it won't take effect on an already-built deploy.

## 5. CORS + cookies

- Backend's `CORS_ORIGINS` must be set to the exact Render URL (or custom
  domain), not a wildcard — `allow_credentials=True` in the CORS middleware
  requires an explicit origin.
- The refresh-token cookie is `secure` + `samesite=strict` in production, so
  both Render and Pterodactyl need to serve over HTTPS for login/signup to
  work end-to-end. Render gives you HTTPS by default; make sure the
  Pterodactyl backend sits behind a reverse proxy or Pterodactyl's own SSL
  termination.

## Local testing before deploying anything

```bash
docker compose up --build
```
Spins up Postgres + backend + frontend together so you can sanity-check the
built Docker images locally first. (This local compose setup builds the
frontend as a Docker image for convenience — Render itself doesn't use
Docker for a static site, it just runs the build command directly.)

## 6. Optional: same-registrable-domain deployment (fixes Safari/Firefox private-media loading)

The setup above (steps 1–5) is fully cross-origin: Render and Pterodactyl
are different domains. That works, but private media (DM attachments,
community chat media — served through `<img>`/`<video>`/`<audio>` and
authenticated via the `media_session` cookie) can silently fail to load on
Safari and Firefox, which block third-party `SameSite=None` cookies by
default. Public post/profile media is unaffected either way (no cookie
involved). See `app/core/media_url.py` for the full technical explanation.

The fix is deployment topology, not code — the backend already supports it
via config:

1. Put the frontend and this API under the **same registrable domain** as
   sibling subdomains — e.g. `app.elcoral.com` for the Render frontend
   (Render → Settings → Custom Domains) and `api.elcoral.com` for this API.
   The API side already has everything needed for a stable subdomain: set
   up a named Cloudflare Tunnel (Zero Trust → Networks → Tunnels), point
   its Public Hostname at `api.elcoral.com`, and set `CLOUDFLARE_TUNNEL_TOKEN`
   + `PUBLIC_API_URL=https://api.elcoral.com` in the backend's env — this
   replaces the random Quick Tunnel URL with a permanent one either way,
   same-site or not.
2. Set these backend env vars (blank by default — nothing changes until
   set, see `.env.example`):
   ```
   COOKIE_DOMAIN=.elcoral.com
   TRUSTED_HOSTS=elcoral.com,*.elcoral.com
   CORS_ORIGINS=https://app.elcoral.com
   ```
3. Set `VITE_API_URL=https://api.elcoral.com` in Render (same as step 4
   above, just now a sibling subdomain instead of an unrelated domain).

Nothing else changes: `SameSite=None` and `Secure` stay as they are on
every cookie (there's no reason to weaken them — see the code comments in
`app/routers/auth.py`/`app/core/csrf.py`), and the CSRF double-submit and
audience-bound media authorization are both unaffected by this migration.
