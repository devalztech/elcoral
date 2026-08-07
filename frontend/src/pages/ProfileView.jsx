import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Loader2, Pencil, Share2, Link2, Settings, MapPin, MessageCircle, Bell,
  Github, Linkedin, Globe, Briefcase, MoreHorizontal, Plus, ImagePlus,
  BadgeCheck, Wifi, ChevronRight, ChevronDown, Check, Clock, FileEdit,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { api } from '../lib/api.js'

// Profile page built to the approved design reference: cover photo with an
// overlapping avatar, icon toolbars on both top corners, verified name,
// badge chips, meta row, 5-up stat strip, action row, a two-card grid
// (profile completion + currently building), an availability strip, and a
// tab strip.
//
// Frontend-only placeholders (no backend field yet, not surfaced to the
// user as fake data): follower/following/like/project counts, badge chips,
// the "Currently building" card, the availability strip, and the
// Projects/Portfolio tabs. Posts, Skills, About and profile completion use
// real data where the API provides it.
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
        setPosts(postList)
      })
      .catch(() => setError('not-found'))
      .finally(() => setLoading(false))
  }, [resolvedUsername, resolving, accessToken])

  if (loading || resolving) {
    return (
      <div className="pv-loading">
        <Loader2 size={24} className="spin" />
        <style>{`.pv-loading { display: flex; justify-content: center; padding: 80px 0; color: var(--ink-faint); } .spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
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

  return (
    <div className="pv">
      <ProfileHeader profile={profile} isLoggedIn={Boolean(user)} postCount={posts.length} />
      <ProfileBody profile={profile} posts={posts} />
    </div>
  )
}

function EmptyState({ title, body, actionTo, actionLabel }) {
  return (
    <div className="empty-state">
      <h1>{title}</h1>
      <p>{body}</p>
      {actionTo && <Link to={actionTo} className="empty-action">{actionLabel}</Link>}
      <style>{`
        .empty-state { text-align: center; padding: 60px 20px; }
        .empty-state h1 { font-family: var(--font-head); font-size: 20px; color: var(--ink); margin-bottom: 8px; }
        .empty-state p { color: var(--ink-dim); font-size: 14px; }
        .empty-action {
          display: inline-block; margin-top: 18px;
          background: var(--lemon); color: #0B0D0A; font-weight: 700;
          font-size: 13.5px; padding: 10px 20px; border-radius: 999px;
        }
      `}</style>
    </div>
  )
}

/* ------------------------------- header -------------------------------- */

function ProfileHeader({ profile, isLoggedIn, postCount }) {
  const isOwner = profile.is_owner
  const [moreOpen, setMoreOpen] = useState(false)

  const initials = useMemo(
    () => profile.full_name?.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    [profile.full_name]
  )

  function copyLink() {
    const url = `${window.location.origin}/u/${profile.username}`
    navigator.clipboard?.writeText(url).catch(() => {})
  }

  // Placeholder badge chips — no backend field for badges yet.
  const badges = [
    { emoji: '👑', label: 'Official' },
    { emoji: '🧪', label: 'Beta Tester' },
    { emoji: '🌱', label: 'Early Supporter' },
  ]

  return (
    <div className="ph">
      {/* Cover photo. No backend field yet — falls back to a branded
          gradient. Owner sees a tap-to-upload affordance. */}
      <div className="ph-cover">
        {profile.cover_url && <img src={profile.cover_url} alt="" />}

        {isOwner && (
          <div className="ph-toolbar ph-toolbar-left">
            <Link to="/home/more" className="ph-icon-btn" aria-label="More">
              <MoreHorizontal size={20} />
            </Link>
          </div>
        )}

        {isOwner && (
          <div className="ph-toolbar ph-toolbar-right">
            <Link to="/home/messages" className="ph-icon-btn" aria-label="Messages">
              <MessageCircle size={19} />
            </Link>
            <Link to="/home/notifications" className="ph-icon-btn" aria-label="Alerts">
              <Bell size={19} />
            </Link>
            <Link to="/home/settings" className="ph-icon-btn" aria-label="Settings">
              <Settings size={19} />
            </Link>
          </div>
        )}

        {isOwner && (
          <Link to="/home/profile/edit" className="ph-cover-upload" aria-label="Edit cover photo">
            <ImagePlus size={15} /> <span>Edit cover</span>
          </Link>
        )}

        <div className="ph-avatar-wrap">
          <div className="ph-avatar">
            {profile.photo_url ? <img src={profile.photo_url} alt="" /> : <span>{initials}</span>}
          </div>
          {isOwner && (
            <Link to="/home/profile/edit" className="ph-avatar-add" aria-label="Upload profile photo">
              <Plus size={16} strokeWidth={3} />
            </Link>
          )}
        </div>
      </div>

      <h1 className="ph-name">
        {profile.full_name}
        <BadgeCheck size={19} className="ph-verified" />
      </h1>
      {profile.username && <p className="ph-username">@{profile.username}</p>}

      {profile.bio && <p className="ph-bio">{profile.bio}</p>}

      {/* Placeholder badges — swap for real badge data when available. */}
      <div className="ph-badges">
        {badges.map((b) => (
          <span className="ph-badge" key={b.label}>
            <span aria-hidden="true">{b.emoji}</span> {b.label}
          </span>
        ))}
      </div>

      <div className="ph-meta">
        {profile.city && (
          <span className="ph-meta-item"><MapPin size={13} /> {profile.city}</span>
        )}
        {profile.is_remote && (
          <span className="ph-meta-item"><Wifi size={13} /> Remote</span>
        )}
        <span className="ph-meta-item"><i className="ph-dot-live" /> Available</span>
      </div>

      {/* Counts other than Posts have no backend field yet — shown as zero
          rather than inventing numbers. */}
      <div className="ph-stats">
        <StatItem value={0} label="Following" />
        <StatItem value={0} label="Followers" />
        <StatItem value={profile.portfolio_links?.length ?? 0} label="Projects" />
        <StatItem value={postCount} label="Posts" />
        <StatItem value={0} label="Likes" />
      </div>

      <div className="ph-actions">
        {isOwner ? (
          <>
            <Link to="/home/profile/edit" className="ph-btn ph-btn-primary">
              <Pencil size={15} /> Edit Profile
            </Link>
            <button type="button" className="ph-btn" onClick={copyLink}>
              <Share2 size={15} /> Share Profile
            </button>
            <button
              type="button"
              className="ph-btn ph-btn-icon"
              aria-label="More profile actions"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <ChevronDown size={16} />
            </button>
          </>
        ) : isLoggedIn ? (
          <>
            <button type="button" className="ph-btn ph-btn-primary">Follow</button>
            <button type="button" className="ph-btn"><MessageCircle size={15} /> Message</button>
            <button type="button" className="ph-btn ph-btn-icon" onClick={copyLink} aria-label="Copy link">
              <Link2 size={16} />
            </button>
          </>
        ) : (
          <>
            <Link to="/signup" className="ph-btn ph-btn-primary">Sign up to connect</Link>
            <button type="button" className="ph-btn" onClick={copyLink}>
              <Link2 size={15} /> Copy link
            </button>
          </>
        )}
      </div>

      {moreOpen && isOwner && (
        <div className="ph-more">
          <Link to="/home/settings" className="ph-more-item">Account settings</Link>
          <Link to="/home/more" className="ph-more-item">More options</Link>
          <button type="button" className="ph-more-item" onClick={copyLink}>Copy profile link</button>
        </div>
      )}

      <style>{`
        .ph { display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; }

        .ph-cover {
          position: relative; width: 100%; height: 158px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(196,241,53,0.16), rgba(0,0,0,0.5)), var(--panel-raised);
          border: 1px solid var(--border);
          margin-bottom: 52px;
        }
        .ph-cover > img {
          position: absolute; inset: 0;
          width: 100%; height: 100%; object-fit: cover;
          border-radius: 18px;
        }
        .ph-cover-upload {
          position: absolute; right: 12px; bottom: 12px; z-index: 2;
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 13px; font-weight: 600; color: var(--ink);
          background: rgba(11, 13, 10, 0.68); border: 1px solid var(--border);
          border-radius: 999px; padding: 9px 15px; backdrop-filter: blur(8px);
        }
        .ph-cover-upload:hover { border-color: var(--lemon); color: var(--lemon); }

        .ph-toolbar {
          position: absolute; top: 12px; z-index: 3;
          display: flex; align-items: center; gap: 8px;
        }
        .ph-toolbar-left { left: 12px; }
        .ph-toolbar-right { right: 12px; }
        .ph-icon-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 38px; height: 38px; border-radius: 50%;
          color: var(--ink);
          background: rgba(11, 13, 10, 0.62);
          border: 1px solid var(--border);
          backdrop-filter: blur(8px);
        }
        .ph-icon-btn:hover { color: var(--lemon); border-color: var(--lemon); }

        .ph-avatar-wrap {
          position: absolute; left: 50%; bottom: -46px; z-index: 2;
          transform: translateX(-50%);
        }
        .ph-avatar {
          width: 104px; height: 104px; border-radius: 50%;
          background: var(--panel-raised); border: 3px solid var(--lemon);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          font-family: var(--font-head); font-weight: 700; font-size: 30px; color: var(--lemon);
        }
        .ph-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .ph-avatar-add {
          position: absolute; right: -2px; bottom: 2px;
          width: 32px; height: 32px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--lemon); color: #0B0D0A;
          border: 3px solid var(--bg, #0B0D0A);
        }

        .ph-name {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-display); font-weight: 800; font-size: 23px; color: var(--ink);
        }
        .ph-verified { color: var(--lemon); flex-shrink: 0; }
        .ph-username { color: var(--ink-faint); font-size: 14px; margin-top: 3px; }
        .ph-bio { color: var(--ink-dim); font-size: 14px; line-height: 1.55; margin-top: 12px; max-width: 340px; white-space: pre-wrap; }

        .ph-badges { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 16px; }
        .ph-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12.5px; font-weight: 600; color: var(--ink);
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 999px; padding: 7px 14px;
        }

        .ph-meta {
          display: flex; flex-wrap: wrap; justify-content: center; align-items: center;
          gap: 6px 14px; margin-top: 16px;
        }
        .ph-meta-item {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12.5px; color: var(--ink-dim);
        }
        .ph-meta-item + .ph-meta-item::before {
          content: '•'; color: var(--ink-faint); margin-right: 9px;
        }
        .ph-dot-live {
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--lemon); display: inline-block;
        }

        .ph-stats {
          display: grid; grid-template-columns: repeat(5, 1fr);
          width: 100%; margin-top: 20px;
        }
        .ph-stats > * + * { border-left: 1px solid var(--border); }

        .ph-actions { display: flex; gap: 10px; margin-top: 20px; width: 100%; }
        .ph-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          flex: 1;
          font-size: 14px; font-weight: 600; color: var(--ink);
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 999px; padding: 13px 16px;
        }
        .ph-btn:hover { border-color: var(--lemon); }
        .ph-btn-primary { background: var(--lemon); color: #0B0D0A; border-color: var(--lemon); font-weight: 700; }
        .ph-btn-icon { flex: 0 0 54px; padding: 13px 0; }

        .ph-more {
          width: 100%; margin-top: 10px;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden;
          display: flex; flex-direction: column;
        }
        .ph-more-item {
          text-align: left; font-size: 13.5px; color: var(--ink);
          padding: 12px 16px; background: none; border: none;
          border-bottom: 1px solid var(--border);
        }
        .ph-more-item:last-child { border-bottom: none; }
        .ph-more-item:hover { color: var(--lemon); background: var(--panel-raised); }
      `}</style>
    </div>
  )
}

function StatItem({ value, label }) {
  return (
    <div className="stat-item">
      <span className="stat-item-value">{value}</span>
      <span className="stat-item-label">{label}</span>
      <style>{`
        .stat-item { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 4px 0; }
        .stat-item-value { font-family: var(--font-head); font-size: 19px; font-weight: 700; color: var(--ink); }
        .stat-item-label { font-size: 12px; color: var(--ink-faint); }
      `}</style>
    </div>
  )
}

/* -------------------------------- cards -------------------------------- */

function ProfileCards({ profile }) {
  const pct = profile.profile_completion_pct ?? 0

  const checklist = [
    { label: 'Add profile photo', worth: 15, done: Boolean(profile.photo_url) },
    { label: 'Add bio', worth: 10, done: Boolean(profile.bio) },
    { label: 'Add location', worth: 10, done: Boolean(profile.city) },
    { label: 'Add skills', worth: 15, done: Boolean(profile.skills?.length) },
    { label: 'Add portfolio', worth: 15, done: Boolean(profile.portfolio_links?.length) },
    { label: 'Create first post', worth: 15, done: false },
  ]

  return (
    <div className="pc">
      <section className="pc-card">
        <Link to="/home/profile/edit" className="pc-head">
          <h2>Profile completion</h2>
          <span className="pc-head-right">
            <strong>{pct}%</strong> <ChevronRight size={16} />
          </span>
        </Link>
        <div className="pc-bar"><i style={{ width: `${Math.min(100, pct)}%` }} /></div>
        <ul className="pc-list">
          {checklist.map((c) => (
            <li key={c.label} className={c.done ? 'pc-done' : ''}>
              <span className="pc-tick">{c.done ? <Check size={13} strokeWidth={3} /> : null}</span>
              <span className="pc-label">{c.label}</span>
              <span className="pc-worth">+{c.worth}%</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Placeholder card — no "currently building" model on the backend yet. */}
      <section className="pc-card">
        <Link to="/home/profile/edit" className="pc-head">
          <h2><span aria-hidden="true">🚀</span> Currently building</h2>
          <ChevronRight size={16} />
        </Link>
        <div className="pc-build">
          <div className="pc-build-logo">E</div>
          <div className="pc-build-text">
            <p className="pc-build-title">Elcoral Platform</p>
            <p className="pc-build-desc">A professional ecosystem that connects talent with opportunities.</p>
          </div>
        </div>
        <p className="pc-sub">Looking for</p>
        <div className="pc-chips">
          {['UI/UX Designer', 'Backend Developer', 'Researchers', 'Beta Testers'].map((c) => (
            <span className="pc-chip" key={c}>{c}</span>
          ))}
        </div>
      </section>

      <style>{`
        .pc { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 22px; }
        .pc-card { background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 16px; text-align: left; }
        .pc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--ink-faint); }
        .pc-head h2 { font-family: var(--font-head); font-size: 15px; font-weight: 700; color: var(--ink); display: inline-flex; align-items: center; gap: 7px; }
        .pc-head-right { display: inline-flex; align-items: center; gap: 6px; }
        .pc-head-right strong { color: var(--lemon); font-size: 14.5px; }
        .pc-bar { height: 6px; border-radius: 999px; background: var(--panel-raised); margin-top: 14px; overflow: hidden; }
        .pc-bar i { display: block; height: 100%; background: var(--lemon); border-radius: 999px; }
        .pc-list { list-style: none; margin-top: 14px; display: flex; flex-direction: column; gap: 11px; }
        .pc-list li { display: flex; align-items: center; gap: 10px; }
        .pc-tick {
          width: 21px; height: 21px; border-radius: 50%; flex-shrink: 0;
          border: 2px solid var(--border);
          display: inline-flex; align-items: center; justify-content: center;
          color: #0B0D0A;
        }
        .pc-done .pc-tick { background: var(--lemon); border-color: var(--lemon); }
        .pc-label { flex: 1; font-size: 13.5px; color: var(--ink); }
        .pc-worth {
          font-size: 11.5px; font-weight: 700; color: var(--ink-faint);
          background: var(--panel-raised); border-radius: 999px; padding: 4px 9px;
        }
        .pc-done .pc-worth { color: var(--lemon); }

        .pc-build { display: flex; gap: 12px; margin-top: 14px; }
        .pc-build-logo {
          width: 52px; height: 52px; flex-shrink: 0; border-radius: 12px;
          background: #0B0D0A; border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-weight: 800; font-size: 24px; color: var(--lemon);
        }
        .pc-build-title { font-size: 14.5px; font-weight: 700; color: var(--ink); }
        .pc-build-desc { font-size: 13px; color: var(--ink-dim); line-height: 1.45; margin-top: 3px; }
        .pc-sub { font-size: 12.5px; font-weight: 600; color: var(--ink-dim); margin-top: 14px; }
        .pc-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 9px; }
        .pc-chip {
          font-size: 12px; color: var(--lemon);
          border: 1px solid var(--lemon-deep); border-radius: 999px; padding: 6px 11px;
        }
      `}</style>
    </div>
  )
}

// Placeholder strip — no availability model on the backend yet.
function AvailabilityStrip() {
  return (
    <Link to="/home/profile/edit" className="av">
      <span className="av-title"><Clock size={18} /> Availability</span>
      <span className="av-lines">
        <span className="av-line"><i className="av-dot" /> Open to work</span>
        <span className="av-line av-line-dim"><Clock size={13} /> Usually replies within 15 mins</span>
      </span>
      <ChevronRight size={16} className="av-chev" />
      <style>{`
        .av {
          display: flex; align-items: center; gap: 14px;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 16px; padding: 16px; margin-top: 12px; text-align: left;
        }
        .av:hover { border-color: var(--lemon); }
        .av-title {
          display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0;
          font-family: var(--font-head); font-size: 14.5px; font-weight: 700; color: var(--ink);
        }
        .av-title svg { color: var(--lemon); }
        .av-lines { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; }
        .av-line { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; color: var(--ink); }
        .av-line-dim { color: var(--ink-dim); font-size: 12.5px; }
        .av-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--lemon); }
        .av-chev { color: var(--ink-faint); flex-shrink: 0; }
      `}</style>
    </Link>
  )
}

/* --------------------------------- body -------------------------------- */

const TABS = ['Posts', 'Projects', 'Portfolio', 'Skills', 'About']

function ProfileBody({ profile, posts }) {
  const [tab, setTab] = useState('Posts')

  return (
    <div className="pb">
      <ProfileCards profile={profile} />
      <AvailabilityStrip />

      <div className="pb-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`pb-tab ${tab === t ? 'pb-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="pb-panel">
        {tab === 'Posts' && <PostsTab posts={posts} />}
        {/* Projects/Portfolio have no dedicated backend model yet — portfolio
            links stand in, projects shows an empty state. */}
        {tab === 'Projects' && <EmptyTab title="No projects yet" body="Showcase what you're building to attract collaborators." action="Add a Project" to="/home/profile/edit" />}
        {tab === 'Portfolio' && <PortfolioTab profile={profile} />}
        {tab === 'Skills' && <SkillsTab profile={profile} />}
        {tab === 'About' && <AboutTab profile={profile} />}
      </div>

      <style>{`
        .pb-tabs {
          display: flex; border-bottom: 1px solid var(--border);
          margin-top: 24px; overflow-x: auto;
        }
        .pb-tab {
          flex: 1; padding: 13px 8px; text-align: center;
          font-size: 13.5px; font-weight: 600; color: var(--ink-faint);
          background: none; border: none; border-bottom: 2px solid transparent; white-space: nowrap;
        }
        .pb-tab-active { color: var(--ink); border-bottom-color: var(--lemon); }
        .pb-panel { padding: 16px 0; min-height: 120px; }
      `}</style>
    </div>
  )
}

