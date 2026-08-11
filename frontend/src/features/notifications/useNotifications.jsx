/**
 * The notification bell's shared brain — plus the system alerts.
 *
 * One provider for the whole session so every bell (home, jobs,
 * communities, profile) shows the SAME unread number, and reading the
 * list on /home/notifications clears all of them at once. Counts refresh
 * on mount, on a slow poll, and whenever the tab regains focus.
 *
 * Alerts behave like WhatsApp: a direct message arrives over the live
 * socket and rings immediately (no 45s wait), everything else rings off
 * the poll. All of it goes through the service worker so the alert lands
 * in the phone's notification tray, not just the desktop corner.
 * Permission is NEVER asked for on page load — the user turns it on from
 * Settings › Notifications.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../../api/client.js'
import { useAuth } from '../auth/hooks/useAuth.jsx'
import { useMessaging } from '../messages/useMessaging.jsx'
import { notificationSentence } from './notificationCopy.js'
import {
  permissionState, readPrefs, registerServiceWorker, requestPermission, showAlert, supportsNotifications, writePrefs,
} from './browserNotify.js'

const POLL_MS = 30_000
const ANNOUNCED_KEY = 'elcoral:notified-ids'
const ANNOUNCED_MAX = 120

const Ctx = createContext({
  unread: 0,
  refresh: () => {},
  setUnread: () => {},
  desktopPermission: 'default',
  enableDesktop: async () => {},
  alertPrefs: readPrefs(),
  setAlertPrefs: () => {},
  sendTestAlert: async () => false,
})

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

function messagePreview(message) {
  if (message?.deleted) return 'Message deleted'
  if (message?.body) return message.body.length > 140 ? `${message.body.slice(0, 139)}…` : message.body
  const first = message?.attachments?.[0]
  const count = message?.attachments?.length ?? 0
  if (!first) return 'Sent you a message'
  const kind = first.kind || (first.mime_type || '').split('/')[0]
  if (count > 1) return `Sent ${count} attachments`
  if (kind === 'video') return '🎥 Video'
  if (kind === 'audio') return '🎤 Voice note'
  if (kind === 'image') return '📷 Photo'
  return '📄 Document'
}

export function NotificationsProvider({ children }) {
  const { accessToken, authLoading, user } = useAuth()
  const { subscribe } = useMessaging()
  const [unread, setUnread] = useState(0)
  const [permission, setPermission] = useState(permissionState())
  const [alertPrefs, setPrefs] = useState(readPrefs())

  const announced = useRef(readAnnounced())
  const lastCount = useRef(0)
  // The very first poll of a session only seeds the "already seen" set —
  // signing in shouldn't fire ten alerts for yesterday's likes.
  const primed = useRef(false)

  const enableDesktop = useCallback(async () => {
    const result = await requestPermission()
    setPermission(result === 'unsupported' ? 'unsupported' : permissionState())
    return result
  }, [])

  const setAlertPrefs = useCallback((patch) => {
    setPrefs(writePrefs(patch))
  }, [])

  const sendTestAlert = useCallback(
    () => showAlert({
      title: 'Elcoral',
      body: 'Notifications are on — this is what an alert looks like.',
      url: '/home/notifications',
      tag: 'elcoral-test',
      force: true,
    }),
    [],
  )

  // Keep the worker warm whenever permission is already granted, so the
  // first real alert of a session doesn't wait on registration.
  useEffect(() => {
    if (permissionState() === 'granted') registerServiceWorker()
  }, [])

  const announce = useCallback(async () => {
    if (!supportsNotifications() || permissionState() !== 'granted' || !accessToken) return
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
    // Don't interrupt someone who is actively looking at the app.
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus()) return

    for (const n of fresh.slice(0, 3)) {
      await showAlert({
        title: 'Elcoral',
        body: notificationSentence(n),
        icon: n.actor?.photo_url,
        tag: `elcoral-${n.id}`,
        url: n.post_id ? `/home/posts/${n.post_id}` : '/home/notifications',
      })
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

  // Direct messages ring instantly off the live socket — the poll is far
  // too slow for a chat alert.
  useEffect(() => {
    if (!accessToken || !user?.id) return undefined
    return subscribe((event) => {
      if (event?.type !== 'message') return
      const message = event.message
      if (!message || message.sender_id === user.id) return
      const onThisThread =
        typeof window !== 'undefined' &&
        window.location.pathname.includes(String(event.conversation_id))
      if (onThisThread && document.visibilityState === 'visible' && document.hasFocus()) return
      showAlert({
        title: 'New message',
        body: messagePreview(message),
        tag: `elcoral-dm-${event.conversation_id}`,
        url: `/home/messages/${event.conversation_id}`,
      })
    })
  }, [accessToken, subscribe, user?.id])

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
    <Ctx.Provider
      value={{
        unread,
        refresh,
        setUnread,
        desktopPermission: permission,
        enableDesktop,
        alertPrefs,
        setAlertPrefs,
        sendTestAlert,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useNotifications() {
  return useContext(Ctx)
}
