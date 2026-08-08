import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Loader2, Pencil, Share2, Settings, MapPin, MessageCircle, Bell,
  Github, Linkedin, Globe, Briefcase, MoreHorizontal, Plus, ImagePlus,
  BadgeCheck, Wifi, ChevronRight, ChevronDown, Check, Clock, SquarePen,
  ArrowLeft, UserPlus, Crown, FlaskConical, Sprout, Rocket, Lock, Users,
  Heart, Repeat2, Share, Pin, CircleCheck, Twitter, Dribbble,
} from 'lucide-react'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import ReportDialog from '../features/settings/components/ReportDialog.jsx'
import { api } from '../api/client.js'
import { useFollow } from '../features/social/useFollow.js'
import { formatCount } from '../features/social/format.js'

// Elcoral profile page, built to the approved design reference across all
// three viewing angles:
//
//   1. "owner"   — the profile owner viewing their own profile: centred
//                  header, cover toolbars, Edit Profile / Share Profile,
//                  profile-completion card, and the full tab strip.
//   2. "visitor" — another logged-in member viewing the profile: back /
//                  overflow row, left-aligned header, Message / Connect /
//                  Follow actions, top skills, tabs and the post feed.
//   3. "guest"   — a logged-out visitor: the same left-aligned header and
//                  public cards, then a join gate in place of the tabs and
//                  a "Why join Elcoral?" strip.
//
// The Portfolio tab was folded into About (Links section) and Currently
// Building now lives on the Projects tab — neither is a separate tab
// anymore. Availability moved from a standalone strip at the top of the
// page into the About tab as well. "Looking for" on About reads the
// profile's `intents` — the same "what brings you here" goals collected
// at onboarding — rather than a separate field.
//
// Frontend-only placeholders (no backend field yet, deliberately not
// presented as real data): follower/following/like counts and the badge
// chips. Everything else reads from the API when the field exists.

const BADGES = [
  { label: 'Official', Icon: Crown, tone: 'gold' },
  { label: 'Beta Tester', Icon: FlaskConical, tone: 'ink' },
  { label: 'Early Supporter', Icon: Sprout, tone: 'lemon' },
]

// "Currently building" — still frontend-placeholder copy (no backend
// field for a pinned project yet), now shown on the Projects tab instead
// of the top of the profile page.
const TABS = ['Posts', 'Projects', 'Skills', 'About']

// Mirrors app/models/profile.py's AVAILABILITY_CHOICES + the labels/dot
// tone shown in the About tab's availability strip.
const AVAILABILITY_LABELS = {
  open_to_work: 'Open to work',
  open_to_collab: 'Open to collaborate',
  not_available: 'Not available',
}

// Mirrors OnboardingContext.jsx's INTENT_OPTIONS labels — used to render
// the profile's `intents` as readable "Looking for" chips on About.
const INTENT_LABELS = {
  find_work: 'Freelance work',
  hire: 'Hiring professionals',
  build_startup: 'Building a startup',
  find_collaborators: 'Collaborators',
  learn: 'Learning new skills',
  mentor: 'Mentorship',
  showcase_work: 'Showcasing work',
  network: 'Growing my network',
  share_ideas: 'Sharing ideas',
  recruit: 'Recruiting talent',
}