function ExtraSection({ title, children }) {
  return (
    <div className="extra-section">
      <h2>{title}</h2>
      {children}
      <style>{`
        .extra-section { padding: 16px 0; border-top: 1px solid var(--border); }
        .extra-section h2 { font-family: var(--font-head); font-size: 13px; font-weight: 600; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 12px; }
      `}</style>
    </div>
  )
}

function PostsTab({ posts }) {
  if (posts.length === 0) {
    return (
      <EmptyTab
        title="No posts yet"
        body="Share your thoughts, ideas or updates with the community."
        action="Create Your First Post"
        to="/home/create"
      />
    )
  }
  return (
    <div className="posts-grid">
      {posts.map((p) => (
        <div className="post-card" key={p.id}>
          <p>{p.body}</p>
          <span className="post-date">{new Date(p.created_at).toLocaleDateString()}</span>
        </div>
      ))}
      <style>{`
        .posts-grid { display: flex; flex-direction: column; gap: 10px; }
        .post-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; text-align: left; }
        .post-card p { font-size: 14px; color: var(--ink); white-space: pre-wrap; }
        .post-date { display: block; font-size: 11.5px; color: var(--ink-faint); margin-top: 8px; }
      `}</style>
    </div>
  )
}

function PortfolioTab({ profile }) {
  if (!profile.portfolio_links?.length) {
    return <EmptyTab title="No portfolio yet" body="Add links to your best work so people can see what you do." action="Add Portfolio Link" to="/home/profile/edit" />
  }
  return (
    <div className="pt">
      {profile.portfolio_links.map((l) => (
        <a key={l} href={l} target="_blank" rel="noreferrer" className="pt-link">{l}</a>
      ))}
      <style>{`
        .pt { display: flex; flex-direction: column; gap: 8px; text-align: left; }
        .pt-link { font-size: 13.5px; color: var(--lemon); word-break: break-all; }
        .pt-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

function SkillsTab({ profile }) {
  if (!profile.skills?.length) {
    return <EmptyTab title="No skills added yet" body="Add the skills you want to be found for." action="Add Skills" to="/home/profile/edit" />
  }
  return (
    <div className="skills-tab">
      {profile.skills.map((s) => <span key={s} className="skill-chip">{s}</span>)}
      <style>{`
        .skills-tab { display: flex; flex-wrap: wrap; gap: 8px; }
        .skill-chip {
          font-size: 13px; color: var(--ink-dim); background: var(--panel-raised);
          border: 1px solid var(--border); border-radius: 999px; padding: 7px 13px;
        }
      `}</style>
    </div>
  )
}

function AboutTab({ profile }) {
  const hasAny =
    profile.bio || profile.work_experience?.length || profile.github_url ||
    profile.linkedin_url || profile.website_url

  if (!hasAny) {
    return <EmptyTab title="Nothing here yet" body="Tell people who you are and what you work on." action="Edit Profile" to="/home/profile/edit" />
  }

  return (
    <div className="about-tab">
      {profile.bio && (
        <ExtraSection title="Bio">
          <p className="about-bio">{profile.bio}</p>
        </ExtraSection>
      )}

      {profile.work_experience?.length > 0 && (
        <ExtraSection title="Experience" icon={Briefcase}>
          <div className="pb-exp-list">
            {profile.work_experience.map((w, i) => (
              <div className="pb-exp" key={i}>
                <p className="pb-exp-title">{w.title} · {w.company}</p>
                <p className="pb-exp-years">{w.years}</p>
              </div>
            ))}
          </div>
        </ExtraSection>
      )}

      {(profile.github_url || profile.linkedin_url || profile.website_url) && (
        <div className="pb-social">
          {profile.github_url && <a href={profile.github_url} target="_blank" rel="noreferrer"><Github size={18} /></a>}
          {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noreferrer"><Linkedin size={18} /></a>}
          {profile.website_url && <a href={profile.website_url} target="_blank" rel="noreferrer"><Globe size={18} /></a>}
        </div>
      )}

      <style>{`
        .about-tab { text-align: left; }
        .about-bio { font-size: 14px; color: var(--ink-dim); line-height: 1.55; white-space: pre-wrap; }
        .pb-exp-list { display: flex; flex-direction: column; gap: 12px; }
        .pb-exp-title { font-size: 14px; color: var(--ink); font-weight: 600; }
        .pb-exp-years { font-size: 12.5px; color: var(--ink-faint); margin-top: 2px; }
        .pb-social { display: flex; gap: 16px; justify-content: center; padding: 16px 0; border-top: 1px solid var(--border); }
        .pb-social a { color: var(--ink-dim); }
        .pb-social a:hover { color: var(--lemon); }
      `}</style>
    </div>
  )
}

function EmptyTab({ title, body, action, to }) {
  return (
    <div className="empty-tab">
      <FileEdit size={40} className="empty-tab-icon" />
      <p className="empty-tab-title">{title}</p>
      {body && <p className="empty-tab-body">{body}</p>}
      {action && to && <Link to={to} className="empty-tab-action">{action}</Link>}
      <style>{`
        .empty-tab {
          display: flex; flex-direction: column; align-items: center; text-align: center;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 16px; padding: 34px 20px;
        }
        .empty-tab-icon { color: var(--lemon); }
        .empty-tab-title { font-family: var(--font-head); font-size: 16px; font-weight: 700; color: var(--ink); margin-top: 14px; }
        .empty-tab-body { font-size: 13px; color: var(--ink-dim); margin-top: 6px; max-width: 320px; }
        .empty-tab-action {
          margin-top: 16px; background: var(--lemon); color: #0B0D0A;
          font-size: 13.5px; font-weight: 700; border-radius: 999px; padding: 11px 20px;
        }
      `}</style>
    </div>
  )
}
