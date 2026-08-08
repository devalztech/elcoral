"""
Communities: groups, membership and discussions.

Endpoints
---------
GET    /api/communities                          list (scope/topic/search)
GET    /api/communities/options                  topics + tones vocabulary
POST   /api/communities                          create (creator becomes owner)
GET    /api/communities/{slug}                   one community
PATCH  /api/communities/{slug}                   owner/admin edit
POST   /api/communities/{slug}/join              join
DELETE /api/communities/{slug}/join              leave
GET    /api/communities/{slug}/members           member list
GET    /api/communities/discussions              cross-community discussion feed
GET    /api/communities/{slug}/discussions       discussions in one community
POST   /api/communities/{slug}/discussions       post a discussion (members only)
GET    /api/communities/discussions/{id}         single discussion (+view count)
DELETE /api/communities/discussions/{id}         author/owner delete
POST   /api/communities/discussions/{id}/like    toggle like on
DELETE /api/communities/discussions/{id}/like    toggle like off
POST   /api/communities/discussions/{id}/save    toggle save on
DELETE /api/communities/discussions/{id}/save    toggle save off
GET    /api/communities/discussions/{id}/comments
POST   /api/communities/discussions/{id}/comments

Route ordering matters: the literal `/discussions` and `/options` paths
are declared before `/{slug}`, otherwise FastAPI would match them as a
community slug.
"""
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.core.media_url import media_ref_to_url
from app.models.community import (
    COMMUNITY_TONES,
    COMMUNITY_TOPICS,
    Community,
    CommunityMember,
    CommunityRole,
    Discussion,
    DiscussionComment,
    DiscussionLike,
    DiscussionSave,
)
from app.models.profile import Profile
from app.models.user import User
from app.schemas.community import (
    CommunityCreateRequest,
    CommunityListOut,
    CommunityOptionsOut,
    CommunityOut,
    CommunityRefOut,
    CommunityUpdateRequest,
    DiscussionCommentCreateRequest,
    DiscussionCommentOut,
    DiscussionCreateRequest,
    DiscussionListOut,
    DiscussionOut,
)
from app.schemas.social import PersonListOut, PersonOut

router = APIRouter(prefix="/api/communities", tags=["communities"])

PAGE_SIZE = 20

RESERVED_SLUGS = {"discussions", "options", "mine", "trending", "discover", "search", "new"}


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return (base or "community")[:50]


async def _unique_slug(db: AsyncSession, name: str) -> str:
    base = _slugify(name)
    if base in RESERVED_SLUGS:
        base = f"{base}-community"
    slug = base
    n = 2
    while await db.scalar(select(Community.id).where(Community.slug == slug)) is not None:
        slug = f"{base}-{n}"
        n += 1
        if n > 200:  # pathological; give up on prettiness, stay unique
            slug = f"{base}-{uuid.uuid4().hex[:6]}"
            break
    return slug


async def _get_community(db: AsyncSession, slug: str) -> Community:
    community = await db.scalar(select(Community).where(Community.slug == slug.strip().lower()))
    if community is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")
    return community


async def _membership(db: AsyncSession, community_id, user_id) -> CommunityMember | None:
    if user_id is None:
        return None
    return await db.scalar(
        select(CommunityMember).where(
            CommunityMember.community_id == community_id, CommunityMember.user_id == user_id
        )
    )


async def _counts_for(db: AsyncSession, community_ids: list[uuid.UUID]):
    """One grouped query per metric instead of three per community."""
    if not community_ids:
        return {}, {}, {}

    since = datetime.now(timezone.utc) - timedelta(hours=24)

    members = dict(
        (
            await db.execute(
                select(CommunityMember.community_id, func.count(CommunityMember.id))
                .where(CommunityMember.community_id.in_(community_ids))
                .group_by(CommunityMember.community_id)
            )
        ).all()
    )
    fresh = dict(
        (
            await db.execute(
                select(CommunityMember.community_id, func.count(CommunityMember.id))
                .where(
                    CommunityMember.community_id.in_(community_ids),
                    CommunityMember.created_at >= since,
                )
                .group_by(CommunityMember.community_id)
            )
        ).all()
    )
    discussions = dict(
        (
            await db.execute(
                select(Discussion.community_id, func.count(Discussion.id))
                .where(Discussion.community_id.in_(community_ids))
                .group_by(Discussion.community_id)
            )
        ).all()
    )
    return members, fresh, discussions


