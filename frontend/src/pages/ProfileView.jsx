import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Loader2, Pencil, Share2, Link2, Eye, ChevronDown,
  Github, Linkedin, Globe, MapPin, Briefcase,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { api } from '../lib/api.js'

// Three real views live in one component, driven by two things:
//   1. `profile.is_owner` — decided server-side (see backend
//      app/routers/profile.py), never guessed on the client.
//   2. `viewAs` — a LOCAL, owner-only toggle ("viewing as: Me / Public
//      Visitor") that re-filters the already-fetched data client-side. It
//      never re-fetches with different credentials — the private data was
//      already in the response, so "viewing as visitor" just hides it in
//      the UI. That's the whole point of the toggle: instant, no request.
//
// There's no separate "logged-in-other-user" data shape yet (mutual
// connections, endorsements, etc. — those need new backend tables), so
// right now a logged-in visitor sees the same public fields as an
// anonymous one, just without the "Sign up to connect" CTA. That's called
// out inline below rather than silently faked.
export default function ProfileView() {
  const params = useParams()
  const { user, accessToken } = useAuth()

  // /home/profile (no :username param) means "my own profile" — resolve
  // it via /onboarding/me first to get the username, then load the same
  // viewer-aware endpoint everyone else's profile page uses. This keeps
  // ONE rendering path for owner data instead of two.
  const [resolvedUsername, setResolvedUsername] = useState(params.username ?? null)
  const [resolving, setResolving] = useState(!params.username)

  useEffect(() => {
    if (params.username) {
      setResolvedUsername(params.username)
      setResolving(false)
      return
    }
    if (!accessToken) {
      setResolving(false)
      return
    }
    api
      .myProfile(accessToken)
      .then((p) => setResolvedUsername(p?.username ?? null))
      .finally(() => setResolving(false))
  }, [params.username, accessToken])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [viewAs, setViewAs] = useState('me') // 'me' | 'visitor' — owner-only

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

  const isLoggedIn = Boolean(user)
  // What actually renders — owner fields hidden the instant "viewing as
  // visitor" is picked, same shape either way so nothing below needs to
  // branch on viewAs itself.
  const effectiveIsOwner = profile?.is_owner && viewAs === 'me'

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
      {profile.is_owner && (
        <ViewingAsToggle viewAs={viewAs} setViewAs={setViewAs} />
      )}

      <ProfileHeader profile={profile} isOwner={effectiveIsOwner} isLoggedIn={isLoggedIn} />

      {effectiveIsOwner && <OwnerDashboardCards profile={profile} />}

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

function ViewingAsToggle({ viewAs, setViewAs }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="vat">
      <button type="button" className="vat-trigger" onClick={() => setOpen((o) => !o)}>
        <Eye size={14} />
        Viewing as: {viewAs === 'me' ? 'Me' : 'Public Visitor'}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="vat-menu">
          <button
            type="button"
            className={viewAs === 'me' ? 'active' : ''}
            onClick={() => { setViewAs('me'); setOpen(false) }}
          >
            Me
          </button>
          <button
            type="button"
            className={viewAs === 'visitor' ? 'active' : ''}
            onClick={() => { setViewAs('visitor'); setOpen(false) }}
          >
            Public Visitor
          </button>
        </div>
      )}
      <style>{`
        .vat { position: relative; margin-bottom: 14px; display: flex; justify-content: flex-end; }
        .vat-trigger {
          display: flex; align-items: center; gap: 7px;
          font-size: 12.5px; font-weight: 600; color: var(--ink-dim);
          background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 999px; padding: 7px 14px;
        }
        .vat-trigger:hover { color: var(--ink); border-color: var(--lemon); }
        .vat-menu {
          position: absolute; top: calc(100% + 6px); right: 0; z-index: 10;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 10px; overflow: hidden; min-width: 160px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .vat-menu button {
          display: block; width: 100%; text-align: left;
          font-size: 13px; color: var(--ink-dim); padding: 10px 14px;
        }
        .vat-menu button:hover { background: var(--panel-raised); color: var(--ink); }
        .vat-menu button.active { color: var(--lemon); font-weight: 600; }
      `}</style>
    </div>
  )
}

