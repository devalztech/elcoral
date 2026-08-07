import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { api } from '../../../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(null)
  // Starts true and flips false once the initial session-restore attempt
  // finishes (success or fail) — pages that gate on "am I logged in?"
  // (like ProfileView's "no username yet" check) should wait on this
  // before deciding the person is logged out, otherwise a hard refresh
  // always looks logged-out for a moment because accessToken lives only
  // in memory and resets to null on load.
  const [authLoading, setAuthLoading] = useState(true)

  // On first mount, try to silently restore the session from the
  // httponly refresh-token cookie (still valid server-side even though
  // in-memory state just reset). This is what was missing: without it,
  // every hard refresh started every page in a logged-out state.
  useEffect(() => {
    let cancelled = false
    api
      .refresh()
      .then((data) => {
        if (cancelled) return
        setAccessToken(data.access_token)
        setUser(data.user)
      })
      .catch(() => {
        // No valid session cookie — genuinely logged out, nothing to do.
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const signup = useCallback(async (payload) => {
    const data = await api.signup(payload)
    setUser(data.user)
    setAccessToken(data.access_token)
    return data
  }, [])

  const login = useCallback(async (payload) => {
    const data = await api.login(payload)
    setUser(data.user)
    setAccessToken(data.access_token)
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      setAccessToken(null)
    }
  }, [])

  const refreshUser = useCallback(async (token) => {
    const freshUser = await api.getMe(token)
    setUser(freshUser)
    return freshUser
  }, [])

  return (
    <AuthContext.Provider value={{ user, accessToken, authLoading, signup, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