async def _serialize_communities(
    db: AsyncSession, communities: list[Community], viewer: User | None
) -> list[CommunityOut]:
    ids = [c.id for c in communities]
    members, fresh, discussions = await _counts_for(db, ids)

    my_roles: dict[uuid.UUID, str] = {}
    if viewer is not None and ids:
        rows = (
            await db.execute(
                select(CommunityMember.community_id, CommunityMember.role).where(
                    CommunityMember.user_id == viewer.id, CommunityMember.community_id.in_(ids)
                )
            )
        ).all()
        my_roles = {cid: role.value if hasattr(role, "value") else str(role) for cid, role in rows}

    return [
        CommunityOut.from_model(
            c,
            members_count=members.get(c.id, 0),
            new_today=fresh.get(c.id, 0),
            discussions_count=discussions.get(c.id, 0),
            is_member=c.id in my_roles,
            is_owner=viewer is not None and c.owner_id == viewer.id,
            role=my_roles.get(c.id),
        )
        for c in communities
    ]


def _community_ref(community: Community) -> CommunityRefOut:
    return CommunityRefOut(
        id=community.id,
        slug=community.slug,
        name=community.name,
        tone=community.tone,
        glyph=community.glyph,
        icon_url=media_ref_to_url(community.icon_ref),
    )


async def _serialize_discussions(
    db: AsyncSession, rows: list[tuple[Discussion, Community, User, Profile | None]], viewer: User | None
) -> list[DiscussionOut]:
    ids = [d.id for d, *_ in rows]
    if not ids:
        return []

    likes = dict(
        (
            await db.execute(
                select(DiscussionLike.discussion_id, func.count(DiscussionLike.id))
                .where(DiscussionLike.discussion_id.in_(ids))
                .group_by(DiscussionLike.discussion_id)
            )
        ).all()
    )
    comments = dict(
        (
            await db.execute(
                select(DiscussionComment.discussion_id, func.count(DiscussionComment.id))
                .where(DiscussionComment.discussion_id.in_(ids))
                .group_by(DiscussionComment.discussion_id)
            )
        ).all()
    )

    my_likes: set[uuid.UUID] = set()
    my_saves: set[uuid.UUID] = set()
    if viewer is not None:
        my_likes = {
            r[0]
            for r in (
                await db.execute(
                    select(DiscussionLike.discussion_id).where(
                        DiscussionLike.user_id == viewer.id, DiscussionLike.discussion_id.in_(ids)
                    )
                )
            ).all()
        }
        my_saves = {
            r[0]
            for r in (
                await db.execute(
                    select(DiscussionSave.discussion_id).where(
                        DiscussionSave.user_id == viewer.id, DiscussionSave.discussion_id.in_(ids)
                    )
                )
            ).all()
        }

    return [
        DiscussionOut(
            id=d.id,
            title=d.title,
            body=d.body,
            created_at=d.created_at,
            view_count=d.view_count,
            author=PersonOut.from_user(author, profile),
            community=_community_ref(community),
            likes_count=likes.get(d.id, 0),
            comments_count=comments.get(d.id, 0),
            is_liked=d.id in my_likes,
            is_saved=d.id in my_saves,
            can_delete=viewer is not None
            and (d.author_id == viewer.id or community.owner_id == viewer.id),
        )
        for d, community, author, profile in rows
    ]


def _discussion_query():
    return (
        select(Discussion, Community, User, Profile)
        .join(Community, Community.id == Discussion.community_id)
        .join(User, User.id == Discussion.author_id)
        .outerjoin(Profile, Profile.user_id == User.id)
    )


# --------------------------------------------------------------- options ---


@router.get("/options", response_model=CommunityOptionsOut)
async def community_options():
    return CommunityOptionsOut(topics=COMMUNITY_TOPICS, tones=COMMUNITY_TONES)


# --------------------------------------------------- cross-community feed ---


