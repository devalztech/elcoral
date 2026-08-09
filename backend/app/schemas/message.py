"""Direct-messaging schemas (see app/routers/messages.py)."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.media_url import media_ref_to_url
from app.schemas.social import PersonOut


def _kind_for(mime: str | None) -> str:
    """Coarse bucket the UI switches on: image / video / audio / file."""
    value = (mime or "").lower()
    if value.startswith("image/"):
        return "image"
    if value.startswith("video/"):
        return "video"
    if value.startswith("audio/"):
        return "audio"
    return "file"


class MessageAttachmentOut(BaseModel):
    """
    One attached file, already resolved to a fetchable URL. `kind` is
    derived server-side from the stored MIME type so every client renders
    the same thing rather than sniffing the ref.
    """

    url: str
    mime_type: str | None = None
    kind: str = "file"
    name: str | None = None


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    # Nullable since a voice note / photo / document needs no caption.
    body: str | None = None
    # Kept for backwards compatibility with anything already reading it.
    media_urls: list[str] = []
    attachments: list[MessageAttachmentOut] = []
    created_at: datetime
    is_mine: bool = False
    # True once the other participant's last_read_at is at or past this
    # message — the "seen" tick. Only ever meaningful on your own messages.
    is_read: bool = False

    @staticmethod
    def from_model(message, viewer_id=None, other_last_read_at=None) -> "MessageOut":
        refs = list(message.media_refs or [])
        types = list(getattr(message, "media_types", None) or [])
        attachments = [
            MessageAttachmentOut(
                url=media_ref_to_url(ref),
                mime_type=types[i] if i < len(types) else None,
                kind=_kind_for(types[i] if i < len(types) else None),
            )
            for i, ref in enumerate(refs)
        ]
        is_mine = viewer_id is not None and message.sender_id == viewer_id
        is_read = bool(
            is_mine and other_last_read_at is not None and other_last_read_at >= message.created_at
        )
        return MessageOut(
            id=message.id,
            conversation_id=message.conversation_id,
            sender_id=message.sender_id,
            body=message.body,
            media_urls=[a.url for a in attachments],
            attachments=attachments,
            created_at=message.created_at,
            is_mine=is_mine,
            is_read=is_read,
        )


class ConversationOut(BaseModel):
    id: uuid.UUID
    # 1:1 today, so the inbox renders "the other person".
    participant: PersonOut
    last_message: MessageOut | None = None
    unread_count: int = 0
    last_message_at: datetime
    # Presence for the other participant (see app/core/presence.py).
    is_online: bool = False
    last_seen_at: datetime | None = None


class ConversationListOut(BaseModel):
    items: list[ConversationOut]
    unread_total: int


class MessageListOut(BaseModel):
    items: list[MessageOut]
    participant: PersonOut
    next_cursor: datetime | None = None
    is_online: bool = False
    last_seen_at: datetime | None = None
    # How far the other person has read, so the thread can draw ticks on
    # messages that arrived before this timestamp.
    other_last_read_at: datetime | None = None


class StartConversationRequest(BaseModel):
    model_config = {"extra": "forbid"}

    username: str = Field(min_length=1, max_length=30)


class MessageCreateRequest(BaseModel):
    model_config = {"extra": "forbid"}

    # Optional now: media-only messages are valid. The model validator
    # below still rejects a message that is empty in every respect.
    body: str | None = Field(default=None, max_length=4000)
    media_refs: list[str] = Field(default_factory=list, max_length=10)
    media_types: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("body")
    @classmethod
    def strip_body(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("media_refs", "media_types", mode="before")
    @classmethod
    def coerce_list(cls, v):
        return v or []

    @model_validator(mode="after")
    def not_empty(self):
        if not self.body and not self.media_refs:
            raise ValueError("Message cannot be empty")
        return self


class UnreadCountOut(BaseModel):
    unread_total: int
