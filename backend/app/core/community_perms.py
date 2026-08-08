"""
Community authorization.

Every community action resolves to a *capability* that is computed here,
server-side, from (community row, membership row, ban row). The frontend
receives the resulting capability booleans purely so it can hide controls
the caller cannot use — it is never trusted as the decision-maker; each
router endpoint calls `require()` again before mutating anything.

Rules
-----
- Owner always passes everything (`ROLE_RANK` puts them at the top).
- A banned user has no capabilities at all, not even read on a private
  community.
- Everything else is `rank(member.role) >= POLICY_MIN_RANK[policy]`,
  where the policy value is chosen by the owner on the community row.
"""
from dataclasses import dataclass, asdict

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.community import (
    POLICY_MIN_RANK,
    ROLE_RANK,
    Community,
    CommunityBan,
    CommunityMember,
    CommunityRole,
)


@dataclass
class Capabilities:
    is_member: bool = False
    role: str | None = None
    is_banned: bool = False

    can_view: bool = False
    can_post: bool = False
    can_chat: bool = False
    can_create_project: bool = False
    can_invite: bool = False
    can_moderate: bool = False          # remove others' content, ban members
    can_manage_members: bool = False    # change roles (admin+)
    can_edit_settings: bool = False     # admin+
    can_manage_roles: bool = False      # owner only: appoint admins
    can_delete_community: bool = False  # owner only

    def dict(self) -> dict:
        return asdict(self)


def _rank(membership: CommunityMember | None) -> int:
    if membership is None:
        return -1
    return ROLE_RANK.get(membership.role, 0)


def compute(
    community: Community,
    membership: CommunityMember | None,
    *,
    banned: bool = False,
) -> Capabilities:
    if banned:
        return Capabilities(is_banned=True)

    rank = _rank(membership)
    is_member = membership is not None
    can_view = (not community.is_private) or is_member

    def allowed(policy: str) -> bool:
        return is_member and rank >= POLICY_MIN_RANK.get(policy, 0)

    return Capabilities(
        is_member=is_member,
        role=membership.role.value if membership is not None else None,
        is_banned=False,
        can_view=can_view,
        can_post=allowed(community.post_policy),
        can_chat=community.chat_enabled and allowed(community.chat_policy),
        can_create_project=allowed(community.project_policy),
        can_invite=allowed(community.invite_policy),
        can_moderate=allowed(community.moderate_policy),
        can_manage_members=rank >= ROLE_RANK[CommunityRole.admin],
        can_edit_settings=rank >= ROLE_RANK[CommunityRole.admin],
        can_manage_roles=rank >= ROLE_RANK[CommunityRole.owner],
        can_delete_community=rank >= ROLE_RANK[CommunityRole.owner],
    )


async def load(db: AsyncSession, community: Community, user_id) -> tuple[CommunityMember | None, Capabilities]:
    """Membership + capabilities for a (possibly anonymous) viewer."""
    if user_id is None:
        return None, compute(community, None)

    membership = await db.scalar(
        select(CommunityMember).where(
            CommunityMember.community_id == community.id, CommunityMember.user_id == user_id
        )
    )
    banned = (
        await db.scalar(
            select(CommunityBan.id).where(
                CommunityBan.community_id == community.id, CommunityBan.user_id == user_id
            )
        )
    ) is not None
    return membership, compute(community, membership, banned=banned)


def require(caps: Capabilities, capability: str, message: str = "You don't have permission to do that.") -> None:
    if caps.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You have been removed from this community."
        )
    if not getattr(caps, capability, False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)


def require_visible(caps: Capabilities) -> None:
    """404, not 403 — a private community shouldn't confirm it exists."""
    if not caps.can_view or caps.is_banned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")
