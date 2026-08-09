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
            {group.items.map((message, i) => {
              const seen = message.is_mine && !message.pending && theirReadAt
                && new Date(theirReadAt) >= new Date(message.created_at)
              // WhatsApp only draws the little tail on the first bubble of
              // a run from the same sender; the rest sit 2px apart with a
              // plain corner, and a new run starts 12px lower.
              const prev = group.items[i - 1]
              const startsRun = !prev || prev.is_mine !== message.is_mine
              const mediaOnly = message.attachments?.length > 0 && !message.body
              return (
                <article
                  key={message.id}
                  className={`mt-msg ${message.is_mine ? 'mt-mine' : 'mt-theirs'} ${startsRun ? 'mt-run-start' : ''}`}
                >
                  <div
                    className={`mt-bubble ${startsRun ? 'mt-tail' : ''} ${mediaOnly ? 'mt-bubble-media' : ''} ${message.failed ? 'mt-failed' : ''}`}
                  >
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
                    {message.body && (
                      <p className="mt-text">
                        {message.body}
                        {/* Reserves the exact width of the timestamp so the
                            last line of text never runs underneath it —
                            the same trick WhatsApp uses. */}
                        <span className="mt-gap" aria-hidden="true" />
                      </p>
                    )}
                    <span className={`mt-meta ${mediaOnly ? 'mt-meta-over' : ''}`}>
                      {timeOfDay(message.created_at)}
                      {message.is_mine && (
                        message.pending
                          ? <Clock size={15} aria-label="Sending" />
                          : seen
                            ? <CheckCheck size={15} aria-label="Seen" />
                            : <Check size={15} aria-label="Sent" />
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
        /* --------------------------------------------------------------
           Thread metrics — measured off WhatsApp:

             header .................. 59px tall, avatar 40px, name 16px,
                                       presence line 13px
             scroll padding .......... 8px 9px (phone) / 9px 6.5% (wide)
             bubble .................. max-width 85% (65% wide), radius
                                       7.5px, padding 6px 7px 8px 9px,
                                       shadow 0 1px .5px rgba(11,20,26,.13)
             text .................... 14.2px / 19px
             timestamp ............... 11px, bottom-right, 4px from text
             tail .................... 8px triangle on the first bubble
                                       of a run only
             spacing ................. 2px inside a run, 12px between runs
             media bubble ............ 3px padding, 6px inner radius,
                                       max-width 330px
           -------------------------------------------------------------- */
        .mt { display: flex; flex-direction: column; height: 100vh; }
        .mt-head {
          display: flex; align-items: center; gap: 8px; height: 59px;
          padding: 0 12px; border-bottom: 1px solid var(--border);
          background: var(--panel); position: sticky; top: 0; z-index: 5;
        }
        .mt-back { display: grid; place-items: center; width: 34px; height: 34px; color: var(--ink-dim); flex: none; }
        .mt-who { display: flex; align-items: center; gap: 12px; color: inherit; min-width: 0; }
        .mt-av-wrap { position: relative; display: block; width: 40px; height: 40px; flex: none; }
        .mt-av {
          width: 40px; height: 40px; border-radius: 999px; object-fit: cover;
          display: grid; place-items: center; font-family: var(--font-head); font-size: 14px;
          background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink);
        }
        .mt-av.tone-a { background: color-mix(in srgb, var(--lemon) 45%, transparent); }
        .mt-av.tone-b { background: color-mix(in srgb, var(--accent-ink) 18%, transparent); }
        .mt-who-text { display: flex; flex-direction: column; min-width: 0; }
        .mt-name { font-family: var(--font-head); font-size: 16px; line-height: 21px; font-weight: 600; color: var(--ink); }
        .mt-status { font-size: 13px; line-height: 17px; color: var(--ink-faint); }

        .mt-scroll { flex: 1; overflow-y: auto; padding: 8px 9px 6px; display: flex; flex-direction: column; }
        .mt-more { align-self: center; font-size: 13px; color: var(--accent-ink); padding: 6px 12px; margin-bottom: 8px; }
        .mt-note { text-align: center; font-size: 13px; color: var(--ink-faint); margin: 24px 0; }
        .mt-error { text-align: center; font-size: 13px; color: crimson; }
        .mt-day-label { display: flex; align-items: center; justify-content: center; margin: 12px 0; }
        .mt-day-label span {
          font-size: 12.5px; font-weight: 500; color: var(--ink-faint);
          background: var(--panel); box-shadow: 0 1px .5px rgba(11,20,26,.13);
          padding: 5px 12px; border-radius: 7.5px; text-transform: uppercase; letter-spacing: .3px;
        }

        .mt-msg { display: flex; margin-top: 2px; }
        .mt-msg.mt-run-start { margin-top: 12px; }
        .mt-mine { justify-content: flex-end; }
        .mt-bubble {
          position: relative;
          max-width: 85%; padding: 6px 7px 8px 9px; border-radius: 7.5px;
          background: var(--panel); color: var(--ink);
          box-shadow: 0 1px .5px rgba(11, 20, 26, .13);
          display: flex; flex-direction: column;
        }
        .mt-mine .mt-bubble { background: var(--lemon); color: var(--on-accent); }
        /* Tail: an 8px triangle tucked into the top corner of the first
           bubble in a run, matching WhatsApp's tail-out sprite. */
        .mt-mine .mt-tail { border-top-right-radius: 0; }
        .mt-theirs .mt-tail { border-top-left-radius: 0; }
        .mt-tail::before {
          content: ''; position: absolute; top: 0; width: 8px; height: 13px;
        }
        .mt-mine .mt-tail::before {
          right: -8px;
          background: var(--lemon);
          clip-path: polygon(0 0, 100% 0, 0 100%);
        }
        .mt-theirs .mt-tail::before {
          left: -8px;
          background: var(--panel);
          clip-path: polygon(0 0, 100% 0, 100% 100%);
        }
        .mt-failed { outline: 1px solid crimson; }

        .mt-text {
          margin: 0; font-size: 14.2px; line-height: 19px;
          white-space: pre-wrap; overflow-wrap: anywhere;
        }
        /* 62px covers "12:34 ✓✓" at 11px; 46px would clip the ticks. */
        .mt-gap { display: inline-block; width: 62px; height: 1px; }
        .mt-theirs .mt-gap { width: 46px; }

        .mt-media {
          display: flex; flex-direction: column; gap: 3px;
          width: 100%; max-width: 330px;
        }
        /* A bubble that is only media shrinks its padding to 3px, the way
           a WhatsApp photo message does. */
        .mt-bubble-media { padding: 3px; }
        .mt-bubble-media .mt-media { margin: 0; }

        .mt-meta {
          position: absolute; right: 9px; bottom: 5px;
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 11px; line-height: 15px; opacity: .6;
          font-variant-numeric: tabular-nums; pointer-events: none;
        }
        .mt-meta svg { width: 15px; height: 15px; }
        /* On a photo-only bubble the stamp floats over the image on the
           dark scrim WhatsApp paints there. */
        .mt-meta-over {
          right: 10px; bottom: 8px; opacity: 1; color: #fff;
          padding: 2px 7px; border-radius: 999px; background: rgba(11, 20, 26, .45);
        }
        .mt-retry { font-size: 11px; color: crimson; align-self: flex-end; margin-top: 2px; }

        @media (min-width: 860px) {
          .mt { height: 100vh; }
          .mt-scroll { padding: 9px 6.5% 6px; }
          .mt-bubble { max-width: 65%; }
        }
      `}</style>

    </div>
  )
}
