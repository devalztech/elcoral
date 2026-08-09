/**
 * One WebSocket for the whole signed-in session.
 *
 * The inbox badge, the thread you have open, the "typing…" line and the
 * green dot next to an avatar are all fed by a single socket
 * (/api/messages/ws), because opening one per conversation would mean
 * the inbox couldn't update until you'd opened every thread in it.
 *
 * Sending a message is deliberately NOT done over this socket — it stays
 * a POST, which owns validation and persistence and then fans the saved
 * message back through here. That keeps one code path for "a message
 * exists" and means a dropped socket can never lose a message the user
 * thought they'd sent.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import { api } from '../../api/client.js'
import { useAuth } from '../auth/hooks/useAuth.jsx'

const MessagingContext = createContext(null)

// Server tells us how long a typing flag is good for; this is the
// fallback so a client that stops sending never leaves "typing…" stuck.
const TYPING_TTL_MS = 8000
const PING_MS = 25000
const MAX_BACKOFF_MS = 20000

export function MessagingProvider({ children }) {
  const { accessToken, authLoading } = useAuth()

  const [connected, setConnected] = useState(false)
  const [unreadTotal, setUnreadTotal] = useState(0)
  // userId -> { online, last_seen_at }
  const [presence, setPresence] = useState({})
  // conversationId -> { [userId]: expiresAt }
  const [typing, setTyping] = useState({})

  const socketRef = useRef(null)
  const listenersRef = useRef(new Set())
  const retryRef = useRef(0)
  const closedByUsRef = useRef(false)

  const emit = useCallback((event) => {
    listenersRef.current.forEach((fn) => {
      try { fn(event) } catch { /* one bad listener must not kill the rest */ }
    })
  }, [])

  const refreshUnread = useCallback(async () => {
    if (!accessToken) return
    try {
      const data = await api.unreadMessageCount(accessToken)
      setUnreadTotal(data.unread_total ?? 0)
    } catch { /* badge is cosmetic; never surface an error for it */ }
  }, [accessToken])

  // ------------------------------------------------------------ socket
  useEffect(() => {
    if (authLoading || !accessToken) {
      setConnected(false)
      return undefined
    }

    let timer = null
    let ping = null
    closedByUsRef.current = false

    const open = () => {
      if (closedByUsRef.current) return
      let socket
      try {
        socket = new WebSocket(api.messageSocketUrl(accessToken))
      } catch {
        schedule()
        return
      }
      socketRef.current = socket

      socket.onopen = () => {
        retryRef.current = 0
        setConnected(true)
        ping = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }))
        }, PING_MS)
      }

      socket.onmessage = (raw) => {
        let event
        try { event = JSON.parse(raw.data) } catch { return }

        if (event.type === 'ready') {
          setPresence((prev) => {
            const next = { ...prev }
            for (const id of event.online ?? []) next[id] = { online: true, last_seen_at: null }
            return next
          })
          return
        }

        if (event.type === 'presence') {
          setPresence((prev) => ({
            ...prev,
            [event.user_id]: { online: !!event.online, last_seen_at: event.last_seen_at ?? null },
          }))
          return
        }

        if (event.type === 'typing') {
          const until = Date.now() + (event.ttl ? event.ttl * 1000 : TYPING_TTL_MS)
          setTyping((prev) => {
            const room = { ...(prev[event.conversation_id] ?? {}) }
            if (event.state) room[event.user_id] = until
            else delete room[event.user_id]
            return { ...prev, [event.conversation_id]: room }
          })
          return
        }

        if (event.type === 'message') {
          if (typeof event.unread_total === 'number') setUnreadTotal(event.unread_total)
          // An incoming message means they've stopped typing.
          setTyping((prev) => {
            const room = { ...(prev[event.conversation_id] ?? {}) }
            delete room[event.message?.sender_id]
            return { ...prev, [event.conversation_id]: room }
          })
        }

        emit(event)
      }

      socket.onclose = () => {
        setConnected(false)
        if (ping) { clearInterval(ping); ping = null }
        // 4401 = the token was rejected. Reconnecting with the same token
        // would just spin, so wait for a new one to arrive as a new effect.
        schedule()
      }
      socket.onerror = () => { /* onclose always follows; handled there */ }
    }

    const schedule = () => {
      if (closedByUsRef.current || timer) return
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** retryRef.current)
      retryRef.current += 1
      timer = setTimeout(() => { timer = null; open() }, delay)
    }

    open()
    refreshUnread()

    return () => {
      closedByUsRef.current = true
      if (timer) clearTimeout(timer)
      if (ping) clearInterval(ping)
      const socket = socketRef.current
      socketRef.current = null
      if (socket && socket.readyState <= WebSocket.OPEN) socket.close()
      setConnected(false)
    }
  }, [accessToken, authLoading, emit, refreshUnread])

  // Expire stale typing flags even if the "stopped" event never arrives.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      setTyping((prev) => {
        let changed = false
        const next = {}
        for (const [conversationId, room] of Object.entries(prev)) {
          const kept = Object.fromEntries(Object.entries(room).filter(([, until]) => until > now))
          if (Object.keys(kept).length !== Object.keys(room).length) changed = true
          next[conversationId] = kept
        }
        return changed ? next : prev
      })
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const send = useCallback((payload) => {
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload))
  }, [])

  const value = useMemo(() => ({
    connected,
    unreadTotal,
    setUnreadTotal,
    refreshUnread,
    /** Subscribe to raw socket events. Returns an unsubscribe function. */
    subscribe: (fn) => {
      listenersRef.current.add(fn)
      return () => listenersRef.current.delete(fn)
    },
    /** Seed presence from a REST payload so the dot is right before the socket speaks. */
    seedPresence: (userId, online, lastSeenAt) => {
      if (!userId) return
      setPresence((prev) => {
        const current = prev[userId]
        if (current && current.online === online && current.last_seen_at === (lastSeenAt ?? null)) return prev
        return { ...prev, [userId]: { online: !!online, last_seen_at: lastSeenAt ?? null } }
      })
    },
    isOnline: (userId) => Boolean(presence[userId]?.online),
    lastSeen: (userId) => presence[userId]?.last_seen_at ?? null,
    isTyping: (conversationId) => Object.keys(typing[conversationId] ?? {}).length > 0,
    sendTyping: (conversationId, state) => send({ type: 'typing', conversation_id: conversationId, state }),
    sendRead: (conversationId) => send({ type: 'read', conversation_id: conversationId }),
  }), [connected, unreadTotal, refreshUnread, presence, typing, send])

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>
}

export function useMessaging() {
  const ctx = useContext(MessagingContext)
  if (!ctx) {
    // Rendering a message surface outside the provider is a wiring bug,
    // but it shouldn't white-screen the app — degrade to "no realtime".
    return {
      connected: false,
      unreadTotal: 0,
      setUnreadTotal: () => {},
      refreshUnread: () => {},
      subscribe: () => () => {},
      seedPresence: () => {},
      isOnline: () => false,
      lastSeen: () => null,
      isTyping: () => false,
      sendTyping: () => {},
      sendRead: () => {},
    }
  }
  return ctx
}
