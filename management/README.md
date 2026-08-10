# Elcoral Management

Admin console for Elcoral. Hosted separately from the API and the member
frontend; talks to the same backend at `/api/admin`, so admin and member
views can never disagree about state.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5174  (proxies /api to :8000)
```

## Deploy

Static build (`npm run build` -> `dist/`), or the included Dockerfile.
Set `VITE_API_URL` to the backend's public URL at build time.

Then, on the backend, add this app's origin to `ADMIN_CORS_ORIGINS`.

## Getting the first admin

1. Sign up normally on the member frontend.
2. Set `BOOTSTRAP_SUPERADMIN_EMAIL` to that email on the backend, restart.
   That account is granted `superadmin`.
3. Sign in here and grant roles to everyone else from Users -> a user -> Roles.
4. Unset `BOOTSTRAP_SUPERADMIN_EMAIL`.

## What admins can do

- See, search and filter every account
- Create accounts (optionally pre-confirmed and/or pre-badged)
- Suspend/restore, and permanently delete accounts
- Grant and strip the verification badge — **a confirmed email never grants
  a badge; only an admin does**
- Superadmins only: grant/revoke roles (`user`, `moderator`, `admin`,
  `superadmin`), stored in their own `user_roles` table
- Read the audit log of every admin action
