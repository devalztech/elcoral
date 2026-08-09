"""
Posts: composer + feed + engagement (likes, comments, reposts, saves, polls).

Counts are derived with COUNT(*) against the engagement tables rather than
denormalised counters on `posts` — same reasoning as the follow graph in
app/routers/social.py: a counted index scan stays correct, a counter drifts
the first time a row is deleted outside the API.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user, require_verified
from app.models.post import Post, PostComment, PostLike, PostPollVote, PostRepost, PostSave
from app.models.profile import Profile
from app.models.social import Follow
from app.models.user import User
from app.schemas.post import (
    CommentCreateRequest,
    CommentOut,
    PollVoteRequest,
    PostAuthorOut,
    PostCreateRequest,
    PostEngagementOut,
    PostOut,
    PostUpdateRequest,
    RepostRequest,
)

router = APIRouter(prefix="/api/posts", tags=["posts"])

PAGE_SIZE = 20


def _base_query():
    # selectinload avoids N+1 queries for author + author.profile on every
    # post in the feed — one extra query per relationship instead of one
    # per post.
    return select(Post).options(selectinload(Post.author).selectinload(User.profile))


async def _following_ids(db: AsyncSession, viewer_id) -> set[uuid.UUID]:
    if viewer_id is None:
        return set()
    rows = await db.execute(select(Follow.following_id).where(Follow.follower_id == viewer_id))
    return set(rows.scalars().all())


async def _stats_for(db: AsyncSession, post_ids: list[uuid.UUID], viewer_id) -> dict:
    """One query per engagement type for the whole page, not per post."""
    if not post_ids:
        return {}

    stats = {pid: {"likes": 0, "comments": 0, "reposts": 0} for pid in post_ids}

    for key, model in (("likes", PostLike), ("comments", PostComment), ("reposts", PostRepost)):
        rows = await db.execute(
            select(model.post_id, func.count()).where(model.post_id.in_(post_ids)).group_by(model.post_id)
        )
        for pid, count in rows.all():
            stats[pid][key] = count

    if viewer_id is not None:
        for key, model in (("liked", PostLike), ("reposted", PostRepost), ("saved", PostSave)):
            rows = await db.execute(
                select(model.post_id).where(model.post_id.in_(post_ids), model.user_id == viewer_id)
            )
            for pid in rows.scalars().all():
                stats[pid][key] = True

    return stats


async def _poll_data(db: AsyncSession, posts: list[Post], viewer_id):
    poll_ids = [p.id for p in posts if p.poll_options]
    counts: dict[uuid.UUID, dict[int, int]] = {}
    my_votes: dict[uuid.UUID, int] = {}
    if not poll_ids:
        return counts, my_votes

    rows = await db.execute(
        select(PostPollVote.post_id, PostPollVote.option_index, func.count())
        .where(PostPollVote.post_id.in_(poll_ids))
        .group_by(PostPollVote.post_id, PostPollVote.option_index)
    )
    for pid, index, count in rows.all():
        counts.setdefault(pid, {})[index] = count

    if viewer_id is not None:
        mine = await db.execute(
            select(PostPollVote.post_id, PostPollVote.option_index).where(
                PostPollVote.post_id.in_(poll_ids), PostPollVote.user_id == viewer_id
            )
        )
        my_votes = {pid: index for pid, index in mine.all()}

    return counts, my_votes


async def _serialize(db: AsyncSession, posts: list[Post], viewer_id, reposted_by=None) -> list[PostOut]:
    ids = [p.id for p in posts]
    stats = await _stats_for(db, ids, viewer_id)
    poll_counts, my_votes = await _poll_data(db, posts, viewer_id)
    reposted_by = reposted_by or {}
    return [
        PostOut.from_model(
            p,
            stats=stats.get(p.id),
            viewer_id=viewer_id,
            poll_counts=poll_counts.get(p.id),
            my_vote=my_votes.get(p.id),
            reposted_by=reposted_by.get(p.id),
        )
        for p in posts
    ]


def _visibility_filter(viewer_id, following: set[uuid.UUID]):
    """Followers-only posts are visible to the author and to their followers."""
    if viewer_id is None:
        return Post.visibility == "public"
    allowed = {viewer_id, *following}
    return or_(Post.visibility == "public", Post.author_id.in_(allowed))


async def _load_post(db: AsyncSession, post_id: uuid.UUID) -> Post:
    result = await db.execute(_base_query().where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return post


async def _engagement(db: AsyncSession, post_id: uuid.UUID, viewer_id) -> PostEngagementOut:
    stats = (await _stats_for(db, [post_id], viewer_id)).get(post_id, {})
    return PostEngagementOut(
        post_id=post_id,
        like_count=int(stats.get("likes", 0)),
        comment_count=int(stats.get("comments", 0)),
        repost_count=int(stats.get("reposts", 0)),
        liked_by_me=bool(stats.get("liked")),
        reposted_by_me=bool(stats.get("reposted")),
        saved_by_me=bool(stats.get("saved")),
    )


# ----------------------------------------------------------------- compose ----


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: PostCreateRequest,
    user: User = Depends(require_verified),
    db: AsyncSession = Depends(get_db),
):
    if payload.kind == "poll" and len(payload.poll_options) < 2:
        raise HTTPException(status_code=400, detail="A poll needs at least two options.")
    if payload.kind == "media" and not payload.media_refs:
        raise HTTPException(status_code=400, detail="Attach at least one image or video.")
    if payload.kind == "article" and not (payload.title or "").strip():
        raise HTTPException(status_code=400, detail="An article needs a title.")

    post = Post(
        author_id=user.id,
        kind=payload.kind,
        title=(payload.title or None),
        body=payload.body,
        media_refs=payload.media_refs or None,
        media_types=payload.media_types or None,
        tags=payload.tags or None,
        link_url=payload.link_url or None,
        visibility=payload.visibility,
        poll_options=payload.poll_options or None,
    )
    db.add(post)
    await db.commit()

    post = await _load_post(db, post.id)
    return (await _serialize(db, [post], user.id))[0]


@router.patch("/{post_id}", response_model=PostOut)
async def edit_post(
    post_id: uuid.UUID,
    payload: PostUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _load_post(db, post_id)
    if post.author_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your post")

    post.title = payload.title or None
    post.body = payload.body
    post.tags = payload.tags or None
    post.visibility = payload.visibility
    post.edited_at = func.now()
    await db.commit()

    post = await _load_post(db, post_id)
    return (await _serialize(db, [post], user.id))[0]


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _load_post(db, post_id)
    if post.author_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your post")
    await db.delete(post)
    await db.commit()


# -------------------------------------------------------------------- feed ----


@router.get("", response_model=list[PostOut])
async def list_feed(
    cursor: uuid.UUID | None = Query(default=None, description="Post id to page before"),
    username: str | None = Query(default=None, description="Only posts authored by this username"),
    tab: str = Query(default="for-you", pattern="^(for-you|following|media|articles|saved)$"),
    tag: str | None = Query(default=None, max_length=40),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Reverse-chronological feed, cursor-paginated by (created_at, id).

    `username` narrows it to one author (how a profile page loads posts),
    `tab` switches between everything, people you follow, media only,
    articles only, and your saved posts.
    """
    viewer_id = viewer.id if viewer else None
    following = await _following_ids(db, viewer_id)

    query = (
        _base_query()
        .where(_visibility_filter(viewer_id, following))
        .order_by(Post.created_at.desc(), Post.id.desc())
        .limit(PAGE_SIZE)
    )

    if username:
        author_id = await db.scalar(
            select(Profile.user_id).where(func.lower(Profile.username) == username.strip().lower())
        )
        if author_id is None:
            # Unknown handle: an empty list beats a 404 here, since the
            # profile page already 404s on the profile request itself.
            return []
        query = query.where(Post.author_id == author_id)

    if tab == "following":
        if viewer_id is None:
            return []
        query = query.where(Post.author_id.in_({*following, viewer_id}))
    elif tab == "media":
        query = query.where(Post.media_refs.is_not(None))
    elif tab == "articles":
        query = query.where(Post.kind == "article")
    elif tab == "saved":
        if viewer_id is None:
            return []
        saved = select(PostSave.post_id).where(PostSave.user_id == viewer_id)
        query = query.where(Post.id.in_(saved))

    if tag:
        query = query.where(Post.tags.any(tag.strip().lstrip("#").lower()))

    if cursor is not None:
        cursor_post = await db.get(Post, cursor)
        if cursor_post is not None:
            query = query.where(
                or_(
                    Post.created_at < cursor_post.created_at,
                    (Post.created_at == cursor_post.created_at) & (Post.id < cursor_post.id),
                )
            )

    posts = (await db.execute(query)).scalars().all()
    return await _serialize(db, list(posts), viewer_id)


