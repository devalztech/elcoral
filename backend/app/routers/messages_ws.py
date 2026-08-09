"""
Direct-message WebSocket: realtime delivery, typing, presence, receipts.

    ws://<api>/api/messages/ws?token=<access token>

One socket per signed-in person, not one per conversation: the inbox
badge, the thread you have open, and the online dot next to someone's
avatar are all fed by the same connection. The access token travels as a
query param because browsers cannot set an Authorization header on a
WebSocket handshake; it is the same short-lived access JWT used
everywhere else and is validated before the socket is accepted.

Server -> client events
-----------------------
{"type": "ready", "online": [user ids currently online among your contacts]}
{"type": "message", "conversation_id": ..., "message": {...MessageOut}, "unread_total"?: n}
{"type": "typing", "conversation_id": ..., "user_id": ..., "state": true|false}
{"type": "read", "conversation_id": ..., "user_id": ..., "at": iso}
{"type": "presence", "user_id": ..., "online": bool, "last_seen_at": iso|null}
{"type": "pong"}

Client -> server events
-----------------------
{"type": "typing", "conversation_id": ..., "state": true|false}
{"type": "read", "conversation_id": ...}
{"type": "ping"}

Sending a message is NOT one of them — that stays POST
/api/messages/conversations/{id}, which owns validation and persistence
and then fans the saved row out through app/core/presence.py.

Close codes: 4401 = missing/expired/!access token (do not reconnect).
"""
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.presence import presence
from app.core.security import decode_token
from app.models.message import Conversation, ConversationParticipant
from app.models.user import User

router = APIRouter(prefix="/api/messages", tags=["messages"])

# A typing flag the client forgets to clear (tab closed mid-sentence)
# must not leave the other side showing "typing…" forever; the frontend
# also expires it locally, this is the server-side belt.
TYPING_TTL_SECONDS = 8


async def _contact_ids(db: AsyncSession, user_id) -> list[str]:
    """Everyone this person shares a conversation with."""
    mine = select(ConversationParticipant.conversation_id).where(
        ConversationParticipant.user_id == user_id
    )
    rows = await db.execute(
        select(ConversationParticipant.user_id).where(
            ConversationParticipant.conversation_id.in_(mine),
            ConversationParticipant.user_id != user_id,
        )
    )
    return [str(r[0]) for r in rows.all()]


async def _is_participant(db: AsyncSession, conversation_id, user_id) -> bool:
    row = await db.scalar(
        select(ConversationParticipant.id).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
    )
    return row is not None


async def _other_id(db: AsyncSession, conversation_id, user_id):
    return await db.scalar(
        select(ConversationParticipant.user_id).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id != user_id,
        )
    )


async def _touch_last_seen(user_id) -> datetime:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if user is not None:
            user.last_seen_at = now
            await db.commit()
    presence.touch(user_id)
    return now


@router.websocket("/ws")
async def direct_message_socket(websocket: WebSocket, token: str = Query(default="")):
    payload = decode_token(token) if token else None
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4401)
        return

    async with AsyncSessionLocal() as db:
        user = await db.get(User, payload["sub"])
        if user is None or not user.is_active:
            await websocket.close(code=4401)
            return
        user_id = user.id
        contacts = await _contact_ids(db, user_id)

    await websocket.accept()
    queue, became_online = await presence.connect(str(user_id))
    await _touch_last_seen(user_id)

    if became_online:
        await presence.send_many(
            contacts,
            {"type": "presence", "user_id": str(user_id), "online": True, "last_seen_at": None},
        )

    await websocket.send_json(
        {"type": "ready", "online": [cid for cid in contacts if presence.is_online(cid)]}
    )

    async def pump_outgoing():
        while True:
            event = await queue.get()
            await websocket.send_json(event)

    async def pump_incoming():
        while True:
            event = await websocket.receive_json()
            kind = event.get("type")

            if kind == "ping":
                presence.touch(user_id)
                await websocket.send_json({"type": "pong"})
                continue

            if kind not in {"typing", "read"}:
                continue

            conversation_id = event.get("conversation_id")
            if not conversation_id:
                continue

            async with AsyncSessionLocal() as db:
                try:
                    conversation = await db.get(Conversation, conversation_id)
                except Exception:
                    continue
                if conversation is None or not await _is_participant(db, conversation.id, user_id):
                    # Same rule as the REST routes: a guessed id is simply
                    # ignored, never an error that confirms it exists.
                    continue
                other = await _other_id(db, conversation.id, user_id)
                if other is None:
                    continue

                if kind == "typing":
                    await presence.send(
                        other,
                        {
                            "type": "typing",
                            "conversation_id": str(conversation.id),
                            "user_id": str(user_id),
                            "state": bool(event.get("state")),
                            "ttl": TYPING_TTL_SECONDS,
                        },
                    )
                else:
                    row = await db.scalar(
                        select(ConversationParticipant).where(
                            ConversationParticipant.conversation_id == conversation.id,
                            ConversationParticipant.user_id == user_id,
                        )
                    )
                    if row is None:
                        continue
                    row.last_read_at = datetime.now(timezone.utc)
                    await db.commit()
                    await presence.send(
                        other,
                        {
                            "type": "read",
                            "conversation_id": str(conversation.id),
                            "user_id": str(user_id),
                            "at": row.last_read_at.isoformat(),
                        },
                    )

    outgoing = asyncio.create_task(pump_outgoing())
    incoming = asyncio.create_task(pump_incoming())
    try:
        done, pending = await asyncio.wait(
            {outgoing, incoming}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        outgoing.cancel()
        incoming.cancel()
        went_offline = await presence.disconnect(str(user_id), queue)
        if went_offline:
            seen_at = await _touch_last_seen(user_id)
            await presence.send_many(
                contacts,
                {
                    "type": "presence",
                    "user_id": str(user_id),
                    "online": False,
                    "last_seen_at": seen_at.isoformat(),
                },
            )