@router.get("/discussions", response_model=DiscussionListOut)
async def list_all_discussions(
    scope: str = Query(default="top", pattern="^(top|latest|mine|saved)$"),
    topic: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=PAGE_SIZE, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    "Top discussions" on the Communities screen. `top` ranks by
    engagement (likes + comments) over the last 30 days so the section
    stays alive; `latest` is plain reverse-chronological.
    """
    query = _discussion_query().where(Community.is_private.is_(False))
    count_query = (
        select(func.count(Discussion.id))
        .join(Community, Community.id == Discussion.community_id)
        .where(Community.is_private.is_(False))
    )

    if topic and topic in COMMUNITY_TOPICS:
        query = query.where(Community.topic == topic)
        count_query = count_query.where(Community.topic == topic)

    if q:
        pattern = f"%{q.strip().lower()}%"
        cond = or_(func.lower(Discussion.title).like(pattern), func.lower(Community.name).like(pattern))
        query = query.where(cond)
        count_query = count_query.where(cond)

    if scope in ("mine", "saved"):
        if viewer is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        if scope == "mine":
            member_ids = select(CommunityMember.community_id).where(CommunityMember.user_id == viewer.id)
            query = query.where(Discussion.community_id.in_(member_ids))
            count_query = count_query.where(Discussion.community_id.in_(member_ids))
        else:
            saved_ids = select(DiscussionSave.discussion_id).where(DiscussionSave.user_id == viewer.id)
            query = query.where(Discussion.id.in_(saved_ids))
            count_query = count_query.where(Discussion.id.in_(saved_ids))

    if scope == "top":
        since = datetime.now(timezone.utc) - timedelta(days=30)
        like_count = (
            select(func.count(DiscussionLike.id))
            .where(DiscussionLike.discussion_id == Discussion.id)
            .scalar_subquery()
        )
        comment_count = (
            select(func.count(DiscussionComment.id))
            .where(DiscussionComment.discussion_id == Discussion.id)
            .scalar_subquery()
        )
        query = query.where(Discussion.created_at >= since).order_by(
            (like_count + comment_count).desc(), Discussion.created_at.desc()
        )
    else:
        query = query.order_by(Discussion.created_at.desc())

    rows = (await db.execute(query.limit(limit).offset(offset))).all()

    # `top` is time-boxed; if the last 30 days are empty, fall back to the
    # all-time latest so a young instance doesn't show an empty section.
    if scope == "top" and not rows and offset == 0:
        rows = (
            await db.execute(
                _discussion_query()
                .where(Community.is_private.is_(False))
                .order_by(Discussion.created_at.desc())
                .limit(limit)
            )
        ).all()

    total = (await db.scalar(count_query)) or 0
    items = await _serialize_discussions(db, [tuple(r) for r in rows], viewer)
    return DiscussionListOut(items=items, total=total)


# ------------------------------------------------------- community lists ---


@router.get("", response_model=CommunityListOut)
async def list_communities(
    scope: str = Query(default="all", pattern="^(all|mine|trending|for_you|discover)$"),
    topic: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=PAGE_SIZE, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Community)
    count_query = select(func.count(Community.id))

    # Private communities are only listed to their own members.
    if viewer is None:
        visibility = Community.is_private.is_(False)
    else:
        my_ids = select(CommunityMember.community_id).where(CommunityMember.user_id == viewer.id)
        visibility = or_(Community.is_private.is_(False), Community.id.in_(my_ids))
    query = query.where(visibility)
    count_query = count_query.where(visibility)

    if scope == "mine":
        if viewer is None:
            return CommunityListOut(items=[], total=0)
        my_ids = select(CommunityMember.community_id).where(CommunityMember.user_id == viewer.id)
        query = query.where(Community.id.in_(my_ids))
        count_query = count_query.where(Community.id.in_(my_ids))

    if scope in ("trending", "discover", "for_you") and viewer is not None and scope != "for_you":
        joined = select(CommunityMember.community_id).where(CommunityMember.user_id == viewer.id)
        query = query.where(Community.id.not_in(joined))
        count_query = count_query.where(Community.id.not_in(joined))

    if topic and topic in COMMUNITY_TOPICS:
        query = query.where(Community.topic == topic)
        count_query = count_query.where(Community.topic == topic)

    if q:
        pattern = f"%{q.strip().lower()}%"
        cond = or_(
            func.lower(Community.name).like(pattern),
            func.lower(func.coalesce(Community.description, "")).like(pattern),
        )
        query = query.where(cond)
        count_query = count_query.where(cond)

    if scope in ("trending", "for_you", "discover"):
        member_count = (
            select(func.count(CommunityMember.id))
            .where(CommunityMember.community_id == Community.id)
            .scalar_subquery()
        )
        query = query.order_by(member_count.desc(), Community.created_at.desc())
    elif scope == "mine":
        # Official space first (it's everyone's home community), then
        # biggest first — matches how the design's rail reads.
        member_count = (
            select(func.count(CommunityMember.id))
            .where(CommunityMember.community_id == Community.id)
            .scalar_subquery()
        )
        query = query.order_by(Community.is_official.desc(), member_count.desc())
    else:
        query = query.order_by(Community.is_official.desc(), Community.created_at.desc())

    communities = list((await db.scalars(query.limit(limit).offset(offset))).all())
    total = (await db.scalar(count_query)) or 0
    return CommunityListOut(items=await _serialize_communities(db, communities, viewer), total=total)


@router.post("", response_model=CommunityOut, status_code=status.HTTP_201_CREATED)
async def create_community(
    payload: CommunityCreateRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    community = Community(
        slug=await _unique_slug(db, payload.name),
        name=payload.name,
        description=payload.description,
        topic=payload.topic,
        tone=payload.tone,
        glyph=payload.glyph,
        icon_ref=payload.icon_ref,
        cover_ref=payload.cover_ref,
        is_private=payload.is_private,
        owner_id=viewer.id,
    )
    db.add(community)
    await db.flush()
    db.add(
        CommunityMember(community_id=community.id, user_id=viewer.id, role=CommunityRole.owner)
    )
    await db.commit()
    await db.refresh(community)
    return (await _serialize_communities(db, [community], viewer))[0]


# --------------------------------------------------------- one community ---


@router.get("/{slug}", response_model=CommunityOut)
async def get_community(
    slug: str,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    community = await _get_community(db, slug)
    if community.is_private and await _membership(db, community.id, viewer.id if viewer else None) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")
    return (await _serialize_communities(db, [community], viewer))[0]


@router.patch("/{slug}", response_model=CommunityOut)
async def update_community(
    slug: str,
    payload: CommunityUpdateRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    community = await _get_community(db, slug)
    membership = await _membership(db, community.id, viewer.id)
    is_admin = membership is not None and membership.role in (CommunityRole.owner, CommunityRole.admin)
    if community.owner_id != viewer.id and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(community, field, value)
    await db.commit()
    await db.refresh(community)
    return (await _serialize_communities(db, [community], viewer))[0]


@router.post("/{slug}/join", response_model=CommunityOut, status_code=status.HTTP_201_CREATED)
async def join_community(
    slug: str,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    community = await _get_community(db, slug)
    if community.is_private:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This community is invite-only."
        )
    if await _membership(db, community.id, viewer.id) is None:
        db.add(CommunityMember(community_id=community.id, user_id=viewer.id))
        await db.commit()
    return (await _serialize_communities(db, [community], viewer))[0]


@router.delete("/{slug}/join", response_model=CommunityOut)
async def leave_community(
    slug: str,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    community = await _get_community(db, slug)
    membership = await _membership(db, community.id, viewer.id)
    if membership is not None:
        if membership.role == CommunityRole.owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Transfer ownership before leaving your own community.",
            )
        await db.delete(membership)
        await db.commit()
    return (await _serialize_communities(db, [community], viewer))[0]


@router.get("/{slug}/members", response_model=PersonListOut)
async def list_members(
    slug: str,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    community = await _get_community(db, slug)
    if community.is_private and await _membership(db, community.id, viewer.id if viewer else None) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

    rows = (
        await db.execute(
            select(User, Profile)
            .join(CommunityMember, CommunityMember.user_id == User.id)
            .outerjoin(Profile, Profile.user_id == User.id)
            .where(CommunityMember.community_id == community.id, User.is_active.is_(True))
            .order_by(CommunityMember.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    total = (
        await db.scalar(
            select(func.count(CommunityMember.id)).where(CommunityMember.community_id == community.id)
        )
    ) or 0
    return PersonListOut(
        items=[
            PersonOut.from_user(user, profile, is_self=viewer is not None and user.id == viewer.id)
            for user, profile in rows
        ],
        total=total,
    )


# ------------------------------------------------------------ discussions ---


@router.get("/{slug}/discussions", response_model=DiscussionListOut)
async def list_community_discussions(
    slug: str,
    limit: int = Query(default=PAGE_SIZE, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    community = await _get_community(db, slug)
    if community.is_private and await _membership(db, community.id, viewer.id if viewer else None) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

    rows = (
        await db.execute(
            _discussion_query()
            .where(Discussion.community_id == community.id)
            .order_by(Discussion.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    total = (
        await db.scalar(
            select(func.count(Discussion.id)).where(Discussion.community_id == community.id)
        )
    ) or 0
    return DiscussionListOut(
        items=await _serialize_discussions(db, [tuple(r) for r in rows], viewer), total=total
    )


@router.post("/{slug}/discussions", response_model=DiscussionOut, status_code=status.HTTP_201_CREATED)
async def create_discussion(
    slug: str,
    payload: DiscussionCreateRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    community = await _get_community(db, slug)
    if await _membership(db, community.id, viewer.id) is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Join this community to start a discussion."
        )

    discussion = Discussion(
        community_id=community.id, author_id=viewer.id, title=payload.title, body=payload.body
    )
    db.add(discussion)
    await db.commit()
    await db.refresh(discussion)

    profile = await db.scalar(select(Profile).where(Profile.user_id == viewer.id))
    return (
        await _serialize_discussions(db, [(discussion, community, viewer, profile)], viewer)
    )[0]


async def _load_discussion(db: AsyncSession, discussion_id: uuid.UUID, viewer: User | None):
    row = (
        await db.execute(_discussion_query().where(Discussion.id == discussion_id))
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")
    discussion, community, author, profile = row
    if community.is_private and await _membership(db, community.id, viewer.id if viewer else None) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")
    return discussion, community, author, profile


@router.get("/discussions/{discussion_id}", response_model=DiscussionOut)
async def get_discussion(
    discussion_id: uuid.UUID,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    discussion, community, author, profile = await _load_discussion(db, discussion_id, viewer)
    discussion.view_count = (discussion.view_count or 0) + 1
    await db.commit()
    return (await _serialize_discussions(db, [(discussion, community, author, profile)], viewer))[0]


@router.delete("/discussions/{discussion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_discussion(
    discussion_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    discussion, community, _, _ = await _load_discussion(db, discussion_id, viewer)
    if discussion.author_id != viewer.id and community.owner_id != viewer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    await db.delete(discussion)
    await db.commit()


async def _toggle(db: AsyncSession, model, discussion_id, user_id, *, on: bool):
    existing = await db.scalar(
        select(model).where(model.discussion_id == discussion_id, model.user_id == user_id)
    )
    if on and existing is None:
        db.add(model(discussion_id=discussion_id, user_id=user_id))
        await db.commit()
    elif not on and existing is not None:
        await db.delete(existing)
        await db.commit()


@router.post("/discussions/{discussion_id}/like", response_model=DiscussionOut)
async def like_discussion(
    discussion_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    discussion, community, author, profile = await _load_discussion(db, discussion_id, viewer)
    await _toggle(db, DiscussionLike, discussion.id, viewer.id, on=True)
    return (await _serialize_discussions(db, [(discussion, community, author, profile)], viewer))[0]


@router.delete("/discussions/{discussion_id}/like", response_model=DiscussionOut)
async def unlike_discussion(
    discussion_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    discussion, community, author, profile = await _load_discussion(db, discussion_id, viewer)
    await _toggle(db, DiscussionLike, discussion.id, viewer.id, on=False)
    return (await _serialize_discussions(db, [(discussion, community, author, profile)], viewer))[0]


@router.post("/discussions/{discussion_id}/save", response_model=DiscussionOut)
async def save_discussion(
    discussion_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    discussion, community, author, profile = await _load_discussion(db, discussion_id, viewer)
    await _toggle(db, DiscussionSave, discussion.id, viewer.id, on=True)
    return (await _serialize_discussions(db, [(discussion, community, author, profile)], viewer))[0]


@router.delete("/discussions/{discussion_id}/save", response_model=DiscussionOut)
async def unsave_discussion(
    discussion_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    discussion, community, author, profile = await _load_discussion(db, discussion_id, viewer)
    await _toggle(db, DiscussionSave, discussion.id, viewer.id, on=False)
    return (await _serialize_discussions(db, [(discussion, community, author, profile)], viewer))[0]


@router.get("/discussions/{discussion_id}/comments", response_model=list[DiscussionCommentOut])
async def list_discussion_comments(
    discussion_id: uuid.UUID,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    await _load_discussion(db, discussion_id, viewer)
    rows = (
        await db.execute(
            select(DiscussionComment, User, Profile)
            .join(User, User.id == DiscussionComment.author_id)
            .outerjoin(Profile, Profile.user_id == User.id)
            .where(DiscussionComment.discussion_id == discussion_id)
            .order_by(DiscussionComment.created_at.asc())
            .limit(200)
        )
    ).all()
    return [
        DiscussionCommentOut(
            id=comment.id,
            body=comment.body,
            created_at=comment.created_at,
            author=PersonOut.from_user(author, profile),
            can_delete=viewer is not None and comment.author_id == viewer.id,
        )
        for comment, author, profile in rows
    ]


@router.post(
    "/discussions/{discussion_id}/comments",
    response_model=DiscussionCommentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_discussion_comment(
    discussion_id: uuid.UUID,
    payload: DiscussionCommentCreateRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _, community, _, _ = await _load_discussion(db, discussion_id, viewer)
    if await _membership(db, community.id, viewer.id) is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Join this community to reply."
        )

    comment = DiscussionComment(discussion_id=discussion_id, author_id=viewer.id, body=payload.body)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    profile = await db.scalar(select(Profile).where(Profile.user_id == viewer.id))
    return DiscussionCommentOut(
        id=comment.id,
        body=comment.body,
        created_at=comment.created_at,
        author=PersonOut.from_user(viewer, profile),
        can_delete=True,
    )