export default function ProfileView() {
  const params = useParams()
  const { user, accessToken, authLoading } = useAuth()

  const [resolvedUsername, setResolvedUsername] = useState(params.username ?? null)
  const [resolving, setResolving] = useState(!params.username)

  useEffect(() => {
    if (params.username) {
      setResolvedUsername(params.username)
      setResolving(false)
      return
    }
    if (authLoading) return
    if (!accessToken) {
      setResolving(false)
      return
    }
    api
      .myProfile(accessToken)
      .then((p) => setResolvedUsername(p?.username ?? null))
      .finally(() => setResolving(false))
  }, [params.username, accessToken, authLoading])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])

  useEffect(() => {
    if (resolving) return
    if (!resolvedUsername) {
      setLoading(false)
      setError(params.username ? 'not-found' : 'no-username')
      return
    }
    setLoading(true)
    setError('')
    Promise.all([
      api.publicProfile(resolvedUsername, accessToken),
      api.postsByUsername(resolvedUsername).catch(() => []),
    ])
      .then(([p, postList]) => {
        setProfile(p)
        setPosts(Array.isArray(postList) ? postList : [])
      })
      .catch(() => setError('not-found'))
      .finally(() => setLoading(false))
  }, [resolvedUsername, resolving, accessToken, params.username])

  if (loading || resolving || authLoading) {
    return (
      <div className="pv-loading">
        <Loader2 size={24} className="pv-spin" />
        <style>{`
          .pv-loading { display: flex; justify-content: center; padding: 80px 0; color: var(--ink-faint); }
          .pv-spin { animation: pv-spin 0.8s linear infinite; }
          @keyframes pv-spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  if (error === 'no-username') {
    return (
      <EmptyState
        title="Finish setting up your profile"
        body="Complete onboarding to get your profile page."
        actionTo="/onboarding"
        actionLabel="Continue onboarding"
      />
    )
  }

  if (error || !profile) {
    return <EmptyState title="Profile not found" body="This profile doesn't exist or isn't public yet." />
  }

  const mode = profile.is_owner ? 'owner' : user ? 'visitor' : 'guest'

  return (
    <div className={`pv pv-${mode}`}>
      {mode === 'owner' ? (
        <OwnerProfile profile={profile} posts={posts} />
      ) : mode === 'visitor' ? (
        <VisitorProfile profile={profile} posts={posts} />
      ) : (
        <GuestProfile profile={profile} posts={posts} />
      )}
      <ProfileStyles />
    </div>
  )
}

/* ------------------------------- helpers -------------------------------- */

function initialsOf(name) {
  return (
    (name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'E'
  )
}

function copyProfileLink(username) {
  const url = `${window.location.origin}/u/${username}`
  navigator.clipboard?.writeText(url).catch(() => {})
}

function timeAgo(value) {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000))
  const units = [
    ['y', 31536000],
    ['mo', 2592000],
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
  ]
  for (const [suffix, size] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${suffix} ago`
  }
  return 'Just now'
}

function EmptyState({ title, body, actionTo, actionLabel }) {
  return (
    <div className="pv-emptystate">
      <h1>{title}</h1>
      <p>{body}</p>
      {actionTo && (
        <Link to={actionTo} className="pv-emptystate-action">
          {actionLabel}
        </Link>
      )}
      <style>{`
        .pv-emptystate { text-align: center; padding: 60px 20px; }
        .pv-emptystate h1 { font-family: var(--font-head); font-size: 20px; color: var(--ink); margin: 0 0 8px; }
        .pv-emptystate p { color: var(--ink-dim); font-size: 14px; margin: 0; }
        .pv-emptystate-action {
          display: inline-block; margin-top: 18px;
          background: var(--lemon); color: var(--on-accent); font-weight: 700;
          font-size: 13.5px; padding: 10px 20px; border-radius: 999px;
        }
        .pv-stat-link { text-decoration: none; color: inherit; cursor: pointer; }
        .pv-stat-link:hover .pv-stat-label { color: var(--ink); }
        .pv-inline-error { margin: 8px 16px 0; font-size: 13px; color: var(--danger, #d33); text-align: center; }

      `}</style>
    </div>
  )
}

/* -------------------------- shared header pieces ------------------------ */

function Avatar({ profile, size = 108, ring = true, verified = false, children }) {
  const initials = useMemo(() => initialsOf(profile.full_name), [profile.full_name])
  return (
    <div className="pv-avatar-wrap" style={{ width: size, height: size }}>
      <div className={`pv-avatar ${ring ? 'pv-avatar-ring' : ''}`}>
        {profile.photo_url ? (
          <img src={profile.photo_url} alt={profile.full_name ? `${profile.full_name}'s profile photo` : 'Profile photo'} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {verified && (
        <span className="pv-avatar-verified" aria-label="Verified account">
          <Check size={13} strokeWidth={4} />
        </span>
      )}
      {children}
    </div>
  )
}

function BadgeRow({ align = 'center' }) {
  return (
    <div className={`pv-badges pv-badges-${align}`}>
      {BADGES.map(({ label, Icon, tone }) => (
        <span className="pv-badge" key={label}>
          <Icon size={14} className={`pv-badge-icon pv-badge-icon-${tone}`} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  )
}

function MetaRow({ profile, align = 'center' }) {
  const items = []
  if (profile.city) {
    items.push(
      <span className="pv-meta-item" key="city">
        <MapPin size={13} aria-hidden="true" /> {profile.city}
      </span>
    )
  }
  if (profile.is_remote) {
    items.push(
      <span className="pv-meta-item" key="remote">
        <Wifi size={13} aria-hidden="true" /> Remote
      </span>
    )
  }
  if (profile.availability_status && profile.availability_status !== 'not_available') {
    items.push(
      <span className="pv-meta-item" key="available">
        <i className="pv-meta-dot" aria-hidden="true" /> {AVAILABILITY_LABELS[profile.availability_status]}
      </span>
    )
  }

  return (
    <div className={`pv-meta pv-meta-${align}`}>
      {items.map((item, i) => (
        <span className="pv-meta-slot" key={item.key}>
          {i > 0 && <span className="pv-meta-sep" aria-hidden="true">•</span>}
          {item}
        </span>
      ))}
    </div>
  )
}

/*
 * Follower/following counts come from the live follow graph
 * (`follow`, owned by the parent view) rather than the profile payload,
 * so pressing Follow moves the number immediately instead of leaving a
 * stale count until the next reload. Both are tappable and open the
 * matching people list.
 */
function StatsRow({ profile, postCount, follow }) {
  const stats = [
    {
      label: 'Following',
      value: follow?.following_count ?? profile.following_count ?? 0,
      to: `/u/${profile.username}/following`,
    },
    {
      label: 'Followers',
      value: follow?.followers_count ?? profile.followers_count ?? 0,
      to: `/u/${profile.username}/followers`,
    },
    { label: 'Projects', value: profile.projects_count ?? 0 },
    { label: 'Posts', value: postCount },
    { label: 'Likes', value: profile.likes_count ?? 0 },
  ]
  return (
    <div className="pv-stats">
      {stats.map((s) => {
        const body = (
          <>
            <span className="pv-stat-value">{formatCount(s.value)}</span>
            <span className="pv-stat-label">{s.label}</span>
          </>
        )
        return s.to && profile.username ? (
          <Link className="pv-stat pv-stat-link" key={s.label} to={s.to}>{body}</Link>
        ) : (
          <div className="pv-stat" key={s.label}>{body}</div>
        )
      })}
    </div>
  )
}

function NameBlock({ profile, align = 'center' }) {
  return (
    <>
      <h1 className={`pv-name pv-name-${align}`}>
        {profile.full_name}
        <BadgeCheck size={22} className="pv-verified" aria-label="Verified account" />
      </h1>
      {profile.username && <p className={`pv-username pv-username-${align}`}>@{profile.username}</p>}
    </>
  )
}

/* ------------------------------ owner view ------------------------------ */

function OwnerProfile({ profile, posts }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const follow = useFollow(profile.username)

  return (
    <>
      <div className="pv-cover pv-cover-owner">
        {profile.cover_url && <img src={profile.cover_url} alt="" />}

        <div className="pv-cover-toolbar pv-cover-toolbar-left">
          <Link to="/home/more" className="pv-round-btn" aria-label="More options">
            <MoreHorizontal size={20} />
          </Link>
        </div>

        <div className="pv-cover-toolbar pv-cover-toolbar-right">
          <Link to="/home/messages" className="pv-round-btn" aria-label="Messages">
            <MessageCircle size={19} />
          </Link>
          <Link to="/home/notifications" className="pv-round-btn" aria-label="Notifications">
            <Bell size={19} />
          </Link>
          <Link to="/home/settings" className="pv-round-btn" aria-label="Settings">
            <Settings size={19} />
          </Link>
        </div>

        <Link to="/home/profile/edit" className="pv-cover-edit">
          <ImagePlus size={17} aria-hidden="true" /> Edit cover
        </Link>

        <div className="pv-avatar-slot pv-avatar-slot-center">
          <Avatar profile={profile} size={104}>
            <Link to="/home/profile/edit" className="pv-avatar-add" aria-label="Change profile photo">
              <Plus size={18} strokeWidth={3} />
            </Link>
          </Avatar>
        </div>
      </div>

      <div className="pv-head pv-head-center">
        <NameBlock profile={profile} align="center" />
        {profile.bio && <p className="pv-bio pv-bio-center">{profile.bio}</p>}
        <BadgeRow align="center" />
        <MetaRow profile={profile} align="center" />
        <StatsRow profile={profile} postCount={posts.length} follow={follow} />

        <div className="pv-actions">
          <Link to="/home/profile/edit" className="pv-btn pv-btn-primary">
            <Pencil size={16} aria-hidden="true" /> Edit Profile
          </Link>
          <button type="button" className="pv-btn" onClick={() => copyProfileLink(profile.username)}>
            <Share2 size={16} aria-hidden="true" /> Share Profile
          </button>
          <button
            type="button"
            className="pv-btn pv-btn-square"
            aria-label="More profile actions"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {moreOpen && (
          <div className="pv-menu">
            <Link to="/home/settings/privacy" className="pv-menu-item">Privacy settings</Link>
            <Link to="/home/settings/account" className="pv-menu-item">Account settings</Link>
            <button type="button" className="pv-menu-item" onClick={() => copyProfileLink(profile.username)}>
              Copy profile link
            </button>
          </div>
        )}
      </div>

      <div className="pv-cardgrid">
        <CompletionCard profile={profile} postCount={posts.length} />
      </div>

      <ProfileTabs profile={profile} posts={posts} isOwner />
    </>
  )
}

function CompletionCard({ profile, postCount }) {
  const hasSocials = Boolean(
    profile.github_url || profile.linkedin_url || profile.website_url
    || profile.twitter_url || profile.dribbble_url || profile.portfolio_links?.length
  )
  const checklist = [
    { label: 'Add profile photo', worth: 15, done: Boolean(profile.photo_url) },
    { label: 'Add bio', worth: 10, done: Boolean(profile.bio) },
    { label: 'Add location', worth: 10, done: Boolean(profile.city) },
    { label: 'Add skills', worth: 15, done: Boolean(profile.skills?.length) },
    { label: 'Add socials', worth: 15, done: hasSocials },
    { label: 'Create first post', worth: 15, done: postCount > 0 },
  ]
  const computed = checklist.reduce((sum, c) => (c.done ? sum + c.worth : sum), 0)
  const pct = Math.min(100, profile.profile_completion_pct ?? computed)

  return (
    <section className="pv-card">
      <Link to="/home/profile/edit" className="pv-card-head">
        <h2>Profile completion</h2>
        <span className="pv-card-head-right">
          <strong>{pct}%</strong>
          <ChevronRight size={17} />
        </span>
      </Link>
      <div className="pv-progress">
        <i style={{ width: `${pct}%` }} />
      </div>
    </section>
  )
}

// Availability strip — now shown inside the About tab rather than at the
// top of the profile page. Renders nothing if the person hasn't set an
// availability status (no fake "Available" default).
function AvailabilityStrip({ profile, isOwner }) {
  if (!isOwner && !profile.availability_status) return null

  const Wrapper = isOwner ? Link : 'div'
  const wrapperProps = isOwner ? { to: '/home/profile/edit' } : {}

  return (
    <Wrapper className="pv-availability" {...wrapperProps}>
      <span className="pv-availability-title">
        <Clock size={19} aria-hidden="true" /> Availability
      </span>
      {profile.availability_status ? (
        <span className="pv-availability-lines">
          <span className="pv-availability-line">
            <i className="pv-meta-dot" aria-hidden="true" /> {AVAILABILITY_LABELS[profile.availability_status]}
          </span>
          {profile.availability_note && (
            <span className="pv-availability-line pv-availability-line-dim">
              <Clock size={13} aria-hidden="true" /> {profile.availability_note}
            </span>
          )}
        </span>
      ) : (
        <span className="pv-availability-lines">
          <span className="pv-availability-line pv-availability-line-dim">Not set</span>
        </span>
      )}
      {isOwner && <ChevronRight size={18} className="pv-availability-chevron" />}
    </Wrapper>
  )
}

/* ----------------------------- visitor view ----------------------------- */

function VisitorProfile({ profile, posts }) {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const follow = useFollow(profile.username)
  const [moreOpen, setMoreOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [blockError, setBlockError] = useState('')
  const [messageError, setMessageError] = useState('')
  const [opening, setOpening] = useState(false)

  // "Message" is find-or-create: the backend returns the existing thread
  // if these two have talked before, so tapping it twice can't fork the
  // conversation.
  async function openConversation() {
    if (opening) return
    setOpening(true)
    setMessageError('')
    try {
      const conversation = await api.startConversation(profile.username, accessToken)
      navigate(`/home/messages/${conversation.id}`)
    } catch (err) {
      setMessageError(err.message || 'Could not open this conversation.')
    } finally {
      setOpening(false)
    }
  }

  // Blocking is mutual on the backend, so the viewer loses access to this
  // profile straight away — sending them home avoids a dead 404 screen.
  async function block() {
    setMoreOpen(false)
    try {
      await api.blockUser(profile.username, accessToken)
      navigate('/home')
    } catch (err) {
      setBlockError(err.message || 'Could not block this member.')
    }
  }

  return (
    <>
      <div className="pv-toprow">
        <button type="button" className="pv-round-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
        <button
          type="button"
          className="pv-round-btn"
          aria-label="More options"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      {moreOpen && (
        <div className="pv-menu pv-menu-floating">
          <button type="button" className="pv-menu-item" onClick={() => copyProfileLink(profile.username)}>
            Copy profile link
          </button>
          <button
            type="button"
            className="pv-menu-item"
            onClick={() => { setMoreOpen(false); openConversation() }}
          >
            Send a message
          </button>
          <button
            type="button"
            className="pv-menu-item pv-menu-item-danger"
            onClick={() => { setMoreOpen(false); setReporting(true) }}
          >
            Report profile
          </button>
          <button type="button" className="pv-menu-item pv-menu-item-danger" onClick={block}>
            Block @{profile.username}
          </button>
        </div>
      )}

      {blockError && <p className="pv-inline-error" role="alert">{blockError}</p>}

      {reporting && (
        <ReportDialog
          targetType="user"
          targetUsername={profile.username}
          label={`@${profile.username}`}
          onClose={() => setReporting(false)}
        />
      )}

      <div className="pv-cover">
        {profile.cover_url && <img src={profile.cover_url} alt="" />}
        <div className="pv-avatar-slot pv-avatar-slot-left">
          <Avatar profile={profile} size={104} verified />
        </div>
      </div>

      <div className="pv-actionrow">
        <button
          type="button"
          className="pv-round-btn pv-round-btn-lg"
          aria-label={`Message ${profile.full_name || profile.username}`}
          disabled={opening}
          onClick={openConversation}
        >
          <MessageCircle size={20} />
        </button>
        <button
          type="button"
          className={`pv-btn pv-follow ${follow.is_following ? 'pv-follow-on' : 'pv-btn-primary'}`}
          aria-pressed={follow.is_following}
          disabled={follow.loading || follow.pending}
          onClick={follow.toggle}
        >
          {follow.is_following
            ? <CircleCheck size={18} aria-hidden="true" />
            : <UserPlus size={18} aria-hidden="true" />}
          {follow.is_following ? 'Following' : follow.follows_you ? 'Follow back' : 'Follow'}
        </button>
      </div>

      {(messageError || follow.error) && (
        <p className="pv-inline-error" role="alert">{messageError || follow.error}</p>
      )}

      <div className="pv-head pv-head-left">
        <NameBlock profile={profile} align="left" />
        <BadgeRow align="left" />
        {profile.bio && <p className="pv-bio pv-bio-left">{profile.bio}</p>}
        <MetaRow profile={profile} align="left" />
        <StatsRow profile={profile} postCount={posts.length} follow={follow} />
      </div>

      <TopSkills profile={profile} />
      <ProfileTabs profile={profile} posts={posts} />
    </>
  )
}

/* ------------------------------ guest view ------------------------------ */

function GuestProfile({ profile, posts }) {
  const firstName = profile.full_name || `@${profile.username}`
  const follow = useFollow(profile.username)

  return (
    <>
      <div className="pv-cover pv-cover-guest">
        {profile.cover_url && <img src={profile.cover_url} alt="" />}
        <div className="pv-avatar-slot pv-avatar-slot-left">
          <Avatar profile={profile} size={104} verified />
        </div>
      </div>

      <div className="pv-head pv-head-left pv-head-guest">
        <NameBlock profile={profile} align="left" />
        {profile.bio && <p className="pv-bio pv-bio-left">{profile.bio}</p>}
        <BadgeRow align="left" />
        <MetaRow profile={profile} align="left" />
        <StatsRow profile={profile} postCount={posts.length} follow={follow} />
      </div>

      <TopSkills profile={profile} />

      <section className="pv-gate">
        <span className="pv-gate-icon" aria-hidden="true">
          <Lock size={22} />
        </span>
        <h2>Join Elcoral to view full profile</h2>
        <p>
          Sign up or log in to see {firstName}'s posts, projects, portfolio, connections and more.
        </p>
        <div className="pv-gate-actions">
          <Link to="/signup" className="pv-btn pv-btn-primary">Sign up</Link>
          <Link to="/login" className="pv-btn">Log in</Link>
        </div>
      </section>

      <section className="pv-why">
        <h2>Why join Elcoral?</h2>
        <div className="pv-why-grid">
          <WhyItem Icon={Users} title="Connect" body="Build meaningful professional relationships." />
          <WhyItem Icon={Rocket} title="Collaborate" body="Work on projects and bring ideas to life." />
          <WhyItem Icon={Briefcase} title="Grow" body="Learn, share and grow with the community." />
        </div>
      </section>
    </>
  )
}

function WhyItem({ Icon, title, body }) {
  return (
    <div className="pv-why-item">
      <span className="pv-why-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <div>
        <p className="pv-why-title">{title}</p>
        <p className="pv-why-body">{body}</p>
      </div>
    </div>
  )
}

/* --------------------------- public sub-blocks -------------------------- */

function TopSkills({ profile }) {
  const skills = profile.skills ?? []
  if (skills.length === 0) return null
  const shown = skills.slice(0, 4)
  const rest = skills.length - shown.length

  return (
    <section className="pv-skills">
      <h2>Top skills</h2>
      <div className="pv-chips">
        {shown.map((s) => (
          <span className="pv-chip" key={s}>{s}</span>
        ))}
        {rest > 0 && <span className="pv-chip pv-chip-more">+{rest} more</span>}
      </div>
    </section>
  )
}

/* --------------------------------- tabs --------------------------------- */

function ProfileTabs({ profile, posts, isOwner = false }) {
  const [tab, setTab] = useState('Posts')

  return (
    <>
      <div className="pv-tabs" role="tablist" aria-label="Profile sections">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`pv-tab ${tab === t ? 'pv-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pv-tabpanel">
        {tab === 'Posts' && <PostsTab profile={profile} posts={posts} isOwner={isOwner} />}
        {tab === 'Projects' && <ProjectsTab profile={profile} isOwner={isOwner} />}
        {tab === 'Skills' && <SkillsTab profile={profile} isOwner={isOwner} />}
        {tab === 'About' && <AboutTab profile={profile} isOwner={isOwner} />}
      </div>
    </>
  )
}

function ProjectsTab({ profile, isOwner }) {
  return (
    <div className="pv-projects">
      <EmptyTab
        title="No projects yet"
        body={isOwner
          ? 'Showcase what you are building to attract collaborators.'
          : `${profile.full_name} hasn't shared any projects yet.`}
        action={isOwner ? 'Add a Project' : null}
        to="/home/profile/edit"
      />
    </div>
  )
}

function PostsTab({ profile, posts, isOwner }) {
  if (posts.length === 0) {
    return (
      <EmptyTab
        title="No posts yet"
        body={isOwner
          ? 'Share your thoughts, ideas or updates with the community.'
          : `${profile.full_name} hasn't posted anything yet.`}
        action={isOwner ? 'Create Your First Post' : null}
        to="/home/create"
      />
    )
  }
  return (
    <div className="pv-feed">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} profile={profile} />
      ))}
    </div>
  )
}

function PostCard({ post, profile }) {
  return (
    <article className="pv-post">
      <header className="pv-post-head">
        <div className="pv-post-avatar">
          {profile.photo_url ? (
            <img src={profile.photo_url} alt="" />
          ) : (
            <span>{initialsOf(profile.full_name)}</span>
          )}
        </div>
        <div className="pv-post-ids">
          <p className="pv-post-name">
            {profile.full_name}
            <BadgeCheck size={16} className="pv-verified" aria-label="Verified account" />
          </p>
          <p className="pv-post-sub">
            @{profile.username} <span aria-hidden="true">•</span> {timeAgo(post.created_at)}
          </p>
        </div>
        <div className="pv-post-tools">
          {post.is_pinned && (
            <span className="pv-post-pinned">
              <Pin size={14} aria-hidden="true" /> Pinned
            </span>
          )}
          <button type="button" className="pv-post-more" aria-label="Post options">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>

      <p className="pv-post-body">{post.body}</p>

      <footer className="pv-post-actions">
        <button type="button" className="pv-post-action" aria-label="Like">
          <Heart size={18} /> {post.like_count ?? 0}
        </button>
        <button type="button" className="pv-post-action" aria-label="Comment">
          <MessageCircle size={18} /> {post.comment_count ?? 0}
        </button>
        <button type="button" className="pv-post-action" aria-label="Repost">
          <Repeat2 size={18} /> {post.repost_count ?? 0}
        </button>
        <button type="button" className="pv-post-action" aria-label="Share">
          <Share size={18} />
        </button>
      </footer>
    </article>
  )
}

function SkillsTab({ profile, isOwner }) {
  if (!profile.skills?.length) {
    return (
      <EmptyTab
        title="No skills added yet"
        body={isOwner
          ? 'Add the skills you want to be found for.'
          : `${profile.full_name} hasn't added any skills yet.`}
        action={isOwner ? 'Add Skills' : null}
        to="/home/profile/edit"
      />
    )
  }
  return (
    <div className="pv-chips">
      {profile.skills.map((s) => (
        <span key={s} className="pv-chip">{s}</span>
      ))}
    </div>
  )
}

function AboutTab({ profile, isOwner }) {
  const hasSocials = profile.github_url || profile.linkedin_url || profile.website_url
    || profile.twitter_url || profile.dribbble_url
  const hasPortfolio = profile.portfolio_links?.length > 0
  const hasLinks = hasSocials || hasPortfolio
  const lookingFor = (profile.intents ?? []).filter((k) => INTENT_LABELS[k])
  const hasAny = profile.bio || profile.work_experience?.length || hasLinks
    || lookingFor.length > 0 || profile.about || profile.availability_status || isOwner

  if (!hasAny) {
    return (
      <EmptyTab
        title="Nothing here yet"
        body={isOwner
          ? 'Tell people who you are and what you work on.'
          : `${profile.full_name} hasn't added an about section yet.`}
        action={isOwner ? 'Edit Profile' : null}
        to="/home/profile/edit"
      />
    )
  }

  return (
    <div className="pv-about">
      {profile.bio && (
        <AboutSection title="Bio">
          <p className="pv-about-text">{profile.bio}</p>
        </AboutSection>
      )}

      {profile.work_experience?.length > 0 && (
        <AboutSection title="Experience">
          <div className="pv-exp-list">
            {profile.work_experience.map((w, i) => (
              <div className="pv-exp" key={`${w.title}-${i}`}>
                <span className="pv-exp-icon" aria-hidden="true">
                  <Briefcase size={16} />
                </span>
                <div>
                  <p className="pv-exp-title">{w.title} · {w.company}</p>
                  <p className="pv-exp-years">{w.years}</p>
                </div>
              </div>
            ))}
          </div>
        </AboutSection>
      )}

      {hasLinks ? (
        <AboutSection title="Links">
          {hasSocials && (
            <div className="pv-social">
              {profile.github_url && (
                <a href={profile.github_url} target="_blank" rel="noreferrer" aria-label="GitHub">
                  <Github size={18} />
                </a>
              )}
              {profile.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noreferrer" aria-label="LinkedIn">
                  <Linkedin size={18} />
                </a>
              )}
              {profile.website_url && (
                <a href={profile.website_url} target="_blank" rel="noreferrer" aria-label="Website">
                  <Globe size={18} />
                </a>
              )}
              {profile.twitter_url && (
                <a href={profile.twitter_url} target="_blank" rel="noreferrer" aria-label="Twitter">
                  <Twitter size={18} />
                </a>
              )}
              {profile.dribbble_url && (
                <a href={profile.dribbble_url} target="_blank" rel="noreferrer" aria-label="Dribbble">
                  <Dribbble size={18} />
                </a>
              )}
            </div>
          )}
          {hasPortfolio && (
            <div className="pv-portfolio">
              {profile.portfolio_links.map((l) => (
                <a key={l} href={l} target="_blank" rel="noreferrer" className="pv-portfolio-link">
                  <Globe size={16} aria-hidden="true" /> <span>{l}</span>
                  <ChevronRight size={16} className="pv-portfolio-chevron" />
                </a>
              ))}
            </div>
          )}
        </AboutSection>
      ) : isOwner ? (
        <AboutSection title="Links">
          <Link to="/home/profile/edit" className="pv-about-empty-link">
            <Plus size={15} aria-hidden="true" /> Add socials or a portfolio link
          </Link>
        </AboutSection>
      ) : null}

      {lookingFor.length > 0 ? (
        <AboutSection title="Looking for">
          <div className="pv-chips">
            {lookingFor.map((k) => (
              <span className="pv-chip pv-chip-lemon" key={k}>{INTENT_LABELS[k]}</span>
            ))}
          </div>
        </AboutSection>
      ) : isOwner ? (
        <AboutSection title="Looking for">
          <Link to="/home/profile/edit" className="pv-about-empty-link">
            <Plus size={15} aria-hidden="true" /> Add what you're looking for
          </Link>
        </AboutSection>
      ) : null}

      {profile.about ? (
        <AboutSection title="More about">
          <p className="pv-about-text">{profile.about}</p>
        </AboutSection>
      ) : isOwner ? (
        <AboutSection title="More about">
          <Link to="/home/profile/edit" className="pv-about-empty-link">
            <Plus size={15} aria-hidden="true" /> Tell people more about yourself
          </Link>
        </AboutSection>
      ) : null}

      {(isOwner || profile.availability_status) && (
        <AboutSection title="Availability">
          <AvailabilityStrip profile={profile} isOwner={isOwner} />
        </AboutSection>
      )}
    </div>
  )
}

function AboutSection({ title, children }) {
  return (
    <section className="pv-about-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function EmptyTab({ title, body, action, to }) {
  return (
    <div className="pv-emptytab">
      <SquarePen size={40} className="pv-emptytab-icon" aria-hidden="true" />
      <p className="pv-emptytab-title">{title}</p>
      {body && <p className="pv-emptytab-body">{body}</p>}
      {action && to && (
        <Link to={to} className="pv-btn pv-btn-primary pv-emptytab-action">
          {action}
        </Link>
      )}
    </div>
  )
}

/* -------------------------------- styles -------------------------------- */

function ProfileStyles() {
  return (
    <style>{`
      .pv {
        --pv-surface: var(--surface);
        --pv-surface-2: var(--surface-2);
        --pv-line: var(--surface-line);
        --pv-line-soft: var(--surface-line-soft);
        text-align: left;
      }
      .pv * { box-sizing: border-box; }
      .pv h1, .pv h2, .pv p, .pv ul { margin: 0; }
      .pv ul { padding: 0; list-style: none; }

      /* ------------------------------ cover ------------------------------ */
      .pv-toprow {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 14px;
      }
      .pv-cover {
        position: relative;
        border-radius: 18px;
        aspect-ratio: 16 / 5;
        background:
          radial-gradient(120% 160% at 78% 22%, rgba(196, 241, 53, 0.16), transparent 60%),
          var(--cover);
        border: 1px solid var(--pv-line-soft);
      }
      .pv-cover > img {
        position: absolute; inset: 0;
        width: 100%; height: 100%; object-fit: cover;
        border-radius: inherit;
      }
      .pv-cover-owner { aspect-ratio: 16 / 5.6; }

      .pv-cover-toolbar {
        position: absolute; top: 12px; z-index: 3;
        display: flex; align-items: center; gap: 10px;
      }
      .pv-cover-toolbar-left { left: 12px; }
      .pv-cover-toolbar-right { right: 12px; }

      .pv-round-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 42px; height: 42px; border-radius: 50%;
        color: var(--ink);
        background: color-mix(in srgb, var(--surface) 82%, transparent);
        border: 1px solid var(--pv-line);
        backdrop-filter: blur(8px);
        transition: color 0.15s ease, border-color 0.15s ease;
      }
      .pv-round-btn:hover { color: var(--accent-ink); border-color: var(--accent-ink); }
      .pv-round-btn-lg { width: 48px; height: 48px; background: var(--pv-surface); }
      .pv-round-btn-on { color: var(--accent-ink); border-color: var(--accent-ink); }

      .pv-cover-edit {
        position: absolute; right: 14px; bottom: 14px; z-index: 3;
        display: inline-flex; align-items: center; gap: 9px;
        font-size: 14px; font-weight: 600; color: var(--ink);
        background: color-mix(in srgb, var(--surface) 84%, transparent);
        border: 1px solid var(--pv-line);
        border-radius: 999px; padding: 10px 18px;
        backdrop-filter: blur(8px);
      }
      .pv-cover-edit:hover { border-color: var(--accent-ink); color: var(--accent-ink); }

      .pv-avatar-slot { position: absolute; z-index: 4; }
      .pv-avatar-slot-center { left: 50%; bottom: -30px; transform: translateX(-50%); }
      .pv-avatar-slot-left { left: 16px; bottom: -42px; }

      .pv-avatar-wrap { position: relative; }
      .pv-avatar {
        width: 100%; height: 100%;
        border-radius: 50%; overflow: hidden;
        background: var(--pv-surface-2);
        display: flex; align-items: center; justify-content: center;
        font-family: var(--font-display); font-weight: 800; font-size: 32px; color: var(--accent-ink);
      }
      .pv-avatar-ring { border: 3px solid var(--lemon); }
      .pv-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .pv-avatar-add {
        position: absolute; right: -2px; bottom: 2px;
        width: 34px; height: 34px; border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        background: var(--lemon); color: var(--on-accent);
        border: 3px solid var(--bg);
      }
      .pv-avatar-verified {
        position: absolute; right: 0; bottom: 4px;
        width: 28px; height: 28px; border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        background: var(--lemon); color: var(--on-accent);
        border: 3px solid var(--bg);
      }

      /* ---------------------------- action row --------------------------- */
      .pv-actionrow {
        display: flex; align-items: center; justify-content: flex-end; gap: 12px;
        margin-top: 14px;
      }

      /* ------------------------------ header ----------------------------- */
      .pv-head { display: flex; flex-direction: column; }
      .pv-head-center { align-items: center; text-align: center; margin-top: 40px; }
      .pv-head-left { align-items: flex-start; text-align: left; margin-top: 18px; }
      .pv-head-guest { margin-top: 56px; }

      .pv-name {
        display: inline-flex; align-items: center; gap: 9px;
        font-family: var(--font-display); font-weight: 800;
        font-size: 27px; line-height: 1.2; color: var(--ink);
      }
      .pv-verified { color: var(--accent-ink); flex-shrink: 0; }
      .pv-username { color: var(--ink-faint); font-size: 15px; margin-top: 4px; }

      .pv-bio {
        color: var(--ink-dim); font-size: 15px; line-height: 1.5;
        margin-top: 14px; max-width: 420px; white-space: pre-wrap;
      }
      .pv-bio-center { text-align: center; }

      .pv-badges { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 16px; }
      .pv-badges-center { justify-content: center; }
      .pv-badge {
        display: inline-flex; align-items: center; gap: 7px;
        font-size: 13px; font-weight: 600; color: var(--ink);
        background: var(--pv-surface); border: 1px solid var(--pv-line);
        border-radius: 999px; padding: 8px 15px;
      }
      .pv-badge-icon { flex-shrink: 0; }
      .pv-badge-icon-gold { color: #E8B21F; }
      .pv-badge-icon-lemon { color: var(--accent-ink); }
      .pv-badge-icon-ink { color: var(--ink); }

      .pv-meta { display: flex; flex-wrap: wrap; align-items: center; margin-top: 16px; }
      .pv-meta-center { justify-content: center; }
      .pv-meta-slot { display: inline-flex; align-items: center; }
      .pv-meta-sep { color: var(--ink-faint); margin: 0 12px; font-size: 13px; }
      .pv-meta-item {
        display: inline-flex; align-items: center; gap: 7px;
        font-size: 13.5px; color: var(--ink-dim);
      }
      .pv-meta-dot {
        width: 10px; height: 10px; border-radius: 50%;
        background: var(--lemon); display: inline-block; flex-shrink: 0;
      }

      /* ------------------------------- stats ----------------------------- */
      .pv-stats {
        display: grid; grid-template-columns: repeat(5, 1fr);
        width: 100%; margin-top: 22px;
      }
      .pv-stat {
        display: flex; flex-direction: column; align-items: center; gap: 4px;
        padding: 4px 0;
      }
      .pv-stat + .pv-stat { border-left: 1px solid var(--pv-line-soft); }
      .pv-stat-value { font-family: var(--font-head); font-size: 20px; font-weight: 700; color: var(--ink); }
      .pv-stat-label { font-size: 13px; color: var(--ink-faint); }

      /* ------------------------------ buttons ---------------------------- */
      .pv-actions { display: flex; gap: 12px; width: 100%; margin-top: 22px; }
      .pv-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 9px;
        flex: 1;
        font-size: 15px; font-weight: 600; color: var(--ink);
        background: var(--pv-surface); border: 1px solid var(--pv-line);
        border-radius: 999px; padding: 14px 18px;
        transition: border-color 0.15s ease, background 0.15s ease;
        white-space: nowrap;
      }
      .pv-btn:hover { border-color: var(--accent-ink); }
      .pv-btn-primary {
        background: var(--lemon); color: var(--on-accent); border-color: var(--accent-ink); font-weight: 700;
      }
      .pv-btn-primary:hover { background: var(--lemon-dim); border-color: var(--lemon-dim); }
      .pv-btn-square { flex: 0 0 62px; padding: 14px 0; }
      .pv-actionrow .pv-follow { flex: 0 0 auto; padding: 14px 28px; gap: 10px; }
      .pv-actionrow .pv-follow-on {
        background: transparent; color: var(--accent-ink); border-color: var(--accent-ink);
      }

      .pv-menu {
        width: 100%; margin-top: 12px;
        background: var(--pv-surface); border: 1px solid var(--pv-line);
        border-radius: 14px; overflow: hidden;
        display: flex; flex-direction: column;
      }
      .pv-menu-floating { margin: 0 0 14px; }
      .pv-menu-item {
        text-align: left; font-size: 14px; color: var(--ink);
        padding: 13px 16px; border-bottom: 1px solid var(--pv-line-soft);
      }
      .pv-menu-item:last-child { border-bottom: none; }
      .pv-menu-item:hover { color: var(--accent-ink); background: var(--pv-surface-2); }
      .pv-menu-item-danger { color: var(--danger); }
      .pv-inline-error { margin: 0 16px 8px; font-size: 13px; color: var(--danger); }
      .pv-menu-item-danger:hover { color: var(--danger); }

      /* ------------------------------- cards ----------------------------- */
      .pv-cardgrid {
        display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 22px;
      }
      .pv-card {
        background: var(--pv-surface); border: 1px solid var(--pv-line-soft);
        border-radius: 18px; padding: 18px;
      }
      .pv-card-head {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        color: var(--ink-faint);
      }
      .pv-card-head h2 {
        font-family: var(--font-head); font-size: 16px; font-weight: 700; color: var(--ink);
        display: inline-flex; align-items: center; gap: 8px;
      }
      .pv-card-head-icon { color: var(--accent-ink); }
      .pv-card-head-right { display: inline-flex; align-items: center; gap: 7px; }
      .pv-card-head-right strong { color: var(--accent-ink); font-size: 16px; font-weight: 700; }
      .pv-card-head-static {
        display: inline-flex; align-items: center; gap: 8px;
        font-family: var(--font-head); font-size: 16px; font-weight: 700; color: var(--ink);
        margin: 0 0 2px;
      }

      .pv-progress {
        height: 7px; border-radius: 999px; background: var(--pv-surface-2);
        margin-top: 16px; overflow: hidden;
      }
      .pv-progress i { display: block; height: 100%; background: var(--lemon); border-radius: 999px; }

      .pv-chips { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 10px; }
      .pv-chip {
        font-size: 13px; color: var(--ink);
        background: transparent; border: 1px solid var(--pv-line);
        border-radius: 999px; padding: 8px 14px;
      }
      .pv-chip-lemon { color: var(--accent-ink); border-color: var(--lemon-deep); }
      .pv-chip-more { background: var(--pv-surface); color: var(--ink); }

      /* ---------------------------- top skills --------------------------- */
      .pv-skills { margin-top: 24px; }
      .pv-skills h2 { font-family: var(--font-head); font-size: 17px; font-weight: 700; color: var(--ink); }
      .pv-skills .pv-chips { margin-top: 12px; }

      /* --------------------------- availability -------------------------- */
      .pv-availability {
        display: flex; align-items: center; gap: 14px;
        background: var(--pv-surface); border: 1px solid var(--pv-line-soft);
        border-radius: 18px; padding: 18px; margin-top: 12px;
      }
      .pv-availability:hover { border-color: var(--accent-ink); }
      .pv-availability-title {
        display: inline-flex; align-items: center; gap: 9px; flex-shrink: 0;
        font-family: var(--font-head); font-size: 15.5px; font-weight: 700; color: var(--ink);
      }
      .pv-availability-title svg { color: var(--accent-ink); }
      .pv-availability-lines { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
      .pv-availability-line {
        display: inline-flex; align-items: center; gap: 8px;
        font-size: 14.5px; color: var(--ink);
      }
      .pv-availability-line-dim { color: var(--ink-dim); font-size: 13px; white-space: nowrap; }
      .pv-availability-chevron { color: var(--ink-faint); flex-shrink: 0; }

      /* ------------------------------- tabs ------------------------------ */
      .pv-tabs {
        display: flex; border-bottom: 1px solid var(--pv-line-soft);
        margin-top: 26px; overflow-x: auto; scrollbar-width: none;
      }
      .pv-tabs::-webkit-scrollbar { display: none; }
      .pv-tab {
        flex: 1; padding: 14px 8px; text-align: center;
        font-size: 15px; font-weight: 600; color: var(--ink-faint);
        border-bottom: 2px solid transparent; white-space: nowrap;
        transition: color 0.15s ease;
      }
      .pv-tab-active { color: var(--accent-ink); border-bottom-color: var(--accent-ink); }
      .pv-tabpanel { padding: 18px 0 0; min-height: 140px; }

      /* ------------------------------- feed ------------------------------ */
      .pv-feed { display: flex; flex-direction: column; gap: 14px; }
      .pv-post {
        background: var(--pv-surface); border: 1px solid var(--pv-line-soft);
        border-radius: 18px; padding: 18px;
      }
      .pv-post-head { display: flex; align-items: flex-start; gap: 12px; }
      .pv-post-avatar {
        width: 46px; height: 46px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
        background: var(--pv-surface-2);
        display: flex; align-items: center; justify-content: center;
        font-family: var(--font-head); font-weight: 700; font-size: 15px; color: var(--accent-ink);
      }
      .pv-post-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .pv-post-ids { flex: 1; min-width: 0; }
      .pv-post-name {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 15.5px; font-weight: 700; color: var(--ink);
      }
      .pv-post-sub { font-size: 13.5px; color: var(--ink-faint); margin-top: 2px; }
      .pv-post-tools { display: inline-flex; align-items: center; gap: 12px; flex-shrink: 0; }
      .pv-post-pinned {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 13px; font-weight: 600; color: var(--accent-ink);
      }
      .pv-post-more { color: var(--ink-faint); display: inline-flex; }
      .pv-post-more:hover { color: var(--ink); }
      .pv-post-body {
        font-size: 15px; line-height: 1.55; color: var(--ink);
        white-space: pre-wrap; margin-top: 14px;
      }
      .pv-post-actions {
        display: flex; align-items: center; gap: 34px;
        margin-top: 16px;
      }
      .pv-post-action {
        display: inline-flex; align-items: center; gap: 9px;
        font-size: 14px; color: var(--ink-dim);
      }
      .pv-post-action:hover { color: var(--accent-ink); }

      /* ------------------------------- gate ------------------------------ */
      .pv-gate {
        display: flex; flex-direction: column; align-items: center; text-align: center;
        background: var(--pv-surface); border: 1px solid var(--pv-line-soft);
        border-radius: 18px; padding: 28px 20px; margin-top: 24px;
      }
      .pv-gate-icon {
        width: 58px; height: 58px; border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        border: 1px solid var(--lemon-deep); color: var(--ink);
      }
      .pv-gate h2 {
        font-family: var(--font-display); font-weight: 800; font-size: 21px;
        color: var(--ink); margin-top: 18px;
      }
      .pv-gate p {
        font-size: 14.5px; color: var(--ink-dim); line-height: 1.5;
        margin-top: 10px; max-width: 420px;
      }
      .pv-gate-actions { display: flex; gap: 14px; margin-top: 22px; width: 100%; max-width: 400px; }

      /* ------------------------------- why ------------------------------- */
      .pv-why { margin-top: 28px; padding-top: 22px; border-top: 1px solid var(--pv-line-soft); }
      .pv-why h2 { font-family: var(--font-head); font-size: 17px; font-weight: 700; color: var(--ink); }
      .pv-why-grid {
        display: grid; grid-template-columns: 1fr; gap: 18px; margin-top: 18px;
      }
      @media (min-width: 640px) { .pv-why-grid { grid-template-columns: repeat(3, 1fr); } }
      .pv-why-item { display: flex; gap: 12px; align-items: flex-start; }
      .pv-why-icon {
        width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        background: var(--pv-surface); color: var(--accent-ink);
      }
      .pv-why-title { font-size: 15px; font-weight: 700; color: var(--ink); }
      .pv-why-body { font-size: 13.5px; color: var(--ink-dim); line-height: 1.45; margin-top: 3px; }

      /* ----------------------------- sub-tabs ---------------------------- */
      .pv-projects { display: flex; flex-direction: column; gap: 14px; }
      .pv-portfolio { display: flex; flex-direction: column; gap: 10px; }
      .pv-portfolio-link {
        display: flex; align-items: center; gap: 10px;
        background: var(--pv-surface); border: 1px solid var(--pv-line-soft);
        border-radius: 14px; padding: 14px 16px;
        font-size: 14px; color: var(--ink);
      }
      .pv-portfolio-link span { flex: 1; min-width: 0; word-break: break-all; }
      .pv-portfolio-link svg:first-child { color: var(--accent-ink); flex-shrink: 0; }
      .pv-portfolio-chevron { color: var(--ink-faint); flex-shrink: 0; }
      .pv-portfolio-link:hover { border-color: var(--accent-ink); }

      .pv-about-section { padding: 18px 0; border-top: 1px solid var(--pv-line-soft); }
      .pv-about-section:first-child { border-top: none; padding-top: 0; }
      .pv-about-section h2 {
        font-family: var(--font-head); font-size: 13px; font-weight: 600;
        color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.05em;
        margin-bottom: 12px;
      }
      .pv-about-text { font-size: 14.5px; color: var(--ink-dim); line-height: 1.55; white-space: pre-wrap; }
      .pv-exp-list { display: flex; flex-direction: column; gap: 14px; }
      .pv-exp { display: flex; gap: 12px; align-items: flex-start; }
      .pv-exp-icon {
        width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        background: var(--pv-surface); color: var(--accent-ink);
      }
      .pv-exp-title { font-size: 14.5px; color: var(--ink); font-weight: 600; }
      .pv-exp-years { font-size: 13px; color: var(--ink-faint); margin-top: 2px; }
      .pv-social { display: flex; gap: 14px; }
      .pv-social a {
        width: 42px; height: 42px; border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        background: var(--pv-surface); border: 1px solid var(--pv-line-soft);
        color: var(--ink-dim);
      }
      .pv-social a:hover { color: var(--accent-ink); border-color: var(--accent-ink); }
      .pv-social + .pv-portfolio { margin-top: 14px; }

      .pv-about-empty-link {
        display: inline-flex; align-items: center; gap: 7px;
        font-size: 14px; font-weight: 600; color: var(--accent-ink);
      }
      .pv-about-empty-link:hover { text-decoration: underline; }

      .pv-emptytab {
        display: flex; flex-direction: column; align-items: center; text-align: center;
        background: var(--pv-surface); border: 1px solid var(--pv-line-soft);
        border-radius: 18px; padding: 34px 20px;
      }
      .pv-emptytab-icon { color: var(--accent-ink); }
      .pv-emptytab-title {
        font-family: var(--font-head); font-size: 16.5px; font-weight: 700;
        color: var(--ink); margin-top: 16px;
      }
      .pv-emptytab-body { font-size: 13.5px; color: var(--ink-dim); margin-top: 8px; max-width: 380px; }
      .pv-emptytab-action { flex: 0 0 auto; margin-top: 20px; padding: 13px 24px; font-size: 14.5px; }

      @media (max-width: 400px) {
        .pv-stat-value { font-size: 18px; }
        .pv-stat-label { font-size: 11.5px; }
        .pv-name { font-size: 24px; }
        .pv-post-actions { gap: 24px; }
      }
    `}</style>
  )
}
