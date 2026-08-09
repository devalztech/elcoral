import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell, Briefcase, MessageCircle, Plus, RefreshCw, Search, Users,
} from 'lucide-react'
import ElcoralMark from '../components/ElcoralMark.jsx'
import PostCard from '../features/feed/PostCard.jsx'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { api } from '../api/client.js'
import { avatarTone, formatCount, initialsOf, pluralize } from '../features/social/format.js'
import { RECOMMENDED as JOBS } from '../features/jobs/jobs.js'
import { useMessaging } from '../features/messages/useMessaging.jsx'
import Spinner from '../components/Spinner.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'

/**
 * Home feed.
 *
 * The For you tab has exactly one suggestion surface: "Recommended for
 * you", a horizontal-scroll rail mixing people, communities and jobs the
 * viewer hasn't followed/joined/seen yet. Every card is the same size and
 * built the same way — avatar or icon on the left with the name beside
 * it, one sub-line, one status chip, one full-width lemon CTA (Connect /
 * Join / View). Nothing else sits between the rail and the posts feed.
 */

const TABS = [
  { id: 'for-you', label: 'For you' },
  { id: 'following', label: 'Following' },
  { id: 'projects', label: 'Projects' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'communities', label: 'Communities' },
]

// Which tabs are backed by the posts feed endpoint.
const FEED_TABS = new Set(['for-you', 'following'])

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

function SectionHead({ title, to }) {
  return (
    <div className="hm-section-head">
      <h2>{title}</h2>
      <Link to={to} className="hm-see-all">See all</Link>
    </div>
  )
}

/**
 * One card in the "Recommended for you" rail — a person, a community or a job.
 *
 * Layout is fixed so all three are interchangeable tiles:
 *   avatar/icon 52px on the left, name (with verified tick) beside it
 *   one sub-line underneath (role, "Community · N members", "Job · Remote")
 *   one status chip
 *   one full-width lemon CTA (Connect / Join / View)
 */
