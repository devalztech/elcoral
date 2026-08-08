"""Community schemas (see app/routers/communities.py)."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.media_url import media_ref_to_url
from app.models.community import (
    COMMUNITY_TONES,
    COMMUNITY_TOPICS,
    POLICY_LEVELS,
    PROJECT_STATUSES,
)
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
    # Server-computed capability flags. The UI hides controls with these;
    # the server re-checks them on every mutation (app/core/community_perms.py).
    capabilities: dict = Field(default_factory=dict)

    # Owner-controlled policies, echoed so the settings screen can render
    # the current values.
    post_policy: str = "members"
    chat_policy: str = "members"
    project_policy: str = "members"
    invite_policy: str = "members"
    moderate_policy: str = "moderators"
    chat_enabled: bool = True

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
            post_policy=community.post_policy,
            chat_policy=community.chat_policy,
            project_policy=community.project_policy,
            invite_policy=community.invite_policy,
            moderate_policy=community.moderate_policy,
            chat_enabled=community.chat_enabled,
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
    edited_at: datetime | None = None
    media_urls: list[str] = Field(default_factory=list)
    view_count: int = 0

    author: PersonOut
    community: CommunityRefOut

    likes_count: int = 0
    comments_count: int = 0
    is_liked: bool = False
    is_saved: bool = False
    can_delete: bool = False
    can_edit: bool = False


class DiscussionListOut(BaseModel):
    items: list[DiscussionOut]
    total: int
    # Cursor-less pagination: the client asks for the next offset while
    # has_more is true.
    has_more: bool = False


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
    media_refs: list[str] | None = Field(default=None, max_length=6)

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


def _check_policy(v):
    if v is None:
        return None
    v = str(v).strip().lower()
    if v not in POLICY_LEVELS:
        raise ValueError(f"Unknown permission level: {v}")
    return v


class CommunityPermissionsRequest(BaseModel):
    """Owner-only. Separate from CommunityUpdateRequest so the settings
    screen's two panels map to two endpoints with two authorization
    checks (admins may edit details, only the owner may change who can do
    what)."""

    model_config = {"extra": "forbid"}

    post_policy: str | None = None
    chat_policy: str | None = None
    project_policy: str | None = None
    invite_policy: str | None = None
    moderate_policy: str | None = None
    chat_enabled: bool | None = None

    @field_validator("post_policy", "chat_policy", "project_policy", "invite_policy", "moderate_policy")
    @classmethod
    def known_policy(cls, v):
        return _check_policy(v)


class DiscussionUpdateRequest(BaseModel):
    model_config = {"extra": "forbid"}

    title: str | None = Field(default=None, min_length=3, max_length=180)
    body: str | None = Field(default=None, max_length=8000)
    media_refs: list[str] | None = Field(default=None, max_length=6)


class CommunityMemberOut(BaseModel):
    person: PersonOut
    role: str
    joined_at: datetime
    is_banned: bool = False


class CommunityMemberListOut(BaseModel):
    items: list[CommunityMemberOut]
    total: int
    has_more: bool = False


class MemberRoleRequest(BaseModel):
    model_config = {"extra": "forbid"}

    role: str

    @field_validator("role")
    @classmethod
    def known_role(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in ("admin", "moderator", "member"):
            raise ValueError("Role must be admin, moderator or member")
        return v


class MemberRemoveRequest(BaseModel):
    model_config = {"extra": "forbid"}

    ban: bool = False
    reason: str | None = Field(default=None, max_length=200)


# ------------------------------------------------------------- projects ---


class CommunityProjectOut(BaseModel):
    id: uuid.UUID
    community: CommunityRefOut
    owner: PersonOut
    name: str
    description: str | None = None
    media_urls: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    roles_needed: list[str] = Field(default_factory=list)
    status: str
    seats: int = 0
    collaborators_count: int = 0
    pending_count: int = 0
    my_state: str | None = None  # requested | accepted | declined | None
    can_edit: bool = False
    can_delete: bool = False
    created_at: datetime


class CommunityProjectListOut(BaseModel):
    items: list[CommunityProjectOut]
    total: int
    has_more: bool = False


class CommunityProjectCreateRequest(BaseModel):
    model_config = {"extra": "forbid"}

    name: str = Field(min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=4000)
    media_refs: list[str] | None = Field(default=None, max_length=6)
    skills: list[str] | None = Field(default=None, max_length=20)
    roles_needed: list[str] | None = Field(default=None, max_length=20)
    status: str = "idea"
    seats: int = Field(default=0, ge=0, le=100)

    @field_validator("status")
    @classmethod
    def known_status(cls, v: str) -> str:
        v = (v or "idea").strip().lower()
        if v not in PROJECT_STATUSES:
            raise ValueError(f"Unknown status: {v}")
        return v


class CommunityProjectUpdateRequest(BaseModel):
    model_config = {"extra": "forbid"}

    name: str | None = Field(default=None, min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=4000)
    media_refs: list[str] | None = Field(default=None, max_length=6)
    skills: list[str] | None = Field(default=None, max_length=20)
    roles_needed: list[str] | None = Field(default=None, max_length=20)
    status: str | None = None
    seats: int | None = Field(default=None, ge=0, le=100)

    @field_validator("status")
    @classmethod
    def known_status(cls, v):
        if v is None:
            return None
        v = v.strip().lower()
        if v not in PROJECT_STATUSES:
            raise ValueError(f"Unknown status: {v}")
        return v


class ProjectJoinRequest(BaseModel):
    model_config = {"extra": "forbid"}

    note: str | None = Field(default=None, max_length=300)


class ProjectCollaboratorOut(BaseModel):
    id: uuid.UUID
    person: PersonOut
    state: str
    note: str | None = None
    created_at: datetime


class ProjectCollaboratorDecisionRequest(BaseModel):
    model_config = {"extra": "forbid"}

    state: str

    @field_validator("state")
    @classmethod
    def known_state(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in ("accepted", "declined"):
            raise ValueError("State must be accepted or declined")
        return v


# ----------------------------------------------------------------- chat ---


class CommunityMessageOut(BaseModel):
    id: uuid.UUID
    community_id: uuid.UUID
    body: str | None = None
    media_urls: list[str] = Field(default_factory=list)
    created_at: datetime
    sender: PersonOut
    is_deleted: bool = False
    can_delete: bool = False


class CommunityMessageListOut(BaseModel):
    items: list[CommunityMessageOut]
    has_more: bool = False
    can_chat: bool = False
    chat_enabled: bool = True


class CommunityMessageCreateRequest(BaseModel):
    model_config = {"extra": "forbid"}

    body: str | None = Field(default=None, max_length=4000)
    media_refs: list[str] | None = Field(default=None, max_length=6)

    @field_validator("body")
    @classmethod
    def strip_body(cls, v):
        return v.strip() if isinstance(v, str) else v


class CommunityOptionsFullOut(BaseModel):
    topics: list[str]
    tones: list[str]
    policy_levels: list[str]
    project_statuses: list[str]
    roles: list[str]
