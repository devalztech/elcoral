import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Loader2, Pencil, Share2, Link2, Settings, MapPin, MessageCircle, Bell,
  Github, Linkedin, Globe, Briefcase,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { api } from '../lib/api.js'

// Redesigned around the TikTok profile pattern requested: stats row
// (Followers / Following / Likes) instead of metric cards, a settings
// icon routing to its own page instead of inline account controls, a
// single-line profile-strength link instead of a card, and a tab strip
// for Posts / Skills / Liked / Saved / Drafts instead of stacked
// always-visible sections.
//
// Two things below are frontend-only placeholders with no backend field
// yet (commented at each site, not shown to the user): follower/
// following/like counts, and the Liked/Saved/Drafts tab contents. Posts
// and Skills tabs use real data. Wire the rest up when the backend pass
// happens.
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
      <ProfileHeader profile={profile} isLoggedIn={Boolean(user)} />
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

function ProfileHeader({ profile, isLoggedIn }) {
  const isOwner = profile.is_owner

  const initials = useMemo(
    () => profile.full_name?.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    [profile.full_name]
  )

  function copyLink() {
    const url = `${window.location.origin}/u/${profile.username}`
    navigator.clipboard?.writeText(url).catch(() => {})
  }

  const pct = profile.profile_completion_pct ?? 0

  return (
    <div className="ph">
      {isOwner && (
        <div className="ph-toolbar">
          <Link to="/home/messages" className="ph-icon-btn" aria-label="Messages">
            <MessageCircle size={20} />
          </Link>
          <Link to="/home/notifications" className="ph-icon-btn" aria-label="Alerts">
            <Bell size={20} />
          </Link>
          <Link to="/home/settings" className="ph-icon-btn" aria-label="Settings">
            <Settings size={20} />
          </Link>
        </div>
      )}

      <div className="ph-avatar">
        {profile.photo_url ? <img src={profile.photo_url} alt="" /> : <span>{initials}</span>}
      </div>

      <h1 className="ph-name">{profile.full_name}</h1>
      {profile.username && <p className="ph-username">@{profile.username}</p>}

      {/* Follower/following/like counts have no backend field yet — shown
          as zero rather than inventing fake numbers. Wire to real counts
          once the backend has a followers/likes model. */}
      <div className="ph-stats">
        <StatItem value={0} label="Following" />
        <StatItem value={0} label="Followers" />
        <StatItem value={0} label="Likes" />
      </div>

      {profile.bio && <p className="ph-bio">{profile.bio}</p>}

      {(profile.city || profile.is_remote) && (
        <p className="ph-location">
          <MapPin size={12} />
          {[profile.city, profile.is_remote ? 'Remote' : null].filter(Boolean).join(' · ')}
        </p>
      )}

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

      {isOwner && (
        <Link to="/home/profile/edit" className="ph-strength">
          {pct}% complete — finish setting up your profile ›
        </Link>
      )}

      <style>{`
        .ph { display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; padding-top: 8px; }
        .ph-toolbar {
          position: absolute; top: 0; right: 0;
          display: flex; align-items: center; gap: 2px;
        }
        .ph-icon-btn {
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--ink-dim); padding: 8px; border-radius: 10px;
        }
        .ph-icon-btn:hover { color: var(--lemon); background: var(--panel-raised); }
        .ph-avatar {
          width: 88px; height: 88px; border-radius: 50%;
          background: var(--panel-raised); border: 2px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          font-family: var(--font-head); font-weight: 700; font-size: 26px; color: var(--lemon);
        }
        .ph-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .ph-name { font-family: var(--font-display); font-weight: 800; font-size: 20px; color: var(--ink); margin-top: 12px; }
        .ph-username { color: var(--ink-faint); font-size: 13.5px; margin-top: 2px; }

        .ph-stats { display: flex; gap: 28px; margin-top: 18px; }
        .ph-bio { color: var(--ink-dim); font-size: 14px; line-height: 1.5; margin-top: 14px; max-width: 320px; white-space: pre-wrap; }
        .ph-location {
          display: inline-flex; align-items: center; gap: 4px;
          color: var(--ink-faint); font-size: 12.5px; margin-top: 10px;
        }
        .ph-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; justify-content: center; }
        .ph-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13.5px; font-weight: 600; color: var(--ink);
          background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 999px; padding: 9px 16px;
        }
        .ph-btn:hover { border-color: var(--lemon); }
        .ph-btn-primary { background: var(--lemon); color: #0B0D0A; border-color: var(--lemon); }

        .ph-strength {
          font-size: 13px; font-weight: 600; color: var(--lemon);
          margin-top: 16px;
        }
        .ph-strength:hover { text-decoration: underline; }
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
        .stat-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .stat-item-value { font-family: var(--font-head); font-size: 17px; font-weight: 700; color: var(--ink); }
        .stat-item-label { font-size: 12px; color: var(--ink-faint); }
      `}</style>
    </div>
  )
}

