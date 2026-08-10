import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { adminApi, tokenStore } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  // On boot, a token in sessionStorage is only a claim. It gets verified
  // against /auth/me before any admin UI renders, so a revoked or demoted
  // account can't keep a working console just by holding an old token.
  useEffect(() => {
    const token = tokenStore.get()
    if (!token) {
      setLoading(false)
      return
    }
    adminApi
      .me(token)
      .then(setAdmin)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await adminApi.login(email, password)
    tokenStore.set(res.access_token)
    setAdmin(res.admin)
    return res.admin
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setAdmin(null)
  }, [])

  const value = useMemo(
    () => ({ admin, loading, login, logout, isSuperadmin: !!admin?.is_superadmin }),
    [admin, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
