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
  ArrowLeft, Bell, Heart, MessageCircle, CornerDownRight, UserPlus, AtSign,
  SlidersHorizontal,
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
}

// The filter strip. `kinds` is null for "All"; everything else maps onto
// the API's `kind` query parameter so filtering is server-side.
const FILTERS = [
  { id: 'all', label: 'All', icon: Bell, kinds: null },
  { id: 'likes', label: 'Likes', icon: Heart, kinds: 'post_like,comment_like' },
  { id: 'comments', label: 'Comments', icon: MessageCircle, kinds: 'comment,reply' },
  { id: 'follows', label: 'Follows', icon: UserPlus, kinds: 'follow' },
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
      <header className="nt-bar">
        <button type="button" className="nt-icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} strokeWidth={2.2} />
        </button>
        <h1>Notifications</h1>
        <button
          type="button"
          className="nt-icon-btn nt-icon-btn-end"
          aria-label="Notification settings"
          onClick={() => navigate('/home/settings/notifications')}
        >
          <SlidersHorizontal size={21} strokeWidth={2} />
        </button>
      </header>

      <div className="nt-filters" role="tablist" aria-label="Filter notifications">
        {FILTERS.map((f) => {
          const Icon = f.icon
          const on = f.id === filter
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={`nt-chip ${on ? 'on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              <Icon size={15} strokeWidth={2} />
              {f.label}
            </button>
          )
        })}
      </div>

      {error && <p className="nt-error">{error}</p>}

      {items === null ? (
        <div className="nt-loading"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="nt-empty">
          <span className="nt-empty-badge"><Bell size={24} strokeWidth={1.8} /></span>
          <p>{filter === 'all' ? 'No notifications yet' : `No ${activeFilter.label.toLowerCase()} yet`}</p>
          <span className="nt-empty-copy">
            Likes, comments, replies, mentions and new followers land here.
          </span>
        </div>
      ) : (
        <div className="nt-groups">
          {groups.map((group) => (
            <section className="nt-group" key={group.key}>
              <h2 className="nt-group-title">{group.title}</h2>
              <ul className="nt-list">
                {group.rows.map((n) => {
                  const meta = COPY[n.kind] ?? { icon: Bell, text: 'sent you an update', tone: 'accent' }
                  const Icon = meta.icon
                  const person = n.actor
                  const name = person?.full_name || person?.username || 'Someone'
                  const showFollowBack = n.kind === 'follow' && !!person?.username && !n.actor_is_following
                  return (
                    <li key={n.id} className={`nt-row ${n.is_read ? '' : 'unread'}`}>
                      <button type="button" className="nt-link" onClick={() => openRow(n)}>
                        {!n.is_read && <span className="nt-dot" aria-hidden="true" />}
                        <span className="nt-avatar" style={{ background: avatarTone(person?.username || name) }}>
                          {person?.avatar_url || person?.photo_url
                            ? <img src={person.avatar_url || person.photo_url} alt="" />
                            : initialsOf(name)}
                          <span className={`nt-kind nt-kind-${meta.tone}`}>
                            <Icon size={11} strokeWidth={2.6} />
                          </span>
                        </span>
                        <span className="nt-body">
                          <span className="nt-line">
                            <b>{name}</b>
                            {person?.is_verified && <VerifiedBadge size={14} />}
                            <span className="nt-what">{meta.text}</span>
                          </span>
                          {n.preview && <span className="nt-preview">{n.preview}</span>}
                          <span className="nt-time">{whenLabel(n.created_at, group.key)}</span>
                        </span>
                      </button>

                      {showFollowBack ? (
                        <button
                          type="button"
                          className="nt-followback"
                          onClick={() => followBack(n)}
                        >
                          Follow back
                        </button>
                      ) : n.media_url ? (
                        <button
                          type="button"
                          className="nt-thumb"
                          onClick={() => openRow(n)}
                          aria-label="Open post"
                        >
                          <img src={n.media_url} alt="" loading="lazy" />
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {(items ?? []).length > 0 && (
        <div className="nt-footer">
          <button type="button" className="nt-markall" onClick={markAll} disabled={!anyUnread}>
            <Bell size={17} strokeWidth={2} />
            Mark all as read
          </button>
        </div>
      )}

      <style>{`
        .nt { padding-bottom: 20px; }
        .nt-bar {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px 10px; position: sticky; top: 0; z-index: 6;
          background: linear-gradient(to bottom, var(--bg) 76%, transparent);
        }
        .nt-bar h1 {
          font-family: var(--font-display); font-size: 26px; font-weight: 800;
          letter-spacing: -0.02em; color: var(--ink);
        }
        .nt-icon-btn {
          color: var(--ink); display: inline-flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 999px; flex: none;
          transition: background 0.15s ease;
        }
        .nt-icon-btn-end { margin-left: auto; color: var(--ink-dim); }
        @media (hover: hover) { .nt-icon-btn:hover { background: var(--surface-2); color: var(--ink); } }

        /* --- filter strip: edge-to-edge, horizontally scrollable --- */
        .nt-filters {
          display: flex; gap: 10px; padding: 4px 16px 14px;
          overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
          position: sticky; top: 58px; z-index: 5; background: var(--bg);
        }
        .nt-filters::-webkit-scrollbar { display: none; }
        .nt-chip {
          display: inline-flex; align-items: center; gap: 7px; flex: none;
          padding: 9px 16px; border-radius: 999px;
          font-size: 14px; font-weight: 500; color: var(--ink-dim);
          background: var(--surface-2); border: 1px solid transparent;
          transition: color 0.16s ease, background 0.16s ease, border-color 0.16s ease;
        }
        .nt-chip.on {
          color: var(--accent-ink); font-weight: 600;
          background: color-mix(in srgb, var(--lemon) 14%, transparent);
          border-color: color-mix(in srgb, var(--lemon) 55%, transparent);
        }
        @media (hover: hover) { .nt-chip:not(.on):hover { color: var(--ink); } }

        .nt-error { padding: 12px 18px; font-size: 13px; color: var(--danger); }
        .nt-loading { display: flex; justify-content: center; padding: 48px 0; }

        .nt-empty {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 72px 40px; text-align: center; color: var(--ink-faint);
        }
        .nt-empty-badge {
          width: 60px; height: 60px; border-radius: 999px; display: grid; place-items: center;
          background: var(--surface-2); color: var(--ink-dim); margin-bottom: 6px;
        }
        .nt-empty p { font-size: 16px; font-weight: 700; color: var(--ink); }
        .nt-empty-copy { font-size: 13.5px; line-height: 1.6; max-width: 260px; }

        /* --- groups --- */
        .nt-groups { display: flex; flex-direction: column; gap: 22px; padding: 2px 0 6px; }
        .nt-group-title {
          font-size: 17px; font-weight: 500; color: var(--ink);
          padding: 0 18px 10px; letter-spacing: -0.01em;
        }
        .nt-list {
          list-style: none; margin: 0 12px; padding: 0;
          background: color-mix(in srgb, var(--surface-2) 62%, transparent);
          border-radius: 18px; overflow: hidden;
        }
        .nt-row {
          display: flex; align-items: center; gap: 10px; padding-right: 14px;
          position: relative;
        }
        .nt-row + .nt-row::before {
          content: ''; position: absolute; left: 16px; right: 16px; top: 0; height: 1px;
          background: color-mix(in srgb, var(--surface-line) 55%, transparent);
        }
        .nt-row.unread { background: color-mix(in srgb, var(--lemon) 5%, transparent); }
        .nt-link {
          flex: 1; min-width: 0; display: flex; gap: 13px; align-items: flex-start;
          padding: 15px 4px 15px 18px; text-align: left; color: inherit; background: none;
        }
        .nt-dot {
          position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
          width: 6px; height: 6px; border-radius: 999px; background: var(--lemon);
        }
        .nt-row.unread .nt-link { padding-left: 22px; }
        .nt-avatar {
          position: relative; flex: none; width: 46px; height: 46px; border-radius: 50%;
          display: grid; place-items: center;
          font-size: 15px; font-weight: 800; color: var(--ink);
        }
        .nt-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
        .nt-kind {
          position: absolute; right: -3px; bottom: -3px;
          width: 21px; height: 21px; border-radius: 50%;
          display: grid; place-items: center;
          border: 2.5px solid var(--bg);
        }
        .nt-kind-like { background: #F2385A; color: #fff; }
        .nt-kind-accent { background: var(--lemon); color: var(--on-accent); }

        .nt-body { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .nt-line {
          display: flex; align-items: center; flex-wrap: wrap; gap: 5px;
          font-size: 15px; line-height: 1.35; color: var(--ink-dim);
        }
        .nt-line b { font-weight: 700; color: var(--ink); }
        .nt-what { color: var(--ink-dim); }
        .nt-preview {
          font-size: 14px; color: var(--ink-dim); line-height: 1.45;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .nt-time { font-size: 12.5px; color: var(--ink-faint); }

        .nt-followback {
          flex: none; padding: 10px 18px; border-radius: 999px;
          font-size: 13.5px; font-weight: 600; color: var(--accent-ink);
          border: 1px solid color-mix(in srgb, var(--lemon) 60%, transparent);
          background: transparent; transition: background 0.16s ease;
        }
        @media (hover: hover) {
          .nt-followback:hover { background: color-mix(in srgb, var(--lemon) 12%, transparent); }
        }
        .nt-thumb {
          flex: none; width: 72px; height: 56px; border-radius: 10px; overflow: hidden;
          background: var(--surface); padding: 0;
        }
        .nt-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

        .nt-footer { padding: 18px 12px 6px; }
        .nt-markall {
          width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 9px;
          padding: 15px; border-radius: 16px;
          font-size: 15px; font-weight: 600; color: var(--accent-ink);
          background: color-mix(in srgb, var(--surface-2) 62%, transparent);
          transition: background 0.16s ease, opacity 0.16s ease;
        }
        .nt-markall:disabled { opacity: 0.45; }
        @media (hover: hover) {
          .nt-markall:not(:disabled):hover { background: color-mix(in srgb, var(--lemon) 10%, transparent); }
        }

        /* Wider screens keep the same mobile rhythm, centred. */
        @media (min-width: 720px) {
          .nt-groups, .nt-footer, .nt-filters, .nt-bar { max-width: 640px; margin-inline: auto; }
          .nt-list { margin-inline: 0; }
        }
      `}</style>
    </div>
  )
}