const TABS = ['Posts', 'Skills', 'Liked', 'Saved', 'Drafts']

function ProfileBody({ profile, posts }) {
  const [tab, setTab] = useState('Posts')

  return (
    <div className="pb">
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
        {tab === 'Skills' && <SkillsTab profile={profile} />}
        {/* Liked/Saved/Drafts have no backend data source yet — shown as
            empty states rather than fake content. Wire up once those
            models/endpoints exist. */}
        {tab === 'Liked' && <EmptyTab icon="heart" text="No liked posts yet" />}
        {tab === 'Saved' && <EmptyTab icon="bookmark" text="No saved posts yet" />}
        {tab === 'Drafts' && <EmptyTab icon="file" text="No drafts yet" />}
      </div>

      {(profile.github_url || profile.linkedin_url || profile.website_url || profile.portfolio_links?.length > 0 || profile.work_experience?.length > 0) && (
        <div className="pb-extra">
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

          {profile.portfolio_links?.length > 0 && (
            <ExtraSection title="Portfolio">
              <div className="pb-links">
                {profile.portfolio_links.map((l) => (
                  <a key={l} href={l} target="_blank" rel="noreferrer" className="pb-link">{l}</a>
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
        </div>
      )}

      <style>{`
        .pb-tabs {
          display: flex; border-bottom: 1px solid var(--border);
          margin-top: 28px; overflow-x: auto;
        }
        .pb-tab {
          flex: 1; padding: 12px 8px; text-align: center;
          font-size: 13px; font-weight: 600; color: var(--ink-faint);
          background: none; border: none; border-bottom: 2px solid transparent; white-space: nowrap;
        }
        .pb-tab-active { color: var(--ink); border-bottom-color: var(--lemon); }
        .pb-panel { padding: 20px 0; min-height: 120px; }

        .pb-exp-list { display: flex; flex-direction: column; gap: 12px; }
        .pb-exp-title { font-size: 14px; color: var(--ink); font-weight: 600; }
        .pb-exp-years { font-size: 12.5px; color: var(--ink-faint); margin-top: 2px; }
        .pb-links { display: flex; flex-direction: column; gap: 8px; }
        .pb-link { font-size: 13.5px; color: var(--lemon); word-break: break-all; }
        .pb-link:hover { text-decoration: underline; }
        .pb-social { display: flex; gap: 16px; justify-content: center; padding: 8px 0; }
        .pb-social a { color: var(--ink-dim); }
        .pb-social a:hover { color: var(--lemon); }
        .pb-extra { margin-top: 8px; }
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
  if (posts.length === 0) return <EmptyTab text="No posts yet" />
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
        .post-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
        .post-card p { font-size: 14px; color: var(--ink); white-space: pre-wrap; }
        .post-date { display: block; font-size: 11.5px; color: var(--ink-faint); margin-top: 8px; }
      `}</style>
    </div>
  )
}

function SkillsTab({ profile }) {
  if (!profile.skills?.length) return <EmptyTab text="No skills added yet" />
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

function EmptyTab({ text }) {
  return (
    <div className="empty-tab">
      <p>{text}</p>
      <style>{`.empty-tab { text-align: center; padding: 30px 0; color: var(--ink-faint); font-size: 13.5px; }`}</style>
    </div>
  )
}
