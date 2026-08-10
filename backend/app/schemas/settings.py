import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.settings import (
    ACCENT_CHOICES,
    LANGUAGE_CHOICES,
    REPORT_REASONS,
    FontScale,
    ReportStatus,
    ReportTargetType,
    Theme,
)


class NotificationSettingsOut(BaseModel):
    notify_messages: bool
    notify_mentions: bool
    notify_follows: bool
    notify_post_activity: bool
    notify_job_matches: bool

    model_config = {"from_attributes": True}


class EmailSettingsOut(BaseModel):
    email_product_updates: bool
    email_weekly_digest: bool
    email_security_alerts: bool
    email_marketing: bool

    model_config = {"from_attributes": True}


class AppearanceSettingsOut(BaseModel):
    theme: Theme
    accent: str

    model_config = {"from_attributes": True}


class AccessibilitySettingsOut(BaseModel):
    reduce_motion: bool
    high_contrast: bool
    font_scale: FontScale

    model_config = {"from_attributes": True}


class SettingsOut(BaseModel):
    """
    The whole preference set in one payload. The settings screens read
    this once and each subpage PATCHes only its own slice.
    """

    notifications: NotificationSettingsOut
    email: EmailSettingsOut
    appearance: AppearanceSettingsOut
    accessibility: AccessibilitySettingsOut
    language: str

    @classmethod
    def from_row(cls, row) -> "SettingsOut":
        return cls(
            notifications=NotificationSettingsOut.model_validate(row),
            email=EmailSettingsOut.model_validate(row),
            appearance=AppearanceSettingsOut.model_validate(row),
            accessibility=AccessibilitySettingsOut.model_validate(row),
            language=row.language,
        )


class NotificationSettingsUpdate(BaseModel):
    notify_messages: bool | None = None
    notify_mentions: bool | None = None
    notify_follows: bool | None = None
    notify_post_activity: bool | None = None
    notify_job_matches: bool | None = None


class EmailSettingsUpdate(BaseModel):
    email_product_updates: bool | None = None
    email_weekly_digest: bool | None = None
    email_security_alerts: bool | None = None
    email_marketing: bool | None = None


class AppearanceSettingsUpdate(BaseModel):
    theme: Theme | None = None
    accent: str | None = None

    @field_validator("accent")
    @classmethod
    def known_accent(cls, v: str | None) -> str | None:
        if v is not None and v not in ACCENT_CHOICES:
            raise ValueError(f"Unknown accent: {v}")
        return v


class AccessibilitySettingsUpdate(BaseModel):
    reduce_motion: bool | None = None
    high_contrast: bool | None = None
    font_scale: FontScale | None = None


class LanguageUpdate(BaseModel):
    language: str

    @field_validator("language")
    @classmethod
    def known_language(cls, v: str) -> str:
        if v not in LANGUAGE_CHOICES:
            raise ValueError(f"Unsupported language: {v}")
        return v


class VerificationStatusOut(BaseModel):
    """
    Settings -> Account verification.

    Two independent things live here and must not be conflated:

    * `email_verified` — the member confirmed their address. Automatic,
      self-service, and grants no badge.
    * `verified` — the public blue tick. Granted by hand by an admin in
      the management app, never by completing a profile or clicking a
      confirmation link.
    """

    email: str
    email_verified: bool
    email_delivery_enabled: bool
    profile_complete: bool
    profile_completion_pct: int
    verified: bool
    member_since: datetime


class BlockedUserOut(BaseModel):
    user_id: uuid.UUID
    username: str | None
    full_name: str
    photo_url: str | None
    blocked_at: datetime


class BlockUserRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)


class ReportCreateRequest(BaseModel):
    """
    A user can be reported either by id or by username: public profiles
    expose a username and never a raw user id, so the profile "Report"
    action would otherwise have nothing to send. Posts always report by id.
    """

    target_type: ReportTargetType
    target_id: uuid.UUID | None = None
    target_username: str | None = None
    reason: str
    details: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def one_target(self) -> "ReportCreateRequest":
        if self.target_type == ReportTargetType.post and self.target_id is None:
            raise ValueError("target_id is required when reporting a post")
        if self.target_id is None and not self.target_username:
            raise ValueError("Provide target_id or target_username")
        return self

    @field_validator("reason")
    @classmethod
    def known_reason(cls, v: str) -> str:
        if v not in REPORT_REASONS:
            raise ValueError(f"Unknown reason: {v}")
        return v


class ReportOut(BaseModel):
    id: uuid.UUID
    target_type: ReportTargetType
    target_id: uuid.UUID
    target_label: str | None
    reason: str
    details: str | None
    status: ReportStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class AboutOut(BaseModel):
    """Version/build + policy links, read from the server so the app
    never hardcodes a version string that drifts from what's deployed."""

    app_name: str
    version: str
    environment: str
    terms_url: str
    privacy_url: str
    support_email: str
