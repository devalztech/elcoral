"""
Community chat WebSocket.

    ws://<api>/api/communities/ws/{slug}?token=<access token>

The access token is passed as a query param because browsers cannot set
an Authorization header on a WebSocket handshake. It is the same short-
lived access JWT used everywhere else and is validated here before the
socket is accepted; membership and the community's chat policy are then
re-checked server-side, exactly as the REST endpoints do.

The socket is read-only for the client: sending is done through
POST /api/communities/{slug}/messages, which owns validation, rate
limiting and persistence, then fans out through the hub.
"""
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core import community_perms as perms
from app.core.community_hub import hub
from app.core.database import AsyncSessionLocal
from app.core.security import decode_token
from app.models.community import Community
from app.models.user import User

router = APIRouter(prefix="/api/communities", tags=["communities"])


@router.websocket("/ws/{slug}")
async def community_chat_socket(websocket: WebSocket, slug: str, token: str = Query(default="")):
    payload = decode_token(token) if token else None
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4401)
        return

    async with AsyncSessionLocal() as db:
        user = await db.get(User, payload["sub"])
        if user is None or not user.is_active:
            await websocket.close(code=4401)
            return

        community = await db.scalar(select(Community).where(Community.slug == slug.strip().lower()))
        if community is None:
            await websocket.close(code=4404)
            return

        _, caps = await perms.load(db, community, user.id)
        if not caps.is_member or caps.is_banned or not community.chat_enabled:
            await websocket.close(code=4403)
            return
        room = str(community.id)

    await websocket.accept()
    queue = await hub.subscribe(room)
    try:
        while True:
            event = await queue.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await hub.unsubscribe(room, queue)
