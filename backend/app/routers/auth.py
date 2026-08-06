from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import email as email_service
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_verification_token,
    decode_token,
    hash_password,
    verify_password,
    verify_verification_token,
)
from app.models.user import EmailVerificationToken, PasswordResetToken, RefreshToken, User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
VERIFICATION_TOKEN_HOURS = 24
PASSWORD_RESET_TOKEN_HOURS = 1


def _set_refresh_cookie(response: Response, raw_refresh_token: str) -> None:
    # httponly + samesite=none: the frontend (Render) and backend (this API)
    # live on different domains, so samesite=strict/lax would silently stop
    # the browser from ever sending this cookie back — curl/Postman don't
    # enforce SameSite at all, which is why this worked in curl but not in
    # the actual browser. samesite=none requires secure=True (HTTPS only,
    # which we have), and the cookie is still httponly so JS can never read
    # it either way.
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path="/api/auth",
    )


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def signup(request: Request, response: Response, body: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing:
        # Same message as any other validation failure — don't confirm which
        # emails are already registered (account enumeration).
        raise HTTPException(status_code=400, detail="Could not create account with those details")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(subject=str(user.id))
    raw_refresh, hashed_refresh = create_refresh_token(subject=str(user.id))
    db.add(
        RefreshToken(
            user_id=user.id,
            hashed_token=hashed_refresh,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
        )
    )

    if settings.smtp_configured:
        raw_verify_token, hashed_verify_token = create_verification_token()
        verify_row = EmailVerificationToken(
            user_id=user.id,
            hashed_token=hashed_verify_token,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=VERIFICATION_TOKEN_HOURS),
        )
        db.add(verify_row)
        await db.flush()  # populate verify_row.id before we build the URL

        verify_url = (
            f"{settings.frontend_url}/verify-email"
            f"?token_id={verify_row.id}&token={raw_verify_token}"
        )
        await email_service.send_verification_email(user.email, user.full_name, verify_url)
    else:
        # No SMTP configured — there's no way to deliver a verification
        # link, so don't leave the user permanently unverified waiting for
        # an email that will never arrive. Auto-verify instead.
        user.is_verified = True

    await db.commit()

    _set_refresh_cookie(response, raw_refresh)
    return TokenResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.get("/verify")
