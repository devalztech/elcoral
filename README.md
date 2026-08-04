# Elcoral

A freelance marketplace — clients hire people for remote, digital-skill work, and chat with them directly. This first milestone is the **landing page** plus the **auth foundation** it'll plug into later (signup, mobile app, job posting, etc.).

## Stack

- **Frontend:** React (Vite) + React Router
- **Backend:** FastAPI (async), JWT auth, Argon2 password hashing
- **Database:** PostgreSQL (built for Neon serverless Postgres, works with any Postgres)
- **Hosting:** Pterodactyl panel (see `DEPLOY.md`)

## Project structure

Monorepo — one repo, two deployable apps, sharing root-level tooling:

```
elcoral/
  package.json          root — npm workspace + convenience scripts
  docker-compose.yml     local dev: postgres + backend + frontend together
  DEPLOY.md              Pterodactyl deployment steps
  frontend/              React landing page
    Dockerfile
    src/
      pages/Landing.jsx
      components/ActivityFeed.jsx
  backend/               FastAPI auth API
    Dockerfile
    app/
      main.py            app entrypoint + security middleware
      core/               config, db, security, rate limiting
      models/             SQLAlchemy models (User, RefreshToken)
      schemas/            Pydantic request/response shapes
      routers/auth.py     /api/auth/signup, login, refresh, logout
```

Frontend dependencies are managed via npm workspaces from the root; the backend keeps its own Python virtual environment (Python doesn't share npm's workspace model).

## Running the frontend

From the repo root:
```bash
npm install
npm run dev:frontend
```
Or directly:
```bash
cd frontend
npm install
npm run dev
```
Opens at `http://localhost:5173`.

## Running the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edit .env: set DATABASE_URL to your Neon/Postgres connection string,
# and generate a JWT_SECRET_KEY with:
python -c "import secrets; print(secrets.token_urlsafe(64))"

# create the database tables
alembic revision --autogenerate -m "initial users table"
alembic upgrade head

uvicorn app.main:app --reload
```
API runs at `http://localhost:8000`. Health check: `GET /api/health`.

The Vite dev server proxies `/api/*` to `localhost:8000` (see `frontend/vite.config.js`), so the two run side by side in local dev without a CORS dance.

## Running everything together (Docker)

```bash
docker compose up --build
```
Spins up Postgres, the backend, and the frontend together — useful for testing the production-style Docker images locally before deploying to Pterodactyl.

## What's implemented on the security side

- **Argon2** password hashing (memory-hard, current OWASP pick over bcrypt)
- **JWT access tokens** (short-lived, 30 min default) + **refresh tokens** (14 days, stored hashed in the DB, delivered via `httponly` + `secure` + `samesite=strict` cookie so JS can never read them and they don't ride along on cross-site requests)
- **Account lockout** after 5 failed logins (15 min cooldown)
- **Generic error messages** on login/signup so responses can't be used to enumerate which emails are registered
- **Rate limiting** on auth endpoints (`slowapi`): 5 signups/hour, 10 logins/minute per IP
- **Security headers** on every response: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production
- **CORS locked to explicit origins** (set via `.env`, not wildcard)
- Password policy enforced server-side: 10+ characters, upper + lower + digit

## Deploying

See `DEPLOY.md` for the Pterodactyl-specific steps — each app deploys as its own Pterodactyl server (egg), built from the `Dockerfile` in its folder.

## Not built yet (next milestones, one at a time)

- Signup/login pages in the frontend (backend endpoints are ready to be called)
- Job posting, proposals, and the chat system
- Escrow/payment integration
- Mobile app

## Theme

Lemon green (`#C4F135`) on near-black (`#0B0D0A`), set up as CSS variables in `frontend/src/index.css` — change the palette from one place if it needs to shift later.
