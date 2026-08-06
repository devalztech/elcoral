from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import Response

from app.core import telegram_storage
from app.core.deps import get_current_user
from app.core.telegram_storage import TelegramStorageError
from app.models.user import User

router = APIRouter(prefix="/api/media", tags=["media"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"}
MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200MB — well under Telethon's ~2GB ceiling, generous for a first pass


@router.post("/upload")
async def upload_media(
    file: UploadFile,
    user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 200MB)",
        )

    try:
        result = await telegram_storage.upload(file_bytes, file.filename or "upload", file.content_type)
    except TelegramStorageError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    return {"ref": result.ref, "mime_type": result.mime_type, "size_bytes": result.size_bytes}


@router.get("/{ref}")
async def get_media(ref: str):
    # Deliberately no auth check here — media URLs are embedded directly in
    # <img>/<video> tags, which browsers request without custom headers, so
    # requiring a bearer token here wouldn't work anyway. Refs are opaque
    # message ids, not guessable/enumerable in any useful way, and nothing
    # sensitive should be stored this way (this is public profile/post
    # media, not private DMs — DMs will need their own auth-checked route
    # when that's built).
    try:
        file_bytes, mime_type = await telegram_storage.download(ref)
    except TelegramStorageError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    return Response(content=file_bytes, media_type=mime_type)
