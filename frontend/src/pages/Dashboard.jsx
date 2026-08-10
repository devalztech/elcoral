import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell, MessageCircle, Plus, RefreshCw, Search,
} from 'lucide-react'
import ElcoralMark from '../components/ElcoralMark.jsx'
import PostCard from '../features/feed/PostCard.jsx'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { api } from '../api/client.js'
import { formatCount, initialsOf, pluralize } from '../features/social/format.js'
import { RECOMMENDED as JOBS } from '../features/jobs/jobs.js'
import { useMessaging } from '../features/messages/useMessaging.jsx'
import Spinner from '../components/Spinner.jsx'

/**
 * Home feed.
 *
 * The For you tab is a pure feed: composer, then posts. No suggestion
 * rails sit between the tabs and the posts.
 */

const TABS = [
  { id: 'for-you', label: 'For you' },
  { id: 'following', label: 'Following' },
  { id: 'community', label: 'Community' },
  { id: 'jobs', label: 'Jobs' },
]

// Which tabs are backed by the posts feed endpoint.
const FEED_TABS = new Set(['for-you', 'following'])

export default function Dashboard() {
  const { user, accessToken, authLoading } = useAuth()
  const { unreadTotal } = useMessaging()

  const [tab, setTab] = useState('for-you')
  const [posts, setPosts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const [error, setError] = useState('')

  const [discussions, setDiscussions] = useState([])
  const [profile, setProfile] = useState(null)

  const loadFeed = useCallback(async () => {
    if (!FEED_TABS.has(tab)) return
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

  // Suggestions. Communities and discussions are public reads, so they
  // load with or without a token; follow suggestions need one.
  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    const token = accessToken ?? undefined

    if (token) {
      api.myProfile(token)
        .then((data) => { if (!cancelled) setProfile(data) })
        .catch(() => { if (!cancelled) setProfile(null) })
    }

    return () => { cancelled = true }
  }, [authLoading, accessToken])

  // The Community tab shows the same discussions the community screen
  // ranks as "top", rather than a second, differently-sorted list.
  useEffect(() => {
    if (tab !== 'community') return undefined
    let cancelled = false
    setLoading(true)
    api.listDiscussions({ scope: 'top', limit: 15 }, accessToken ?? undefined)
      .then((data) => { if (!cancelled) { setDiscussions(data.items ?? []); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [tab, accessToken])

  useEffect(() => {
    if (tab === 'jobs') setLoading(false)
  }, [tab])

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

      <nav className="hm-tabs" aria-label="Feed filters">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`hm-tab ${tab === t.id ? 'on' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

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

      <div className="hm-feed">
        {error && (
          <div className="hm-empty">
            <p>{error}</p>
            <button type="button" className="hm-retry" onClick={loadFeed}>
              <RefreshCw size={16} strokeWidth={2} /> Try again
            </button>
          </div>
        )}

        {loading && <Spinner page label="Loading posts" />}

        {/* ------------------------------------------------ posts feed --- */}
        {!loading && FEED_TABS.has(tab) && posts?.length === 0 && !error && (
          <div className="hm-empty">
            <p>
              {tab === 'following'
                ? 'Nothing here yet — follow a few people and their posts will show up.'
                : 'The feed is empty. Be the first to post something.'}
            </p>
            {user && (
              <Link to="/home/create/post" className="hm-retry">
                <Plus size={16} strokeWidth={2.4} /> Create a post
              </Link>
            )}
          </div>
        )}

        {!loading && FEED_TABS.has(tab) &&
          posts?.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDeleted={(id) => setPosts((list) => list.filter((p) => p.id !== id))}
            />
          ))}

        {!loading && FEED_TABS.has(tab) && posts?.length > 0 && !exhausted && (
          <button type="button" className="hm-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <Spinner size={18} label="Loading more posts" /> : 'Load more'}
          </button>
        )}

        {!loading && FEED_TABS.has(tab) && posts?.length > 0 && exhausted && (
          <p className="hm-end">{formatCount(posts.length)} posts · you're all caught up</p>
        )}

        {/* ------------------------------------------------- community --- */}
        {!loading && tab === 'community' && discussions.length === 0 && (
          <div className="hm-empty">
            <p>No discussions yet. Join a community to start one.</p>
            <Link to="/home/community" className="hm-retry">Browse communities</Link>
          </div>
        )}

        {!loading && tab === 'community' && discussions.map((d) => (
          <Link
            key={d.id}
            to={d.community?.slug ? `/home/community/${d.community.slug}` : '/home/community'}
            className="hm-item"
          >
            <p className="hm-item-eyebrow">{d.community?.name ?? 'Community'}</p>
            <p className="hm-item-title">{d.title}</p>
            {d.body && <p className="hm-item-body">{d.body}</p>}
            <p className="hm-item-meta">
              {pluralize(d.like_count ?? 0, 'like')} · {pluralize(d.comment_count ?? 0, 'comment')}
            </p>
          </Link>
        ))}

        {/* ------------------------------------------------------ jobs --- */}
        {!loading && tab === 'jobs' && JOBS.map((job) => (
          <Link key={job.id} to="/home/jobs" className="hm-item">
            <p className="hm-item-eyebrow">{job.company}</p>
            <p className="hm-item-title">{job.title}</p>
            <p className="hm-item-meta">{job.place} · {job.type} · {job.time}</p>
          </Link>
        ))}
      </div>

      <Link to="/home/create/post" className="hm-fab" aria-label="Create a post">
        <Plus size={30} strokeWidth={2.4} />
      </Link>

      <style>{`
        /* full-bleed against AppShell's 20px page padding. Every row on
           this screen uses the post's own metrics: 12px 16px padding and
           a single hairline underneath — never a bordered card. */
        .hm { --gut: 16px; margin: -24px -20px 0; padding-bottom: 8px; }
        @media (min-width: 860px) { .hm { margin: -32px -40px 0; } }

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
          gap: 12px; padding: 12px var(--gut);
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
        @media (hover: hover) and (pointer: fine) { .hm-icon-btn:hover { color: var(--accent-ink); } }
        .hm-badge {
          position: absolute; top: -2px; right: -3px;
          min-width: 17px; height: 17px; padding: 0 4px; border-radius: 999px;
          background: var(--lemon); color: var(--on-accent);
          font-size: 10px; font-weight: 700; line-height: 17px; text-align: center;
          border: 2px solid var(--bg);
        }

        /* Tabs: flat, evenly split, active one picked out in Elcoral
           lemon with a matching underline — no pills, no boxes. */
        .hm-tabs {
          position: sticky; top: 62px; z-index: 20;
          display: flex; align-items: stretch;
          border-bottom: 1px solid var(--border);
          background: color-mix(in srgb, var(--bg) 92%, transparent);
          backdrop-filter: blur(12px);
        }
        .hm-tab {
          flex: 1; position: relative; padding: 14px 4px 13px;
          background: none; border: 0;
          font-family: var(--font-head); font-size: 14px; font-weight: 600;
          color: var(--ink-dim);
        }
        @media (hover: hover) and (pointer: fine) { .hm-tab:hover { color: var(--ink); } }
        .hm-tab.on { color: var(--accent-ink); }
        .hm-tab.on::after {
          content: ''; position: absolute; left: 50%; bottom: -1px;
          transform: translateX(-50%);
          width: 52px; height: 3px; border-radius: 999px; background: var(--lemon);
        }

        .hm-composer {
          display: grid; grid-template-columns: auto minmax(0,1fr) auto;
          align-items: center; gap: 11px;
          padding: 12px var(--gut);
          border-bottom: 1px solid var(--border);
        }
        .hm-composer-av {
          width: 40px; height: 40px; border-radius: 999px; overflow: hidden;
          display: grid; place-items: center; background: var(--panel-raised);
          font-family: var(--font-head); font-weight: 700; font-size: 14px; color: var(--ink);
        }
        .hm-composer-av img { width: 100%; height: 100%; object-fit: cover; }
        .hm-composer-hint { font-size: 14px; color: var(--ink-faint); }
        .hm-composer-cta {
          width: 34px; height: 34px; border-radius: 999px; display: grid; place-items: center;
          background: var(--lemon); color: var(--on-accent);
        }

        .hm-block { border-bottom: 1px solid var(--border); }
        .hm-section-head {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 12px; padding: 14px var(--gut) 6px;
        }
        .hm-section-head h2 {
          margin: 0; font-family: var(--font-head);
          font-size: 16px; font-weight: 700; color: var(--ink);
        }
        .hm-see-all { font-family: var(--font-head); font-size: 13.5px; font-weight: 600; color: var(--accent-ink); }
        @media (hover: hover) and (pointer: fine) { .hm-see-all:hover { text-decoration: underline; } }

        .hm-row {
          display: flex; align-items: center; gap: 12px;
          padding: 10px var(--gut);
        }
        @media (hover: hover) and (pointer: fine) { .hm-row:hover { background: color-mix(in srgb, var(--ink) 3%, transparent); } }
        .hm-row-main { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
        .hm-row-text { display: flex; flex-direction: column; min-width: 0; }
        .hm-row-title {
          font-family: var(--font-head); font-size: 15px; line-height: 20px; font-weight: 700; color: var(--ink);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .hm-row-sub {
          font-size: 13.5px; line-height: 18px; color: var(--ink-faint);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .hm-row-time { flex: none; font-size: 12.5px; color: var(--ink-faint); }
        .hm-row-cta {
          flex: none; padding: 8px 16px; border-radius: 999px; border: 0;
          background: var(--lemon); color: var(--on-accent);
          font-family: var(--font-head); font-size: 13.5px; font-weight: 700;
        }
        .hm-row-cta:disabled { opacity: .5; }
        .hm-tile {
          width: 40px; height: 40px; flex: none; border-radius: 12px;
          display: grid; place-items: center; overflow: hidden;
          background: color-mix(in srgb, var(--ink) 7%, transparent);
          color: var(--accent-ink);
        }
        .hm-tile img { width: 100%; height: 100%; object-fit: cover; }

        /* Status chip: a pill outline, self-sized to its label. */


        .hm-feed { display: grid; }

        /* Community / job rows in the feed body match the post cell. */
        .hm-item { display: block; padding: 12px var(--gut); border-bottom: 1px solid var(--border); }
        @media (hover: hover) and (pointer: fine) { .hm-item:hover { background: color-mix(in srgb, var(--ink) 3%, transparent); } }
        .hm-item-eyebrow { margin: 0; font-size: 12.5px; color: var(--accent-ink); font-weight: 600; }
        .hm-item-title { margin: 3px 0 0; font-family: var(--font-head); font-size: 15px; line-height: 20px; font-weight: 700; color: var(--ink); }
        .hm-item-body {
          margin: 3px 0 0; font-size: 15px; line-height: 20px; color: var(--ink-dim);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .hm-item-meta { margin: 6px 0 0; font-size: 13px; color: var(--ink-faint); }

        .hm-skeleton {
          height: 150px; border-bottom: 1px solid var(--border);
          background: linear-gradient(100deg, transparent 30%, color-mix(in srgb, var(--ink) 5%, transparent) 50%, transparent 70%);
          background-size: 220% 100%; animation: hm-shimmer 1.4s linear infinite;
        }
        @keyframes hm-shimmer { to { background-position: -120% 0; } }

        .hm-empty {
          display: grid; gap: 12px; justify-items: center; text-align: center;
          padding: 34px 18px; border-bottom: 1px solid var(--border);
        }
        .hm-empty p { margin: 0; font-size: 14px; color: var(--ink-dim); }
        .hm-retry {
          display: inline-flex; align-items: center; gap: 7px; padding: 10px 16px; border-radius: 999px;
          background: var(--lemon); color: var(--on-accent);
          font-family: var(--font-head); font-weight: 700; font-size: 13.5px;
        }
        .hm-more {
          display: grid; place-items: center; padding: 15px; border: 0; border-bottom: 1px solid var(--border); background: none;
          font-family: var(--font-head); font-weight: 600; font-size: 14px; color: var(--accent-ink);
        }
        .hm-end { margin: 0; padding: 16px; text-align: center; font-size: 12.5px; color: var(--ink-faint); }

        .hm-fab {
          position: fixed; right: 18px; bottom: 92px; z-index: 40;
          width: 56px; height: 56px; border-radius: 999px; display: grid; place-items: center;
          background: var(--lemon); color: var(--on-accent); box-shadow: 0 10px 26px rgba(0,0,0,.4);
        }
      `}</style>
    </div>
  )
}
