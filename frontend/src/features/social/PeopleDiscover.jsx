/**
 * "People" — the discovery surface behind the home tab of the same name.
 *
 * It is deliberately built from the SAME row the Followers/Following
 * screen and the notifications list use: 44px round avatar, name +
 * secondary line, a pill action on the right, a hairline underneath and
 * no card. Search sits at the top; with an empty query the list is the
 * server's follow suggestions (people you don't follow yet).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, X } from 'lucide-react'
import { api } from '../../api/client.js'
import { useAuth } from '../auth/hooks/useAuth.jsx'
import { avatarTone, displayName, initialsOf } from './format.js'
import { followLabel } from './followLabel.js'
import Spinner from '../../components/Spinner.jsx'
import VerifiedBadge from '../../components/VerifiedBadge.jsx'

function FollowPill({ person }) {
  const { accessToken } = useAuth()
  const [state, setState] = useState({
    is_following: !!person.is_following,
    follows_you: !!person.follows_you,
  })
  const [pending, setPending] = useState(false)

  if (!accessToken || person.is_self || !person.username) return null

  const toggle = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (pending) return
    const next = !state.is_following
    setPending(true)
    setState((s) => ({ ...s, is_following: next }))
    try {
      const fresh = next
        ? await api.followUser(person.username, accessToken)
        : await api.unfollowUser(person.username, accessToken)
      setState({ is_following: fresh.is_following, follows_you: fresh.follows_you })
    } catch {
      setState((s) => ({ ...s, is_following: !next }))
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      className={`pd-pill ${state.is_following ? 'pd-pill-on' : ''}`}
      onClick={toggle}
      disabled={pending}
      aria-pressed={state.is_following}
    >
      {followLabel(state.is_following, state.follows_you)}
    </button>
  )
}

function PersonRow({ person }) {
  return (
    <Link to={person.username ? `/u/${person.username}` : '#'} className="pd-row">
      {person.photo_url ? (
        <img className="pd-av" src={person.photo_url} alt="" />
      ) : (
        <span className={`pd-av tone-${avatarTone(person.id)}`} aria-hidden="true">
          {initialsOf(displayName(person))}
        </span>
      )}
      <span className="pd-text">
        <span className="pd-name">
          {displayName(person)}
          {person.is_verified && <VerifiedBadge size={14} className="pd-verified" />}
        </span>
        <span className="pd-sub">
          {person.headline || (person.username ? `@${person.username}` : '')}
        </span>
        {person.follows_you && !person.is_following && (
          <span className="pd-tag">Follows you</span>
        )}
      </span>
      <FollowPill person={person} />
    </Link>
  )
}

export default function PeopleDiscover() {
  const { accessToken, authLoading } = useAuth()
  const [query, setQuery] = useState('')
  const [suggested, setSuggested] = useState(null)
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const term = query.trim()

  const loadSuggestions = useCallback(() => {
    if (authLoading || !accessToken) return
    setError('')
    setSuggested(null)
    api.followSuggestions(accessToken, 20)
      .then((data) => setSuggested(Array.isArray(data) ? data : (data?.items ?? [])))
      .catch((err) => { setError(err.message || 'Could not load suggestions.'); setSuggested([]) })
  }, [accessToken, authLoading])

  useEffect(() => { loadSuggestions() }, [loadSuggestions])

  // Debounced people search — the same endpoint the search screen uses.
  useEffect(() => {
    if (!term) { setResults(null); setSearching(false); return undefined }
    let cancelled = false
    setSearching(true)
    const id = setTimeout(() => {
      api.searchPeople(term, accessToken ?? undefined, 20)
        .then((data) => {
          if (cancelled) return
          setResults(Array.isArray(data) ? data : (data?.items ?? []))
        })
        .catch(() => { if (!cancelled) setResults([]) })
        .finally(() => { if (!cancelled) setSearching(false) })
    }, 260)
    return () => { cancelled = true; clearTimeout(id) }
  }, [term, accessToken])

  const list = term ? results : suggested
  const heading = term ? 'Results' : 'Suggested for you'
  const empty = useMemo(() => Array.isArray(list) && list.length === 0, [list])

  return (
    <div className="pd">
      <div className="pd-search">
        <Search size={18} strokeWidth={2} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people"
          aria-label="Search people"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus() }} aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </div>

      <p className="pd-heading">{heading}</p>

      {error && <p className="pd-error">{error}</p>}

      {(list === null || (term && searching && list === null)) && (
        <Spinner page label="Loading people" />
      )}

      {empty && (
        <div className="pd-empty">
          <UserPlus size={26} strokeWidth={1.6} aria-hidden="true" />
          <p>{term ? `No one matches “${term}”.` : 'No suggestions right now — check back soon.'}</p>
        </div>
      )}

      {Array.isArray(list) && list.length > 0 && (
        <ul className="pd-list">
          {list.map((person) => (
            <li key={person.id ?? person.username}><PersonRow person={person} /></li>
          ))}
        </ul>
      )}

      <style>{`
        .pd { display: block; }
        .pd-search {
          display: flex; align-items: center; gap: 10px;
          margin: 12px var(--gut, 16px) 4px; padding: 10px 14px;
          border-radius: 999px; color: var(--ink-faint);
          background: color-mix(in srgb, var(--ink) 6%, transparent);
        }
        .pd-search input {
          flex: 1; min-width: 0; border: 0; background: none; outline: none;
          font-size: 15px; color: var(--ink);
        }
        .pd-search input::placeholder { color: var(--ink-faint); }
        .pd-search button { display: grid; place-items: center; color: var(--ink-faint); }

        .pd-heading {
          margin: 0; padding: 14px var(--gut, 16px) 8px;
          font-family: var(--font-head); font-size: 12.5px; font-weight: 600;
          letter-spacing: .06em; text-transform: uppercase; color: var(--ink-faint);
        }
        .pd-error { margin: 0; padding: 0 var(--gut, 16px) 8px; font-size: 13px; color: var(--danger, crimson); }

        .pd-list { list-style: none; margin: 0; padding: 0; }
        /* Same row metrics as Followers/Following and notifications. */
        .pd-row {
          display: flex; align-items: center; gap: 12px;
          padding: 11px var(--gut, 16px); color: inherit;
          border-bottom: 1px solid var(--border);
        }
        @media (hover: hover) and (pointer: fine) {
          .pd-row:hover { background: color-mix(in srgb, var(--ink) 3%, transparent); }
        }
        .pd-av {
          width: 44px; height: 44px; border-radius: 999px; object-fit: cover; flex: none;
          display: grid; place-items: center; font-family: var(--font-head); font-size: 15px;
          background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink);
        }
        .pd-av.tone-a { background: color-mix(in srgb, var(--lemon) 45%, transparent); }
        .pd-av.tone-b { background: color-mix(in srgb, var(--accent-ink) 18%, transparent); }
        .pd-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .pd-name {
          display: flex; align-items: center; gap: 4px;
          font-family: var(--font-head); font-size: 14.5px; font-weight: 600; color: var(--ink);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pd-verified { color: var(--verified, #1D9BF0); flex: none; }
        .pd-sub {
          font-size: 12.5px; color: var(--ink-dim);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pd-tag { margin-top: 4px; font-size: 11px; color: var(--ink-faint); }
        .pd-pill {
          flex: none; padding: 8px 16px; border-radius: 999px; border: 0;
          font-family: var(--font-head); font-size: 12.5px; font-weight: 700;
          background: var(--lemon); color: var(--on-accent);
        }
        .pd-pill-on { background: transparent; color: var(--ink-dim); border: 1px solid var(--border); }
        .pd-pill:disabled { opacity: .55; }

        .pd-empty {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          padding: 44px 20px; color: var(--ink-faint); text-align: center;
        }
        .pd-empty p { margin: 0; font-size: 14px; }
      `}</style>
    </div>
  )
}
