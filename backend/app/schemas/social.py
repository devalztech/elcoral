"""Follow-graph schemas (see app/routers/social.py)."""
import uuid
from datetime import datetime

from pydantic import BaseModel

from app.core.media_url import media_ref_to_url


OFFICIAL_USERNAMES = {"elcoral", "elcoral_official"}


class PersonOut(BaseModel):
    """
    Compact person card, reused by the followers/following lists, the
    message inbox and community member lists so all three render the same
    shape on the frontend.
    """

    id: uuid.UUID
    full_name: str
    username: str | None = None
    headline: str | None = None
    photo_url: str | None = None
    # The public blue tick. Sourced from `is_badge_verified` — a badge is
    # granted by an admin in the management app and has nothing to do with
    # whether the account confirmed its email address. `is_verified` is
    # kept as the wire name so existing clients keep rendering, and the
    # explicit alias below makes the meaning unambiguous for new code.
    is_verified: bool = False
    is_badge_verified: bool = False
    # Viewer-relative, omitted (False) for anonymous callers.
    is_following: bool = False
    follows_you: bool = False
    is_self: bool = False
    # Public follower tally, filled in by endpoints that render people
    # cards with social proof (the "@" mention menu, suggestions).
    followers_count: int = 0
    # The platform's own account, rendered with an "Official" pill instead
    # of a follow button.
    is_official: bool = False

    @staticmethod
    def from_user(user, profile=None, **flags) -> "PersonOut":
        profile = profile if profile is not None else getattr(user, "profile", None)
        return PersonOut(
            id=user.id,
            full_name=user.full_name,
            username=getattr(profile, "username", None),
            headline=(getattr(profile, "headline", None) or getattr(profile, "company_name", None))
            if profile
            else None,
            photo_url=media_ref_to_url(getattr(profile, "photo_ref", None)) if profile else None,
            is_verified=bool(getattr(user, "is_badge_verified", False)),
            is_badge_verified=bool(getattr(user, "is_badge_verified", False)),
            is_official=(getattr(profile, "username", "") or "").lower() in OFFICIAL_USERNAMES,
            **flags,
        )


class FollowStateOut(BaseModel):
    is_following: bool
    follows_you: bool
    followers_count: int
    following_count: int


class PersonListOut(BaseModel):
    items: list[PersonOut]
    total: int
    next_cursor: datetime | None = None
