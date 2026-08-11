/**
 * The notification bell's screen.
 *
 * Rows come straight from app/routers/notifications.py — likes, comments,
 * replies, comment likes, follows and mentions, newest first. The design
 * groups them into "New" (unread) and "Earlier" (already seen), with a
 * filter strip across the top, an inline "Follow back" action on follow
 * rows, a media thumbnail when the notification is about a post with an
 * image, and a docked "Mark all as read" action at the bottom.
 *
 * Reading behaviour: the badge is cleared when you leave the screen (or
 * press "Mark all as read"), never on arrival — otherwise the "New"
 * group would be empty by the time it rendered.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Bell, Heart, MessageCircle, CornerDownRight, UserPlus, AtSign,
  SlidersHorizontal, Repeat2,
} from 'lucide-react'
import { api } from '../api/client.js'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { useNotifications } from '../features/notifications/useNotifications.jsx'
import { avatarTone, initialsOf, timeAgo } from '../features/social/format.js'
import Spinner from '../components/Spinner.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'

const COPY = {
  post_like: { icon: Heart, text: 'liked your post', tone: 'like' },
  comment_like: { icon: Heart, text: 'liked your comment', tone: 'like' },
  comment: { icon: MessageCircle, text: 'commented on your post', tone: 'accent' },
  reply: { icon: CornerDownRight, text: 'replied to you', tone: 'accent' },
  follow: { icon: UserPlus, text: 'started following you', tone: 'accent' },
  mention: { icon: AtSign, text: 'mentioned you', tone: 'accent' },
  // A repost is its own event — it must never read as "sent a message".
  repost: { icon: Repeat2, text: 'reposted your post', tone: 'repost' },
}

// The filter strip. `kinds` is null for "All"; everything else maps onto
// the API's `kind` query parameter so filtering is server-side.
const FILTERS = [
  { id: 'all', label: 'All', icon: Bell, kinds: null },
  { id: 'likes', label: 'Likes', icon: Heart, kinds: 'post_like,comment_like' },
  { id: 'comments', label: 'Comments', icon: MessageCircle, kinds: 'comment,reply' },
  { id: 'follows', label: 'Follows', icon: UserPlus, kinds: 'follow' },
  { id: 'reposts', label: 'Reposts', icon: Repeat2, kinds: 'repost' },
  { id: 'mentions', label: 'Mentions', icon: AtSign, kinds: 'mention' },
]

function targetOf(n) {
  if (n.kind === 'follow') return n.actor?.username ? `/u/${n.actor.username}` : '/home'
  if (n.post_id) return `/home/posts/${n.post_id}`
  return '/home'
}

/** "Yesterday at 18:42" / "2 days ago" — the older-rows timestamp style. */
function whenLabel(iso, group) {
  if (!iso) return ''
  if (group === 'new') return timeAgo(iso)
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  const clock = then.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
  if (days <= 0) return timeAgo(iso)
  if (days === 1) return `Yesterday at ${clock}`
  if (days < 7) return `${days} days ago`
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function Notifications() {
  const navigate = useNavigate()
  const { accessToken, authLoading } = useAuth()
  const { refresh, setUnread } = useNotifications()
  const [filter, setFilter] = useState('all')
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const hasUnread = useRef(false)

  const activeFilter = FILTERS.find((f) => f.id === filter) ?? FILTERS[0]

  const load = useCallback(async () => {
    if (!accessToken) { setItems([]); return }
    setItems(null)
    try {
      const data = await api.listNotifications(accessToken, 50, activeFilter.kinds ?? undefined)
      setItems(data.items ?? [])
      hasUnread.current = (data.unread_count ?? 0) > 0
      setError('')
    } catch (err) {
      setError(err.message)
      setItems([])
    }
  }, [accessToken, activeFilter.kinds])

  useEffect(() => {
    if (authLoading) return
    load()
  }, [authLoading, load])

  // Leaving the screen is what counts as "seen" — the list itself keeps
  // showing what was new while you're on it.
  useEffect(() => () => {
    if (!accessToken || !hasUnread.current) return
    api.markAllNotificationsRead(accessToken).then(() => setUnread(0)).catch(() => {})
  }, [accessToken, setUnread])

  const markAll = async () => {
    if (!accessToken) return
    setItems((list) => (list ?? []).map((n) => ({ ...n, is_read: true })))
    hasUnread.current = false
    try {
      await api.markAllNotificationsRead(accessToken)
      setUnread(0)
      refresh()
    } catch { /* the optimistic state is close enough for a badge */ }
  }

  const openRow = async (n) => {
    if (!n.is_read && accessToken) {
      setItems((list) => (list ?? []).map((r) => (r.id === n.id ? { ...r, is_read: true } : r)))
      api.markNotificationRead(n.id, accessToken).then(() => refresh()).catch(() => {})
    }
    navigate(targetOf(n))
  }

  const followBack = async (n) => {
    if (!accessToken || !n.actor?.username) return
    setItems((list) => (list ?? []).map((r) =>
      r.actor?.username === n.actor.username ? { ...r, actor_is_following: true } : r))
    try {
      await api.followUser(n.actor.username, accessToken)
    } catch {
      setItems((list) => (list ?? []).map((r) =>
        r.actor?.username === n.actor.username ? { ...r, actor_is_following: false } : r))
    }
  }

  const groups = useMemo(() => {
    const list = items ?? []
    return [
      { key: 'new', title: 'New', rows: list.filter((n) => !n.is_read) },
      { key: 'earlier', title: 'Earlier', rows: list.filter((n) => n.is_read) },
    ].filter((g) => g.rows.length > 0)
  }, [items])

  const anyUnread = (items ?? []).some((n) => !n.is_read)

  return (
    <div className="nt">
      <header className="nt-head">
        <button type="button" className="nt-back" onClick={() => navigate(-1)} aria-label="Go back">
          <ChevronLeft size={22} />
        </button>
        <h1>Notifications</h1>
        <button
          type="button"
          className="nt-back nt-head-end"
          aria-label="Notification settings"
          onClick={() => navigate('/home/settings/notifications')}
        >
          <SlidersHorizontal size={19} />
        </button>
      </header>

      <div className="nt-tabs" role="tablist" aria-label="Filter notifications">
        {FILTERS.map((f) => {
          const on = f.id === filter
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={`nt-tab ${on ? 'nt-tab-on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {error && <p className="nt-error">{error}</p>}

      {items === null && <Spinner page label="Loading notifications" />}

      {items !== null && items.length === 0 && !error && (
        <div className="nt-empty">
          <Bell size={28} strokeWidth={1.6} aria-hidden="true" />
          <p>{filter === 'all' ? 'No notifications yet.' : `No ${activeFilter.label.toLowerCase()} yet.`}</p>
        </div>
      )}

      {items !== null && items.length > 0 && groups.map((group) => (
        <section className="nt-group" key={group.key}>
          <h2 className="nt-group-title">{group.title}</h2>
          <ul className="nt-list">
            {group.rows.map((n) => {
              const meta = COPY[n.kind] ?? { icon: Bell, text: 'sent you an update', tone: 'accent' }
              const Icon = meta.icon
              const person = n.actor
              const name = person?.full_name || person?.username || 'Someone'
              const photo = person?.photo_url || person?.avatar_url
              const showFollowBack = n.kind === 'follow' && !!person?.username && !n.actor_is_following
              return (
                <li key={n.id}>
                  <button type="button" className={`nt-row ${n.is_read ? '' : 'nt-row-unread'}`} onClick={() => openRow(n)}>
                    <span className="nt-av-wrap">
                      {photo ? (
                        <img className="nt-av" src={photo} alt="" />
                      ) : (
                        <span className="nt-av" style={{ background: avatarTone(person?.username || name) }} aria-hidden="true">
                          {initialsOf(name)}
                        </span>
                      )}
                      <span className={`nt-kind nt-kind-${meta.tone}`}>
                        <Icon size={10} strokeWidth={2.6} />
                      </span>
                    </span>

                    <span className="nt-text">
                      <span className="nt-name">
                        {name}
                        {person?.is_verified && <VerifiedBadge size={14} className="nt-verified" />}
                      </span>
                      <span className="nt-sub">
                        {meta.text}{n.preview ? ` · ${n.preview}` : ''} · {whenLabel(n.created_at, group.key)}
                      </span>
                    </span>

                    {showFollowBack ? (
                      <span
                        role="button"
                        tabIndex={0}
                        className="nt-follow"
                        onClick={(e) => { e.stopPropagation(); followBack(n) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); followBack(n) } }}
                      >
                        Follow back
                      </span>
                    ) : n.media_url ? (
                      <img className="nt-thumb" src={n.media_url} alt="" loading="lazy" />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {(items ?? []).length > 0 && anyUnread && (
        <button type="button" className="nt-more" onClick={markAll}>Mark all as read</button>
      )}

      <style>{`
        .nt-head { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
        .nt-head h1 { font-family: var(--font-head); font-size: 18px; margin: 0; color: var(--ink); }
        .nt-back { display: grid; place-items: center; width: 34px; height: 34px; margin-left: -8px; color: var(--ink-dim); background: none; }
        .nt-head-end { margin-left: auto; margin-right: -8px; }

        .nt-tabs {
          display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 8px;
          overflow-x: auto; scrollbar-width: none;
        }
        .nt-tabs::-webkit-scrollbar { display: none; }
        .nt-tab {
          flex: 1; min-width: 74px; text-align: center; padding: 10px 4px; font-size: 13.5px;
          color: var(--ink-faint); border-bottom: 2px solid transparent; background: none;
        }
        .nt-tab-on {
          color: var(--accent-ink); font-weight: 700;
          border-bottom-color: var(--lemon);
          background: color-mix(in srgb, var(--lemon) 12%, transparent);
          border-radius: 10px 10px 0 0;
        }

        .nt-error { font-size: 13px; color: var(--danger); }

        .nt-group { margin-top: 6px; }
        .nt-group-title {
          font-family: var(--font-head); font-size: 12.5px; font-weight: 600; letter-spacing: 0.04em;
          text-transform: uppercase; color: var(--ink-faint); margin: 10px 6px 2px;
        }
        .nt-list { list-style: none; margin: 0; padding: 0; }

        .nt-row {
          width: 100%; display: flex; align-items: center; gap: 12px; padding: 9px 6px;
          border-radius: 14px; color: inherit; background: none; text-align: left;
        }
        .nt-row:active { background: color-mix(in srgb, var(--ink) 5%, transparent); }
        .nt-row-unread { background: color-mix(in srgb, var(--lemon) 6%, transparent); }

        .nt-av-wrap { position: relative; flex: none; width: 44px; height: 44px; }
        .nt-av {
          width: 44px; height: 44px; border-radius: 999px; object-fit: cover;
          display: grid; place-items: center; font-family: var(--font-head); font-size: 15px;
          background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink);
        }
        .nt-kind {
          position: absolute; right: -2px; bottom: -2px;
          width: 18px; height: 18px; border-radius: 999px; display: grid; place-items: center;
          border: 2px solid var(--bg);
        }
        .nt-kind-like { background: #F2385A; color: #fff; }
        .nt-kind-accent { background: var(--lemon); color: var(--on-accent); }
        .nt-kind-repost { background: #00BA7C; color: #fff; }

        .nt-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .nt-verified { color: var(--verified, #1D9BF0); flex: none; margin-left: 3px; vertical-align: -2px; }
        .nt-name {
          font-family: var(--font-head); font-size: 14.5px; font-weight: 600; color: var(--ink);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .nt-what { font-family: var(--font-body); font-weight: 400; color: var(--ink-dim); }
        .nt-sub { font-size: 12.5px; color: var(--ink-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .nt-follow {
          flex: none; padding: 7px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 700;
          font-family: var(--font-head); background: var(--lemon); color: var(--on-accent);
        }
        .nt-thumb { flex: none; width: 44px; height: 44px; border-radius: 10px; object-fit: cover; }

        .nt-more { display: block; margin: 12px auto; font-size: 13px; color: var(--accent-ink); padding: 8px 16px; background: none; }
        .nt-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 44px 20px; color: var(--ink-faint); }
        .nt-empty p { margin: 0; font-size: 14px; }
      `}</style>
    </div>
  )
}