@limiter.limit("20/minute")
async def verify_email(
    request: Request,
    token_id: str,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    verify_row = await db.get(EmailVerificationToken, token_id)

    invalid = HTTPException(status_code=400, detail="Invalid or expired verification link")

    if verify_row is None or verify_row.used:
        raise invalid
    if verify_row.expires_at < datetime.now(timezone.utc):
        raise invalid
    if not verify_verification_token(token, verify_row.hashed_token):
        raise invalid

    user = await db.get(User, verify_row.user_id)
    if user is None:
        raise invalid

    user.is_verified = True
    verify_row.used = True
    await db.commit()

    return {"detail": "Email verified successfully"}


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/hour")
async def resend_verification(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.is_verified:
        return None  # nothing to do, avoid leaking state either way via an error

    if not settings.smtp_configured:
        # Nothing to resend — signup already auto-verified in this mode.
        return None

    raw_verify_token, hashed_verify_token = create_verification_token()
    verify_row = EmailVerificationToken(
        user_id=user.id,
        hashed_token=hashed_verify_token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=VERIFICATION_TOKEN_HOURS),
    )
    db.add(verify_row)
    await db.flush()

    verify_url = f"{settings.frontend_url}/verify-email?token_id={verify_row.id}&token={raw_verify_token}"
    await email_service.send_verification_email(user.email, user.full_name, verify_url)
    await db.commit()
    return None


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/hour")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Always returns 204 whether or not the email exists — confirming or
    denying account existence here would let someone enumerate registered
    emails. If SMTP isn't configured, this silently does nothing (there's
    no way to deliver a reset link anyway); the person just won't receive
    an email, same externally-visible behavior either way.
    """
    user = await db.scalar(select(User).where(User.email == body.email))

    if user is not None and settings.smtp_configured:
        raw_token, hashed_token = create_verification_token()
        reset_row = PasswordResetToken(
            user_id=user.id,
            hashed_token=hashed_token,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=PASSWORD_RESET_TOKEN_HOURS),
        )
        db.add(reset_row)
        await db.flush()

        reset_url = f"{settings.frontend_url}/reset-password?token_id={reset_row.id}&token={raw_token}"
        await email_service.send_password_reset_email(user.email, user.full_name, reset_url)
        await db.commit()

    return None


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/hour")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    reset_row = await db.get(PasswordResetToken, body.token_id)

    invalid = HTTPException(status_code=400, detail="Invalid or expired reset link")

    if reset_row is None or reset_row.used:
        raise invalid
    if reset_row.expires_at < datetime.now(timezone.utc):
        raise invalid
    if not verify_verification_token(body.token, reset_row.hashed_token):
        raise invalid

    user = await db.get(User, reset_row.user_id)
    if user is None:
        raise invalid

    user.hashed_password = hash_password(body.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    reset_row.used = True

    # Resetting the password invalidates every existing session — someone
    # who had unauthorized access via a compromised password shouldn't
    # stay logged in after the legitimate owner resets it.
    await db.execute(update(RefreshToken).where(RefreshToken.user_id == user.id).values(revoked=True))

    await db.commit()
    return None


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, response: Response, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email))

    generic_error = HTTPException(status_code=401, detail="Incorrect email or password")

    if not user:
        # Still run a hash comparison to keep response timing similar whether
        # or not the account exists — avoids leaking valid emails via timing.
        hash_password(body.password)
        raise generic_error

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=423, detail="Account temporarily locked. Try again later.")

    if not verify_password(body.password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        await db.commit()
        raise generic_error

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    access_token = create_access_token(subject=str(user.id))
    raw_refresh, hashed_refresh = create_refresh_token(subject=str(user.id))
    db.add(
        RefreshToken(
            user_id=user.id,
            hashed_token=hashed_refresh,
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await db.commit()

    _set_refresh_cookie(response, raw_refresh)
    return TokenResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh_access_token(request: Request, db: AsyncSession = Depends(get_db)):
    raw_token = request.cookies.get("refresh_token")
    if not raw_token:
        raise HTTPException(status_code=401, detail="No refresh token provided")

    payload = decode_token(raw_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid session")

    # The JWT signature alone only proves the token was issued by us and
    # hasn't expired — it says nothing about whether it's since been
    # revoked (logout, password reset). Match it against the stored,
    # hashed rows for this user to check that too. There's no direct
    # lookup by jti here (hashed tokens aren't queryable by equality), so
    # this checks against this user's active tokens — fine at the scale
    # of "how many concurrent sessions one person has."
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked == False)  # noqa: E712
    )
    active_tokens = result.scalars().all()
    if not any(verify_verification_token(raw_token, t.hashed_token) for t in active_tokens):
        raise HTTPException(status_code=401, detail="Session has been revoked")

    access_token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    raw_token = request.cookies.get("refresh_token")
    response.delete_cookie("refresh_token", path="/api/auth")

    if raw_token:
        payload = decode_token(raw_token)
        if payload and payload.get("type") == "refresh":
            # Same "no direct hash lookup" constraint as /refresh — check
            # against this user's active tokens and revoke the matching
            # one. Without this, clearing the cookie was purely cosmetic:
            # the token itself stayed valid and usable if someone had
            # captured it separately.
            result = await db.execute(
                select(RefreshToken).where(
                    RefreshToken.user_id == payload["sub"], RefreshToken.revoked == False  # noqa: E712
                )
            )
            for t in result.scalars().all():
                if verify_verification_token(raw_token, t.hashed_token):
                    t.revoked = True
                    await db.commit()
                    break

    return None
