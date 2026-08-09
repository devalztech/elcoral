/**
 * Inbox — the list of direct-message threads.
 *
 * Loaded once over REST, then kept live by the shared socket: a new
 * message re-orders the list and bumps the unread pill without a
 * refetch, and presence updates flip the green dot in place.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, MessageCircle, Search } from 'lucide-react'
import { api } from '../api/client.js'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { useMessaging } from '../features/messages/useMessaging.jsx'
import { OnlineDot, TypingDots } from '../features/messages/Presence.jsx'
import { avatarTone, displayName, initialsOf, timeAgo } from '../features/social/format.js'
import Spinner from '../components/Spinner.jsx'

function previewOf(message) {
  if (!message) return 'Say hello'
  if (message.body) return message.body
  const kind = message.attachments?.[0]?.kind
  if (kind === 'image') return 'Photo'
  if (kind === 'video') return 'Video'
  if (kind === 'audio') return 'Voice note'
  if (kind === 'file') return 'Document'
  return 'Attachment'
}

function Avatar({ person, online }) {
  return (
    <span className="mi-av-wrap">
      {person.photo_url ? (
        <img className="mi-av" src={person.photo_url} alt="" />
      ) : (
        <span className={`mi-av tone-${avatarTone(person.id || person.username)}`} aria-hidden="true">
          {initialsOf(displayName(person))}
        </span>
      )}
      <OnlineDot online={online} />
    </span>
  )
}

export default function Messages() {
  const { accessToken, authLoading } = useAuth()
  const navigate = useNavigate()
  const { subscribe, isOnline, isTyping, seedPresence, refreshUnread } = useMessaging()

  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    if (!accessToken) return
    try {
      const data = await api.listConversations(accessToken)
      setItems(data.items ?? [])
      ;(data.items ?? []).forEach((c) => seedPresence(c.participant.id, c.is_online, c.last_seen_at))
      setError('')
    } catch (err) {
      setError(err.message || 'Could not load your messages.')
      setItems([])
    }
  }, [accessToken, seedPresence])

  useEffect(() => {
    if (authLoading) return
    if (!accessToken) { navigate('/login', { replace: true }); return }
    load()
  }, [authLoading, accessToken, load, navigate])

  // Live updates: move the touched thread to the top with its new
  // preview rather than refetching the whole inbox on every message.
  useEffect(() => subscribe((event) => {
    if (event.type !== 'message') return
    setItems((list) => {
      if (!list) return list
      const index = list.findIndex((c) => c.id === event.conversation_id)
      if (index === -1) {
        // First message of a thread this session — the row doesn't exist
        // locally yet, so fall back to a reload.
        load()
        return list
      }
      const current = list[index]
      const updated = {
        ...current,
        last_message: event.message,
        last_message_at: event.message.created_at,
        unread_count: event.message.is_mine ? 0 : current.unread_count + 1,
      }
      return [updated, ...list.slice(0, index), ...list.slice(index + 1)]
    })
  }), [subscribe, load])

  useEffect(() => { refreshUnread() }, [refreshUnread])

  const visible = (items ?? []).filter((c) => {
    if (!query.trim()) return true
    const person = c.participant
    return `${person.full_name ?? ''} ${person.username ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())
  })

  return (
    <div className="mi">
      <header className="mi-head">
        <Link to="/home" className="mi-back" aria-label="Back to home"><ChevronLeft size={22} /></Link>
        <h1>Messages</h1>
      </header>

      <label className="mi-search">
        <Search size={17} aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
        />
      </label>

      {error && <p className="mi-error">{error}</p>}

      {items === null && (
        <ul className="mi-list">
          <Spinner page label="Loading conversations" />
        </ul>
      )}

      {items !== null && visible.length === 0 && (
        <div className="mi-empty">
          <MessageCircle size={30} strokeWidth={1.6} aria-hidden="true" />
          <p>{query ? 'No conversations match that name.' : 'No messages yet.'}</p>
          {!query && <p className="mi-empty-sub">Open someone’s profile and tap Message to start a conversation.</p>}
        </div>
      )}

      {items !== null && visible.length > 0 && (
        <ul className="mi-list">
          {visible.map((c) => {
            const person = c.participant
            const online = isOnline(person.id) || c.is_online
            const typing = isTyping(c.id)
            return (
              <li key={c.id}>
                <Link to={`/home/messages/${c.id}`} className="mi-row">
                  <Avatar person={person} online={online} />
                  <span className="mi-body">
                    <span className="mi-top">
                      <span className="mi-name">{displayName(person)}</span>
                      <span className="mi-time">{timeAgo(c.last_message_at)}</span>
                    </span>
                    <span className="mi-bottom">
                      {typing ? (
                        <TypingDots />
                      ) : (
                        <span className={`mi-preview ${c.unread_count ? 'mi-unread-text' : ''}`}>
                          {c.last_message?.is_mine ? 'You: ' : ''}{previewOf(c.last_message)}
                        </span>
                      )}
                      {c.unread_count > 0 && <span className="mi-pill">{c.unread_count > 99 ? '99+' : c.unread_count}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <style>{`
        .mi-head { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; }
        .mi-head h1 { font-family: var(--font-head); font-size: 22px; margin: 0; color: var(--ink); }
        .mi-back { display: grid; place-items: center; width: 34px; height: 34px; margin-left: -8px; color: var(--ink-dim); }
        .mi-search {
          display: flex; align-items: center; gap: 8px;
          border: 1px solid var(--border); border-radius: 999px;
          padding: 9px 14px; margin-bottom: 12px; color: var(--ink-faint);
        }
        .mi-search input { flex: 1; border: 0; background: none; font: inherit; font-size: 14px; color: var(--ink); outline: none; }
        .mi-error { font-size: 13px; color: crimson; }
        .mi-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .mi-skeleton { height: 64px; border-radius: 14px; margin-bottom: 8px; background: color-mix(in srgb, var(--ink) 6%, transparent); }
        .mi-row { display: flex; align-items: center; gap: 12px; padding: 10px 6px; border-radius: 14px; color: inherit; }
        .mi-row:active { background: color-mix(in srgb, var(--ink) 5%, transparent); }
        .mi-av-wrap { position: relative; flex: none; display: block; width: 48px; height: 48px; }
        .mi-av {
          width: 48px; height: 48px; border-radius: 999px; object-fit: cover;
          display: grid; place-items: center; font-family: var(--font-head); font-size: 16px;
          background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink);
        }
        .mi-av.tone-a { background: color-mix(in srgb, var(--lemon) 45%, transparent); }
        .mi-av.tone-b { background: color-mix(in srgb, var(--accent-ink) 18%, transparent); }
        .mi-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .mi-top { display: flex; align-items: baseline; gap: 8px; }
        .mi-name { font-family: var(--font-head); font-size: 14.5px; font-weight: 600; color: var(--ink); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mi-time { font-size: 11.5px; color: var(--ink-faint); flex: none; }
        .mi-bottom { display: flex; align-items: center; gap: 8px; }
        .mi-preview { flex: 1; font-size: 13px; color: var(--ink-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mi-unread-text { color: var(--ink); font-weight: 600; }
        .mi-pill {
          flex: none; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
          background: var(--lemon); color: var(--on-accent);
          font-size: 11px; font-weight: 700; display: grid; place-items: center;
        }
        .mi-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px 20px; color: var(--ink-faint); text-align: center; }
        .mi-empty p { margin: 0; font-size: 14px; }
        .mi-empty-sub { font-size: 12.5px; max-width: 260px; }
      `}</style>
    </div>
  )
}
