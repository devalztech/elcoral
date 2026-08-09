import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell, MessageCircle, Plus, RefreshCw, Search, UserPlus,
} from 'lucide-react'
import ElcoralMark from '../components/ElcoralMark.jsx'
import PostCard from '../features/feed/PostCard.jsx'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { api } from '../api/client.js'
import { avatarTone, formatCount, initialsOf } from '../features/social/format.js'
import { completionPct } from '../features/profile/completion.js'
import { useMessaging } from '../features/messages/useMessaging.jsx'

/**
 * Home feed. Everything on this screen comes from the API — posts, people
 * suggestions and profile completeness — so nothing here can drift from
 * what's actually in the database.
 */

const TABS = [
  { id: 'for-you', label: 'For you' },
  { id: 'following', label: 'Following' },
  { id: 'media', label: 'Media' },
  { id: 'articles', label: 'Articles' },
  { id: 'saved', label: 'Saved' },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function PersonAvatar({ person, size = 40 }) {
  if (person.photo_url) {
    return <img className="hm-av" src={person.photo_url} alt={person.full_name} style={{ width: size, height: size }} />
  }
  return (
    <span
      className={`hm-av tone-${avatarTone(person.id || person.full_name)}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      aria-hidden="true"
    >
      {initialsOf(person.full_name)}
    </span>
  )
}

export default function Dashboard() {
  const { user, accessToken, authLoading } = useAuth()
  const { unreadTotal } = useMessaging()

  const [tab, setTab] = useState('for-you')
  const [posts, setPosts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const [error, setError] = useState('')

  const [people, setPeople] = useState([])
  const [followBusy, setFollowBusy] = useState({})
  const [profile, setProfile] = useState(null)

  const loadFeed = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.feed(accessToken, { tab })
      setPosts(data)
      setExhausted(data.length < 20)
    } catch (err) {
      setError(err.message)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [accessToken, tab])

  useEffect(() => {
    if (authLoading) return
    loadFeed()
  }, [authLoading, loadFeed])

  useEffect(() => {
    if (authLoading || !accessToken) return
    let cancelled = false
    api
      .followSuggestions(accessToken, 10)
      .then((data) => { if (!cancelled) setPeople(data.items ?? []) })
      .catch(() => { if (!cancelled) setPeople([]) })
    api
      .myProfile(accessToken)
      .then((data) => { if (!cancelled) setProfile(data) })
      .catch(() => { if (!cancelled) setProfile(null) })
    return () => { cancelled = true }
  }, [authLoading, accessToken])

  const loadMore = async () => {
    if (!posts?.length || loadingMore || exhausted) return
    setLoadingMore(true)
    try {
      const next = await api.feed(accessToken, { tab, cursor: posts[posts.length - 1].id })
      setPosts((list) => [...list, ...next])
      if (next.length < 20) setExhausted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const follow = async (person) => {
    if (!person.username || followBusy[person.id]) return
    setFollowBusy((s) => ({ ...s, [person.id]: true }))
    try {
      await api.followUser(person.username, accessToken)
      setPeople((list) => list.filter((p) => p.id !== person.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setFollowBusy((s) => ({ ...s, [person.id]: false }))
    }
  }

  const firstName = user?.full_name ? user.full_name.split(' ')[0] : null
  // Same number the profile page shows: the server's weighted score
  // (features/profile/completion.js), never a second local formula.
  const progress = completionPct(profile)

  return (
    <div className="hm">
      <header className="hm-bar">
        <Link to="/home" className="hm-brand">
          <ElcoralMark size={30} color="var(--lemon)" />
          <span>Elcoral</span>
        </Link>
        <div className="hm-bar-actions">
          <Link to="/home/search" className="hm-icon-btn" aria-label="Search">
            <Search size={23} strokeWidth={1.9} />
          </Link>
          <Link
            to="/home/messages"
            className="hm-icon-btn"
            aria-label={unreadTotal ? `Messages, ${unreadTotal} unread conversation${unreadTotal === 1 ? '' : 's'}` : 'Messages'}
          >
            <MessageCircle size={23} strokeWidth={1.9} />
            {unreadTotal > 0 && <span className="hm-badge">{unreadTotal > 99 ? '99+' : unreadTotal}</span>}
          </Link>
          <Link to="/home/notifications" className="hm-icon-btn" aria-label="Notifications">
            <Bell size={23} strokeWidth={1.9} />
          </Link>
        </div>
      </header>

      {user && (
        <section className="hm-greet">
          <div className="hm-greet-text">
            <p className="hm-greet-title">{greeting()}{firstName ? `, ${firstName}` : ''} 👋</p>
            <p className="hm-greet-sub">Share what you're building today.</p>
          </div>
          {progress !== null && progress < 100 && (
            <Link to="/home/profile/edit" className="hm-progress">
              <span className="hm-progress-text">
                <span className="hm-progress-label">Complete profile</span>
                <span className="hm-progress-value"><b>{progress}%</b> done</span>
              </span>
              <span
                className="hm-ring"
                style={{ background: `conic-gradient(var(--lemon) ${progress * 3.6}deg, var(--border) 0deg)` }}
              />
            </Link>
          )}
        </section>
      )}

      {user && (
        <Link to="/home/create/post" className="hm-composer">
          <span className="hm-composer-av">
            {profile?.photo_url
              ? <img src={profile.photo_url} alt="" />
              : initialsOf(user.full_name)}
          </span>
          <span className="hm-composer-hint">Share an update, project or article…</span>
          <span className="hm-composer-cta"><Plus size={18} strokeWidth={2.4} /></span>
        </Link>
      )}

      {people.length > 0 && (
        <>
          <div className="hm-section-head">
            <h2>People to follow</h2>
            <Link to="/home/discover" className="hm-see-all">See all</Link>
          </div>
          <div className="hm-rail">
            {people.map((person) => (
              <article key={person.id} className="hm-rec">
                <div className="hm-rec-top">
                  <PersonAvatar person={person} />
                  <div className="hm-rec-id">
                    <h3>{person.full_name}</h3>
                    <p>{person.headline || (person.username ? `@${person.username}` : 'On Elcoral')}</p>
                  </div>
                </div>
                {person.follows_you && <span className="hm-chip">Follows you</span>}
                <button
                  type="button"
                  className="hm-rec-cta"
                  disabled={!!followBusy[person.id]}
                  onClick={() => follow(person)}
                >
                  <UserPlus size={15} strokeWidth={2.2} /> Follow
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      <nav className="hm-tabs" aria-label="Feed filters">
        <div className="hm-rail hm-tabs-rail">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`hm-tab ${tab === t.id ? 'on' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="hm-feed">
        {error && (
          <div className="hm-empty">
            <p>{error}</p>
            <button type="button" className="hm-retry" onClick={loadFeed}>
              <RefreshCw size={16} strokeWidth={2} /> Try again
            </button>
          </div>
        )}

        {loading && (
          <>
            <div className="hm-skeleton" />
            <div className="hm-skeleton" />
          </>
        )}

        {!loading && posts?.length === 0 && !error && (
          <div className="hm-empty">
            <p>
              {tab === 'following' && 'Nothing here yet — follow a few people and their posts will show up.'}
              {tab === 'saved' && "You haven't saved any posts yet."}
              {tab === 'media' && 'No photos or videos have been shared yet.'}
              {tab === 'articles' && 'No articles have been published yet.'}
              {tab === 'for-you' && 'The feed is empty. Be the first to post something.'}
            </p>
            {user && (
              <Link to="/home/create/post" className="hm-retry">
                <Plus size={16} strokeWidth={2.4} /> Create a post
              </Link>
            )}
          </div>
        )}

        {!loading &&
          posts?.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDeleted={(id) => setPosts((list) => list.filter((p) => p.id !== id))}
            />
          ))}

        {!loading && posts?.length > 0 && !exhausted && (
          <button type="button" className="hm-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}

        {!loading && posts?.length > 0 && exhausted && (
          <p className="hm-end">{formatCount(posts.length)} posts · you're all caught up</p>
        )}
      </div>

      <Link to="/home/create/post" className="hm-fab" aria-label="Create a post">
        <Plus size={30} strokeWidth={2.4} />
      </Link>

      <style>{`
        /* full-bleed against AppShell's 20px page padding */
        .hm { --gut: 20px; margin: -24px -20px 0; padding-bottom: 8px; }
        @media (min-width: 860px) { .hm { margin: -32px -40px 0; --gut: 40px; } }

        .hm-av {
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; flex: none; overflow: hidden; object-fit: cover;
          font-family: var(--font-head); font-weight: 700; letter-spacing: .3px;
          color: var(--ink); background: var(--panel-raised);
        }
        .hm-av.tone-a { background: linear-gradient(145deg,#1d2415,#0f1309); color: var(--accent-ink); }
        .hm-av.tone-b { background: linear-gradient(145deg,#3a2a20,#1a130e); }
        .hm-av.tone-c { background: linear-gradient(145deg,#28303a,#12161b); }

        .hm-bar {
          position: sticky; top: 0; z-index: 30;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 14px var(--gut) 12px;
          background: color-mix(in srgb, var(--bg) 88%, transparent);
          backdrop-filter: blur(14px);
        }
        .hm-brand { display: flex; align-items: center; gap: 9px; color: var(--ink); }
        .hm-brand span { font-family: var(--font-display); font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
        .hm-bar-actions { display: flex; align-items: center; gap: 6px; }
        .hm-icon-btn {
          position: relative; display: grid; place-items: center;
          width: 40px; height: 40px; border-radius: 999px; color: var(--ink);
        }
        .hm-icon-btn:hover { background: var(--panel); color: var(--accent-ink); }

        .hm-rail {
          display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x proximity;
          padding: 0 var(--gut); -webkit-overflow-scrolling: touch; scrollbar-width: none;
        }
        .hm-rail::-webkit-scrollbar { display: none; }
        .hm-rail > * { scroll-snap-align: start; }

        .hm-greet {
          margin: 8px var(--gut) 0; padding: 12px;
          display: flex; align-items: center; gap: 12px;
          background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
        }
        .hm-greet-text { flex: 1; min-width: 0; }
        .hm-greet-title { margin: 0; font-family: var(--font-head); font-size: 15.5px; font-weight: 700; color: var(--ink); }
        .hm-greet-sub { margin: 3px 0 0; font-size: 13px; color: var(--ink-dim); }
        .hm-icon-btn { position: relative; }
        .hm-badge {
          position: absolute; top: -2px; right: -3px;
          min-width: 17px; height: 17px; padding: 0 4px; border-radius: 999px;
          background: var(--lemon); color: var(--on-accent);
          font-size: 10px; font-weight: 700; line-height: 17px; text-align: center;
          border: 2px solid var(--bg);
        }
        .hm-progress {
          flex: none; display: flex; align-items: center; gap: 10px;
          background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 12px; padding: 9px 11px; color: var(--ink);
        }
        .hm-progress-text { display: flex; flex-direction: column; gap: 2px; }
        .hm-progress-label { font-family: var(--font-head); font-size: 13px; font-weight: 600; }
        .hm-progress-value { font-size: 11.5px; color: var(--ink-dim); }
        .hm-ring {
          width: 34px; height: 34px; border-radius: 999px; flex: none;
          mask: radial-gradient(circle, transparent 60%, #000 61%);
          -webkit-mask: radial-gradient(circle, transparent 60%, #000 61%);
        }

        .hm-composer {
          margin: 12px var(--gut) 0; padding: 11px 12px;
          display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 11px;
          background: var(--panel); border: 1px solid var(--border); border-radius: 999px;
        }
        .hm-composer-av {
          width: 40px; height: 40px; border-radius: 999px; overflow: hidden;
          display: grid; place-items: center; background: var(--panel-raised);
          font-family: var(--font-head); font-weight: 700; font-size: 14px; color: var(--ink);
        }
        .hm-composer-av img { width: 100%; height: 100%; object-fit: cover; }
        .hm-composer-hint { font-size: 13.5px; color: var(--ink-dim); }
        .hm-composer-cta {
          width: 36px; height: 36px; border-radius: 999px; display: grid; place-items: center;
          background: var(--lemon); color: var(--on-accent);
        }

        .hm-section-head {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 12px; margin: 22px var(--gut) 10px;
        }
        .hm-section-head h2 { margin: 0; font-family: var(--font-head); font-size: 16px; font-weight: 700; color: var(--ink); }
        .hm-see-all { font-family: var(--font-head); font-size: 13px; font-weight: 600; color: var(--accent-ink); }

        .hm-rec {
          flex: none; width: 214px; padding: 13px; display: grid; gap: 11px; align-content: start;
          background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
        }
        .hm-rec-top { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 10px; align-items: center; }
        .hm-rec-id { min-width: 0; }
        .hm-rec-id h3 {
          margin: 0; font-family: var(--font-head); font-size: 14.5px; font-weight: 700; color: var(--ink);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .hm-rec-id p { margin: 2px 0 0; font-size: 12.5px; color: var(--ink-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .hm-chip {
          justify-self: start; font-size: 11.5px; color: var(--accent-ink);
          background: var(--panel-raised); border-radius: 999px; padding: 5px 10px;
        }
        .hm-rec-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          background: var(--lemon); color: var(--on-accent); border-radius: 999px; padding: 10px;
          font-family: var(--font-head); font-weight: 700; font-size: 13.5px;
        }
        .hm-rec-cta:disabled { opacity: .5; }

        .hm-tabs { position: sticky; top: 64px; z-index: 20; padding: 14px 0 10px;
          background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(12px); }
        .hm-tab {
          flex: none; padding: 9px 15px; border-radius: 999px;
          border: 1px solid var(--border); background: var(--panel);
          font-family: var(--font-head); font-size: 13.5px; font-weight: 600; color: var(--ink-dim);
        }
        .hm-tab.on { border-color: var(--accent-ink); color: var(--accent-ink); }

        .hm-feed { display: grid; padding: 4px 0 0; }

        .hm-skeleton {
          height: 190px; border-radius: 16px; border: 1px solid var(--border);
          background: linear-gradient(100deg, var(--panel) 30%, var(--panel-raised) 50%, var(--panel) 70%);
          background-size: 220% 100%; animation: hm-shimmer 1.4s linear infinite;
        }
        @keyframes hm-shimmer { to { background-position: -120% 0; } }

        .hm-empty {
          display: grid; gap: 12px; justify-items: center; text-align: center;
          background: var(--panel); border: 1px solid var(--border); border-radius: 16px; padding: 26px 18px;
        }
        .hm-empty p { margin: 0; font-size: 13.8px; color: var(--ink-dim); }
        .hm-retry {
          display: inline-flex; align-items: center; gap: 7px; padding: 10px 16px; border-radius: 999px;
          background: var(--lemon); color: var(--on-accent);
          font-family: var(--font-head); font-weight: 700; font-size: 13.5px;
        }
        .hm-more {
          margin-top: 2px; padding: 13px; border-radius: 12px;
          border: 1px solid var(--border); background: var(--panel);
          font-family: var(--font-head); font-weight: 600; font-size: 14px; color: var(--ink);
        }
        .hm-end { margin: 6px 0 0; text-align: center; font-size: 12.5px; color: var(--ink-faint); }

        .hm-fab {
          position: fixed; right: 18px; bottom: 92px; z-index: 40;
          width: 56px; height: 56px; border-radius: 999px; display: grid; place-items: center;
          background: var(--lemon); color: var(--on-accent); box-shadow: 0 10px 26px rgba(0,0,0,.4);
        }
        .hm-fab:active { transform: scale(0.96); }
        @media (min-width: 860px) { .hm-fab { display: none; } }
      `}</style>
    </div>
  )
}
