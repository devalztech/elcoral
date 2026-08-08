import re
import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


def _check_password_strength(v: str) -> str:
    if len(v) < 10:
        raise ValueError("Password must be at least 10 characters")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain an uppercase letter")
    if not re.search(r"[a-z]", v):
        raise ValueError("Password must contain a lowercase letter")
    if not re.search(r"\d", v):
        raise ValueError("Password must contain a number")
    return v


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    # Both chosen on the signup form itself. Optional so older clients (and
    # the "sign up, pick a handle during onboarding" path) still work: the
    # username is only reserved here when one was supplied and is free.
    username: str | None = Field(
        default=None, min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$"
    )
    account_type: Literal["individual", "organization"] = "individual"

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


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    is_verified: bool

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token_id: str
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _check_password_strength(v)


class UpdateAccountRequest(BaseModel):
    """
    Settings -> Account. Both fields optional so the screen can save just
    one. Changing the email resets is_verified and re-sends the
    verification link (when SMTP is configured) — otherwise anyone could
    move their account to an address they don't control and keep a
    verified badge.
    """

    full_name: str | None = None
    email: EmailStr | None = None

    @field_validator("full_name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name is required")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _check_password_strength(v)


class DeleteAccountRequest(BaseModel):
    """Password re-entry required — account deletion is irreversible."""

    password: str
