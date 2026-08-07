import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.post import Post
from app.models.profile import Profile
from app.models.user import User
from app.schemas.post import PostCreateRequest, PostOut

router = APIRouter(prefix="/api/posts", tags=["posts"])

PAGE_SIZE = 20


def _base_query():
    # selectinload avoids N+1 queries for author + author.profile on every
    # post in the feed — one extra query per relationship instead of one
    # per post.
    return select(Post).options(selectinload(Post.author).selectinload(User.profile))


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: PostCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = Post(author_id=user.id, body=payload.body, media_refs=payload.media_refs or None)
    db.add(post)
    await db.commit()

    result = await db.execute(_base_query().where(Post.id == post.id))
    post = result.scalar_one()
    return PostOut.from_model(post)


@router.get("", response_model=list[PostOut])
async def list_feed(
    cursor: uuid.UUID | None = Query(default=None, description="Post id to page before"),
    username: str | None = Query(
        default=None, description="Only return posts authored by this username"
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Simple reverse-chronological feed, cursor-paginated by post id (posts
    are UUIDv4 so id order isn't time order — we page by created_at with
    id as a tiebreaker instead).

    Passing `username` narrows the feed to one author, which is how a
    profile page loads that person's posts without a separate endpoint.
    """
    query = _base_query().order_by(Post.created_at.desc(), Post.id.desc()).limit(PAGE_SIZE)

    if username:
        author_id = await db.scalar(
            select(Profile.user_id).where(func.lower(Profile.username) == username.strip().lower())
        )
        if author_id is None:
            # Unknown handle: an empty list beats a 404 here, since the
            # profile page already 404s on the profile request itself.
            return []
        query = query.where(Post.author_id == author_id)

    if cursor is not None:
        cursor_post = await db.get(Post, cursor)
        if cursor_post is not None:
            query = query.where(
                or_(
                    Post.created_at < cursor_post.created_at,
                    (Post.created_at == cursor_post.created_at) & (Post.id < cursor_post.id),
                )
            )

    result = await db.execute(query)
    posts = result.scalars().all()
    return [PostOut.from_model(p) for p in posts]


@router.get("/search", response_model=list[PostOut])
async def search_posts(
    q: str = Query(min_length=1, max_length=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Basic substring search over post body and author name/headline/company.
    Good enough for launch; swap for full-text search (Postgres tsvector or
    an external index) once volume justifies it.
    """
    like = f"%{q}%"
    query = (
        _base_query()
        .join(User, Post.author_id == User.id)
        .outerjoin(Profile, Profile.user_id == User.id)
        .where(
            or_(
                Post.body.ilike(like),
                User.full_name.ilike(like),
                Profile.headline.ilike(like),
                Profile.company_name.ilike(like),
                Profile.skills.any(q),
            )
        )
        .order_by(Post.created_at.desc())
        .limit(PAGE_SIZE)
    )
    result = await db.execute(query)
    posts = result.scalars().unique().all()
    return [PostOut.from_model(p) for p in posts]


@router.get("/{post_id}", response_model=PostOut)
async def get_post(post_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(_base_query().where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return PostOut.from_model(post)
