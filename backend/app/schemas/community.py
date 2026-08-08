"""Community schemas (see app/routers/communities.py)."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.media_url import media_ref_to_url
from app.models.community import COMMUNITY_TONES, COMMUNITY_TOPICS
from app.schemas.social import PersonOut


class CommunityOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    description: str | None = None
    topic: str
    tone: str
    glyph: str | None = None
    icon_url: str | None = None
    cover_url: str | None = None
    is_official: bool = False
    is_private: bool = False

    members_count: int = 0
    # Members who joined in the last 24h — drives the "380 new today" line.
    new_today: int = 0
    discussions_count: int = 0

    # Viewer-relative
    is_member: bool = False
    is_owner: bool = False
    role: str | None = None

    created_at: datetime

    @staticmethod
    def from_model(community, **extra) -> "CommunityOut":
        return CommunityOut(
            id=community.id,
            slug=community.slug,
            name=community.name,
            description=community.description,
            topic=community.topic,
            tone=community.tone,
            glyph=community.glyph,
            icon_url=media_ref_to_url(community.icon_ref),
            cover_url=media_ref_to_url(community.cover_ref),
            is_official=community.is_official,
            is_private=community.is_private,
            created_at=community.created_at,
            **extra,
        )


class CommunityListOut(BaseModel):
    items: list[CommunityOut]
    total: int


class CommunityRefOut(BaseModel):
    """Minimal community pointer embedded in a discussion row."""

    id: uuid.UUID
    slug: str
    name: str
    tone: str
    glyph: str | None = None
    icon_url: str | None = None


class DiscussionOut(BaseModel):
    id: uuid.UUID
    title: str
    body: str | None = None
    created_at: datetime
    view_count: int = 0

    author: PersonOut
    community: CommunityRefOut

    likes_count: int = 0
    comments_count: int = 0
    is_liked: bool = False
    is_saved: bool = False
    can_delete: bool = False


class DiscussionListOut(BaseModel):
    items: list[DiscussionOut]
    total: int


class DiscussionCommentOut(BaseModel):
    id: uuid.UUID
    body: str
    created_at: datetime
    author: PersonOut
    can_delete: bool = False


class CommunityCreateRequest(BaseModel):
    model_config = {"extra": "forbid"}

    name: str = Field(min_length=3, max_length=80)
    description: str | None = Field(default=None, max_length=300)
    topic: str = "other"
    tone: str = "dark"
    glyph: str | None = Field(default=None, max_length=24)
    icon_ref: str | None = Field(default=None, max_length=64)
    cover_ref: str | None = Field(default=None, max_length=64)
    is_private: bool = False

    @field_validator("topic")
    @classmethod
    def check_topic(cls, v: str) -> str:
        v = (v or "other").strip().lower()
        if v not in COMMUNITY_TOPICS:
            raise ValueError(f"Unknown topic: {v}")
        return v

    @field_validator("tone")
    @classmethod
    def check_tone(cls, v: str) -> str:
        v = (v or "dark").strip().lower()
        if v not in COMMUNITY_TONES:
            raise ValueError(f"Unknown tone: {v}")
        return v

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v


class CommunityUpdateRequest(BaseModel):
    model_config = {"extra": "forbid"}

    name: str | None = Field(default=None, min_length=3, max_length=80)
    description: str | None = Field(default=None, max_length=300)
    topic: str | None = None
    tone: str | None = None
    glyph: str | None = Field(default=None, max_length=24)
    icon_ref: str | None = Field(default=None, max_length=64)
    cover_ref: str | None = Field(default=None, max_length=64)
    is_private: bool | None = None

    @field_validator("topic")
    @classmethod
    def check_topic(cls, v):
        if v is None:
            return None
        v = v.strip().lower()
        if v not in COMMUNITY_TOPICS:
            raise ValueError(f"Unknown topic: {v}")
        return v

    @field_validator("tone")
    @classmethod
    def check_tone(cls, v):
        if v is None:
            return None
        v = v.strip().lower()
        if v not in COMMUNITY_TONES:
            raise ValueError(f"Unknown tone: {v}")
        return v


class DiscussionCreateRequest(BaseModel):
    model_config = {"extra": "forbid"}

    title: str = Field(min_length=3, max_length=180)
    body: str | None = Field(default=None, max_length=8000)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title is required")
        return v


class DiscussionCommentCreateRequest(BaseModel):
    model_config = {"extra": "forbid"}

    body: str = Field(min_length=1, max_length=3000)

    @field_validator("body")
    @classmethod
    def strip_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment cannot be empty")
        return v


class CommunityOptionsOut(BaseModel):
    topics: list[str]
    tones: list[str]
