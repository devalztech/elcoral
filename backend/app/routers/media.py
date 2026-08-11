from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import Response

from app.core import telegram_storage
from app.core.deps import get_current_user
from app.core.media_url import verify_media_signature
from app.core.telegram_storage import TelegramStorageError
from app.models.user import User

router = APIRouter(prefix="/api/media", tags=["media"])

ALLOWED_TYPES = {
    # images
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/heic",
    "image/heif",
    # video
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-matroska",
    # audio (voice notes / clips attached to a post)
    "audio/mpeg",
    "audio/mp4",
    "audio/webm",
    "audio/ogg",
    "audio/wav",
    "audio/aac",
    "audio/flac",
    "audio/x-m4a",
    # documents shared in chat or attached to a post/article
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/rtf",
    "application/zip",
    "application/x-zip-compressed",
    "text/plain",
    "text/csv",
    "text/markdown",
}
MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200MB — well under Telethon's ~2GB ceiling, generous for a first pass


@router.post("/upload")
async def upload_media(
    file: UploadFile,
    user: User = Depends(get_current_user),
):
    # Browsers tack codec parameters onto recorded audio/video
    # ("audio/webm;codecs=opus"); match on the bare type.
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {content_type or file.content_type}",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 200MB)",
        )

    try:
        result = await telegram_storage.upload(file_bytes, file.filename or "upload", content_type)
    except TelegramStorageError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    return {"ref": result.ref, "mime_type": result.mime_type, "size_bytes": result.size_bytes}


@router.get("/{ref}")
async def get_media(
    ref: str,
    exp: int | None = Query(default=None),
    sig: str | None = Query(default=None),
):
    """
    Serve a stored file, but only to someone holding a URL this server
    signed (see app/core/media_url.py).

    A bearer token cannot be used here — browsers request <img src> without
    custom headers — so the capability lives in the URL itself. Storage refs
    are short sequential ids, so the signature is what stops an attacker
    from enumerating /api/media/1..N and pulling other users' private chat
    photos. Signatures expire, so a leaked link does not last forever.
    """
    if not verify_media_signature(ref, exp, sig):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This media link is invalid or has expired",
        )

    try:
        file_bytes, mime_type = await telegram_storage.download(ref)
    except TelegramStorageError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    return Response(
        content=file_bytes,
        media_type=mime_type,
        headers={
            # Private: a shared cache must never hand one user's chat photo
            # to the next requester of the same URL.
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
            # Never let an uploaded file execute in our origin.
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
    )
