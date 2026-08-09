"""
Direct messages.

Endpoints
---------
GET    /api/messages/conversations            inbox, newest activity first
POST   /api/messages/conversations            find-or-create a 1:1 thread
GET    /api/messages/conversations/{id}       thread history (cursor-paged)
POST   /api/messages/conversations/{id}       send a message
POST   /api/messages/conversations/{id}/read  mark thread read
GET    /api/messages/unread-count             badge counter

Realtime lives next door in app/routers/messages_ws.py. Exactly like
community chat, the socket is receive-only: sending is always this POST,
which owns validation and persistence and then fans the saved message out
to both participants through app/core/presence.py. Typing indicators and
read receipts are the two things that never touch the database on the way
in, so those do travel up the socket.

Authorization: every thread route re-checks that the caller is actually
a participant, so a guessed conversation id is a 404, never a leak.
Blocks are checked at send/create time — an existing thread stays
readable, but neither side can push new messages into it once blocked.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.presence import presence
from app.models.message import Conversation, ConversationParticipant, Message, pair_key_for
from app.models.profile import Profile
from app.models.user import User
from app.routers.settings import is_blocked_between
from app.routers.social import follow_flags, resolve_user_by_username
from app.schemas.message import (
    ConversationListOut,
    ConversationOut,
    MessageCreateRequest,
    MessageListOut,
    MessageOut,
    StartConversationRequest,
    UnreadCountOut,
)
from app.schemas.social import PersonOut

router = APIRouter(prefix="/api/messages", tags=["messages"])

PAGE_SIZE = 40


async def _require_participant(db: AsyncSession, conversation_id: uuid.UUID, user_id) -> Conversation:
    row = await db.scalar(
        select(Conversation)
        .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
        .where(Conversation.id == conversation_id, ConversationParticipant.user_id == user_id)
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return row


async def _other_participant(db: AsyncSession, conversation_id, viewer_id) -> tuple[User, Profile | None]:
    row = (
        await db.execute(
            select(User, Profile)
            .join(ConversationParticipant, ConversationParticipant.user_id == User.id)
            .outerjoin(Profile, Profile.user_id == User.id)
            .where(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id != viewer_id,
            )
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return row[0], row[1]


async def _other_last_read_at(db: AsyncSession, conversation_id, viewer_id) -> datetime | None:
    return await db.scalar(
        select(ConversationParticipant.last_read_at).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id != viewer_id,
        )
    )


def _presence_for(user: User) -> tuple[bool, datetime | None]:
    """
    Live flag from the in-process registry, falling back to the persisted
    column so "last seen" survives an API restart.
    """
    online = presence.is_online(user.id)
    last_seen = presence.last_seen(user.id) or getattr(user, "last_seen_at", None)
    return online, (None if online else last_seen)


async def _unread_for(db: AsyncSession, conversation_id, viewer_id, last_read_at) -> int:
    query = select(func.count(Message.id)).where(
        Message.conversation_id == conversation_id, Message.sender_id != viewer_id
    )
    if last_read_at is not None:
        query = query.where(Message.created_at > last_read_at)
    return (await db.scalar(query)) or 0


async def _unread_total(db: AsyncSession, viewer_id) -> int:
    """
    Number of CONVERSATIONS with at least one unread message — not the
    number of unread messages. The badge is per conversation, so twenty
    messages from one person still count as one.
    """
    rows = (
        await db.execute(
            select(ConversationParticipant.conversation_id, ConversationParticipant.last_read_at).where(
                ConversationParticipant.user_id == viewer_id
            )
        )
    ).all()
    total = 0
    for conversation_id, last_read_at in rows:
        if await _unread_for(db, conversation_id, viewer_id, last_read_at) > 0:
            total += 1
    return total


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return UnreadCountOut(unread_total=await _unread_total(db, viewer.id))


@router.get("/conversations", response_model=ConversationListOut)
async def list_conversations(
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mine = aliased(ConversationParticipant)
    rows = (
        await db.execute(
            select(Conversation, mine.last_read_at)
            .join(mine, and_(mine.conversation_id == Conversation.id, mine.user_id == viewer.id))
            .order_by(Conversation.last_message_at.desc())
            .limit(100)
        )
    ).all()

    items: list[ConversationOut] = []
    unread_total = 0
    for conversation, last_read_at in rows:
        try:
            other, other_profile = await _other_participant(db, conversation.id, viewer.id)
        except HTTPException:
            # Other participant's account was deleted — skip the orphan
            # rather than 500-ing the whole inbox.
            continue

        last_message = await db.scalar(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        # An empty thread (created but never used) shouldn't clutter the inbox.
        if last_message is None:
            continue

        unread = await _unread_for(db, conversation.id, viewer.id, last_read_at)
        # One badge per conversation, regardless of how many messages wait.
        if unread > 0:
            unread_total += 1
        is_following, follows_you = await follow_flags(db, viewer.id, other.id)
        online, seen_at = _presence_for(other)

        items.append(
            ConversationOut(
                id=conversation.id,
                participant=PersonOut.from_user(
                    other, other_profile, is_following=is_following, follows_you=follows_you
                ),
                last_message=MessageOut.from_model(
                    last_message,
                    viewer.id,
                    await _other_last_read_at(db, conversation.id, viewer.id),
                ),
                unread_count=unread,
                last_message_at=conversation.last_message_at,
                is_online=online,
                last_seen_at=seen_at,
            )
        )

    return ConversationListOut(items=items, unread_total=unread_total)


@router.post("/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def start_conversation(
    payload: StartConversationRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Find-or-create. The unique `pair_key` means two simultaneous taps of
    "Message" can't produce two threads — the loser of the race just
    re-reads the winner's row.
    """
    target, target_profile = await resolve_user_by_username(db, payload.username)
    if target.id == viewer.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="You can't message yourself"
        )
    if await is_blocked_between(db, viewer.id, target.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    key = pair_key_for(viewer.id, target.id)
    conversation = await db.scalar(select(Conversation).where(Conversation.pair_key == key))

    if conversation is None:
        conversation = Conversation(pair_key=key)
        db.add(conversation)
        try:
            await db.flush()
            db.add(ConversationParticipant(conversation_id=conversation.id, user_id=viewer.id))
            db.add(ConversationParticipant(conversation_id=conversation.id, user_id=target.id))
            await db.commit()
        except Exception:
            await db.rollback()
            conversation = await db.scalar(select(Conversation).where(Conversation.pair_key == key))
            if conversation is None:
                raise
        else:
            await db.refresh(conversation)

    last_message = await db.scalar(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    is_following, follows_you = await follow_flags(db, viewer.id, target.id)
    online, seen_at = _presence_for(target)

    return ConversationOut(
        id=conversation.id,
        participant=PersonOut.from_user(
            target, target_profile, is_following=is_following, follows_you=follows_you
        ),
        last_message=MessageOut.from_model(last_message, viewer.id) if last_message else None,
        unread_count=0,
        last_message_at=conversation.last_message_at,
        is_online=online,
        last_seen_at=seen_at,
    )


@router.get("/conversations/{conversation_id}", response_model=MessageListOut)
async def list_messages(
    conversation_id: uuid.UUID,
    cursor: datetime | None = Query(default=None, description="Return messages older than this"),
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_participant(db, conversation_id, viewer.id)
    other, other_profile = await _other_participant(db, conversation_id, viewer.id)

    query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(PAGE_SIZE + 1)
    )
    if cursor is not None:
        query = query.where(Message.created_at < cursor)

    rows = list((await db.scalars(query)).all())
    has_more = len(rows) > PAGE_SIZE
    rows = rows[:PAGE_SIZE]
    next_cursor = rows[-1].created_at if (has_more and rows) else None

    is_following, follows_you = await follow_flags(db, viewer.id, other.id)
    their_read_at = await _other_last_read_at(db, conversation_id, viewer.id)
    online, seen_at = _presence_for(other)

    # Oldest-first for rendering: the transport pages backwards, the UI
    # reads forwards.
    return MessageListOut(
        items=[MessageOut.from_model(m, viewer.id, their_read_at) for m in reversed(rows)],
        participant=PersonOut.from_user(
            other, other_profile, is_following=is_following, follows_you=follows_you
        ),
        next_cursor=next_cursor,
        is_online=online,
        last_seen_at=seen_at,
        other_last_read_at=their_read_at,
    )


@router.post(
    "/conversations/{conversation_id}", response_model=MessageOut, status_code=status.HTTP_201_CREATED
)
async def send_message(
    conversation_id: uuid.UUID,
    payload: MessageCreateRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation = await _require_participant(db, conversation_id, viewer.id)
    other, _ = await _other_participant(db, conversation_id, viewer.id)

    if await is_blocked_between(db, viewer.id, other.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You can no longer message this member."
        )

    message = Message(
        conversation_id=conversation_id,
        sender_id=viewer.id,
        body=payload.body,
        media_refs=payload.media_refs or None,
        media_types=payload.media_types or None,
    )
    db.add(message)
    conversation.last_message_at = datetime.now(timezone.utc)

    # Sending is an implicit read of everything before it.
    my_row = await db.scalar(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == viewer.id,
        )
    )
    if my_row is not None:
        my_row.last_read_at = conversation.last_message_at

    await db.commit()
    await db.refresh(message)

    their_read_at = await _other_last_read_at(db, conversation_id, viewer.id)
    mine = MessageOut.from_model(message, viewer.id, their_read_at)

    # Fan out live. Each side gets the message serialized from their own
    # point of view so `is_mine` is correct without the client patching it.
    await presence.send(
        other.id,
        {
            "type": "message",
            "conversation_id": str(conversation_id),
            "message": MessageOut.from_model(message, other.id, None).model_dump(mode="json"),
            "unread_total": await _unread_total(db, other.id),
        },
    )
    # Echo to the sender's other devices (not the tab that just posted —
    # it already has the response — but a duplicate id is easy to dedupe).
    await presence.send(
        viewer.id,
        {
            "type": "message",
            "conversation_id": str(conversation_id),
            "message": mine.model_dump(mode="json"),
        },
    )
    return mine


@router.post("/conversations/{conversation_id}/read", response_model=UnreadCountOut)
async def mark_read(
    conversation_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_participant(db, conversation_id, viewer.id)
    row = await db.scalar(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == viewer.id,
        )
    )
    if row is not None:
        row.last_read_at = datetime.now(timezone.utc)
        await db.commit()
        try:
            other, _ = await _other_participant(db, conversation_id, viewer.id)
        except HTTPException:
            other = None
        if other is not None:
            await presence.send(
                other.id,
                {
                    "type": "read",
                    "conversation_id": str(conversation_id),
                    "user_id": str(viewer.id),
                    "at": row.last_read_at.isoformat(),
                },
            )
    return UnreadCountOut(unread_total=await _unread_total(db, viewer.id))
