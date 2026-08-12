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

    # ------------------------------------------------------- cookie domain
    # Leave unset for the CURRENT cross-origin deployment (Render +
    # Pterodactyl-via-tunnel, different registrable domains) — cookies then
    # default to "this exact host only", which is what every cookie in this
    # app already does today. Nothing changes until this is set.
    #
    # Set this to a shared parent domain (e.g. ".elcoral.com") ONLY once
    # the frontend and this API are deployed as sibling subdomains of the
    # SAME registrable domain (e.g. frontend on app.elcoral.com, this API
    # reachable at api.elcoral.com via the existing named Cloudflare
    # tunnel — see main.py's _start_cloudflare_tunnel and
    # PUBLIC_API_URL above). That is a same-site relationship per the
    # cookie spec (SameSite is computed on the registrable domain, not the
    # exact host), which is what actually fixes Safari/Firefox blocking
    # media_session and other cookies as third-party — see the
    # "Browser/PWA compatibility" note in app/core/media_url.py for the
    # full reasoning and the residual Safari caveat.
    #
    # The leading dot is conventional (RFC 6265 treats a leading dot as
    # equivalent to none — it's included for clarity/older clients) and
    # covers api.<domain> and app.<domain> alike; do not set this to a
    # bare eTLD (e.g. ".com") — browsers refuse public-suffix cookie
    # domains outright.
    cookie_domain: str = ""

    # Comma-separated hostnames TrustedHostMiddleware accepts in
    # production (see main.py). Kept in settings rather than hardcoded so
    # it can never drift from CORS_ORIGINS/cookie_domain without a config
    # change being visible in one place. Include both the frontend and API
    # hosts once they're deployed under the same registrable domain, e.g.
    # "elcoral.com,*.elcoral.com". Left blank, this falls back to a value
    # derived from cookie_domain (below) once that's set, and otherwise to
    # the historical hardcoded default — see trusted_hosts_list.
    trusted_hosts: str = ""

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
    def trusted_hosts_list(self) -> list[str]:
        """
        Hosts TrustedHostMiddleware accepts in production (see main.py).

        Priority: TRUSTED_HOSTS if set (explicit, always wins) > a value
        derived from COOKIE_DOMAIN (once same-site deployment is
        configured, the trusted hosts are exactly "that domain and its
        subdomains") > the historical hardcoded default ("elcoral.com",
        "*.elcoral.com"), so leaving both unset keeps today's production
        behavior byte-for-byte instead of silently loosening to "*".
        """
        if self.trusted_hosts.strip():
            return [h.strip() for h in self.trusted_hosts.split(",") if h.strip()]
        if self.cookie_domain.strip():
            bare = self.cookie_domain.strip().lstrip(".")
            return [bare, f"*.{bare}"]
        return ["elcoral.com", "*.elcoral.com"]

    @property
    def telegram_configured(self) -> bool:
        return bool(self.telegram_api_id and self.telegram_api_hash and self.telegram_session)

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_username and self.smtp_password and self.smtp_from_email)


settings = Settings()
