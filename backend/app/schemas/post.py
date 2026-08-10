import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.media_url import media_ref_to_url

POST_KINDS = ("text", "media", "article", "link", "poll")
VISIBILITIES = ("public", "followers")


class PostCreateRequest(BaseModel):
    kind: str = "text"
    title: str | None = Field(default=None, max_length=200)
    body: str = Field(min_length=1, max_length=20000)
    media_refs: list[str] = Field(default_factory=list, max_length=10)
    media_types: list[str] = Field(default_factory=list, max_length=10)
    tags: list[str] = Field(default_factory=list, max_length=10)
    link_url: str | None = Field(default=None, max_length=500)
    visibility: str = "public"
    poll_options: list[str] = Field(default_factory=list, max_length=6)

    @field_validator("kind")
    @classmethod
    def _kind(cls, v: str) -> str:
        if v not in POST_KINDS:
            raise ValueError(f"kind must be one of {', '.join(POST_KINDS)}")
        return v

    @field_validator("visibility")
    @classmethod
    def _visibility(cls, v: str) -> str:
        if v not in VISIBILITIES:
            raise ValueError(f"visibility must be one of {', '.join(VISIBILITIES)}")
        return v

    @field_validator("tags")
    @classmethod
    def _tags(cls, v: list[str]) -> list[str]:
        cleaned = []
        for tag in v:
            tag = tag.strip().lstrip("#").lower()[:40]
            if tag and tag not in cleaned:
                cleaned.append(tag)
        return cleaned

    @field_validator("poll_options")
    @classmethod
    def _poll_options(cls, v: list[str]) -> list[str]:
        return [o.strip()[:120] for o in v if o.strip()]


class PostUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    body: str = Field(min_length=1, max_length=20000)
    tags: list[str] = Field(default_factory=list, max_length=10)
    visibility: str = "public"

    @field_validator("visibility")
    @classmethod
    def _visibility(cls, v: str) -> str:
        if v not in VISIBILITIES:
            raise ValueError(f"visibility must be one of {', '.join(VISIBILITIES)}")
        return v


class CommentCreateRequest(BaseModel):
    # A comment is valid with text, with a photo, or with both — the
    # router rejects the empty case.
    body: str | None = Field(default=None, max_length=2000)
    parent_id: uuid.UUID | None = None
    media_ref: str | None = Field(default=None, max_length=512)
    media_type: str | None = Field(default=None, max_length=120)


class RepostRequest(BaseModel):
    quote: str | None = Field(default=None, max_length=3000)


class PollVoteRequest(BaseModel):
    option_index: int = Field(ge=0, le=5)


class PostAuthorOut(BaseModel):
    id: uuid.UUID
    full_name: str
    username: str | None = None
    photo_url: str | None = None
    headline: str | None = None
    # The public blue tick. Sourced from `is_badge_verified` — a badge is
    # granted by an admin in the management app and has nothing to do with
    # whether the account confirmed its email address. `is_verified` is
    # kept as the wire name so existing clients keep rendering, and the
    # explicit alias below makes the meaning unambiguous for new code.
    is_verified: bool = False
    is_badge_verified: bool = False
    categories: list[str] | None = None

    @staticmethod
    def from_user(user) -> "PostAuthorOut":
        profile = getattr(user, "profile", None)
        return PostAuthorOut(
            id=user.id,
            full_name=user.full_name,
            username=getattr(profile, "username", None),
            photo_url=media_ref_to_url(getattr(profile, "photo_ref", None)) if profile else None,
            headline=(getattr(profile, "headline", None) or getattr(profile, "company_name", None))
            if profile
            else None,
            is_verified=bool(getattr(user, "is_badge_verified", False)),
            is_badge_verified=bool(getattr(user, "is_badge_verified", False)),
            categories=getattr(profile, "categories", None) if profile else None,
        )


class MediaOut(BaseModel):
    url: str
    mime_type: str | None = None


class PollOptionOut(BaseModel):
    index: int
    label: str
    votes: int


class CommentOut(BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    body: str = ""
    # Photo comments: a resolved URL plus the MIME type it was uploaded
    # with, so the client renders an <img> without sniffing the URL.
    media_url: str | None = None
    media_type: str | None = None
    reply_count: int = 0
    created_at: datetime
    author: PostAuthorOut
    is_mine: bool = False

    @staticmethod
    def from_model(comment, viewer_id=None, reply_count: int = 0) -> "CommentOut":
        return CommentOut(
            id=comment.id,
            post_id=comment.post_id,
            parent_id=comment.parent_id,
            body=comment.body or "",
            media_url=media_ref_to_url(getattr(comment, "media_ref", None)),
            media_type=getattr(comment, "media_type", None),
            reply_count=reply_count,
            created_at=comment.created_at,
            author=PostAuthorOut.from_user(comment.author),
            is_mine=viewer_id is not None and comment.author_id == viewer_id,
        )


class PostOut(BaseModel):
    id: uuid.UUID
    kind: str
    title: str | None = None
    body: str
    media_urls: list[str]
    media: list[MediaOut] = []
    tags: list[str] = []
    link_url: str | None = None
    visibility: str = "public"
    poll: list[PollOptionOut] | None = None
    my_poll_vote: int | None = None
    created_at: datetime
    edited_at: datetime | None = None
    author: PostAuthorOut
    like_count: int = 0
    comment_count: int = 0
    repost_count: int = 0
    liked_by_me: bool = False
    reposted_by_me: bool = False
    saved_by_me: bool = False
    is_mine: bool = False
    # Set when this feed entry is surfaced because someone reposted it.
    reposted_by: PostAuthorOut | None = None

    @staticmethod
    def from_model(post, *, stats=None, viewer_id=None, poll_counts=None, my_vote=None, reposted_by=None) -> "PostOut":
        stats = stats or {}
        refs = list(post.media_refs or [])
        types = list(post.media_types or [])
        media = [
            MediaOut(url=media_ref_to_url(ref), mime_type=types[i] if i < len(types) else None)
            for i, ref in enumerate(refs)
        ]

        poll = None
        if post.poll_options:
            counts = poll_counts or {}
            poll = [
                PollOptionOut(index=i, label=label, votes=int(counts.get(i, 0)))
                for i, label in enumerate(post.poll_options)
            ]

        return PostOut(
            id=post.id,
            kind=post.kind or "text",
            title=post.title,
            body=post.body,
            media_urls=[m.url for m in media],
            media=media,
            tags=list(post.tags or []),
            link_url=post.link_url,
            visibility=post.visibility or "public",
            poll=poll,
            my_poll_vote=my_vote,
            created_at=post.created_at,
            edited_at=post.edited_at,
            author=PostAuthorOut.from_user(post.author),
            like_count=int(stats.get("likes", 0)),
            comment_count=int(stats.get("comments", 0)),
            repost_count=int(stats.get("reposts", 0)),
            liked_by_me=bool(stats.get("liked")),
            reposted_by_me=bool(stats.get("reposted")),
            saved_by_me=bool(stats.get("saved")),
            is_mine=viewer_id is not None and post.author_id == viewer_id,
            reposted_by=reposted_by,
        )


class PostEngagementOut(BaseModel):
    """Returned by the like / repost / save toggles so the UI can trust the server count."""

    post_id: uuid.UUID
    like_count: int
    comment_count: int
    repost_count: int
    liked_by_me: bool
    reposted_by_me: bool
    saved_by_me: bool
