import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { useAuth } from '../auth/hooks/useAuth.jsx'

/**
 * Live follow state for one profile.
 *
 * Owns the counts as well as the boolean, because the follower count on
 * a profile has to move the moment the button is pressed — reading the
 * count from the profile payload instead would leave it stale until a
 * reload and make the button look broken.
 *
 * The toggle is optimistic and reverts on failure; the server's own
 * counts always win once the response lands.
 */
export function useFollow(username) {
  const { accessToken, authLoading } = useAuth()
  const [state, setState] = useState({
    is_following: false,
    follows_you: false,
    followers_count: 0,
    following_count: 0,
  })
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!username || authLoading) return
    setLoading(true)
    try {
      setState(await api.followState(username, accessToken ?? undefined))
      setError('')
    } catch (err) {
      setError(err.message || 'Could not load follow state.')
    } finally {
      setLoading(false)
    }
  }, [username, accessToken, authLoading])

  useEffect(() => { load() }, [load])

  const toggle = useCallback(async () => {
    if (!accessToken || pending || !username) return null
    const previous = state
    const next = !state.is_following
    setPending(true)
    setError('')
    setState((s) => ({
      ...s,
      is_following: next,
      followers_count: Math.max(0, s.followers_count + (next ? 1 : -1)),
    }))
    try {
      const fresh = next
        ? await api.followUser(username, accessToken)
        : await api.unfollowUser(username, accessToken)
      setState(fresh)
      return fresh
    } catch (err) {
      setState(previous)
      setError(err.message || 'Could not update follow.')
      return null
    } finally {
      setPending(false)
    }
  }, [accessToken, pending, state, username])

  return { ...state, loading, pending, error, toggle, reload: load, canFollow: !!accessToken }
}
