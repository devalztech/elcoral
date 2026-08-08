"""Direct-messaging schemas (see app/routers/messages.py)."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.media_url import media_ref_to_url
from app.schemas.social import PersonOut


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    body: str
    media_urls: list[str] = []
    created_at: datetime
    is_mine: bool = False

    @staticmethod
    def from_model(message, viewer_id=None) -> "MessageOut":
        return MessageOut(
            id=message.id,
            conversation_id=message.conversation_id,
            sender_id=message.sender_id,
            body=message.body,
            media_urls=[media_ref_to_url(r) for r in (message.media_refs or [])],
            created_at=message.created_at,
            is_mine=viewer_id is not None and message.sender_id == viewer_id,
        )


class ConversationOut(BaseModel):
    id: uuid.UUID
    # 1:1 today, so the inbox renders "the other person".
    participant: PersonOut
    last_message: MessageOut | None = None
    unread_count: int = 0
    last_message_at: datetime


class ConversationListOut(BaseModel):
    items: list[ConversationOut]
    unread_total: int


class MessageListOut(BaseModel):
    items: list[MessageOut]
    participant: PersonOut
    next_cursor: datetime | None = None


class StartConversationRequest(BaseModel):
    model_config = {"extra": "forbid"}

    username: str = Field(min_length=1, max_length=30)


class MessageCreateRequest(BaseModel):
    model_config = {"extra": "forbid"}

    body: str = Field(min_length=1, max_length=4000)
    media_refs: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("body")
    @classmethod
    def strip_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        return v


class UnreadCountOut(BaseModel):
    unread_total: int
