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
import {
  Check, CheckCheck, ChevronLeft, Clock, Copy, CornerUpLeft, Forward, Smile, Trash2, X,
} from 'lucide-react'
import { api } from '../api/client.js'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { useMessaging } from '../features/messages/useMessaging.jsx'
import { OnlineDot, TypingDots, presenceLabel } from '../features/messages/Presence.jsx'
import Attachment from '../features/messages/Attachment.jsx'
import MediaCarousel from '../components/MediaCarousel.jsx'
import Composer from '../features/messages/Composer.jsx'
import Lightbox from '../components/Lightbox.jsx'
import RichText from '../components/RichText.jsx'
import {
  avatarTone, dayLabel, displayName, initialsOf, timeOfDay,
} from '../features/social/format.js'
import Spinner from '../components/Spinner.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'

// How long we can go without re-telling the server "still typing".
const TYPING_PING_MS = 3000

// The quick-reaction row, in the order WhatsApp/Messenger use.
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

// Press-and-hold on touch opens the same sheet the hover button does.
const LONG_PRESS_MS = 420

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
  // The message whose action sheet is open, the one being replied to, and
  // the one being forwarded.
  const [sheetFor, setSheetFor] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [forwarding, setForwarding] = useState(null)
  const [forwardList, setForwardList] = useState(null)
  const [forwardBusy, setForwardBusy] = useState(false)
  const [toast, setToast] = useState('')

  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const typingSentAt = useRef(0)
  const longPress = useRef(null)

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

    if (event.type === 'message_update') {
      setMessages((list) => (list ?? []).map((m) => (
        m.id === event.message.id ? { ...m, ...event.message } : m
      )))
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
  const handleSend = async ({ body, attachments, replyToId }) => {
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
      reply_to: replyTo && replyTo.id === replyToId
        ? { id: replyTo.id, body: replyTo.body, is_mine: replyTo.is_mine, kind: 'text' }
        : null,
    }
    setMessages((list) => [...(list ?? []), optimistic])
    scrollToBottom('smooth')
    try {
      const saved = await api.sendMessage(conversationId, { body, attachments, replyToId }, accessToken)
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

  // --------------------------------------------------------- actions
  const patchMessage = (id, patch) => {
    setMessages((list) => (list ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  const react = async (message, emoji) => {
    setSheetFor(null)
    // Optimistic: one emoji per person, tapping the same one clears it.
    const mineNow = message.reactions?.find((r) => r.mine)
    const next = []
    for (const r of message.reactions ?? []) {
      let count = r.count
      if (r.mine) count -= 1
      if (r.emoji === emoji && !(mineNow?.emoji === emoji)) count += 1
      if (count > 0) next.push({ ...r, count, mine: r.emoji === emoji && mineNow?.emoji !== emoji })
    }
    if (mineNow?.emoji !== emoji && !next.some((r) => r.emoji === emoji)) {
      next.push({ emoji, count: 1, mine: true })
    }
    patchMessage(message.id, { reactions: next })
    try {
      await api.reactToMessage(message.id, emoji, accessToken)
    } catch (err) {
      patchMessage(message.id, { reactions: message.reactions ?? [] })
      setToast(err.message || 'Could not react.')
    }
  }

  const removeMessage = async (message, scope) => {
    setSheetFor(null)
    const before = messages
    if (scope === 'self') setMessages((list) => (list ?? []).filter((m) => m.id !== message.id))
    else patchMessage(message.id, { deleted: true, body: null, attachments: [], reactions: [] })
    try {
      await api.deleteMessage(message.id, scope, accessToken)
    } catch (err) {
      setMessages(before)
      setToast(err.message || 'Could not delete that message.')
    }
  }

  const openForward = async (message) => {
    setSheetFor(null)
    setForwarding(message)
    if (forwardList) return
    try {
      const data = await api.listConversations(accessToken)
      setForwardList(data.items ?? [])
    } catch (err) {
      setToast(err.message || 'Could not load your chats.')
      setForwardList([])
    }
  }

  const doForward = async (targetId) => {
    if (!forwarding || forwardBusy) return
    setForwardBusy(true)
    try {
      await api.forwardMessage(forwarding.id, { conversationIds: [targetId] }, accessToken)
      setForwarding(null)
      setToast('Forwarded.')
    } catch (err) {
      setToast(err.message || 'Could not forward that message.')
    } finally {
      setForwardBusy(false)
    }
  }

  const copyMessage = async (message) => {
    setSheetFor(null)
    try {
      await navigator.clipboard.writeText(message.body ?? '')
      setToast('Copied.')
    } catch {
      setToast('Could not copy.')
    }
  }

  const startLongPress = (message) => {
    clearTimeout(longPress.current)
    longPress.current = setTimeout(() => setSheetFor(message), LONG_PRESS_MS)
  }
  const cancelLongPress = () => clearTimeout(longPress.current)

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(id)
  }, [toast])

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
              <span className="mt-name">
                {displayName(participant)}
                {participant.is_verified && <VerifiedBadge size={16} className="mt-verified" />}
              </span>
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
            {loadingMore ? <Spinner size={17} label="Loading earlier messages" /> : 'Load earlier messages'}
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
              if (message.deleted) {
                return (
                  <article
                    key={message.id}
                    className={`mt-msg ${message.is_mine ? 'mt-mine' : 'mt-theirs'} ${startsRun ? 'mt-run-start' : ''}`}
                  >
                    <div className={`mt-bubble mt-deleted ${startsRun ? 'mt-tail' : ''}`}>
                      <p className="mt-text"><em>This message was deleted</em></p>
                      <span className="mt-meta">{timeOfDay(message.created_at)}</span>
                    </div>
                  </article>
                )
              }
              return (
                <article
                  key={message.id}
                  className={`mt-msg ${message.is_mine ? 'mt-mine' : 'mt-theirs'} ${startsRun ? 'mt-run-start' : ''}`}
                  onPointerDown={() => { if (!message.pending) startLongPress(message) }}
                  onPointerUp={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onContextMenu={(e) => { if (!message.pending) { e.preventDefault(); setSheetFor(message) } }}
                >
                  <div
                    id={`msg-${message.id}`}
                    className={`mt-bubble ${startsRun ? 'mt-tail' : ''} ${mediaOnly ? 'mt-bubble-media' : ''} ${message.failed ? 'mt-failed' : ''} ${message.reactions?.length ? 'mt-has-reacts' : ''}`}
                  >
                    {message.is_forwarded && (
                      <span className="mt-fwd"><Forward size={12} /> Forwarded</span>
                    )}
                    {message.reply_to && (
                      <button
                        type="button"
                        className="mt-quote"
                        onClick={() => {
                          const el = document.getElementById(`msg-${message.reply_to.id}`)
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          el?.classList.add('mt-flash')
                          setTimeout(() => el?.classList.remove('mt-flash'), 1200)
                        }}
                      >
                        <b>{message.reply_to.is_mine ? 'You' : displayName(participant ?? {})}</b>
                        <i>
                          {message.reply_to.kind === 'deleted'
                            ? 'Deleted message'
                            : (message.reply_to.body || 'Attachment')}
                        </i>
                      </button>
                    )}
                    {message.attachments?.length > 0 && (
                      <div className="mt-media">
                        {(() => {
                          const gallery = message.attachments.filter(
                            (a) => a.kind === 'image' || a.kind === 'video',
                          )
                          const rest = message.attachments.filter(
                            (a) => a.kind !== 'image' && a.kind !== 'video',
                          )
                          return (
                            <>
                              {/* Several photos/clips sent at once collapse
                                  into ONE frame with a counter instead of
                                  flooding the thread. */}
                              {gallery.length > 1 ? (
                                <div
                                  className="ma-frame"
                                  style={{ width: 246, maxWidth: '100%', aspectRatio: '3 / 4', borderRadius: 6, overflow: 'hidden', background: '#000' }}
                                >
                                  <MediaCarousel items={gallery} />
                                </div>
                              ) : (
                                gallery.map((attachment) => (
                                  <Attachment
                                    key={attachment.url}
                                    attachment={attachment}
                                    onOpenImage={(url) => setPreview(url)}
                                  />
                                ))
                              )}
                              {rest.map((attachment) => (
                                <Attachment key={attachment.url} attachment={attachment} />
                              ))}
                            </>
                          )
                        })()}
                      </div>
                    )}

                    {message.body && (
                      <p className="mt-text">
                        {/* Same renderer as posts and comments, so a long
                            DM gets the identical inline "… More" toggle. */}
                        <RichText as="span" text={message.body} limit={280} />
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

                    {message.reactions?.length > 0 && (
                      <span className="mt-reacts">
                        {message.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            className={`mt-react ${r.mine ? 'mt-react-mine' : ''}`}
                            onClick={() => react(message, r.emoji)}
                            aria-label={`${r.emoji} ${r.count}`}
                          >
                            {r.emoji}{r.count > 1 && <b>{r.count}</b>}
                          </button>
                        ))}
                      </span>
                    )}
                  </div>

                  {!message.pending && (
                    <button
                      type="button"
                      className="mt-act"
                      onClick={() => setSheetFor(message)}
                      aria-label="Message actions"
                    >
                      <Smile size={15} />
                    </button>
                  )}
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
        replyTo={replyTo ? { ...replyTo, author_name: displayName(participant ?? {}) } : null}
        onCancelReply={() => setReplyTo(null)}
      />

      {/* ------------------------------------------------ action sheet */}
      {sheetFor && (
        <div className="mt-sheet-wrap" role="dialog" aria-modal="true" onClick={() => setSheetFor(null)}>
          <div className="mt-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mt-emoji-row">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`mt-emoji ${sheetFor.reactions?.some((r) => r.mine && r.emoji === emoji) ? 'mt-emoji-on' : ''}`}
                  onClick={() => react(sheetFor, emoji)}
                  aria-label={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button type="button" className="mt-sheet-item" onClick={() => { setReplyTo(sheetFor); setSheetFor(null) }}>
              <CornerUpLeft size={17} /> Reply
            </button>
            <button type="button" className="mt-sheet-item" onClick={() => openForward(sheetFor)}>
              <Forward size={17} /> Forward
            </button>
            {sheetFor.body && (
              <button type="button" className="mt-sheet-item" onClick={() => copyMessage(sheetFor)}>
                <Copy size={17} /> Copy text
              </button>
            )}
            <button type="button" className="mt-sheet-item mt-sheet-bad" onClick={() => removeMessage(sheetFor, 'self')}>
              <Trash2 size={17} /> Delete for me
            </button>
            {sheetFor.is_mine && (
              <button type="button" className="mt-sheet-item mt-sheet-bad" onClick={() => removeMessage(sheetFor, 'everyone')}>
                <Trash2 size={17} /> Delete for everyone
              </button>
            )}
            <button type="button" className="mt-sheet-cancel" onClick={() => setSheetFor(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------- forward to */}
      {forwarding && (
        <div className="mt-sheet-wrap" role="dialog" aria-modal="true" onClick={() => setForwarding(null)}>
          <div className="mt-sheet" onClick={(e) => e.stopPropagation()}>
            <header className="mt-sheet-head">
              <h3>Forward to</h3>
              <button type="button" onClick={() => setForwarding(null)} aria-label="Close"><X size={17} /></button>
            </header>
            {forwardList === null && <p className="mt-note">Loading chats…</p>}
            {forwardList?.length === 0 && <p className="mt-note">You have no other chats yet.</p>}
            <div className="mt-fwd-list">
              {(forwardList ?? [])
                .filter((c) => c.id !== conversationId)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="mt-fwd-row"
                    disabled={forwardBusy}
                    onClick={() => doForward(c.id)}
                  >
                    {c.participant?.photo_url ? (
                      <img src={c.participant.photo_url} alt="" />
                    ) : (
                      <span className={`mt-fwd-av tone-${avatarTone(c.participant?.id)}`}>
                        {initialsOf(displayName(c.participant ?? {}))}
                      </span>
                    )}
                    <span>{displayName(c.participant ?? {})}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {toast && <p className="mt-toast" role="status">{toast}</p>}

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
        /* 100dvh (not 100vh) so mobile browser chrome can't push the composer
           below the fold, and min-height:0 on the scroller so the flex child
           actually shrinks — without it the last bubble sat underneath the
           input pill and only appeared after a hard scroll. */
        .mt { display: flex; flex-direction: column; height: 100dvh; min-height: 100dvh; overflow: hidden; }
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
        .mt-verified { color: var(--verified, #1D9BF0); flex: none; margin-left: 3px; vertical-align: -2px; }
        .mt-name { font-family: var(--font-head); font-size: 16px; line-height: 21px; font-weight: 600; color: var(--ink); }
        .mt-status { font-size: 13px; line-height: 17px; color: var(--ink-faint); }

        .mt-scroll {
          flex: 1 1 auto; min-height: 0; overflow-y: auto;
          padding: 8px 9px 14px; display: flex; flex-direction: column;
          overscroll-behavior: contain; scroll-padding-bottom: 16px;
        }
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

        /* ------------------------------------------------ message actions */
        .mt-msg { position: relative; align-items: flex-end; }
        .mt-act {
          opacity: 0; pointer-events: none; flex: none;
          width: 28px; height: 28px; margin: 0 2px 2px; border-radius: 999px;
          display: grid; place-items: center; color: var(--ink-faint);
          background: var(--panel); box-shadow: 0 1px 3px rgba(11,20,26,.18);
          transition: opacity 120ms ease;
        }
        .mt-mine .mt-act { order: -1; }
        @media (hover: hover) and (pointer: fine) {
          .mt-msg:hover .mt-act, .mt-msg:focus-within .mt-act { opacity: 1; pointer-events: auto; }
        }

        .mt-deleted { opacity: .75; }
        .mt-deleted .mt-text em { font-style: italic; color: var(--ink-faint); }
        .mt-flash { animation: mt-flash 1.2s ease-out; }
        @keyframes mt-flash {
          0%, 100% { box-shadow: 0 1px .5px rgba(11,20,26,.13); }
          30% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--lemon) 65%, transparent); }
        }

        .mt-fwd {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11.5px; opacity: .65; margin-bottom: 2px; font-style: italic;
        }

        /* Quoted reply strip inside a bubble. */
        .mt-quote {
          display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
          width: 100%; text-align: left; margin-bottom: 4px;
          padding: 5px 8px; border-radius: 6px;
          border-left: 3px solid color-mix(in srgb, var(--accent-ink) 70%, transparent);
          background: color-mix(in srgb, var(--ink) 8%, transparent);
        }
        .mt-mine .mt-quote { background: rgba(0, 0, 0, .08); }
        .mt-quote b { font-size: 12px; }
        .mt-quote i {
          font-style: normal; font-size: 12.5px; opacity: .75;
          max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        /* Reaction chips, tucked on the bubble's lower edge. */
        .mt-has-reacts { margin-bottom: 12px; }
        .mt-reacts {
          position: absolute; bottom: -12px; display: inline-flex; gap: 3px;
        }
        .mt-theirs .mt-reacts { left: 8px; }
        .mt-mine .mt-reacts { right: 8px; }
        .mt-react {
          display: inline-flex; align-items: center; gap: 3px;
          padding: 2px 6px; border-radius: 999px; font-size: 12px; line-height: 16px;
          background: var(--panel); color: var(--ink);
          box-shadow: 0 1px 3px rgba(11,20,26,.2);
        }
        .mt-react b { font-size: 10.5px; font-weight: 600; }
        .mt-react-mine { outline: 1.5px solid var(--lemon); }

        /* Bottom sheet, shared by the actions menu and the forward picker. */
        .mt-sheet-wrap {
          position: fixed; inset: 0; z-index: 60; display: flex;
          align-items: flex-end; justify-content: center;
          background: rgba(11, 20, 26, .42); backdrop-filter: blur(2px);
          animation: mt-fade 140ms ease-out;
        }
        .mt-sheet {
          width: min(460px, 100%); background: var(--panel);
          border-radius: 18px 18px 0 0; padding: 10px 10px calc(14px + env(safe-area-inset-bottom));
          box-shadow: 0 -12px 40px rgba(0,0,0,.24);
          animation: mt-rise 180ms cubic-bezier(.2,.8,.2,1);
        }
        .mt-sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px 10px; }
        .mt-sheet-head h3 { margin: 0; font-family: var(--font-head); font-size: 16px; }
        .mt-sheet-head button { color: var(--ink-faint); display: grid; place-items: center; }
        .mt-emoji-row {
          display: flex; justify-content: space-between; gap: 4px;
          padding: 6px 4px 12px; margin-bottom: 6px; border-bottom: 1px solid var(--border);
        }
        .mt-emoji {
          width: 42px; height: 42px; border-radius: 999px; font-size: 22px; line-height: 1;
          display: grid; place-items: center; transition: transform 120ms ease;
        }
        @media (hover: hover) and (pointer: fine) { .mt-emoji:hover { transform: scale(1.18); } }
        .mt-emoji-on { background: color-mix(in srgb, var(--lemon) 40%, transparent); }
        .mt-sheet-item {
          display: flex; align-items: center; gap: 12px; width: 100%;
          padding: 12px 12px; border-radius: 12px; font-size: 14.5px;
          color: var(--ink); text-align: left;
        }
        @media (hover: hover) and (pointer: fine) {
          .mt-sheet-item:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
        }
        .mt-sheet-bad { color: var(--danger, #d33); }
        .mt-sheet-cancel {
          width: 100%; margin-top: 6px; padding: 12px; border-radius: 12px;
          font-size: 14.5px; font-weight: 600; color: var(--ink-dim);
          background: color-mix(in srgb, var(--ink) 6%, transparent);
        }
        .mt-fwd-list { max-height: 46vh; overflow-y: auto; }
        .mt-fwd-row {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 9px 10px; border-radius: 12px; font-size: 14.5px; color: var(--ink);
        }
        .mt-fwd-row:disabled { opacity: .5; }
        @media (hover: hover) and (pointer: fine) {
          .mt-fwd-row:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
        }
        .mt-fwd-row img, .mt-fwd-av {
          width: 36px; height: 36px; border-radius: 999px; object-fit: cover; flex: none;
          display: grid; place-items: center; font-size: 13px; font-family: var(--font-head);
          background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink);
        }
        .mt-fwd-av.tone-a { background: color-mix(in srgb, var(--lemon) 45%, transparent); }
        .mt-fwd-av.tone-b { background: color-mix(in srgb, var(--accent-ink) 18%, transparent); }

        .mt-toast {
          position: fixed; left: 50%; bottom: 92px; transform: translateX(-50%);
          z-index: 70; margin: 0; padding: 9px 16px; border-radius: 999px;
          background: rgba(11, 20, 26, .88); color: #fff; font-size: 13px;
          animation: mt-fade 140ms ease-out;
        }
        @keyframes mt-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mt-rise { from { transform: translateY(18px) } to { transform: none } }
        @media (prefers-reduced-motion: reduce) {
          .mt-sheet, .mt-sheet-wrap, .mt-toast, .mt-flash { animation: none; }
        }

        @media (min-width: 860px) {
          .mt { height: 100dvh; }
          .mt-scroll { padding: 9px 6.5% 6px; }
          .mt-bubble { max-width: 65%; }
        }
      `}</style>

    </div>
  )
}
