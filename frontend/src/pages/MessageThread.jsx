/**
 * One conversation.
 *
 * History is paged backwards over REST; everything after that arrives on
 * the shared socket — new messages, the other person's typing state,
 * their read receipt and their online/last-seen status.
 *
 * Sent messages render optimistically with a "sending" tick so the
 * thread feels instant on a slow connection; the socket echo replaces
 * the placeholder by id, so a duplicate can't appear.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, CheckCheck, ChevronLeft, Clock } from 'lucide-react'
import { api } from '../api/client.js'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { useMessaging } from '../features/messages/useMessaging.jsx'
import { OnlineDot, TypingDots, presenceLabel } from '../features/messages/Presence.jsx'
import Attachment from '../features/messages/Attachment.jsx'
import Composer from '../features/messages/Composer.jsx'
import Lightbox from '../components/Lightbox.jsx'
import {
  avatarTone, dayLabel, displayName, initialsOf, timeOfDay,
} from '../features/social/format.js'

// How long we can go without re-telling the server "still typing".
const TYPING_PING_MS = 3000

export default function MessageThread() {
  const { conversationId } = useParams()
  const { accessToken, authLoading } = useAuth()
  const navigate = useNavigate()
  const {
    subscribe, isOnline, lastSeen, isTyping, seedPresence, sendTyping, sendRead, refreshUnread,
  } = useMessaging()

  const [messages, setMessages] = useState(null)
  const [participant, setParticipant] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [theirReadAt, setTheirReadAt] = useState(null)
  const [error, setError] = useState('')
  // Tapping an image opens a client-side overlay — never a new tab.
  const [preview, setPreview] = useState(null)

  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const typingSentAt = useRef(0)

  const scrollToBottom = useCallback((behavior = 'auto') => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior, block: 'end' }))
  }, [])

  // ------------------------------------------------------------- load
  useEffect(() => {
    if (authLoading) return undefined
    if (!accessToken) { navigate('/login', { replace: true }); return undefined }

    let cancelled = false
    api.listMessages(conversationId, accessToken)
      .then((data) => {
        if (cancelled) return
        setMessages(data.items ?? [])
        setParticipant(data.participant)
        setCursor(data.next_cursor ?? null)
        setTheirReadAt(data.other_last_read_at ?? null)
        seedPresence(data.participant?.id, data.is_online, data.last_seen_at)
        scrollToBottom()
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.status === 404 ? 'This conversation is no longer available.' : (err.message || 'Could not load this conversation.'))
        setMessages([])
      })
    return () => { cancelled = true }
  }, [authLoading, accessToken, conversationId, navigate, seedPresence, scrollToBottom])

  // Opening the thread marks it read, and so does every message that
  // arrives while it's open — otherwise the badge would keep counting
  // messages the person is looking at.
  useEffect(() => {
    if (!accessToken || messages === null) return
    sendRead(conversationId)
    api.markConversationRead(conversationId, accessToken)
      .then((data) => refreshUnread(data))
      .catch(() => {})
  }, [accessToken, conversationId, messages === null]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------- realtime
  useEffect(() => subscribe((event) => {
    if (event.conversation_id !== conversationId) return

    if (event.type === 'message') {
      setMessages((list) => {
        if (!list) return list
        // Replace the optimistic placeholder (same client id) or skip a
        // duplicate echo of a message we already have.
        if (list.some((m) => m.id === event.message.id)) return list
        const withoutPending = event.message.is_mine
          ? list.filter((m) => !(m.pending && m.body === event.message.body))
          : list
        return [...withoutPending, event.message]
      })
      scrollToBottom('smooth')
      if (!event.message.is_mine) {
        sendRead(conversationId)
        api.markConversationRead(conversationId, accessToken).catch(() => {})
      }
      return
    }

    if (event.type === 'read') {
      setTheirReadAt(event.at)
    }
  }), [subscribe, conversationId, accessToken, sendRead, scrollToBottom])

  // -------------------------------------------------------- pagination
  const loadOlder = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    const container = scrollRef.current
    const before = container?.scrollHeight ?? 0
    try {
      const data = await api.listMessages(conversationId, accessToken, cursor)
      setMessages((list) => [...(data.items ?? []), ...(list ?? [])])
      setCursor(data.next_cursor ?? null)
      // Keep the reading position steady instead of jumping to the top.
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - before
      })
    } catch (err) {
      setError(err.message || 'Could not load older messages.')
    } finally {
      setLoadingMore(false)
    }
  }

  // ------------------------------------------------------------- send
  const handleSend = async ({ body, attachments }) => {
    const optimistic = {
      id: `pending-${Date.now()}`,
      conversation_id: conversationId,
      body: body || null,
      attachments: [],
      media_urls: [],
      created_at: new Date().toISOString(),
      is_mine: true,
      is_read: false,
      pending: true,
    }
    setMessages((list) => [...(list ?? []), optimistic])
    scrollToBottom('smooth')
    try {
      const saved = await api.sendMessage(conversationId, { body, attachments }, accessToken)
      setMessages((list) => (list ?? []).map((m) => (m.id === optimistic.id ? saved : m)))
      scrollToBottom('smooth')
    } catch (err) {
      // Leave the bubble in place but flag it, so the text isn't lost.
      setMessages((list) => (list ?? []).map((m) => (
        m.id === optimistic.id ? { ...m, pending: false, failed: true } : m
      )))
      throw err
    }
  }

  const handleTyping = (state) => {
    const now = Date.now()
    if (state && now - typingSentAt.current < TYPING_PING_MS) return
    typingSentAt.current = state ? now : 0
    sendTyping(conversationId, state)
  }

  // Group into day sections once, rather than comparing dates per bubble.
  const groups = useMemo(() => {
    const out = []
    for (const message of messages ?? []) {
      const label = dayLabel(message.created_at)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(message)
      else out.push({ label, items: [message] })
    }
    return out
  }, [messages])

  const online = participant ? isOnline(participant.id) : false
  const status = participant
    ? presenceLabel(online, lastSeen(participant.id))
    : ''
  const typing = isTyping(conversationId)

  return (
    <div className="mt">
      <header className="mt-head">
        <Link to="/home/messages" className="mt-back" aria-label="Back to messages"><ChevronLeft size={22} /></Link>
        {participant ? (
          <Link to={`/u/${participant.username}`} className="mt-who">
            <span className="mt-av-wrap">
              {participant.photo_url ? (
                <img className="mt-av" src={participant.photo_url} alt="" />
              ) : (
                <span className={`mt-av tone-${avatarTone(participant.id)}`} aria-hidden="true">
                  {initialsOf(displayName(participant))}
                </span>
              )}
              <OnlineDot online={online} size={10} />
            </span>
            <span className="mt-who-text">
              <span className="mt-name">{displayName(participant)}</span>
              {typing ? <TypingDots /> : status && <span className="mt-status">{status}</span>}
            </span>
          </Link>
        ) : (
          <span className="mt-who"><span className="mt-name">Conversation</span></span>
        )}
      </header>

      <div className="mt-scroll" ref={scrollRef}>
        {cursor && (
          <button type="button" className="mt-more" onClick={loadOlder} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}

        {error && <p className="mt-error">{error}</p>}

        {messages === null && <p className="mt-note">Loading conversation…</p>}
        {messages !== null && messages.length === 0 && !error && (
          <p className="mt-note">No messages yet — say hello.</p>
        )}

        {groups.map((group) => (
          <section key={group.label} className="mt-day">
            <h2 className="mt-day-label"><span>{group.label}</span></h2>
            {group.items.map((message) => {
              const seen = message.is_mine && !message.pending && theirReadAt
                && new Date(theirReadAt) >= new Date(message.created_at)
              return (
                <article key={message.id} className={`mt-msg ${message.is_mine ? 'mt-mine' : 'mt-theirs'}`}>
                  <div className={`mt-bubble ${message.failed ? 'mt-failed' : ''}`}>
                    {message.attachments?.length > 0 && (
                      <div className="mt-media">
                        {message.attachments.map((attachment) => (
                          <Attachment
                            key={attachment.url}
                            attachment={attachment}
                            onOpenImage={(url) => setPreview(url)}
                          />
                        ))}
                      </div>
                    )}
                    {message.body && <p className="mt-text">{message.body}</p>}
                    <span className="mt-meta">
                      {timeOfDay(message.created_at)}
                      {message.is_mine && (
                        message.pending
                          ? <Clock size={12} aria-label="Sending" />
                          : seen
                            ? <CheckCheck size={13} aria-label="Seen" />
                            : <Check size={13} aria-label="Sent" />
                      )}
                    </span>
                    {message.failed && <span className="mt-retry">Not sent</span>}
                  </div>
                </article>
              )
            })}
          </section>
        ))}
        <div ref={bottomRef} />
      </div>

      <Lightbox src={preview} onClose={() => setPreview(null)} />

      <Composer
        token={accessToken}
        disabled={!accessToken || !!error}
        onSend={handleSend}
        onTyping={handleTyping}
      />

      <style>{`
        .mt { display: flex; flex-direction: column; height: calc(100vh - 88px); margin: -24px -20px -88px; }
        .mt-head {
          display: flex; align-items: center; gap: 4px;
          padding: 10px 12px; border-bottom: 1px solid var(--border);
          background: var(--panel); position: sticky; top: 0; z-index: 5;
        }
        .mt-back { display: grid; place-items: center; width: 34px; height: 34px; color: var(--ink-dim); }
        .mt-who { display: flex; align-items: center; gap: 10px; color: inherit; min-width: 0; }
        .mt-av-wrap { position: relative; display: block; width: 38px; height: 38px; flex: none; }
        .mt-av {
          width: 38px; height: 38px; border-radius: 999px; object-fit: cover;
          display: grid; place-items: center; font-family: var(--font-head); font-size: 13px;
          background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink);
        }
        .mt-av.tone-a { background: color-mix(in srgb, var(--lemon) 45%, transparent); }
        .mt-av.tone-b { background: color-mix(in srgb, var(--accent-ink) 18%, transparent); }
        .mt-who-text { display: flex; flex-direction: column; min-width: 0; }
        .mt-name { font-family: var(--font-head); font-size: 15px; font-weight: 600; color: var(--ink); }
        .mt-status { font-size: 12px; color: var(--ink-faint); }
        .mt-scroll { flex: 1; overflow-y: auto; padding: 14px 14px 6px; display: flex; flex-direction: column; }
        .mt-more { align-self: center; font-size: 12.5px; color: var(--accent-ink); padding: 6px 12px; margin-bottom: 10px; }
        .mt-note { text-align: center; font-size: 13px; color: var(--ink-faint); margin: 24px 0; }
        .mt-error { text-align: center; font-size: 13px; color: crimson; }
        .mt-day-label { display: flex; align-items: center; justify-content: center; margin: 12px 0; }
        .mt-day-label span {
          font-size: 11.5px; font-weight: 600; color: var(--ink-faint);
          background: color-mix(in srgb, var(--ink) 6%, transparent);
          padding: 3px 10px; border-radius: 999px;
        }
        .mt-msg { display: flex; margin-bottom: 8px; }
        .mt-mine { justify-content: flex-end; }
        .mt-bubble {
          max-width: 78%; padding: 9px 13px 7px; border-radius: 22px;
          background: var(--panel); border: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 6px;
        }
        .mt-mine .mt-bubble {
          background: var(--lemon); color: var(--on-accent); border-color: transparent;
          border-bottom-right-radius: 8px;
        }
        .mt-theirs .mt-bubble { border-bottom-left-radius: 8px; }
        .mt-failed { border-color: crimson; }
        .mt-text { margin: 0; font-size: 14.5px; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
        .mt-media { display: flex; flex-direction: column; gap: 6px; width: 100%; }
        .mt-meta {
          display: inline-flex; align-items: center; gap: 4px; align-self: flex-end;
          font-size: 10.5px; opacity: 0.7;
        }
        .mt-retry { font-size: 11px; color: crimson; align-self: flex-end; }
        @media (min-width: 860px) {
          .mt { height: calc(100vh - 64px); margin: -32px -40px; }
        }
      `}</style>
    </div>
  )
}