function ProfileHeader({ profile, isOwner, isLoggedIn }) {
  const initials = useMemo(
    () => profile.full_name?.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    [profile.full_name]
  )

  function copyLink() {
    const url = `${window.location.origin}/u/${profile.username}`
    navigator.clipboard?.writeText(url).catch(() => {})
  }

  return (
    <div className="ph">
      <div className="ph-cover" style={profile.cover_url ? { backgroundImage: `url(${profile.cover_url})` } : undefined} />

      <div className="ph-main">
        <div className="ph-avatar">
          {profile.photo_url ? <img src={profile.photo_url} alt="" /> : <span>{initials}</span>}
        </div>

        <div className="ph-identity">
          <h1>{profile.full_name}</h1>
          {profile.username && <p className="ph-username">@{profile.username}</p>}
          {profile.headline && <p className="ph-headline">{profile.headline}</p>}
          {(profile.city || profile.is_remote) && (
            <p className="ph-location">
              <MapPin size={13} />
              {[profile.city, profile.is_remote ? 'Remote' : null].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        <div className="ph-actions">
          {isOwner ? (
            <>
              <Link to="/home/profile/edit" className="ph-btn ph-btn-primary">
                <Pencil size={14} /> Edit Profile
              </Link>
              <button type="button" className="ph-btn" onClick={copyLink}>
                <Share2 size={14} /> Share
              </button>
            </>
          ) : isLoggedIn ? (
            <>
              <button type="button" className="ph-btn ph-btn-primary">Follow</button>
              <button type="button" className="ph-btn">Message</button>
            </>
          ) : (
            <>
              <Link to="/signup" className="ph-btn ph-btn-primary">Sign up to connect</Link>
              <button type="button" className="ph-btn" onClick={copyLink}>
                <Link2 size={14} /> Copy link
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .ph-cover {
          height: 140px; border-radius: 14px;
          background: linear-gradient(135deg, var(--panel-raised), var(--panel));
          background-size: cover; background-position: center;
          border: 1px solid var(--border);
        }
        .ph-main { display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: -44px; }
        .ph-avatar {
          width: 88px; height: 88px; border-radius: 50%;
          background: var(--panel-raised); border: 3px solid var(--bg);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          font-family: var(--font-head); font-weight: 700; font-size: 26px; color: var(--lemon);
        }
        .ph-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .ph-identity { margin-top: 12px; }
        .ph-identity h1 { font-family: var(--font-display); font-weight: 800; font-size: 21px; color: var(--ink); }
        .ph-username { color: var(--ink-faint); font-size: 13.5px; margin-top: 2px; }
        .ph-headline { color: var(--ink-dim); font-size: 14.5px; margin-top: 6px; }
        .ph-location {
          display: inline-flex; align-items: center; gap: 4px;
          color: var(--ink-faint); font-size: 12.5px; margin-top: 6px;
        }
        .ph-actions { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; justify-content: center; }
        .ph-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13.5px; font-weight: 600; color: var(--ink);
          background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 999px; padding: 9px 16px;
        }
        .ph-btn:hover { border-color: var(--lemon); }
        .ph-btn-primary { background: var(--lemon); color: #0B0D0A; border-color: var(--lemon); }
      `}</style>
    </div>
  )
}

function OwnerDashboardCards({ profile }) {
  const pct = profile.profile_completion_pct ?? 0
  return (
    <div className="odc">
      <div className="odc-card odc-strength">
        <div className="odc-strength-head">
          <span>Profile Strength</span>
          <span className="odc-strength-pct">{pct}%</span>
        </div>
        <div className="odc-bar"><div className="odc-bar-fill" style={{ width: `${pct}%` }} /></div>
        <ProfileStrengthTips profile={profile} />
      </div>

      <div className="odc-stats">
        <StatCard label="Profile views (7d)" value={profile.private?.profile_views_7d ?? 0} />
        <StatCard label="Search appearances (30d)" value={profile.private?.search_appearances_30d ?? 0} />
        <StatCard label="Link clicks (30d)" value={profile.private?.link_clicks_30d ?? 0} />
      </div>
      <p className="odc-stats-note">
        View, search, and click tracking isn't wired up on the backend yet — these will start counting once that's built.
      </p>

      <style>{`
        .odc { margin: 24px 0; }
        .odc-card {
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; padding: 18px 20px; margin-bottom: 14px;
        }
        .odc-strength-head {
          display: flex; justify-content: space-between; align-items: baseline;
          font-family: var(--font-head); font-size: 13.5px; font-weight: 600; color: var(--ink);
          margin-bottom: 10px;
        }
        .odc-strength-pct { color: var(--lemon); font-size: 15px; }
        .odc-bar { height: 8px; border-radius: 999px; background: var(--panel-raised); overflow: hidden; }
        .odc-bar-fill { height: 100%; background: linear-gradient(90deg, var(--lemon-deep), var(--lemon)); border-radius: 999px; }
        .odc-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .odc-stats-note { font-size: 11.5px; color: var(--ink-faint); margin-top: 8px; }
        @media (max-width: 480px) { .odc-stats { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  )
}

function ProfileStrengthTips({ profile }) {
  const tips = []
  if (!profile.portfolio_links?.length) tips.push('Add a portfolio link')
  if (!profile.work_experience?.length) tips.push('Add work experience')
  if (!profile.github_url) tips.push('Add your GitHub')
  if (!profile.linkedin_url) tips.push('Add your LinkedIn')
  if (!profile.bio) tips.push('Write a bio')

  if (!tips.length) return null
  return (
    <ul className="tips">
      {tips.slice(0, 3).map((t) => (
        <li key={t}>+ {t}</li>
      ))}
      <style>{`
        .tips { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .tips li { font-size: 12.5px; color: var(--ink-faint); }
      `}</style>
    </ul>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      <style>{`
        .stat-card {
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 12px; padding: 14px; text-align: center;
        }
        .stat-value { display: block; font-family: var(--font-head); font-size: 20px; font-weight: 700; color: var(--ink); }
        .stat-label { display: block; font-size: 11px; color: var(--ink-faint); margin-top: 4px; }
      `}</style>
    </div>
  )
}

function ProfileBody({ profile, posts }) {
  return (
    <div className="pb">
      {profile.bio && (
        <Section title="About">
          <p className="pb-bio">{profile.bio}</p>
        </Section>
      )}

      {(profile.skills?.length > 0) && (
        <Section title="Skills">
          <div className="pb-chips">
            {profile.skills.map((s) => <span key={s} className="pb-chip">{s}</span>)}
          </div>
        </Section>
      )}

      {(profile.portfolio_links?.length > 0) && (
        <Section title="Portfolio">
          <div className="pb-links">
            {profile.portfolio_links.map((l) => (
              <a key={l} href={l} target="_blank" rel="noreferrer" className="pb-link">{l}</a>
            ))}
          </div>
        </Section>
      )}

      {(profile.work_experience?.length > 0) && (
        <Section title="Experience">
          <div className="pb-exp-list">
            {profile.work_experience.map((w, i) => (
              <div className="pb-exp" key={i}>
                <Briefcase size={15} />
                <div>
                  <p className="pb-exp-title">{w.title} · {w.company}</p>
                  <p className="pb-exp-years">{w.years}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(profile.github_url || profile.linkedin_url || profile.website_url) && (
        <Section title="Links">
          <div className="pb-social">
            {profile.github_url && <a href={profile.github_url} target="_blank" rel="noreferrer"><Github size={18} /></a>}
            {profile.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noreferrer"><Linkedin size={18} /></a>}
            {profile.website_url && <a href={profile.website_url} target="_blank" rel="noreferrer"><Globe size={18} /></a>}
          </div>
        </Section>
      )}

      {posts.length > 0 && (
        <Section title="Posts">
          <div className="pb-posts">
            {posts.map((p) => (
              <div className="pb-post" key={p.id}>
                <p>{p.body}</p>
                <span className="pb-post-date">{new Date(p.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <style>{`
        .pb-bio { font-size: 14.5px; color: var(--ink-dim); line-height: 1.6; white-space: pre-wrap; }
        .pb-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .pb-chip {
          font-size: 13px; color: var(--ink-dim); background: var(--panel-raised);
          border: 1px solid var(--border); border-radius: 999px; padding: 7px 13px;
        }
        .pb-links { display: flex; flex-direction: column; gap: 8px; }
        .pb-link { font-size: 13.5px; color: var(--lemon); word-break: break-all; }
        .pb-link:hover { text-decoration: underline; }
        .pb-exp-list { display: flex; flex-direction: column; gap: 14px; }
        .pb-exp { display: flex; gap: 12px; color: var(--ink-dim); }
        .pb-exp-title { font-size: 14px; color: var(--ink); font-weight: 600; }
        .pb-exp-years { font-size: 12.5px; color: var(--ink-faint); margin-top: 2px; }
        .pb-social { display: flex; gap: 14px; }
        .pb-social a { color: var(--ink-dim); }
        .pb-social a:hover { color: var(--lemon); }
        .pb-posts { display: flex; flex-direction: column; gap: 12px; }
        .pb-post {
          background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 12px; padding: 14px 16px;
        }
        .pb-post p { font-size: 14px; color: var(--ink); white-space: pre-wrap; }
        .pb-post-date { display: block; font-size: 11.5px; color: var(--ink-faint); margin-top: 8px; }
      `}</style>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="section">
      <h2>{title}</h2>
      {children}
      <style>{`
        .section {
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; padding: 20px; margin-bottom: 16px;
        }
        .section h2 {
          font-family: var(--font-head); font-size: 14.5px; font-weight: 600;
          color: var(--ink); margin-bottom: 14px;
        }
      `}</style>
    </div>
  )
}
