/**
 * The notification bell's shared brain.
 *
 * One provider for the whole session so every bell (home, jobs,
 * communities, profile) shows the SAME unread number, and reading the
 * list on /home/notifications clears all of them at once. Counts refresh
 * on mount, on a slow poll, and whenever the tab regains focus.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { useAuth } from '../auth/hooks/useAuth.jsx'

const POLL_MS = 45_000

const Ctx = createContext({ unread: 0, refresh: () => {}, setUnread: () => {} })

export function NotificationsProvider({ children }) {
  const { accessToken, authLoading } = useAuth()
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(async () => {
    if (!accessToken) { setUnread(0); return }
    try {
      const data = await api.unreadNotificationCount(accessToken)
      setUnread(data.unread_count ?? 0)
    } catch {
      /* a bell badge is never worth surfacing an error for */
    }
  }, [accessToken])

  useEffect(() => {
    if (authLoading) return
    refresh()
    const id = setInterval(refresh, POLL_MS)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [authLoading, refresh])

  return <Ctx.Provider value={{ unread, refresh, setUnread }}>{children}</Ctx.Provider>
}

export function useNotifications() {
  return useContext(Ctx)
}
