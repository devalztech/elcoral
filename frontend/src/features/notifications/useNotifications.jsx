/**
 * The notification bell's shared brain.
 *
 * One provider for the whole session so every bell (home, jobs,
 * communities, profile) shows the SAME unread number, and reading the
 * list on /home/notifications clears all of them at once. Counts refresh
 * on mount, on a slow poll, and whenever the tab regains focus.
 *
 * It also raises a real browser notification for anything that arrives
 * while the app isn't the focused tab. Permission is asked for once, on
 * the first signed-in session, and never again if it's denied. Rows we
 * have already announced are remembered in sessionStorage so a refresh
 * doesn't re-ring the same three likes.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../../api/client.js'
import { useAuth } from '../auth/hooks/useAuth.jsx'
import { notificationSentence } from './notificationCopy.js'

const POLL_MS = 45_000
const ANNOUNCED_KEY = 'elcoral:notified-ids'
const ANNOUNCED_MAX = 120

const Ctx = createContext({
  unread: 0, refresh: () => {}, setUnread: () => {}, desktopPermission: 'default', enableDesktop: async () => {},
})

function supported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

function readAnnounced() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(ANNOUNCED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function writeAnnounced(set) {
  try {
    sessionStorage.setItem(ANNOUNCED_KEY, JSON.stringify([...set].slice(-ANNOUNCED_MAX)))
  } catch {
    /* private mode — announcing twice is better than crashing */
  }
}

export function NotificationsProvider({ children }) {
  const { accessToken, authLoading } = useAuth()
  const [unread, setUnread] = useState(0)
  const [permission, setPermission] = useState(supported() ? Notification.permission : 'unsupported')

  const announced = useRef(readAnnounced())
  const lastCount = useRef(0)
  // The very first poll of a session only seeds the "already seen" set —
  // signing in shouldn't fire ten alerts for yesterday's likes.
  const primed = useRef(false)

  const enableDesktop = useCallback(async () => {
    if (!supported()) return 'unsupported'
    if (Notification.permission !== 'default') {
      setPermission(Notification.permission)
      return Notification.permission
    }
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [])

  const announce = useCallback(async () => {
    if (!supported() || Notification.permission !== 'granted' || !accessToken) return
    let items = []
    try {
      const data = await api.listNotifications(accessToken, 10)
      items = data.items ?? []
    } catch {
      return
    }
    const fresh = items.filter((n) => !n.is_read && !announced.current.has(n.id))
    for (const n of fresh) announced.current.add(n.id)
    writeAnnounced(announced.current)

    if (!primed.current) { primed.current = true; return }
    // Don't interrupt someone who is already looking at the app.
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return

    for (const n of fresh.slice(0, 3)) {
      try {
        const note = new Notification('Elcoral', {
          body: notificationSentence(n),
          icon: n.actor?.photo_url || '/favicon.ico',
          tag: `elcoral-${n.id}`,
        })
        note.onclick = () => {
          window.focus()
          window.location.href = n.post_id
            ? `/home/posts/${n.post_id}`
            : '/home/notifications'
          note.close()
        }
      } catch {
        /* some browsers block constructing Notification outside a SW */
      }
    }
  }, [accessToken])

  const refresh = useCallback(async () => {
    if (!accessToken) { setUnread(0); return }
    try {
      const data = await api.unreadNotificationCount(accessToken)
      const next = data.unread_count ?? 0
      setUnread(next)
      if (!primed.current || next > lastCount.current) await announce()
      lastCount.current = next
    } catch {
      /* a bell badge is never worth surfacing an error for */
    }
  }, [accessToken, announce])

  // Ask once per signed-in session, after the token exists.
  useEffect(() => {
    if (authLoading || !accessToken || !supported()) return
    if (Notification.permission === 'default') { enableDesktop().catch(() => {}) }
    else setPermission(Notification.permission)
  }, [authLoading, accessToken, enableDesktop])

  useEffect(() => {
    if (authLoading) return undefined
    refresh()
    const id = setInterval(refresh, POLL_MS)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [authLoading, refresh])

  return (
    <Ctx.Provider value={{ unread, refresh, setUnread, desktopPermission: permission, enableDesktop }}>
      {children}
    </Ctx.Provider>
  )
}

export function useNotifications() {
  return useContext(Ctx)
}
