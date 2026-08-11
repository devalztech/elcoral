"""
Notification helpers.

Every place that can generate a notification (posts, comments, likes,
follows, mentions) funnels through `push` so the dedupe and self-notify
rules live in exactly one place.

`mention_targets` parses "@username" out of a body and resolves the
handles to real, active users — it is deliberately tolerant: an unknown
handle is simply not a mention.
"""
import asyncio
import logging
import re
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.presence import presence
from app.models.notification import Notification
from app.models.profile import Profile
from app.models.user import User

logger = logging.getLogger("uvicorn.error")

# How long to wait before nudging the recipient's socket. The caller owns
# the transaction, so the row is not visible yet when push() returns; a
# short delay lets the commit land before the client refetches. The nudge
# carries no payload — it only says "your notifications changed" — so a
# nudge for a transaction that rolled back is harmless.
NUDGE_DELAY_SECONDS = 0.6


async def _nudge(user_id: uuid.UUID) -> None:
    try:
        await asyncio.sleep(NUDGE_DELAY_SECONDS)
        await presence.send(user_id, {"type": "notification"})
    except Exception:  # pragma: no cover - a missed nudge must never 500 a request
        logger.debug("notification nudge failed", exc_info=True)


MENTION_RE = re.compile(r"@([A-Za-z0-9_.]{2,30})")

# Kinds that should never appear twice for the same (actor, target) pair.
DEDUPED_KINDS = {"post_like", "comment_like", "follow"}


def excerpt(text: str | None, limit: int = 180) -> str | None:
    if not text:
        return None
    clean = " ".join(text.split())
    return clean if len(clean) <= limit else f"{clean[: limit - 1]}…"


async def push(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None,
    actor_id: uuid.UUID | None,
    kind: str,
    post_id: uuid.UUID | None = None,
    comment_id: uuid.UUID | None = None,
    preview: str | None = None,
) -> Notification | None:
    """
    Create one notification. Returns None when it was skipped (self
    action, missing recipient, or an already-recorded duplicate).

    The caller owns the transaction: this only adds to the session.
    """
    if user_id is None or actor_id is None or user_id == actor_id:
        return None

    if kind in DEDUPED_KINDS:
        query = select(Notification).where(
            Notification.user_id == user_id,
            Notification.actor_id == actor_id,
            Notification.kind == kind,
        )
        query = query.where(
            Notification.post_id.is_(None) if post_id is None else Notification.post_id == post_id
        )
        query = query.where(
            Notification.comment_id.is_(None)
            if comment_id is None
            else Notification.comment_id == comment_id
        )
        if await db.scalar(query.limit(1)) is not None:
            return None

    row = Notification(
        user_id=user_id,
        actor_id=actor_id,
        kind=kind,
        post_id=post_id,
        comment_id=comment_id,
        preview=excerpt(preview),
    )
    db.add(row)
    # Live bell + browser notification on the other end. Fire-and-forget:
    # the notification itself is already persisted by the caller's commit.
    try:
        asyncio.get_running_loop().create_task(_nudge(user_id))
    except RuntimeError:
        pass
    return row


async def mention_targets(db: AsyncSession, body: str | None) -> list[User]:
    """Active users whose username appears as @handle in `body`."""
    if not body:
        return []
    handles = {h.lower().rstrip(".") for h in MENTION_RE.findall(body)}
    if not handles:
        return []
    rows = await db.execute(
        select(User)
        .join(Profile, Profile.user_id == User.id)
        .where(func.lower(Profile.username).in_(handles), User.is_active.is_(True))
        .limit(20)
    )
    return list(rows.scalars().all())


async def notify_mentions(
    db: AsyncSession,
    *,
    body: str | None,
    actor_id: uuid.UUID,
    post_id: uuid.UUID | None = None,
    comment_id: uuid.UUID | None = None,
) -> None:
    for target in await mention_targets(db, body):
        await push(
            db,
            user_id=target.id,
            actor_id=actor_id,
            kind="mention",
            post_id=post_id,
            comment_id=comment_id,
            preview=body,
        )
