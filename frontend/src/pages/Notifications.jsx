/**
 * The notification bell's screen.
 *
 * Rows come straight from app/routers/notifications.py — likes, comments,
 * replies, comment likes, follows and mentions, newest first. Opening the
 * screen marks everything read (that's what the bell badge counts), and a
 * row taps through to whatever it is about: the post, the comment, or the
 * person who followed you.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Bell, Heart, MessageCircle, CornerDownRight, UserPlus, AtSign,
} from 'lucide-react'
import { api } from '../api/client.js'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { useNotifications } from '../features/notifications/useNotifications.jsx'
import { avatarTone, initialsOf, timeAgo } from '../features/social/format.js'
import Spinner from '../components/Spinner.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'

const COPY = {
  post_like: { icon: Heart, text: 'liked your post' },
  comment_like: { icon: Heart, text: 'liked your comment' },
  comment: { icon: MessageCircle, text: 'commented on your post' },
  reply: { icon: CornerDownRight, text: 'replied to you' },
  follow: { icon: UserPlus, text: 'started following you' },
  mention: { icon: AtSign, text: 'mentioned you' },
}

function targetOf(n) {
  if (n.kind === 'follow') return n.actor?.username ? `/u/${n.actor.username}` : '/home'
  if (n.post_id) return `/home/posts/${n.post_id}`
  return '/home'
}

export default function Notifications() {
  const navigate = useNavigate()
  const { accessToken, authLoading } = useAuth()
  const { refresh, setUnread } = useNotifications()
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!accessToken) { setItems([]); return }
    try {
      const data = await api.listNotifications(accessToken, 50)
      setItems(data.items ?? [])
      // Seeing the list IS reading it — clear the bell.
      if ((data.unread_count ?? 0) > 0) {
        await api.markAllNotificationsRead(accessToken)
        setUnread(0)
      }
      refresh()
    } catch (err) {
      setError(err.message)
      setItems([])
    }
  }, [accessToken, refresh, setUnread])

  useEffect(() => {
    if (authLoading) return
    load()
  }, [authLoading, load])

  return (
    <div className="nt">
      <header className="nt-bar">
        <button type="button" className="nt-back" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <h1>Notifications</h1>
      </header>

      {error && <p className="nt-error">{error}</p>}

      {items === null ? (
        <div className="nt-loading"><Spinner /></div>
      ) : items.length === 0 ? (
        <div className="nt-empty">
          <Bell size={26} strokeWidth={1.8} />
          <p>No notifications yet</p>
          <span>Likes, comments, replies, mentions and new followers land here.</span>
        </div>
      ) : (
        <ul className="nt-list">
          {items.map((n) => {
            const meta = COPY[n.kind] ?? { icon: Bell, text: 'sent you an update' }
            const Icon = meta.icon
            const person = n.actor
            const name = person?.full_name || person?.username || 'Someone'
            return (
              <li key={n.id} className={`nt-row ${n.is_read ? '' : 'unread'}`}>
                <Link to={targetOf(n)} className="nt-link">
                  <span className="nt-avatar" style={{ background: avatarTone(person?.username || name) }}>
                    {person?.avatar_url
                      ? <img src={person.avatar_url} alt="" />
                      : initialsOf(name)}
                    <span className="nt-kind"><Icon size={11} strokeWidth={2.4} /></span>
                  </span>
                  <span className="nt-body">
                    <span className="nt-line">
                      <b>{name}</b>
                      {person?.is_verified && <VerifiedBadge size={14} />}
                      <span className="nt-what">{meta.text}</span>
                      <span className="nt-time">{timeAgo(n.created_at)}</span>
                    </span>
                    {n.preview && <span className="nt-preview">{n.preview}</span>}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <style>{`
        .nt { padding-bottom: 28px; }
        .nt-bar {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 16px; position: sticky; top: 0; z-index: 5;
          background: var(--bg); border-bottom: 1px solid var(--border);
        }
        .nt-bar h1 { font-family: var(--font-display); font-size: 19px; font-weight: 800; color: var(--ink); }
        .nt-back { color: var(--ink); display: inline-flex; }
        .nt-error { padding: 14px 16px; font-size: 13px; color: var(--danger); }
        .nt-loading { display: flex; justify-content: center; padding: 40px 0; }
        .nt-empty {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 64px 32px; text-align: center; color: var(--ink-faint);
        }
        .nt-empty p { font-size: 15px; font-weight: 700; color: var(--ink); }
        .nt-empty span { font-size: 13px; line-height: 1.6; }
        .nt-list { display: flex; flex-direction: column; }
        .nt-row { border-bottom: 1px solid var(--border); }
        .nt-row.unread { background: color-mix(in srgb, var(--lemon) 14%, transparent); }
        .nt-link { display: flex; gap: 12px; padding: 14px 16px; align-items: flex-start; }
        .nt-avatar {
          position: relative; flex: none; width: 40px; height: 40px; border-radius: 50%;
          display: grid; place-items: center; overflow: visible;
          font-size: 14px; font-weight: 800; color: var(--ink);
        }
        .nt-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
        .nt-kind {
          position: absolute; right: -2px; bottom: -2px;
          width: 18px; height: 18px; border-radius: 50%;
          display: grid; place-items: center;
          background: var(--ink); color: var(--bg); border: 2px solid var(--bg);
        }
        .nt-body { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .nt-line {
          display: flex; align-items: center; flex-wrap: wrap; gap: 5px;
          font-size: 14px; color: var(--ink);
        }
        .nt-line b { font-weight: 700; }
        .nt-what { color: var(--ink-dim); }
        .nt-time { font-size: 12px; color: var(--ink-faint); }
        .nt-preview {
          font-size: 13px; color: var(--ink-faint); line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
      `}</style>
    </div>
  )
}
