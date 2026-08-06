"""
Password hashing and JWT handling.

- Passwords: argon2 (via passlib) — memory-hard, current OWASP recommendation,
  stronger against GPU cracking than bcrypt for new projects.
- Tokens: short-lived access token (JWT) + longer-lived refresh token.
  Access tokens are never stored server-side; refresh tokens are stored hashed
  so a leaked database dump can't be replayed directly.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, extra_claims: dict | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "type": "access", "exp": expire}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str) -> tuple[str, str]:
    """Returns (raw_token_for_client, hashed_token_for_db)."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    jti = secrets.token_urlsafe(32)
    payload = {"sub": subject, "type": "refresh", "jti": jti, "exp": expire}
    raw = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    hashed = pwd_context.hash(raw)
    return raw, hashed


def create_verification_token() -> tuple[str, str]:
    """
    Returns (raw_token_for_email_link, hashed_token_for_db). Deliberately a
    plain random token, not a JWT — there's no payload worth encoding, and
    the DB row (EmailVerificationToken) already tracks which user and
    when it expires, so a JWT's self-contained claims would be redundant.
    """
    raw = secrets.token_urlsafe(32)
    hashed = pwd_context.hash(raw)
    return raw, hashed


def verify_verification_token(raw_token: str, hashed_token: str) -> bool:
    return pwd_context.verify(raw_token, hashed_token)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)
