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
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import community_perms as perms
from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.core.media_url import media_ref_to_url
from app.models.community import (
    COMMUNITY_TONES,
    COMMUNITY_TOPICS,
    POLICY_LEVELS,
    PROJECT_STATUSES,
    ROLE_RANK,
    Community,
    CommunityBan,
    CommunityMember,
    CommunityMessage,
    CommunityProject,
    CommunityProjectCollaborator,
    CommunityRole,
    Discussion,
    DiscussionComment,
    DiscussionLike,
    DiscussionSave,
)
from app.models.settings import ContentReport, ReportTargetType, REPORT_REASONS
from app.models.profile import Profile
from app.models.user import User
from app.schemas.community import (
    CommunityCreateRequest,
    CommunityMemberListOut,
    CommunityMemberOut,
    CommunityMessageCreateRequest,
    CommunityMessageListOut,
    CommunityMessageOut,
    CommunityOptionsFullOut,
    CommunityPermissionsRequest,
    CommunityProjectCreateRequest,
    CommunityProjectListOut,
    CommunityProjectOut,
    CommunityProjectUpdateRequest,
    DiscussionUpdateRequest,
    MemberRemoveRequest,
    MemberRoleRequest,
    ProjectCollaboratorDecisionRequest,
    ProjectCollaboratorOut,
    ProjectJoinRequest,
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

    my_memberships: dict[uuid.UUID, CommunityMember] = {}
    banned_ids: set[uuid.UUID] = set()
    if viewer is not None and ids:
        for m in (
            await db.scalars(
                select(CommunityMember).where(
                    CommunityMember.user_id == viewer.id, CommunityMember.community_id.in_(ids)
                )
            )
        ).all():
            my_memberships[m.community_id] = m
        banned_ids = {
            r[0]
            for r in (
                await db.execute(
                    select(CommunityBan.community_id).where(
                        CommunityBan.user_id == viewer.id, CommunityBan.community_id.in_(ids)
                    )
                )
            ).all()
        }

    return [
        CommunityOut.from_model(
            c,
            capabilities=perms.compute(
                c, my_memberships.get(c.id), banned=c.id in banned_ids
            ).dict(),
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

    # Moderator/admin delete rights are per community, so resolve
    # capabilities once per distinct community rather than per row.
    caps_by_community: dict[uuid.UUID, perms.Capabilities] = {}
    for _, community, _, _ in rows:
        if community.id not in caps_by_community:
            _, caps = await perms.load(db, community, viewer.id if viewer else None)
            caps_by_community[community.id] = caps

    return [
        DiscussionOut(
            id=d.id,
            title=d.title,
            body=d.body,
            created_at=d.created_at,
            edited_at=d.edited_at,
            # Community discussion media is bound to the viewer: a private
            # community's attachments must not be readable by anyone who
            # merely gets hold of the URL.
            media_urls=[
                u
                for u in (
                    media_ref_to_url(r, viewer_id=viewer.id if viewer else None)
                    for r in (d.media_refs or [])
                )
                if u
            ],
            view_count=d.view_count,
            author=PersonOut.from_user(author, profile),
            community=_community_ref(community),
            likes_count=likes.get(d.id, 0),
            comments_count=comments.get(d.id, 0),
            is_liked=d.id in my_likes,
            is_saved=d.id in my_saves,
            can_delete=viewer is not None
            and (
                d.author_id == viewer.id
                or community.owner_id == viewer.id
                or caps_by_community[community.id].can_moderate
            ),
            can_edit=viewer is not None and d.author_id == viewer.id,
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


@router.get("/options", response_model=CommunityOptionsFullOut)
async def community_options():
    return CommunityOptionsFullOut(
        topics=COMMUNITY_TOPICS,
        tones=COMMUNITY_TONES,
        policy_levels=POLICY_LEVELS,
        project_statuses=PROJECT_STATUSES,
        roles=["owner", "admin", "moderator", "member"],
    )


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
    scope: str = Query(default="all", pattern="^(all|mine|trending|for_you|discover|featured)$"),
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

    if scope == "featured":
        query = query.where(Community.is_featured.is_(True))
        count_query = count_query.where(Community.is_featured.is_(True))
        query = query.order_by(
            Community.featured_rank.is_(None), Community.featured_rank, Community.created_at.desc()
        )
    elif scope in ("trending", "for_you", "discover"):
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
    banned = await db.scalar(
        select(CommunityBan.id).where(
            CommunityBan.community_id == community.id, CommunityBan.user_id == viewer.id
        )
    )
    if banned is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You have been removed from this community."
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
    _, caps = await perms.load(db, community, viewer.id)
    perms.require_visible(caps)
    perms.require(caps, "can_post", "You don't have permission to post in this community.")

    discussion = Discussion(
        community_id=community.id,
        author_id=viewer.id,
        title=payload.title,
        body=payload.body,
        media_refs=payload.media_refs or None,
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
    _, caps = await perms.load(db, community, viewer.id)
    if discussion.author_id != viewer.id and community.owner_id != viewer.id and not caps.can_moderate:
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


# ===========================================================================
# Members, roles and moderation
# ===========================================================================


async def _person(db: AsyncSession, user: User, viewer: User | None = None) -> PersonOut:
    profile = await db.scalar(select(Profile).where(Profile.user_id == user.id))
    return PersonOut.from_user(user, profile, is_self=viewer is not None and user.id == viewer.id)


async def _require_community(db: AsyncSession, slug: str, viewer: User | None):
    community = await _get_community(db, slug)
    membership, caps = await perms.load(db, community, viewer.id if viewer else None)
    perms.require_visible(caps)
    return community, membership, caps


@router.get("/{slug}/roster", response_model=CommunityMemberListOut)
async def community_roster(
    slug: str,
    role: str | None = Query(default=None, pattern="^(owner|admin|moderator|member)$"),
    q: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Members with their roles — powers the members tab and the manage screen."""
    community, _, caps = await _require_community(db, slug, viewer)

    query = (
        select(CommunityMember, User, Profile)
        .join(User, User.id == CommunityMember.user_id)
        .outerjoin(Profile, Profile.user_id == User.id)
        .where(CommunityMember.community_id == community.id, User.is_active.is_(True))
    )
    count_query = (
        select(func.count(CommunityMember.id))
        .join(User, User.id == CommunityMember.user_id)
        .where(CommunityMember.community_id == community.id, User.is_active.is_(True))
    )
    if role:
        query = query.where(CommunityMember.role == CommunityRole(role))
        count_query = count_query.where(CommunityMember.role == CommunityRole(role))
    if q:
        pattern = f"%{q.strip().lower()}%"
        cond = or_(
            func.lower(func.coalesce(Profile.username, "")).like(pattern),
            func.lower(func.coalesce(Profile.full_name, "")).like(pattern),
            func.lower(User.full_name).like(pattern),
        )
        query = query.where(cond)

    rows = (
        await db.execute(
            query.order_by(CommunityMember.role.asc(), CommunityMember.created_at.asc())
            .limit(limit + 1)
            .offset(offset)
        )
    ).all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    banned_ids: set[uuid.UUID] = set()
    if caps.can_moderate:
        banned_ids = {
            r[0]
            for r in (
                await db.execute(
                    select(CommunityBan.user_id).where(CommunityBan.community_id == community.id)
                )
            ).all()
        }

    total = (await db.scalar(count_query)) or 0
    return CommunityMemberListOut(
        items=[
            CommunityMemberOut(
                person=PersonOut.from_user(
                    user, profile, is_self=viewer is not None and user.id == viewer.id
                ),
                role=m.role.value,
                joined_at=m.created_at,
                is_banned=user.id in banned_ids,
            )
            for m, user, profile in rows
        ],
        total=total,
        has_more=has_more,
    )


@router.patch("/{slug}/members/{user_id}/role", response_model=CommunityMemberOut)
async def set_member_role(
    slug: str,
    user_id: uuid.UUID,
    payload: MemberRoleRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Owner appoints/demotes admins; admins may only manage moderators and
    members. Ownership itself is never transferred here.
    """
    community, membership, caps = await _require_community(db, slug, viewer)
    perms.require(caps, "can_manage_members", "Only admins can manage member roles.")

    target = await db.scalar(
        select(CommunityMember).where(
            CommunityMember.community_id == community.id, CommunityMember.user_id == user_id
        )
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="That person isn't a member")
    if target.role == CommunityRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="The owner's role can't be changed")

    new_role = CommunityRole(payload.role)
    actor_rank = ROLE_RANK[membership.role]
    # You can neither promote someone to your own level or above, nor
    # demote a peer — only the owner outranks an admin.
    if actor_rank < ROLE_RANK[CommunityRole.owner]:
        if ROLE_RANK[new_role] >= actor_rank or ROLE_RANK[target.role] >= actor_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can manage admins."
            )

    target.role = new_role
    await db.commit()

    user = await db.get(User, user_id)
    return CommunityMemberOut(
        person=await _person(db, user, viewer), role=target.role.value, joined_at=target.created_at
    )


@router.delete("/{slug}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    slug: str,
    user_id: uuid.UUID,
    payload: MemberRemoveRequest | None = None,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    community, membership, caps = await _require_community(db, slug, viewer)
    perms.require(caps, "can_moderate", "You don't have permission to remove members.")

    if user_id == viewer.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Use leave community instead."
        )

    target = await db.scalar(
        select(CommunityMember).where(
            CommunityMember.community_id == community.id, CommunityMember.user_id == user_id
        )
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="That person isn't a member")
    if ROLE_RANK[target.role] >= ROLE_RANK[membership.role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You can't remove someone at or above your role."
        )

    await db.delete(target)
    if payload is not None and payload.ban:
        existing = await db.scalar(
            select(CommunityBan).where(
                CommunityBan.community_id == community.id, CommunityBan.user_id == user_id
            )
        )
        if existing is None:
            db.add(
                CommunityBan(
                    community_id=community.id,
                    user_id=user_id,
                    banned_by_id=viewer.id,
                    reason=payload.reason,
                )
            )
    await db.commit()


@router.delete("/{slug}/bans/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unban_member(
    slug: str,
    user_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    community, _, caps = await _require_community(db, slug, viewer)
    perms.require(caps, "can_moderate")
    ban = await db.scalar(
        select(CommunityBan).where(
            CommunityBan.community_id == community.id, CommunityBan.user_id == user_id
        )
    )
    if ban is not None:
        await db.delete(ban)
        await db.commit()


@router.patch("/{slug}/permissions", response_model=CommunityOut)
async def update_permissions(
    slug: str,
    payload: CommunityPermissionsRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owner-only: who can post, chat, create projects, invite, moderate."""
    community, _, caps = await _require_community(db, slug, viewer)
    perms.require(caps, "can_manage_roles", "Only the community owner can change permissions.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(community, field, value)
    await db.commit()
    await db.refresh(community)
    return (await _serialize_communities(db, [community], viewer))[0]


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_community(
    slug: str,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    community, _, caps = await _require_community(db, slug, viewer)
    perms.require(caps, "can_delete_community", "Only the owner can delete this community.")
    if community.is_official:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This community can't be deleted.")
    await db.delete(community)
    await db.commit()


# ===========================================================================
# Discussion edit + comment moderation
# ===========================================================================


@router.patch("/discussions/{discussion_id}", response_model=DiscussionOut)
async def update_discussion(
    discussion_id: uuid.UUID,
    payload: DiscussionUpdateRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    discussion, community, author, profile = await _load_discussion(db, discussion_id, viewer)
    if discussion.author_id != viewer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit your own post.")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(discussion, field, value)
    if data:
        discussion.edited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(discussion)
    return (await _serialize_discussions(db, [(discussion, community, author, profile)], viewer))[0]


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = await db.get(DiscussionComment, comment_id)
    if comment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    discussion = await db.get(Discussion, comment.discussion_id)
    community = await db.get(Community, discussion.community_id)
    _, caps = await perms.load(db, community, viewer.id)
    if comment.author_id != viewer.id and not caps.can_moderate and community.owner_id != viewer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    await db.delete(comment)
    await db.commit()


# ===========================================================================
# Projects
# ===========================================================================


async def _serialize_projects(
    db: AsyncSession,
    rows: list[tuple[CommunityProject, Community, User, Profile | None]],
    viewer: User | None,
    caps: perms.Capabilities | None = None,
) -> list[CommunityProjectOut]:
    ids = [p.id for p, *_ in rows]
    if not ids:
        return []

    accepted = dict(
        (
            await db.execute(
                select(
                    CommunityProjectCollaborator.project_id,
                    func.count(CommunityProjectCollaborator.id),
                )
                .where(
                    CommunityProjectCollaborator.project_id.in_(ids),
                    CommunityProjectCollaborator.state == "accepted",
                )
                .group_by(CommunityProjectCollaborator.project_id)
            )
        ).all()
    )
    pending = dict(
        (
            await db.execute(
                select(
                    CommunityProjectCollaborator.project_id,
                    func.count(CommunityProjectCollaborator.id),
                )
                .where(
                    CommunityProjectCollaborator.project_id.in_(ids),
                    CommunityProjectCollaborator.state == "requested",
                )
                .group_by(CommunityProjectCollaborator.project_id)
            )
        ).all()
    )
    mine: dict[uuid.UUID, str] = {}
    if viewer is not None:
        mine = {
            r[0]: r[1]
            for r in (
                await db.execute(
                    select(
                        CommunityProjectCollaborator.project_id, CommunityProjectCollaborator.state
                    ).where(
                        CommunityProjectCollaborator.project_id.in_(ids),
                        CommunityProjectCollaborator.user_id == viewer.id,
                    )
                )
            ).all()
        }

    out: list[CommunityProjectOut] = []
    for project, community, owner, profile in rows:
        can_moderate = caps.can_moderate if caps is not None else False
        is_owner = viewer is not None and project.owner_id == viewer.id
        out.append(
            CommunityProjectOut(
                id=project.id,
                community=_community_ref(community),
                owner=PersonOut.from_user(owner, profile),
                name=project.name,
                description=project.description,
                media_urls=[
                    u
                    for u in (
                        media_ref_to_url(r, viewer_id=viewer.id if viewer else None)
                        for r in (project.media_refs or [])
                    )
                    if u
                ],
                skills=project.skills or [],
                roles_needed=project.roles_needed or [],
                status=project.status,
                seats=project.seats,
                collaborators_count=accepted.get(project.id, 0),
                pending_count=pending.get(project.id, 0) if is_owner or can_moderate else 0,
                my_state=mine.get(project.id),
                can_edit=is_owner,
                can_delete=is_owner or can_moderate,
                created_at=project.created_at,
            )
        )
    return out


def _project_query():
    return (
        select(CommunityProject, Community, User, Profile)
        .join(Community, Community.id == CommunityProject.community_id)
        .join(User, User.id == CommunityProject.owner_id)
        .outerjoin(Profile, Profile.user_id == User.id)
    )


@router.get("/{slug}/projects", response_model=CommunityProjectListOut)
async def list_projects(
    slug: str,
    project_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=PAGE_SIZE, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    community, _, caps = await _require_community(db, slug, viewer)

    query = _project_query().where(CommunityProject.community_id == community.id)
    count_query = select(func.count(CommunityProject.id)).where(
        CommunityProject.community_id == community.id
    )
    if project_status and project_status in PROJECT_STATUSES:
        query = query.where(CommunityProject.status == project_status)
        count_query = count_query.where(CommunityProject.status == project_status)

    rows = (
        await db.execute(
            query.order_by(CommunityProject.created_at.desc()).limit(limit + 1).offset(offset)
        )
    ).all()
    has_more = len(rows) > limit
    rows = [tuple(r) for r in rows[:limit]]
    total = (await db.scalar(count_query)) or 0
    return CommunityProjectListOut(
        items=await _serialize_projects(db, rows, viewer, caps), total=total, has_more=has_more
    )


@router.post(
    "/{slug}/projects", response_model=CommunityProjectOut, status_code=status.HTTP_201_CREATED
)
async def create_project(
    slug: str,
    payload: CommunityProjectCreateRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    community, _, caps = await _require_community(db, slug, viewer)
    perms.require(caps, "can_create_project", "You don't have permission to start a project here.")

    project = CommunityProject(
        community_id=community.id,
        owner_id=viewer.id,
        name=payload.name,
        description=payload.description,
        media_refs=payload.media_refs or None,
        skills=payload.skills or None,
        roles_needed=payload.roles_needed or None,
        status=payload.status,
        seats=payload.seats,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    profile = await db.scalar(select(Profile).where(Profile.user_id == viewer.id))
    return (await _serialize_projects(db, [(project, community, viewer, profile)], viewer, caps))[0]


async def _load_project(db: AsyncSession, project_id: uuid.UUID, viewer: User | None):
    row = (await db.execute(_project_query().where(CommunityProject.id == project_id))).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    project, community, owner, profile = row
    _, caps = await perms.load(db, community, viewer.id if viewer else None)
    perms.require_visible(caps)
    return project, community, owner, profile, caps


@router.get("/projects/{project_id}", response_model=CommunityProjectOut)
async def get_project(
    project_id: uuid.UUID,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    project, community, owner, profile, caps = await _load_project(db, project_id, viewer)
    return (await _serialize_projects(db, [(project, community, owner, profile)], viewer, caps))[0]


@router.patch("/projects/{project_id}", response_model=CommunityProjectOut)
async def update_project(
    project_id: uuid.UUID,
    payload: CommunityProjectUpdateRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project, community, owner, profile, caps = await _load_project(db, project_id, viewer)
    if project.owner_id != viewer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return (await _serialize_projects(db, [(project, community, owner, profile)], viewer, caps))[0]


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project, community, _, _, caps = await _load_project(db, project_id, viewer)
    if project.owner_id != viewer.id and not caps.can_moderate:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    await db.delete(project)
    await db.commit()


@router.post(
    "/projects/{project_id}/join",
    response_model=CommunityProjectOut,
    status_code=status.HTTP_201_CREATED,
)
async def request_to_collaborate(
    project_id: uuid.UUID,
    payload: ProjectJoinRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project, community, owner, profile, caps = await _load_project(db, project_id, viewer)
    if not caps.is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Join this community to collaborate."
        )
    if project.owner_id == viewer.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You own this project.")

    existing = await db.scalar(
        select(CommunityProjectCollaborator).where(
            CommunityProjectCollaborator.project_id == project.id,
            CommunityProjectCollaborator.user_id == viewer.id,
        )
    )
    if existing is None:
        db.add(
            CommunityProjectCollaborator(
                project_id=project.id, user_id=viewer.id, note=payload.note, state="requested"
            )
        )
        await db.commit()
    return (await _serialize_projects(db, [(project, community, owner, profile)], viewer, caps))[0]


@router.delete("/projects/{project_id}/join", response_model=CommunityProjectOut)
async def withdraw_collaboration(
    project_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project, community, owner, profile, caps = await _load_project(db, project_id, viewer)
    existing = await db.scalar(
        select(CommunityProjectCollaborator).where(
            CommunityProjectCollaborator.project_id == project.id,
            CommunityProjectCollaborator.user_id == viewer.id,
        )
    )
    if existing is not None:
        await db.delete(existing)
        await db.commit()
    return (await _serialize_projects(db, [(project, community, owner, profile)], viewer, caps))[0]


@router.get("/projects/{project_id}/collaborators", response_model=list[ProjectCollaboratorOut])
async def list_collaborators(
    project_id: uuid.UUID,
    state: str | None = Query(default=None, pattern="^(requested|accepted|declined)$"),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    project, _, _, _, caps = await _load_project(db, project_id, viewer)
    is_owner = viewer is not None and project.owner_id == viewer.id

    query = (
        select(CommunityProjectCollaborator, User, Profile)
        .join(User, User.id == CommunityProjectCollaborator.user_id)
        .outerjoin(Profile, Profile.user_id == User.id)
        .where(CommunityProjectCollaborator.project_id == project.id)
    )
    if state:
        query = query.where(CommunityProjectCollaborator.state == state)
    elif not (is_owner or caps.can_moderate):
        # Pending requests are only the project owner's business.
        query = query.where(CommunityProjectCollaborator.state == "accepted")

    rows = (await db.execute(query.order_by(CommunityProjectCollaborator.created_at.asc()))).all()
    return [
        ProjectCollaboratorOut(
            id=c.id,
            person=PersonOut.from_user(user, profile),
            state=c.state,
            note=c.note if (is_owner or caps.can_moderate) else None,
            created_at=c.created_at,
        )
        for c, user, profile in rows
    ]


@router.patch("/projects/{project_id}/collaborators/{collaborator_id}", response_model=ProjectCollaboratorOut)
async def decide_collaborator(
    project_id: uuid.UUID,
    collaborator_id: uuid.UUID,
    payload: ProjectCollaboratorDecisionRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project, _, _, _, caps = await _load_project(db, project_id, viewer)
    if project.owner_id != viewer.id and not caps.can_moderate:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    collaborator = await db.get(CommunityProjectCollaborator, collaborator_id)
    if collaborator is None or collaborator.project_id != project.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    collaborator.state = payload.state
    await db.commit()
    user = await db.get(User, collaborator.user_id)
    return ProjectCollaboratorOut(
        id=collaborator.id,
        person=await _person(db, user, viewer),
        state=collaborator.state,
        note=collaborator.note,
        created_at=collaborator.created_at,
    )


# ===========================================================================
# Community chat
# ===========================================================================


async def _serialize_messages(
    db: AsyncSession,
    rows: list[tuple[CommunityMessage, User, Profile | None]],
    viewer: User | None,
    caps: perms.Capabilities,
) -> list[CommunityMessageOut]:
    return [
        CommunityMessageOut(
            id=m.id,
            community_id=m.community_id,
            body=None if m.deleted_at else m.body,
            media_urls=[]
            if m.deleted_at
            else [
                u
                for u in (
                    media_ref_to_url(r, viewer_id=viewer.id if viewer else None)
                    for r in (m.media_refs or [])
                )
                if u
            ],
            created_at=m.created_at,
            sender=PersonOut.from_user(
                user, profile, is_self=viewer is not None and user.id == viewer.id
            ),
            is_deleted=m.deleted_at is not None,
            can_delete=viewer is not None
            and m.deleted_at is None
            and (m.sender_id == viewer.id or caps.can_moderate),
        )
        for m, user, profile in rows
    ]


@router.get("/{slug}/messages", response_model=CommunityMessageListOut)
async def list_community_messages(
    slug: str,
    before: datetime | None = Query(default=None),
    limit: int = Query(default=40, ge=1, le=100),
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Newest-last page of chat history. Older pages: pass `before`."""
    community, membership, caps = await _require_community(db, slug, viewer)
    if not caps.is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Join this community to see its chat."
        )
    if not community.chat_enabled:
        return CommunityMessageListOut(items=[], has_more=False, can_chat=False, chat_enabled=False)

    query = (
        select(CommunityMessage, User, Profile)
        .join(User, User.id == CommunityMessage.sender_id)
        .outerjoin(Profile, Profile.user_id == User.id)
        .where(CommunityMessage.community_id == community.id)
    )
    if before is not None:
        query = query.where(CommunityMessage.created_at < before)

    rows = (await db.execute(query.order_by(CommunityMessage.created_at.desc()).limit(limit + 1))).all()
    has_more = len(rows) > limit
    rows = [tuple(r) for r in rows[:limit]][::-1]

    return CommunityMessageListOut(
        items=await _serialize_messages(db, rows, viewer, caps),
        has_more=has_more,
        can_chat=caps.can_chat,
        chat_enabled=community.chat_enabled,
    )


@router.post(
    "/{slug}/messages", response_model=CommunityMessageOut, status_code=status.HTTP_201_CREATED
)
async def send_community_message(
    slug: str,
    payload: CommunityMessageCreateRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    community, _, caps = await _require_community(db, slug, viewer)
    perms.require(caps, "can_chat", "You don't have permission to send messages here.")
    if not (payload.body or payload.media_refs):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message is empty")

    message = CommunityMessage(
        community_id=community.id,
        sender_id=viewer.id,
        body=payload.body or None,
        media_refs=payload.media_refs or None,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    profile = await db.scalar(select(Profile).where(Profile.user_id == viewer.id))
    out = (await _serialize_messages(db, [(message, viewer, profile)], viewer, caps))[0]

    # Fan out to everyone with the chat open (see app/core/community_hub.py).
    # The broadcast copy is serialized for NOBODY in particular: one payload
    # goes to every listener, so viewer-specific flags (`is_self`,
    # `can_delete`) must not be baked in — the sender's own "mine" bubble
    # and "you may delete this" are decided client-side from sender.id.
    from app.core.community_hub import hub

    fanout = (await _serialize_messages(db, [(message, viewer, profile)], None, caps))[0]
    fanout_payload = fanout.model_dump(mode="json")
    # Media URLs are stripped from the shared payload and re-signed per
    # socket in app/routers/community_ws.py: one broadcast reaches many
    # members, so a single URL here would have to be unbound to any
    # viewer — exactly what we don't want for a private community.
    fanout_payload["media_urls"] = []
    await hub.broadcast(
        str(community.id),
        {
            "type": "message",
            "message": fanout_payload,
            "media_refs": [str(r) for r in (message.media_refs or [])],
        },
    )
    return out


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_community_message(
    message_id: uuid.UUID,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    message = await db.get(CommunityMessage, message_id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    community = await db.get(Community, message.community_id)
    _, caps = await perms.load(db, community, viewer.id)
    if message.sender_id != viewer.id and not caps.can_moderate:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    # Soft delete: the row stays so moderators keep a record, but the body
    # and media are no longer served.
    message.deleted_at = datetime.now(timezone.utc)
    message.deleted_by_id = viewer.id
    await db.commit()

    from app.core.community_hub import hub

    await hub.broadcast(
        str(community.id), {"type": "message_deleted", "message_id": str(message.id)}
    )


# ===========================================================================
# Discovery
# ===========================================================================


@router.get("/discovery/categories")
async def discovery_categories(db: AsyncSession = Depends(get_db)):
    """Topic -> community count, for the filter rail's real ordering."""
    rows = (
        await db.execute(
            select(Community.topic, func.count(Community.id))
            .where(Community.is_private.is_(False))
            .group_by(Community.topic)
        )
    ).all()
    counts = dict(rows)
    return {"items": [{"topic": t, "count": counts.get(t, 0)} for t in COMMUNITY_TOPICS]}


# ===========================================================================
# Reporting (reuses the platform-wide content_reports table)
# ===========================================================================


class _CommunityReportRequest(BaseModel):
    model_config = {"extra": "forbid"}

    target_type: str
    target_id: uuid.UUID
    reason: str
    details: str | None = Field(default=None, max_length=2000)

    @field_validator("target_type")
    @classmethod
    def known_target(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in ("community", "discussion", "comment", "message", "member"):
            raise ValueError("Unknown target type")
        return v

    @field_validator("reason")
    @classmethod
    def known_reason(cls, v: str) -> str:
        if v not in REPORT_REASONS:
            raise ValueError(f"Unknown reason: {v}")
        return v


@router.post("/reports", status_code=status.HTTP_201_CREATED)
async def report_community_content(
    payload: _CommunityReportRequest,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    File a report against a community, one of its posts, a comment, a chat
    message or a member. Rows land in the same `content_reports` table the
    Settings > Reports screen already reads.
    """
    label: str | None = None
    if payload.target_type == "community":
        target = await db.get(Community, payload.target_id)
        label = target.name if target else None
    elif payload.target_type == "discussion":
        target = await db.get(Discussion, payload.target_id)
        label = (target.title if target else None)
    elif payload.target_type == "comment":
        target = await db.get(DiscussionComment, payload.target_id)
        label = (target.body[:80] if target else None)
    elif payload.target_type == "message":
        target = await db.get(CommunityMessage, payload.target_id)
        label = ((target.body or "")[:80] if target else None)
    else:
        target = await db.get(User, payload.target_id)
        label = target.full_name if target else None
        if target is not None and target.id == viewer.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't report yourself")

    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="That content no longer exists")

    target_type = ReportTargetType(payload.target_type)
    duplicate = await db.scalar(
        select(ContentReport.id).where(
            ContentReport.reporter_id == viewer.id,
            ContentReport.target_type == target_type,
            ContentReport.target_id == payload.target_id,
            ContentReport.status.in_(["open", "reviewing"]),
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You've already reported this — it's still under review",
        )

    report = ContentReport(
        reporter_id=viewer.id,
        target_type=target_type,
        target_id=payload.target_id,
        target_label=label,
        reason=payload.reason,
        details=payload.details,
    )
    db.add(report)
    await db.commit()
    return {"ok": True}