@router.get("/search", response_model=list[PostOut])
async def search_posts(
    q: str = Query(min_length=1, max_length=200),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Basic substring search over post body/title and author name/headline/company.
    Good enough for launch; swap for full-text search (Postgres tsvector or
    an external index) once volume justifies it.
    """
    viewer_id = viewer.id if viewer else None
    following = await _following_ids(db, viewer_id)
    like = f"%{q}%"
    query = (
        _base_query()
        .join(User, Post.author_id == User.id)
        .outerjoin(Profile, Profile.user_id == User.id)
        .where(
            _visibility_filter(viewer_id, following),
            or_(
                Post.body.ilike(like),
                Post.title.ilike(like),
                Post.tags.any(q.strip().lstrip("#").lower()),
                User.full_name.ilike(like),
                Profile.headline.ilike(like),
                Profile.company_name.ilike(like),
                Profile.skills.any(q),
            ),
        )
        .order_by(Post.created_at.desc())
        .limit(PAGE_SIZE)
    )
    posts = (await db.execute(query)).scalars().unique().all()
    return await _serialize(db, list(posts), viewer_id)


@router.get("/{post_id}", response_model=PostOut)
async def get_post(
    post_id: uuid.UUID,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _load_post(db, post_id)
    viewer_id = viewer.id if viewer else None
    if post.visibility != "public" and post.author_id != viewer_id:
        following = await _following_ids(db, viewer_id)
        if post.author_id not in following:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return (await _serialize(db, [post], viewer_id))[0]


# -------------------------------------------------------------- engagement ----


@router.post("/{post_id}/like", response_model=PostEngagementOut, status_code=status.HTTP_201_CREATED)
async def like_post(
    post_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _load_post(db, post_id)
    exists = await db.scalar(
        select(PostLike.id).where(PostLike.post_id == post_id, PostLike.user_id == user.id)
    )
    if exists is None:
        db.add(PostLike(post_id=post_id, user_id=user.id))
        await db.commit()
    return await _engagement(db, post_id, user.id)


@router.delete("/{post_id}/like", response_model=PostEngagementOut)
async def unlike_post(
    post_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user.id))
    await db.commit()
    return await _engagement(db, post_id, user.id)


@router.post("/{post_id}/repost", response_model=PostEngagementOut, status_code=status.HTTP_201_CREATED)
async def repost(
    post_id: uuid.UUID,
    payload: RepostRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _load_post(db, post_id)
    existing = await db.scalar(
        select(PostRepost).where(PostRepost.post_id == post_id, PostRepost.user_id == user.id)
    )
    if existing is None:
        db.add(PostRepost(post_id=post_id, user_id=user.id, quote=(payload.quote if payload else None)))
    elif payload and payload.quote:
        existing.quote = payload.quote
    await db.commit()
    return await _engagement(db, post_id, user.id)


@router.delete("/{post_id}/repost", response_model=PostEngagementOut)
async def undo_repost(
    post_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(PostRepost).where(PostRepost.post_id == post_id, PostRepost.user_id == user.id))
    await db.commit()
    return await _engagement(db, post_id, user.id)


@router.post("/{post_id}/save", response_model=PostEngagementOut, status_code=status.HTTP_201_CREATED)
async def save_post(
    post_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _load_post(db, post_id)
    exists = await db.scalar(
        select(PostSave.id).where(PostSave.post_id == post_id, PostSave.user_id == user.id)
    )
    if exists is None:
        db.add(PostSave(post_id=post_id, user_id=user.id))
        await db.commit()
    return await _engagement(db, post_id, user.id)


@router.delete("/{post_id}/save", response_model=PostEngagementOut)
async def unsave_post(
    post_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(PostSave).where(PostSave.post_id == post_id, PostSave.user_id == user.id))
    await db.commit()
    return await _engagement(db, post_id, user.id)


@router.post("/{post_id}/poll/vote", response_model=PostOut)
async def vote_poll(
    post_id: uuid.UUID,
    payload: PollVoteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await _load_post(db, post_id)
    options = post.poll_options or []
    if not options:
        raise HTTPException(status_code=400, detail="This post isn't a poll.")
    if payload.option_index >= len(options):
        raise HTTPException(status_code=400, detail="Unknown poll option.")

    existing = await db.scalar(
        select(PostPollVote).where(PostPollVote.post_id == post_id, PostPollVote.user_id == user.id)
    )
    if existing is None:
        db.add(PostPollVote(post_id=post_id, user_id=user.id, option_index=payload.option_index))
    else:
        existing.option_index = payload.option_index
    await db.commit()

    return (await _serialize(db, [post], user.id))[0]


# ---------------------------------------------------------------- comments ----


@router.get("/{post_id}/comments", response_model=list[CommentOut])
async def list_comments(
    post_id: uuid.UUID,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    await _load_post(db, post_id)
    rows = await db.execute(
        select(PostComment)
        .options(selectinload(PostComment.author).selectinload(User.profile))
        .where(PostComment.post_id == post_id)
        .order_by(PostComment.created_at.asc())
        .limit(200)
    )
    viewer_id = viewer.id if viewer else None
    comments = list(rows.scalars().all())
    # Reply counts are computed here so the client can render
    # "View N replies" without loading a thread it may never open.
    reply_counts: dict = {}
    for c in comments:
        if c.parent_id is not None:
            reply_counts[c.parent_id] = reply_counts.get(c.parent_id, 0) + 1
    return [
        CommentOut.from_model(c, viewer_id, reply_counts.get(c.id, 0)) for c in comments
    ]


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment(
    post_id: uuid.UUID,
    payload: CommentCreateRequest,
    user: User = Depends(require_verified),
    db: AsyncSession = Depends(get_db),
):
    await _load_post(db, post_id)

    body = (payload.body or "").strip()
    if not body and not payload.media_ref:
        raise HTTPException(status_code=400, detail="Write something or attach a photo.")

    if payload.parent_id is not None:
        parent = await db.get(PostComment, payload.parent_id)
        if parent is None or parent.post_id != post_id:
            raise HTTPException(status_code=400, detail="Unknown comment to reply to.")
        # One level of threading only — a reply to a reply attaches to the
        # same top-level comment so threads stay readable on mobile.
        if parent.parent_id is not None:
            payload.parent_id = parent.parent_id

    comment = PostComment(
        post_id=post_id,
        author_id=user.id,
        parent_id=payload.parent_id,
        body=body or None,
        media_ref=payload.media_ref,
        media_type=payload.media_type,
    )
    db.add(comment)
    await db.commit()

    loaded = await db.execute(
        select(PostComment)
        .options(selectinload(PostComment.author).selectinload(User.profile))
        .where(PostComment.id == comment.id)
    )
    return CommentOut.from_model(loaded.scalar_one(), user.id)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = await db.get(PostComment, comment_id)
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    post = await db.get(Post, comment.post_id)
    # The comment's author can delete it; so can the post's author, who is
    # the de-facto moderator of their own thread.
    if comment.author_id != user.id and (post is None or post.author_id != user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    await db.delete(comment)
    await db.commit()


@router.get("/{post_id}/likes", response_model=list[PostAuthorOut])
async def list_likers(post_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _load_post(db, post_id)
    rows = await db.execute(
        select(User)
        .options(selectinload(User.profile))
        .join(PostLike, PostLike.user_id == User.id)
        .where(PostLike.post_id == post_id)
        .order_by(PostLike.created_at.desc())
        .limit(100)
    )
    return [PostAuthorOut.from_user(u) for u in rows.scalars().all()]
