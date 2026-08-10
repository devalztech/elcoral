"""
Admin API schemas (see app/routers/admin.py).

Everything the management app sends or receives is declared here rather
than inline in the router, matching how the rest of the API is laid out
(schemas/auth.py, schemas/profile.py ...).
"""
import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.admin import ASSIGNABLE_ROLES


def _check_password_strength(v: str) -> str:
    """Same policy as member signup — admins don't get a weaker bar."""
    if len(v) < 10:
        raise ValueError("Password must be at least 10 characters")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain an uppercase letter")
    if not re.search(r"[a-z]", v):
        raise ValueError("Password must contain a lowercase letter")
    if not re.search(r"\d", v):
        raise ValueError("Password must contain a number")
    return v


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    roles: list[str]
    is_superadmin: bool


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    admin: AdminOut


class AdminUserOut(BaseModel):
    """One row in the management users table."""

    id: uuid.UUID
    email: EmailStr
    full_name: str
    username: str | None = None
    photo_url: str | None = None
    headline: str | None = None
    account_type: str | None = None

    is_active: bool
    # Email confirmation — informational only, never drives the badge.
    is_email_verified: bool
    # The blue tick. Admin-granted, admin-revoked.
    is_badge_verified: bool
    badge_verified_at: datetime | None = None

    roles: list[str] = Field(default_factory=list)
    onboarding_complete: bool = False
    created_at: datetime
    last_seen_at: datetime | None = None


class AdminUserListOut(BaseModel):
    items: list[AdminUserOut]
    total: int
    page: int
    page_size: int


class AdminCreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    username: str | None = Field(
        default=None, min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$"
    )
    account_type: str = "individual"
    # An admin creating an account on someone's behalf has already
    # established who they are out-of-band, so the email step can be
    # marked done. It still does NOT grant a badge.
    mark_email_verified: bool = True
    grant_badge: bool = False
    roles: list[str] = Field(default_factory=list)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _check_password_strength(v)

    @field_validator("full_name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name is required")
        return v

    @field_validator("account_type")
    @classmethod
    def known_account_type(cls, v: str) -> str:
        if v not in ("individual", "organization"):
            raise ValueError("account_type must be individual or organization")
        return v

    @field_validator("roles")
    @classmethod
    def known_roles(cls, v: list[str]) -> list[str]:
        for role in v:
            if role not in ASSIGNABLE_ROLES:
                raise ValueError(f"Unknown role: {role}")
        return v


class AdminBadgeRequest(BaseModel):
    """Optional note stored on the audit row explaining the decision."""

    reason: str | None = Field(default=None, max_length=280)


class AdminRoleRequest(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def known_role(cls, v: str) -> str:
        if v not in ASSIGNABLE_ROLES:
            raise ValueError(f"Unknown role: {v}")
        return v


class AdminSetActiveRequest(BaseModel):
    is_active: bool


class AuditLogOut(BaseModel):
    id: uuid.UUID
    actor_email: str | None
    action: str
    target_user_id: uuid.UUID | None
    target_email: str | None
    detail: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminStatsOut(BaseModel):
    total_users: int
    active_users: int
    email_verified_users: int
    badge_verified_users: int
    admins: int
    new_users_7d: int


class RoleOptionOut(BaseModel):
    value: str
    label: str
    description: str
    can_sign_in_to_admin: bool


class RoleCatalogOut(BaseModel):
    roles: list[RoleOptionOut]
