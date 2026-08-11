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
from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.presence import presence
from app.models.message import (
    Conversation,
    ConversationParticipant,
    Message,
    MessageDeletion,
    MessageReaction,
    pair_key_for,
)
from app.models.profile import Profile
from app.models.user import User
from app.routers.settings import is_blocked_between
from app.routers.social import follow_flags, resolve_user_by_username
from app.schemas.message import (
    ConversationListOut,
    ConversationOut,
    ForwardRequest,
    ForwardResultOut,
    MessageCreateRequest,
    MessageListOut,
    MessageOut,
    ReactionRequest,
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


async def _hidden_ids(db: AsyncSession, viewer_id, message_ids: list) -> set:
    """Messages this person deleted for themselves only."""
    if not message_ids:
        return set()
    rows = await db.execute(
        select(MessageDeletion.message_id).where(
            MessageDeletion.user_id == viewer_id, MessageDeletion.message_id.in_(message_ids)
        )
    )
    return set(rows.scalars().all())


async def _reload_message(db: AsyncSession, message_id) -> Message | None:
    """
    Re-select so the selectin relationships (reactions, reply_to) are
    populated — a freshly flushed object has neither, and touching them
    lazily is an error under asyncio.
    """
    # populate_existing forces the eager loaders to run again even when the
    # row is already in the identity map — without it a just-flushed
    # message comes back with `reactions` / `reply_to` still unloaded and
    # touching them raises MissingGreenlet.
    return await db.scalar(
        select(Message)
        .options(selectinload(Message.reactions), selectinload(Message.reply_to))
        .where(Message.id == message_id)
        .execution_options(populate_existing=True)
    )


async def _require_message(db: AsyncSession, message_id, viewer_id) -> Message:
    message = await _reload_message(db, message_id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    await _require_participant(db, message.conversation_id, viewer_id)
    return message


async def _broadcast_update(db: AsyncSession, message: Message, viewer_id) -> None:
    """Push the message's new state to both sides, each from their own POV."""
    try:
        other, _ = await _other_participant(db, message.conversation_id, viewer_id)
    except HTTPException:
        return
    for person_id in (viewer_id, other.id):
        await presence.send(
            person_id,
            {
                "type": "message_update",
                "conversation_id": str(message.conversation_id),
                "message": MessageOut.from_model(message, person_id, None).model_dump(mode="json"),
            },
        )


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
            .options(selectinload(Message.reactions), selectinload(Message.reply_to))
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc())
            .limit(1)
            .execution_options(populate_existing=True)
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
        .options(selectinload(Message.reactions), selectinload(Message.reply_to))
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(1)
        .execution_options(populate_existing=True)
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
        # Eager-load BOTH relationships the serializer reads. Without this
        # the quoted reply strip and the reaction chips come back empty on
        # every history load (serialization never lazy-loads: under asyncio
        # that would raise MissingGreenlet), so a reply looked fine when it
        # was sent and lost its quote the moment the thread was re-opened.
        .options(selectinload(Message.reactions), selectinload(Message.reply_to))
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(PAGE_SIZE + 1)
        .execution_options(populate_existing=True)
    )

    if cursor is not None:
        query = query.where(Message.created_at < cursor)

    rows = list((await db.scalars(query)).all())
    has_more = len(rows) > PAGE_SIZE
    rows = rows[:PAGE_SIZE]
    # "Delete for me" is per person, so it is filtered on read rather
    # than removing anything the other participant still has.
    hidden = await _hidden_ids(db, viewer.id, [m.id for m in rows])
    rows = [m for m in rows if m.id not in hidden]
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

    reply_to_id = None
    if payload.reply_to_id is not None:
        parent = await db.scalar(
            select(Message.id).where(
                Message.id == payload.reply_to_id, Message.conversation_id == conversation_id
            )
        )
        if parent is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="You can only reply to a message in this conversation.",
            )
        reply_to_id = parent

    message = Message(
        conversation_id=conversation_id,
        sender_id=viewer.id,
        body=payload.body,
        media_refs=payload.media_refs or None,
        media_types=payload.media_types or None,
        reply_to_id=reply_to_id,
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
    message = await _reload_message(db, message.id)

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


# ------------------------------------------------------- message actions ----
# These sit under /messages/messages/{id} rather than under the
# conversation, because the client always has the message id to hand and
# the conversation is derived from it anyway (and re-checked).


@router.put("/messages/{message_id}/reaction", response_model=MessageOut)
async def react_to_message(
    message_id: uuid.UUID,
    payload: ReactionRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Set (or replace) your reaction. One emoji per person per message, so
    tapping a different one swaps it instead of stacking.
    """
    message = await _require_message(db, message_id, viewer.id)
    if message.deleted_for_all:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This message was deleted.")

    existing = await db.scalar(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id, MessageReaction.user_id == viewer.id
        )
    )
    if existing is None:
        db.add(MessageReaction(message_id=message_id, user_id=viewer.id, emoji=payload.emoji))
    elif existing.emoji == payload.emoji:
        # Tapping the same emoji again clears it — the toggle people expect.
        await db.delete(existing)
    else:
        existing.emoji = payload.emoji
    await db.commit()

    message = await _reload_message(db, message_id)
    await _broadcast_update(db, message, viewer.id)
    return MessageOut.from_model(message, viewer.id, await _other_last_read_at(db, message.conversation_id, viewer.id))


@router.delete("/messages/{message_id}/reaction", response_model=MessageOut)
async def clear_reaction(
    message_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await _require_message(db, message_id, viewer.id)
    await db.execute(
        delete(MessageReaction).where(
            MessageReaction.message_id == message_id, MessageReaction.user_id == viewer.id
        )
    )
    await db.commit()

    message = await _reload_message(db, message_id)
    await _broadcast_update(db, message, viewer.id)
    return MessageOut.from_model(message, viewer.id, None)


@router.delete("/messages/{message_id}", status_code=status.HTTP_200_OK)
async def delete_message(
    message_id: uuid.UUID,
    scope: str = Query(default="self", pattern="^(self|everyone)$"),
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    scope=self      hide it for me only (the other side keeps their copy)
    scope=everyone  tombstone it for both — only the sender may do this
    """
    message = await _require_message(db, message_id, viewer.id)

    if scope == "everyone":
        if message.sender_id != viewer.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own message for everyone.",
            )
        message.deleted_for_all = True
        message.deleted_at = datetime.now(timezone.utc)
        message.body = None
        message.media_refs = None
        message.media_types = None
        await db.execute(delete(MessageReaction).where(MessageReaction.message_id == message_id))
        await db.commit()
        fresh = await _reload_message(db, message_id)
        await _broadcast_update(db, fresh, viewer.id)
        return {"deleted": "everyone", "message_id": str(message_id)}

    already = await db.scalar(
        select(MessageDeletion.id).where(
            MessageDeletion.message_id == message_id, MessageDeletion.user_id == viewer.id
        )
    )
    if already is None:
        db.add(MessageDeletion(message_id=message_id, user_id=viewer.id))
        await db.commit()
    return {"deleted": "self", "message_id": str(message_id)}


@router.post("/messages/{message_id}/forward", response_model=ForwardResultOut)
async def forward_message(
    message_id: uuid.UUID,
    payload: ForwardRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Copy a message into other threads. Each destination gets its OWN new
    message row (not a pointer), so deleting the original later leaves
    the forwarded copies alone.
    """
    source = await _require_message(db, message_id, viewer.id)
    if source.deleted_for_all:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This message was deleted.")

    targets: list[uuid.UUID] = []

    for conversation_id in payload.conversation_ids:
        await _require_participant(db, conversation_id, viewer.id)
        targets.append(conversation_id)

    # Usernames: find-or-create the 1:1 thread, exactly like tapping
    # "Message" on someone's profile does.
    for username in payload.usernames:
        target_user, _ = await resolve_user_by_username(db, username)
        if target_user.id == viewer.id:
            continue
        if await is_blocked_between(db, viewer.id, target_user.id):
            continue
        key = pair_key_for(viewer.id, target_user.id)
        conversation = await db.scalar(select(Conversation).where(Conversation.pair_key == key))
        if conversation is None:
            conversation = Conversation(pair_key=key)
            db.add(conversation)
            await db.flush()
            db.add(ConversationParticipant(conversation_id=conversation.id, user_id=viewer.id))
            db.add(ConversationParticipant(conversation_id=conversation.id, user_id=target_user.id))
            await db.flush()
        targets.append(conversation.id)

    if not targets:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Pick someone to forward to."
        )

    now = datetime.now(timezone.utc)
    created: list[tuple[uuid.UUID, uuid.UUID]] = []
    seen: set[uuid.UUID] = set()
    for conversation_id in targets:
        if conversation_id in seen:
            continue
        seen.add(conversation_id)
        other, _ = await _other_participant(db, conversation_id, viewer.id)
        if await is_blocked_between(db, viewer.id, other.id):
            continue
        copy = Message(
            conversation_id=conversation_id,
            sender_id=viewer.id,
            body=source.body,
            media_refs=list(source.media_refs or []) or None,
            media_types=list(source.media_types or []) or None,
            is_forwarded=True,
        )
        db.add(copy)
        conversation = await db.get(Conversation, conversation_id)
        if conversation is not None:
            conversation.last_message_at = now
        await db.flush()
        created.append((conversation_id, copy.id))

    await db.commit()

    for conversation_id, copy_id in created:
        fresh = await _reload_message(db, copy_id)
        if fresh is None:
            continue
        other, _ = await _other_participant(db, conversation_id, viewer.id)
        await presence.send(
            other.id,
            {
                "type": "message",
                "conversation_id": str(conversation_id),
                "message": MessageOut.from_model(fresh, other.id, None).model_dump(mode="json"),
                "unread_total": await _unread_total(db, other.id),
            },
        )
        await presence.send(
            viewer.id,
            {
                "type": "message",
                "conversation_id": str(conversation_id),
                "message": MessageOut.from_model(fresh, viewer.id, None).model_dump(mode="json"),
            },
        )

    return ForwardResultOut(sent=len(created), conversation_ids=[c for c, _ in created])
