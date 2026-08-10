/**
 * "See all" for the home page's suggested accounts.
 *
 * Same rows, same hairlines, same follow button as the home screen —
 * just the whole list instead of the first four.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { api } from '../api/client.js'
import { avatarTone, initialsOf } from '../features/social/format.js'
import { followLabel } from '../features/social/followLabel.js'
import Spinner from '../components/Spinner.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'

export default function Discover() {
  const navigate = useNavigate()
  const { accessToken, authLoading } = useAuth()
  const [people, setPeople] = useState(null)
  const [busy, setBusy] = useState({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!accessToken) { setPeople([]); return }
    setError('')
    try {
      const data = await api.followSuggestions(accessToken, 50)
      setPeople(data.items ?? [])
    } catch (err) {
      setError(err.message)
      setPeople([])
    }
  }, [accessToken])

  useEffect(() => {
    if (authLoading) return
    load()
  }, [authLoading, load])

  const follow = async (person) => {
    if (!person.username || busy[person.id]) return
    setBusy((s) => ({ ...s, [person.id]: true }))
    try {
      await api.followUser(person.username, accessToken)
      setPeople((list) => list.filter((p) => p.id !== person.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy((s) => ({ ...s, [person.id]: false }))
    }
  }

  return (
    <div className="dc">
      <header className="dc-bar">
        <button type="button" className="dc-back" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <h1>Suggested accounts</h1>
      </header>

      {error && (
        <div className="dc-state">
          <p>{error}</p>
          <button type="button" className="dc-retry" onClick={load}>
            <RefreshCw size={16} strokeWidth={2} /> Try again
          </button>
        </div>
      )}

      {people === null && <Spinner page label="Loading people" />}
      {people?.length === 0 && !error && (
        <p className="dc-state">
          {accessToken ? 'No suggestions right now — check back soon.' : 'Sign in to see people to follow.'}
        </p>
      )}

      {people?.map((person) => (
        <div key={person.id} className="dc-row">
          <Link to={person.username ? `/u/${person.username}` : '/home'} className="dc-row-main">
            {person.photo_url
              ? <img className="dc-av" src={person.photo_url} alt="" />
              : (
                <span className={`dc-av tone-${avatarTone(person.id || person.full_name)}`} aria-hidden="true">
                  {initialsOf(person.full_name)}
                </span>
              )}
            <span className="dc-text">
              <span className="dc-title">
                {person.full_name}
                {person.is_verified && <VerifiedBadge size={14} className="dc-verified" />}
              </span>
              <span className="dc-sub">
                {person.headline || (person.username ? `@${person.username}` : 'On Elcoral')}
                {person.follows_you && ' · follows you'}
              </span>
            </span>
          </Link>
          <button type="button" className="dc-cta" disabled={!!busy[person.id]} onClick={() => follow(person)}>
            {followLabel(person.is_following, person.follows_you)}
          </button>
        </div>
      ))}

      <style>{`
        .dc { --gut: 16px; margin: -24px -20px 0; padding-bottom: 24px; }
        @media (min-width: 860px) { .dc { margin: -32px -40px 0; } }
        .dc-bar {
          position: sticky; top: 0; z-index: 30;
          display: flex; align-items: center; gap: 10px; padding: 12px var(--gut);
          background: color-mix(in srgb, var(--bg) 88%, transparent);
          backdrop-filter: blur(14px); border-bottom: 1px solid var(--border);
        }
        .dc-bar h1 { margin: 0; font-family: var(--font-head); font-size: 17px; font-weight: 700; color: var(--ink); }
        .dc-back {
          display: grid; place-items: center; width: 36px; height: 36px;
          margin-left: -6px; border-radius: 999px; color: var(--ink); background: none;
        }
        .dc-row {
          display: flex; align-items: center; gap: 12px;
          padding: 11px var(--gut); border-bottom: 1px solid var(--border);
        }
        @media (hover: hover) and (pointer: fine) { .dc-row:hover { background: color-mix(in srgb, var(--ink) 3%, transparent); } }
        .dc-row-main { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
        .dc-av {
          width: 44px; height: 44px; border-radius: 999px; flex: none; overflow: hidden;
          object-fit: cover; display: inline-flex; align-items: center; justify-content: center;
          background: var(--panel-raised); color: var(--ink);
          font-family: var(--font-head); font-weight: 700; font-size: 15px;
        }
        .dc-av.tone-a { background: linear-gradient(145deg,#1d2415,#0f1309); color: var(--accent-ink); }
        .dc-av.tone-b { background: linear-gradient(145deg,#3a2a20,#1a130e); }
        .dc-av.tone-c { background: linear-gradient(145deg,#28303a,#12161b); }
        .dc-text { display: flex; flex-direction: column; min-width: 0; }
        .dc-verified { color: var(--verified, #1D9BF0); flex: none; margin-left: 3px; vertical-align: -2px; }
        .dc-title {
          font-family: var(--font-head); font-size: 15px; line-height: 20px; font-weight: 700; color: var(--ink);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dc-sub {
          font-size: 13.5px; line-height: 18px; color: var(--ink-faint);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .dc-cta {
          flex: none; padding: 8px 16px; border-radius: 999px; border: 0;
          background: var(--lemon); color: var(--on-accent);
          font-family: var(--font-head); font-size: 13.5px; font-weight: 700;
        }
        .dc-cta:disabled { opacity: .5; }
        .dc-state { display: grid; gap: 12px; justify-items: center; padding: 40px 20px; text-align: center; font-size: 14px; color: var(--ink-dim); }
        .dc-retry {
          display: inline-flex; align-items: center; gap: 7px; padding: 10px 16px; border-radius: 999px;
          background: var(--lemon); color: var(--on-accent);
          font-family: var(--font-head); font-weight: 700; font-size: 13.5px;
        }
      `}</style>
    </div>
  )
}
