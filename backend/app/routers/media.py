from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials

from app.core import telegram_storage
from app.core.deps import bearer_scheme, get_current_user
from app.core.file_validation import (
    MAX_UPLOAD_BYTES,
    FileValidationError,
    validate_upload,
)
from app.core.limiter import limiter
from app.core.media_url import (
    MEDIA_SESSION_COOKIE,
    read_media_session,
    verify_media_signature,
)
from app.core.security import decode_token
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

# Read ceiling. Per-category ceilings (much tighter for images/docs) live
# in app/core/file_validation.py and are applied by validate_upload().
_READ_CHUNK = 1024 * 1024


@router.post("/upload")
@limiter.limit("60/minute")
async def upload_media(
    request: Request,
    file: UploadFile,
    user: User = Depends(get_current_user),
):
    # Browsers tack codec parameters onto recorded audio/video
    # ("audio/webm;codecs=opus"); match on the bare type.
    #
    # NOTE: this is only the *claimed* type. It is never trusted on its
    # own — validate_upload() below re-derives the real type from the
    # bytes and rejects any mismatch, BEFORE anything reaches Telegram.
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {content_type or file.content_type}",
        )

    # Read with a hard cap instead of slurping the whole body: an oversized
    # upload is refused after one chunk past the limit rather than being
    # fully buffered first.
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_READ_CHUNK)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File too large (max 200MB)",
            )
        chunks.append(chunk)
    file_bytes = b"".join(chunks)

    try:
        stored_type = validate_upload(file_bytes, content_type, file.filename)
    except FileValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(e)
        )

    try:
        result = await telegram_storage.upload(file_bytes, file.filename or "upload", stored_type)
    except TelegramStorageError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    return {"ref": result.ref, "mime_type": result.mime_type, "size_bytes": result.size_bytes}


def _requester_id(request: Request, credentials: HTTPAuthorizationCredentials | None) -> str | None:
    """
    Who is asking, for the purposes of the media route only.

    Prefers a bearer token (native clients, fetch()); falls back to the
    httponly media_session cookie, which is the only credential a browser
    can attach to an <img src> / <video src> request.
    """
    if credentials is not None:
        payload = decode_token(credentials.credentials)
        if payload and payload.get("type") == "access":
            return str(payload.get("sub"))
    return read_media_session(request.cookies.get(MEDIA_SESSION_COOKIE))


@router.get("/{ref}")
@limiter.limit("300/minute")
async def get_media(
    request: Request,
    ref: str,
    exp: int | None = Query(default=None),
    sig: str | None = Query(default=None),
    aud: str | None = Query(default=None, max_length=64),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    """
    Serve a stored file. Two gates, both applied BEFORE anything is
    fetched from Telegram:

    1. Signature. The URL must have been signed by this server for this
       exact ref (and audience) and must not have expired. A storage ref
       is never a credential on its own — refs are short sequential
       Telegram message ids, so without this anyone could enumerate
       /api/media/1..N.
    2. Audience. Private material (DM attachments, community chat /
       discussion / project media) is signed with `aud=<user id>`: the
       caller must prove they are that user, via bearer token or the
       httponly media_session cookie. A private link copied out of one
       account is therefore useless in another. Public post and profile
       media is signed without an audience and stays openly embeddable,
       exactly as before.

    The signed URL is only ever minted while serializing an object the
    caller was already authorized to see, so the endpoint-level checks in
    posts/messages/communities remain the source of truth for
    deleted, private and unpublished content.
    """
    audience = (aud or "").strip()

    if not verify_media_signature(ref, exp, sig, audience):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This media link is invalid or has expired",
        )

    if audience:
        requester = _requester_id(request, credentials)
        if requester is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sign in to view this media",
            )
        if requester != audience:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to view this media",
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
            "Content-Disposition": "inline",
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
    )
