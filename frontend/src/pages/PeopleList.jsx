/**
 * Followers / Following, TikTok-style: one screen with two tabs and the
 * person's handle in the header, so switching lists doesn't feel like
 * navigating away.
 *
 * The route decides which tab opens (/u/:username/followers or
 * /u/:username/following); switching tabs swaps the URL too, so the back
 * button and a shared link both behave.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Users } from 'lucide-react'
import { api } from '../api/client.js'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { avatarTone, displayName, formatCount, initialsOf } from '../features/social/format.js'
import { followLabel } from '../features/social/followLabel.js'
import Spinner from '../components/Spinner.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'

function FollowButton({ person, onChanged }) {
  const { accessToken } = useAuth()
  const [state, setState] = useState({ is_following: person.is_following, follows_you: person.follows_you })
  const [pending, setPending] = useState(false)

  if (!accessToken || person.is_self || !person.username) return null

  const toggle = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (pending) return
    const next = !state.is_following
    setPending(true)
    // Optimistic: the row must respond on the tap, not after the round trip.
    setState((s) => ({ ...s, is_following: next }))
    try {
      const fresh = next
        ? await api.followUser(person.username, accessToken)
        : await api.unfollowUser(person.username, accessToken)
      setState({ is_following: fresh.is_following, follows_you: fresh.follows_you })
      onChanged?.(person, fresh)
    } catch {
      setState((s) => ({ ...s, is_following: !next }))
    } finally {
      setPending(false)
    }
  }

  const label = followLabel(state.is_following, state.follows_you)
  return (
    <button
      type="button"
      className={`pl-follow ${state.is_following ? 'pl-following' : ''} ${state.is_following && state.follows_you ? 'pl-friends' : ''}`}
      onClick={toggle}
      disabled={pending}
      aria-pressed={state.is_following}
    >
      {label}
    </button>
  )
}

export default function PeopleList() {
  const { username } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { accessToken, authLoading } = useAuth()

  const tab = location.pathname.endsWith('/following') ? 'following' : 'followers'

  const [items, setItems] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [counts, setCounts] = useState({ followers_count: 0, following_count: 0 })

  const fetcher = tab === 'following' ? api.listFollowing : api.listFollowers

  const load = useCallback(async () => {
    setItems(null)
    setError('')
    try {
      const data = await fetcher(username, accessToken ?? undefined)
      setItems(data.items ?? [])
      setCursor(data.next_cursor ?? null)
    } catch (err) {
      setError(err.status === 404 ? 'That profile doesn’t exist.' : (err.message || 'Could not load this list.'))
      setItems([])
    }
  }, [fetcher, username, accessToken])

  useEffect(() => {
    if (authLoading) return
    load()
  }, [authLoading, load])

  // Counts drive the tab labels; they come from the follow-state endpoint
  // so they match the numbers on the profile page exactly.
  useEffect(() => {
    if (authLoading || !username) return
    let cancelled = false
    api.followState(username, accessToken ?? undefined)
      .then((data) => { if (!cancelled) setCounts(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [authLoading, username, accessToken])

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await fetcher(username, accessToken ?? undefined, cursor)
      setItems((list) => [...(list ?? []), ...(data.items ?? [])])
      setCursor(data.next_cursor ?? null)
    } catch (err) {
      setError(err.message || 'Could not load more.')
    } finally {
      setLoadingMore(false)
    }
  }

  const tabs = useMemo(() => ([
    { id: 'followers', label: 'Followers', count: counts.followers_count, to: `/u/${username}/followers` },
    { id: 'following', label: 'Following', count: counts.following_count, to: `/u/${username}/following` },
  ]), [counts, username])

  return (
    <div className="pl">
      <header className="pl-head">
        <button type="button" className="pl-back" onClick={() => navigate(-1)} aria-label="Go back">
          <ChevronLeft size={22} />
        </button>
        <h1>@{username}</h1>
      </header>

      <div className="pl-tabs" role="tablist">
        {tabs.map((t) => (
          <Link
            key={t.id}
            to={t.to}
            replace
            role="tab"
            aria-selected={tab === t.id}
            className={`pl-tab ${tab === t.id ? 'pl-tab-on' : ''}`}
          >
            <b>{formatCount(t.count)}</b> {t.label}
          </Link>
        ))}
      </div>

      {error && <p className="pl-error">{error}</p>}

      {items === null && (
        <Spinner page label="Loading people" />
      )}

      {items !== null && items.length === 0 && !error && (
        <div className="pl-empty">
          <Users size={28} strokeWidth={1.6} aria-hidden="true" />
          <p>{tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</p>
        </div>
      )}

      {items !== null && items.length > 0 && (
        <ul className="pl-list">
          {items.map((person) => (
            <li key={person.id}>
              <Link to={person.username ? `/u/${person.username}` : '#'} className="pl-row">
                {person.photo_url ? (
                  <img className="pl-av" src={person.photo_url} alt="" />
                ) : (
                  <span className={`pl-av tone-${avatarTone(person.id)}`} aria-hidden="true">
                    {initialsOf(displayName(person))}
                  </span>
                )}
                <span className="pl-text">
                  <span className="pl-name">
                    {displayName(person)}
                    {person.is_verified && <VerifiedBadge size={14} className="pl-verified" />}
                  </span>
                  {(person.username || person.headline) && (
                    <span className="pl-sub">{person.headline || `@${person.username}`}</span>
                  )}
                </span>
                <FollowButton person={person} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <button type="button" className="pl-more" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? <Spinner size={17} label="Loading more" /> : 'Load more'}
        </button>
      )}

      <style>{`
        .pl-head { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
        .pl-head h1 { font-family: var(--font-head); font-size: 18px; margin: 0; color: var(--ink); }
        .pl-back { display: grid; place-items: center; width: 34px; height: 34px; margin-left: -8px; color: var(--ink-dim); }
        .pl-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 8px; }
        .pl-tab {
          flex: 1; text-align: center; padding: 10px 4px; font-size: 13.5px;
          color: var(--ink-faint); border-bottom: 2px solid transparent;
        }
        .pl-tab b { font-family: var(--font-head); color: var(--ink); }
        .pl-tab-on {
          color: var(--accent-ink); font-weight: 700;
          border-bottom-color: var(--lemon);
          background: color-mix(in srgb, var(--lemon) 12%, transparent);
          border-radius: 10px 10px 0 0;
        }
        .pl-tab-on b { color: var(--accent-ink); }
        .pl-error { font-size: 13px; color: crimson; }
        .pl-list { list-style: none; margin: 0; padding: 0; }
        .pl-skeleton { height: 58px; border-radius: 14px; margin-bottom: 8px; background: color-mix(in srgb, var(--ink) 6%, transparent); }
        .pl-row { display: flex; align-items: center; gap: 12px; padding: 9px 6px; border-radius: 14px; color: inherit; }
        .pl-row:active { background: color-mix(in srgb, var(--ink) 5%, transparent); }
        .pl-av {
          width: 44px; height: 44px; border-radius: 999px; object-fit: cover; flex: none;
          display: grid; place-items: center; font-family: var(--font-head); font-size: 15px;
          background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink);
        }
        .pl-av.tone-a { background: color-mix(in srgb, var(--lemon) 45%, transparent); }
        .pl-av.tone-b { background: color-mix(in srgb, var(--accent-ink) 18%, transparent); }
        .pl-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .pl-verified { color: var(--verified, #1D9BF0); flex: none; margin-left: 3px; vertical-align: -2px; }
        .pl-name { font-family: var(--font-head); font-size: 14.5px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pl-sub { font-size: 12.5px; color: var(--ink-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pl-follow {
          flex: none; padding: 7px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 700;
          font-family: var(--font-head); background: var(--lemon); color: var(--on-accent);
        }
        .pl-following { background: transparent; color: var(--ink-dim); border: 1px solid var(--border); }
        .pl-more { display: block; margin: 12px auto; font-size: 13px; color: var(--accent-ink); padding: 8px 16px; }
        .pl-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 44px 20px; color: var(--ink-faint); }
        .pl-empty p { margin: 0; font-size: 14px; }
      `}</style>
    </div>
  )
}
