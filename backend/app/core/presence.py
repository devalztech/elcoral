"""
Presence + direct-message fan-out.

Same reasoning as app/core/community_hub.py: the API runs as a single
container today, so an in-process registry is correct and needs no extra
infrastructure. The difference is the addressing — community chat fans
out per *room*, direct messaging fans out per *user*, because a person's
socket has to receive events for every conversation they're in (plus
presence and typing) without subscribing to each thread separately.

`presence` is the only object the rest of the app touches, so moving to
Redis pub/sub later is a change to this file alone.
"""
import asyncio
from collections import defaultdict
from datetime import datetime, timezone


class PresenceHub:
    def __init__(self) -> None:
        # user id (str) -> set of per-connection queues. A person can have
        # several sockets open (phone + laptop + two tabs); they're online
        # while at least one of them is connected.
        self._connections: dict[str, set[asyncio.Queue]] = defaultdict(set)
        # Kept in memory as well as on the user row so a heartbeat doesn't
        # cost a write per tick.
        self._last_seen: dict[str, datetime] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str) -> tuple[asyncio.Queue, bool]:
        """Register a socket. Returns (queue, became_online)."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=200)
        async with self._lock:
            was_online = bool(self._connections.get(user_id))
            self._connections[user_id].add(queue)
        return queue, not was_online

    async def disconnect(self, user_id: str, queue: asyncio.Queue) -> bool:
        """Drop a socket. Returns True when the user has no sockets left."""
        async with self._lock:
            self._connections.get(user_id, set()).discard(queue)
            if not self._connections.get(user_id):
                self._connections.pop(user_id, None)
                self._last_seen[user_id] = datetime.now(timezone.utc)
                return True
        return False

    def is_online(self, user_id) -> bool:
        return bool(self._connections.get(str(user_id)))

    def last_seen(self, user_id) -> datetime | None:
        return self._last_seen.get(str(user_id))

    def touch(self, user_id) -> None:
        self._last_seen[str(user_id)] = datetime.now(timezone.utc)

    async def send(self, user_id, payload: dict) -> None:
        """Deliver an event to every socket a single person has open."""
        key = str(user_id)
        async with self._lock:
            queues = list(self._connections.get(key, ()))
        for queue in queues:
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                # A stalled client must never block the sender's request.
                pass

    async def send_many(self, user_ids, payload: dict) -> None:
        for user_id in user_ids:
            await self.send(user_id, payload)


presence = PresenceHub()
