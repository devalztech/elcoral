import { createContext, useContext, useState, useCallback } from 'react'
import { api } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(null)

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
    <AuthContext.Provider value={{ user, accessToken, signup, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
