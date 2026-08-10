from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14
    cors_origins: str = "http://localhost:5173"
    environment: str = "development"

    # ----------------------------------------------------------------- admin
    # The management app (see management/) is a THIRD deployment, hosted
    # separately from the frontend and this API, and talks to this same
    # backend at /api/admin. Its origin therefore has to be allowed
    # explicitly — it is kept in its own variable rather than being
    # appended to CORS_ORIGINS so the admin origin can be changed,
    # audited, or removed without touching the public site's config.
    admin_cors_origins: str = "http://localhost:5174"

    # The management app's public URL (no trailing slash). Used for links
    # in admin-facing emails/logs.
    admin_url: str = ""

    # Admin sessions are short by design: the panel can delete accounts.
    admin_access_token_expire_minutes: int = 60

    # First-run bootstrap. Set to the email of an EXISTING account (sign
    # up normally on the frontend first) and that account is granted the
    # superadmin role on the next backend start, which is how the very
    # first admin comes into existence without an SQL console. Once the
    # first superadmin exists, unset it — leaving it set is harmless
    # (grant is idempotent) but it's one fewer thing that can be abused
    # if the env leaks.
    bootstrap_superadmin_email: str = ""

    # Telegram storage (MTProto via Telethon) — used for profile photos and
    # post media. See app/core/telegram_storage.py.
    telegram_api_id: int = 0
    telegram_api_hash: str = ""
    telegram_session: str = ""
    telegram_channel_id: int = 0

    # The backend's current public URL (the Cloudflare tunnel URL for now).
    # Used to build absolute media URLs in API responses. Update this env
    # var whenever the tunnel URL changes on restart — check GET /api/health
    # for the current one. Safe to leave blank; media URLs just fall back
    # to relative paths, which still work fine same-origin.
    public_api_url: str = ""

    # The frontend's public URL (Render), e.g. https://elcoral.onrender.com
    # with no trailing slash. Used to build user-facing links that should
    # open in the app's UI rather than hit the API directly — e.g. the
    # email verification link points here (/verify-email?...), and the
    # frontend page calls the actual API endpoint and shows a real screen
    # instead of the person landing on raw JSON.
    frontend_url: str = ""

    # Token for the cloudflared tunnel container/sidecar. Not read by the
    # FastAPI app itself — cloudflared reads it directly from its own
    # process env — but declared here so it doesn't crash Settings() if it
    # ends up in the same .env file.
    cloudflare_tunnel_token: str = ""

    # Email verification (see app/core/email.py). Uses Gmail SMTP by
    # default (smtp.gmail.com:587 + an App Password, not your normal Gmail
    # password — generate one at myaccount.google.com/apppasswords).
    # Left unset, the app runs in "SMTP not configured" mode: no email is
    # ever sent, and new users are auto-verified on signup instead of
    # being blocked waiting for a link that will never arrive. This keeps
    # local/dev/testing (e.g. the curl workflow from Termux) frictionless.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "Elcoral"

    # extra="ignore": any other env var present in the environment or .env
    # file that isn't declared above is silently ignored instead of
    # crashing startup. Without this, adding ANY new env var (for a new
    # feature, a sidecar, a platform-injected variable, etc.) requires a
    # matching field here first, which is what caused this exact
    # cloudflare_tunnel_token failure.
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        """Public site + management app. Never a wildcard: the API is
        called with credentials, which browsers refuse against "*"."""
        raw = f"{self.cors_origins},{self.admin_cors_origins}"
        seen: list[str] = []
        for origin in (o.strip() for o in raw.split(",")):
            if origin and origin not in seen:
                seen.append(origin)
        return seen

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def telegram_configured(self) -> bool:
        return bool(self.telegram_api_id and self.telegram_api_hash and self.telegram_session)

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_username and self.smtp_password and self.smtp_from_email)


settings = Settings()
