import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.media_url import media_ref_to_url


class PostCreateRequest(BaseModel):
    body: str = Field(min_length=1, max_length=3000)
    media_refs: list[str] = Field(default_factory=list, max_length=10)


class PostAuthorOut(BaseModel):
    id: uuid.UUID
    full_name: str
    username: str | None = None
    photo_url: str | None = None
    headline: str | None = None
    categories: list[str] | None = None


class PostOut(BaseModel):
    id: uuid.UUID
    body: str
    media_urls: list[str]
    created_at: datetime
    author: PostAuthorOut

    @staticmethod
    def from_model(post) -> "PostOut":
        author_profile = getattr(post.author, "profile", None)
        headline = None
        photo_url = None
        username = None
        categories = None
        if author_profile:
            # headline (e.g. "Backend Developer") takes priority; falls
            # back to company_name for someone who's only filled in the
            # hiring-related fields and has no headline of their own.
            headline = author_profile.headline or author_profile.company_name
            photo_url = media_ref_to_url(author_profile.photo_ref)
            username = author_profile.username
            categories = author_profile.categories

        return PostOut(
            id=post.id,
            body=post.body,
            media_urls=[media_ref_to_url(r) for r in (post.media_refs or [])],
            created_at=post.created_at,
            author=PostAuthorOut(
                id=post.author.id,
                full_name=post.author.full_name,
                username=username,
                photo_url=photo_url,
                headline=headline,
                categories=categories,
            ),
        )
