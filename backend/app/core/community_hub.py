"""
In-process pub/sub for community chat.

Deliberately not Redis: the API runs as a single container today (see
DEPLOY.md), so a per-process fan-out is correct and adds no
infrastructure. `hub` is the only thing the rest of the app touches, so
swapping the implementation for Redis pub/sub later is a change to this
file alone.
"""
import asyncio
from collections import defaultdict


class Hub:
    def __init__(self) -> None:
        # room key (community id) -> set of per-connection queues
        self._rooms: dict[str, set[asyncio.Queue]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe(self, room: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._rooms[room].add(queue)
        return queue

    async def unsubscribe(self, room: str, queue: asyncio.Queue) -> None:
        async with self._lock:
            self._rooms.get(room, set()).discard(queue)
            if not self._rooms.get(room):
                self._rooms.pop(room, None)

    async def broadcast(self, room: str, payload: dict) -> None:
        async with self._lock:
            queues = list(self._rooms.get(room, ()))
        for queue in queues:
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                # A stalled client must never block the sender's request.
                pass


hub = Hub()
