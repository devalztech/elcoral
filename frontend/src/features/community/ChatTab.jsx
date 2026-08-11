/**
 * Community group chat — the WhatsApp model.
 *
 * History comes from REST (newest-last, paged backwards with `before`),
 * live messages arrive on the receive-only community socket, and sending
 * is a POST that persists first and then fans out. That means a dropped
 * socket can never lose a message someone thought they'd sent.
 *
 * Bubbles are grouped by sender the way a chat app groups them: the
 * avatar and name appear once per run, day dividers separate the runs,
 * and albums collapse into a single swipeable frame (MediaCarousel) so
 * six photos don't become six bubbles.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Trash2, ChevronUp, Lock } from 'lucide-react'
import Composer from '../messages/Composer.jsx'
import MediaCarousel from '../../components/MediaCarousel.jsx'
import Spinner from '../../components/Spinner.jsx'
import { api } from '../../api/client.js'
import { avatarTone, displayName, initialsOf } from '../social/format.js'

const PAGE = 40

function dayKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Today'
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function clock(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function Avatar({ person, size = 30 }) {
  const name = displayName(person)
  if (person?.photo_url) {
    return <img className="ct-av" src={person.photo_url} alt="" style={{ width: size, height: size }} />
  }
  return (
    <span
      className={`ct-av av-${avatarTone(person?.id ?? name)}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  )
}

function mediaItems(message) {
  return (message.media_urls ?? []).map((url) => ({ url, kind: /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ? 'video' : 'image' }))
}

export default function ChatTab({ community, caps, accessToken, loggedIn, currentUser }) {
  const slug = community.slug
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [olderBusy, setOlderBusy] = useState(false)
  const [canChat, setCanChat] = useState(!!caps.can_chat)
  const [live, setLive] = useState(false)

  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const socketRef = useRef(null)

  const gated = !community.chat_enabled || (loggedIn && !caps.is_member) || !loggedIn

  const upsert = useCallback((message) => {
    setItems((list) => {
      if (list.some((m) => m.id === message.id)) {
        return list.map((m) => (m.id === message.id ? message : m))
      }
      return [...list, message]
    })
  }, [])

  const load = useCallback(async () => {
    if (gated || !accessToken) { setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const data = await api.listCommunityMessages(slug, { limit: PAGE }, accessToken)
      setItems(data.items ?? [])
      setHasMore(!!data.has_more)
      setCanChat(data.can_chat !== false)
    } catch (err) {
      setError(err.message || 'Could not load the chat.')
    } finally {
      setLoading(false)
    }
  }, [slug, accessToken, gated])

  useEffect(() => { load() }, [load])

  // Live feed. The socket is receive-only; reconnects are handled by
  // remounting through the effect when the token or community changes.
  useEffect(() => {
    if (gated || !accessToken) return undefined
    let socket
    let closed = false
    let retry = null
    const open = () => {
      if (closed) return
      try {
        socket = new WebSocket(api.wsUrl(slug, accessToken))
      } catch {
        return
      }
      socketRef.current = socket
      socket.onopen = () => setLive(true)
      socket.onmessage = (raw) => {
        let event
        try { event = JSON.parse(raw.data) } catch { return }
        if (event.type === 'message' && event.message) upsert(event.message)
        if (event.type === 'message_deleted' && event.message_id) {
          setItems((list) => list.map((m) => (
            m.id === event.message_id ? { ...m, is_deleted: true, body: null, media_urls: [] } : m
          )))
        }
      }
      socket.onclose = () => {
        setLive(false)
        if (!closed) retry = setTimeout(open, 3000)
      }
    }
    open()
    return () => {
      closed = true
      if (retry) clearTimeout(retry)
      const s = socketRef.current
      socketRef.current = null
      if (s && s.readyState <= WebSocket.OPEN) s.close()
      setLive(false)
    }
  }, [slug, accessToken, gated, upsert])

  // Stick to the newest message, the way a chat should.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [items.length])

  const loadOlder = async () => {
    if (!items.length || olderBusy) return
    setOlderBusy(true)
    try {
      const data = await api.listCommunityMessages(
        slug, { before: items[0].created_at, limit: PAGE }, accessToken,
      )
      setItems((list) => [...(data.items ?? []), ...list])
      setHasMore(!!data.has_more)
    } catch (err) {
      setError(err.message || 'Could not load older messages.')
    } finally {
      setOlderBusy(false)
    }
  }

  const send = async ({ body, attachments }) => {
    const message = await api.sendCommunityMessage(
      slug,
      { body, mediaRefs: (attachments ?? []).map((a) => a.ref) },
      accessToken,
    )
    upsert(message)
  }

  const remove = async (message) => {
    const previous = items
    setItems((list) => list.map((m) => (
      m.id === message.id ? { ...m, is_deleted: true, body: null, media_urls: [] } : m
    )))
    try {
      await api.deleteCommunityMessage(message.id, accessToken)
    } catch {
      setItems(previous)
    }
  }

  // Group into runs by sender + day, so the avatar and name print once.
  const rows = useMemo(() => {
    const out = []
    let lastDay = null
    let lastSender = null
    for (const m of items) {
      const key = dayKey(m.created_at)
      if (key !== lastDay) {
        out.push({ type: 'day', id: `day-${key}`, at: m.created_at })
        lastDay = key
        lastSender = null
      }
      out.push({ type: 'msg', id: m.id, message: m, head: m.sender?.id !== lastSender })
      lastSender = m.sender?.id
    }
    return out
  }, [items])

  if (!community.chat_enabled) {
    return <ChatNote icon={<Lock size={26} strokeWidth={1.7} />} text="Chat is turned off for this community." />
  }
  if (!loggedIn) {
    return (
      <ChatNote
        icon={<MessageCircle size={26} strokeWidth={1.7} />}
        text="Sign in to join the conversation."
        action={<Link className="ct-cta" to="/login">Sign in</Link>}
      />
    )
  }
  if (!caps.is_member) {
    return <ChatNote icon={<MessageCircle size={26} strokeWidth={1.7} />} text="Join this community to see its chat." />
  }

  return (
    <div className="ct">
      <div className="ct-scroll" ref={scrollRef}>
        {loading && <Spinner page label="Loading chat" />}
        {!loading && error && (
          <p className="ct-error">
            {error} <button type="button" className="ct-retry" onClick={load}>Try again</button>
          </p>
        )}

        {!loading && hasMore && (
          <button type="button" className="ct-older" onClick={loadOlder} disabled={olderBusy}>
            <ChevronUp size={15} strokeWidth={2} /> {olderBusy ? 'Loading…' : 'Older messages'}
          </button>
        )}

        {!loading && !error && !items.length && (
          <ChatNote
            icon={<MessageCircle size={26} strokeWidth={1.7} />}
            text={`No messages yet in ${community.name}. Say hello 👋`}
          />
        )}

        {rows.map((row) => {
          if (row.type === 'day') {
            return <p key={row.id} className="ct-day"><span>{dayLabel(row.at)}</span></p>
          }
          const m = row.message
          const mine = m.sender?.id === currentUser?.id || m.sender?.is_self
          const media = mediaItems(m)
          const canDelete = !m.is_deleted && (mine || caps.can_moderate)
          return (
            <div key={row.id} className={`ct-row ${mine ? 'mine' : ''} ${row.head ? 'head' : ''}`}>
              {!mine && <span className="ct-av-slot">{row.head && <Avatar person={m.sender} />}</span>}
              <div className="ct-bubble">
                {!mine && row.head && (
                  <Link to={m.sender?.username ? `/u/${m.sender.username}` : '/home'} className="ct-name">
                    {displayName(m.sender)}
                  </Link>
                )}
                {m.is_deleted ? (
                  <p className="ct-deleted">This message was deleted</p>
                ) : (
                  <>
                    {media.length > 0 && (
                      <div className="ct-media"><MediaCarousel items={media} /></div>
                    )}
                    {m.body && <p className="ct-text">{m.body}</p>}
                  </>
                )}
                <span className="ct-meta">
                  {clock(m.created_at)}
                  {canDelete && (
                    <button type="button" className="ct-del" aria-label="Delete message" onClick={() => remove(m)}>
                      <Trash2 size={12} strokeWidth={2} />
                    </button>
                  )}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {canChat ? (
        <div className="ct-composer">
          <Composer token={accessToken} onSend={send} />
          {!live && <p className="ct-offline">Reconnecting…</p>}
        </div>
      ) : (
        <p className="ct-locked"><Lock size={13} strokeWidth={2} /> Only admins can send messages here.</p>
      )}

      <ChatStyles />
    </div>
  )
}

function ChatNote({ icon, text, action }) {
  return (
    <div className="ct-note">
      <span className="ct-note-icon" aria-hidden="true">{icon}</span>
      <p>{text}</p>
      {action}
      <style>{`
        .ct-note {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          padding: 44px 20px; text-align: center; color: var(--ink-faint);
        }
        .ct-note-icon {
          display: grid; place-items: center; width: 52px; height: 52px;
          border-radius: 18px; border: 1px solid var(--border); background: var(--panel-raised);
        }
        .ct-note p { margin: 0; font-size: 14px; }
        .ct-cta {
          padding: 8px 16px; border-radius: 999px; font-size: 13.5px; font-weight: 600;
          background: var(--lemon); color: var(--bg);
        }
      `}</style>
    </div>
  )
}

function ChatStyles() {
  return (
    <style>{`
      .ct { display: flex; flex-direction: column; min-height: 0; }
      .ct-scroll {
        display: flex; flex-direction: column; gap: 2px;
        padding: 8px 2px 12px; overflow-y: auto;
        max-height: calc(100vh - 300px);
      }
      .ct-older {
        align-self: center; display: inline-flex; align-items: center; gap: 6px;
        margin: 4px 0 10px; padding: 6px 13px; border-radius: 999px; cursor: pointer;
        font-size: 12.5px; font-weight: 600; color: var(--ink-faint);
        border: 1px solid var(--border); background: var(--panel-raised);
      }
      .ct-day {
        display: flex; justify-content: center; margin: 14px 0 8px;
      }
      .ct-day span {
        padding: 3px 12px; border-radius: 999px;
        font-size: 11.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
        color: var(--ink-faint); background: var(--panel-raised); border: 1px solid var(--border);
      }
      .ct-row { display: flex; align-items: flex-end; gap: 8px; }
      .ct-row.head { margin-top: 10px; }
      .ct-row.mine { justify-content: flex-end; }
      .ct-av-slot { width: 30px; flex: none; }
      .ct-av {
        display: grid; place-items: center; border-radius: 50%;
        object-fit: cover; font-weight: 700; color: var(--bg);
      }
      .ct-bubble {
        position: relative; max-width: min(78%, 460px);
        padding: 7px 11px 5px; border-radius: 16px 16px 16px 5px;
        background: var(--panel-raised); border: 1px solid var(--border);
      }
      .ct-row.mine .ct-bubble {
        border-radius: 16px 16px 5px 16px;
        background: color-mix(in srgb, var(--lemon) 20%, var(--panel-raised));
        border-color: color-mix(in srgb, var(--lemon) 45%, var(--border));
      }
      .ct-name { display: block; font-size: 12.5px; font-weight: 700; color: var(--accent-ink); margin-bottom: 3px; }
      .ct-text { margin: 0; font-size: 14.5px; line-height: 1.45; color: var(--ink); white-space: pre-wrap; word-break: break-word; }
      .ct-deleted { margin: 0; font-size: 13.5px; font-style: italic; color: var(--ink-faint); }
      .ct-media {
        width: 246px; max-width: 100%; aspect-ratio: 1 / 1;
        margin: 2px 0 6px; border-radius: 12px; overflow: hidden;
        background: var(--panel);
      }
      .ct-meta {
        display: flex; align-items: center; justify-content: flex-end; gap: 6px;
        margin-top: 2px; font-size: 10.5px; color: var(--ink-faint);
      }
      .ct-del { display: grid; place-items: center; color: var(--ink-faint); cursor: pointer; }
      .ct-del:hover { color: crimson; }
      .ct-composer { position: sticky; bottom: 0; padding-top: 6px; background: var(--bg); }
      .ct-offline { margin: 4px 0 0; font-size: 11.5px; color: var(--ink-faint); text-align: center; }
      .ct-locked {
        display: flex; align-items: center; justify-content: center; gap: 6px;
        margin: 10px 0 0; font-size: 12.5px; color: var(--ink-faint);
      }
      .ct-error { margin: 0 0 8px; font-size: 13px; color: crimson; text-align: center; }
      .ct-retry { color: var(--accent-ink); font-weight: 600; text-decoration: underline; cursor: pointer; }
    `}</style>
  )
}
