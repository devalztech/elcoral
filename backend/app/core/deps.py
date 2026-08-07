from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    return user


async def require_verified(user: User = Depends(get_current_user)) -> User:
    """
    Use in place of get_current_user on routes that must be blocked until
    the user's email is verified (onboarding, posting). Users created
    while SMTP wasn't configured are auto-verified at signup, so this
    never blocks anyone in that mode — see app/routers/auth.py signup.
    """
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before continuing.",
        )
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """
    Same as get_current_user but never raises — returns None for anonymous
    callers. Used by viewer-aware public endpoints (e.g. GET
    /api/profile/{username}) which must work logged-out but return extra
    owner-only context when the caller happens to be the profile owner.
    """
    if credentials is None:
        return None

    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        return None

    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        return None
    return user