function RecommendCard({ item, busy, onAct }) {
  const isPerson = item.kind === 'person'
  const isCommunity = item.kind === 'community'
  const isJob = item.kind === 'job'

  const href = isPerson
    ? (item.username ? `/u/${item.username}` : '/home')
    : isCommunity
      ? `/home/community/${item.slug}`
      : '/home/jobs'

  const name = isPerson ? item.full_name : isCommunity ? item.name : item.title
  const sub = isPerson
    ? (item.headline || (item.username ? `@${item.username}` : 'On Elcoral'))
    : isCommunity
      ? `Community · ${pluralize(item.members_count ?? 0, 'member')}`
      : `Job · ${item.place || 'Remote'}`
  const chip = isPerson
    ? (item.is_open_to_work ? 'Open to work' : (item.location || 'Member'))
    : isCommunity
      ? (item.topic || 'Open to join')
      : (item.type || 'Full-time')
  const cta = isPerson ? 'Connect' : isCommunity ? 'Join' : 'View'
  // Person sub-lines are the headline and carry the card, so they read a
  // step larger than the metadata line on community/job tiles.
  const subClass = isPerson ? 'hm-rec-sub hm-rec-sub-lead' : 'hm-rec-sub'

  return (
    <div className="hm-rec-card">
      <Link to={href} className="hm-rec-main">
        <span className="hm-rec-top">
          {isPerson
            ? <PersonAvatar person={item} size={52} />
            : (
              <span className="hm-tile hm-rec-tile" aria-hidden="true">
                {item.icon_url
                  ? <img src={item.icon_url} alt="" />
                  : isCommunity
                    ? <Users size={24} strokeWidth={1.9} />
                    : <Briefcase size={23} strokeWidth={1.9} />}
              </span>
            )}
          <span className="hm-rec-name">
            <span className="hm-rec-name-text">{name}</span>
            {item.is_verified && <VerifiedBadge size={17} className="hm-rec-tick" />}
          </span>
        </span>
        <span className={subClass}>{sub}</span>
      </Link>
      <span className="hm-rec-chip">
        {isPerson
          ? (item.is_open_to_work ? <span className="hm-rec-dot" aria-hidden="true" /> : null)
          : <Users size={14} strokeWidth={2} aria-hidden="true" />}
        {chip}
      </span>
      <button
        type="button"
        className="hm-rec-cta"
        disabled={busy}
        onClick={() => onAct(item)}
      >
        {busy ? <Spinner size={16} /> : cta}
      </button>
    </div>
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
  const [peopleError, setPeopleError] = useState('')
  const [communities, setCommunities] = useState([])
  const [discussions, setDiscussions] = useState([])
  const [projects, setProjects] = useState([])
  const [followBusy, setFollowBusy] = useState({})
  const [joinBusy, setJoinBusy] = useState({})
  const [profile, setProfile] = useState(null)
  const navigate = useNavigate()

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
      setPeopleError('')
      api.followSuggestions(token, 10)
        .then((data) => { if (!cancelled) setPeople((data.items ?? []).filter((p) => !p.is_following && !p.followed_by_me)) })
        .catch((err) => { if (!cancelled) { setPeople([]); setPeopleError(err.message) } })
      api.myProfile(token)
        .then((data) => { if (!cancelled) setProfile(data) })
        .catch(() => { if (!cancelled) setProfile(null) })
    }

    api.listCommunities({ scope: 'trending', limit: 5 }, token)
      .then((data) => { if (!cancelled) setCommunities((data.items ?? []).filter((c) => !c.is_member)) })
      .catch(() => { if (!cancelled) setCommunities([]) })

    return () => { cancelled = true }
  }, [authLoading, accessToken])

  // The Community tab shows the same discussions the community screen
  // ranks as "top", rather than a second, differently-sorted list.
  useEffect(() => {
    if (tab !== 'communities') return undefined
    let cancelled = false
    setLoading(true)
    api.listDiscussions({ scope: 'top', limit: 15 }, accessToken ?? undefined)
      .then((data) => { if (!cancelled) { setDiscussions(data.items ?? []); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [tab, accessToken])

  // Projects spans every community the viewer can see, so the home tab
  // never depends on which community they happen to be looking at.
  useEffect(() => {
    if (tab !== 'projects') return undefined
    let cancelled = false
    setLoading(true)
    setError('')
    api.discoverProjects(accessToken ?? undefined, { limit: 20 })
      .then((data) => { if (!cancelled) { setProjects(data.items ?? []); setLoading(false) } })
      .catch((err) => { if (!cancelled) { setError(err.message); setProjects([]); setLoading(false) } })
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

  const join = async (community) => {
    if (!accessToken || joinBusy[community.id]) return
    setJoinBusy((s) => ({ ...s, [community.id]: true }))
    try {
      await api.joinCommunity(community.slug, accessToken)
      setCommunities((list) => list.filter((c) => c.id !== community.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setJoinBusy((s) => ({ ...s, [community.id]: false }))
    }
  }

  const showSuggestions = tab === 'for-you'

  // "Recommended for you" interleaves people, communities and jobs in that
  // repeating order, so the rail always opens on a person and the three
  // kinds stay mixed however short any one source is.
  const recommended = []
  const maxLen = Math.max(people.length, communities.length, JOBS.length)
  for (let i = 0; i < maxLen; i += 1) {
    if (people[i]) recommended.push({ ...people[i], kind: 'person' })
    if (communities[i]) recommended.push({ ...communities[i], kind: 'community' })
    if (JOBS[i]) recommended.push({ ...JOBS[i], kind: 'job' })
  }

  const actOnRecommended = (item) => {
    if (item.kind === 'person') return follow(item)
    if (item.kind === 'community') return join(item)
    return navigate('/home/jobs')
  }
  const recommendedBusy = (item) => (
    item.kind === 'person' ? !!followBusy[item.id]
      : item.kind === 'community' ? !!joinBusy[item.id]
        : false
  )

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

      {showSuggestions && peopleError && communities.length === 0 && (
        <section className="hm-block">
          <SectionHead title="Recommended for you" to="/home/discover" />
          <div className="hm-empty">
            <p>{peopleError}</p>
          </div>
        </section>
      )}

      {showSuggestions && recommended.length > 0 && (
        <section className="hm-block">
          <SectionHead title="Recommended for you" to="/home/discover" />
          <div className="hm-rec-rail">
            {recommended.map((item) => (
              <RecommendCard
                key={`${item.kind}-${item.id}`}
                item={item}
                busy={recommendedBusy(item)}
                onAct={actOnRecommended}
              />
            ))}
          </div>
        </section>
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
        {!loading && tab === 'communities' && discussions.length === 0 && (
          <div className="hm-empty">
            <p>No discussions yet. Join a community to start one.</p>
            <Link to="/home/community" className="hm-retry">Browse communities</Link>
          </div>
        )}

        {!loading && tab === 'communities' && discussions.map((d) => (
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

        {/* -------------------------------------------------- projects --- */}
        {!loading && tab === 'projects' && projects.length === 0 && !error && (
          <div className="hm-empty">
            <p>No projects yet. Communities you join can start one anytime.</p>
            <Link to="/home/community" className="hm-retry">Browse communities</Link>
          </div>
        )}

        {!loading && tab === 'projects' && projects.map((pr) => (
          <Link
            key={pr.id}
            to={pr.community?.slug ? `/home/community/${pr.community.slug}` : '/home/community'}
            className="hm-item"
          >
            <p className="hm-item-eyebrow">{pr.community?.name ?? 'Project'}</p>
            <p className="hm-item-title">{pr.name}</p>
            {pr.description && <p className="hm-item-body">{pr.description}</p>}
            <p className="hm-item-meta">
              {(pr.status ?? 'open').replace(/_/g, ' ')}
              {pr.seats ? ` · ${pluralize(pr.seats, 'seat')}` : ''}
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
          overflow-x: auto; scrollbar-width: none;
          border-bottom: 1px solid var(--border);
          background: color-mix(in srgb, var(--bg) 92%, transparent);
          backdrop-filter: blur(12px);
        }
        .hm-tabs::-webkit-scrollbar { display: none; }
        .hm-tab {
          flex: 1 0 auto; position: relative; padding: 14px 10px 13px;
          white-space: nowrap;
          background: none; border: 0;
          font-family: var(--font-head); font-size: 14px; font-weight: 600;
          color: var(--ink-dim);
        }
        @media (hover: hover) and (pointer: fine) { .hm-tab:hover { color: var(--ink); } }
        .hm-tab.on { color: var(--accent-ink); }
        .hm-tab.on::after {
          content: ''; position: absolute; left: 50%; bottom: -1px;
          transform: translateX(-50%);
          width: calc(100% - 20px); height: 3px; border-radius: 999px; background: var(--lemon);
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

        /* Recommended rail: horizontal scroll of mixed person/community
           cards. Every card is exactly the same width AND height, so a
           person tile and a community tile are interchangeable and the
           row of CTAs lines up across the whole rail. Snaps to card
           edges; scrollbar hidden so it reads as a carousel. */
        .hm-rec-rail {
          display: flex; gap: 12px; padding: 6px var(--gut) 16px;
          overflow-x: auto; scroll-snap-type: x mandatory;
          scrollbar-width: none;
        }
        .hm-rec-rail::-webkit-scrollbar { display: none; }

        .hm-rec-card {
          flex: none; width: 258px; min-height: 208px; scroll-snap-align: start;
          display: grid; grid-template-rows: auto auto 1fr auto; gap: 11px;
          padding: 14px; border-radius: 18px;
          background: var(--panel-raised); border: 1px solid var(--border);
        }
        .hm-rec-main { display: grid; gap: 9px; min-width: 0; }
        .hm-rec-top {
          display: grid; grid-template-columns: 52px minmax(0, 1fr);
          align-items: center; gap: 12px;
        }
        .hm-rec-tile { width: 52px; height: 52px; border-radius: 999px; }
        /* Name and tick share one line; the tick never shrinks and the
           name truncates around it rather than pushing it off the card. */
        .hm-rec-name {
          display: flex; align-items: center; gap: 5px; min-width: 0;
        }
        .hm-rec-name-text {
          font-family: var(--font-head); font-size: 16px; font-weight: 700; line-height: 20px;
          color: var(--ink);
          overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
          -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .hm-rec-tick { flex: none; }
        .hm-rec-sub {
          font-size: 13.5px; line-height: 18px; color: var(--ink-faint);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .hm-rec-sub-lead { font-size: 14px; color: var(--ink-dim); }
        /* Status chip: a pill outline, self-sized to its label. */
        .hm-rec-chip {
          justify-self: start; align-self: start;
          display: inline-flex; align-items: center; gap: 7px;
          max-width: 100%; padding: 7px 13px; border-radius: 999px;
          border: 1px solid var(--border);
          font-family: var(--font-head); font-size: 12.5px; font-weight: 600;
          color: var(--ink-dim);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .hm-rec-chip svg { flex: none; color: var(--ink-faint); }
        .hm-rec-dot {
          width: 8px; height: 8px; flex: none; border-radius: 999px;
          background: var(--lemon);
        }
        .hm-rec-cta {
          display: grid; place-items: center;
          min-height: 44px; padding: 10px; border-radius: 999px; border: 0;
          background: var(--lemon); color: var(--on-accent);
          font-family: var(--font-head); font-size: 15px; font-weight: 700;
        }
        .hm-rec-cta:disabled { opacity: .6; }


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
