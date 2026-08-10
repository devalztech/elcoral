/**
 * A text field with "@" mention autocomplete.
 *
 * Typing "@" followed by at least one character opens a menu of matching
 * people; picking one (tap, Enter or Tab) replaces the fragment with
 * "@their_handle ". The menu is anchored above the field so it works
 * both in the docked comment composer and in the full post composer.
 *
 * The component is a drop-in for <input>/<textarea>: it owns nothing but
 * the menu, and reports plain text back through onChange(value).
 */
import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { api } from '../api/client.js'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { avatarTone, formatCount, initialsOf } from '../features/social/format.js'
import VerifiedBadge from './VerifiedBadge.jsx'

// The fragment being typed: an "@" that starts a word, then handle chars,
// anchored to the caret (end of the sliced value).
const FRAGMENT = /(^|\s)@([A-Za-z0-9_.]{1,30})$/

export default function MentionInput({
  value,
  onChange,
  placeholder,
  multiline = false,
  className = '',
  maxLength = 2000,
  rows = 3,
  inputRef,
  ...rest
}) {
  const { accessToken } = useAuth()
  const localRef = useRef(null)
  const ref = inputRef || localRef
  const [term, setTerm] = useState(null)
  const [people, setPeople] = useState([])
  const [active, setActive] = useState(0)
  // The menu carries its own search box (see the "Mention someone" sheet),
  // so the list can be refined without touching the text being written.
  const [query, setQuery] = useState('')
  const [following, setFollowing] = useState({})
  const searchRef = useRef(null)

  // Look up the current fragment, debounced so a fast typist makes one
  // request per pause instead of one per keystroke.
  useEffect(() => {
    if (!term || !accessToken) { setPeople([]); return undefined }
    let cancelled = false
    const t = setTimeout(() => {
      api.searchPeople(query.trim() || term, accessToken, 12)
        .then((data) => { if (!cancelled) { setPeople(data.items ?? []); setActive(0) } })
        .catch(() => { if (!cancelled) setPeople([]) })
    }, 160)
    return () => { cancelled = true; clearTimeout(t) }
  }, [term, query, accessToken])

  const close = () => { setTerm(null); setPeople([]); setQuery('') }

  const toggleFollow = async (person) => {
    if (!accessToken || !person?.username) return
    const isOn = following[person.username] ?? person.is_following ?? false
    setFollowing((f) => ({ ...f, [person.username]: !isOn }))
    try {
      if (isOn) await api.unfollowUser(person.username, accessToken)
      else await api.followUser(person.username, accessToken)
    } catch {
      setFollowing((f) => ({ ...f, [person.username]: isOn }))
    }
  }

  const handleChange = (e) => {
    const next = e.target.value
    onChange(next)
    const caret = e.target.selectionStart ?? next.length
    const match = FRAGMENT.exec(next.slice(0, caret))
    setTerm(match ? match[2] : null)
  }

  const choose = (person) => {
    if (!person?.username) return
    const el = ref.current
    const caret = el?.selectionStart ?? value.length
    const before = value.slice(0, caret)
    const after = value.slice(caret)
    const replaced = before.replace(FRAGMENT, `$1@${person.username} `)
    onChange(replaced + after)
    close()
    requestAnimationFrame(() => {
      el?.focus()
      const pos = replaced.length
      el?.setSelectionRange?.(pos, pos)
    })
  }

  const onKeyDown = (e) => {
    if (!people.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % people.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + people.length) % people.length) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(people[active]) }
    else if (e.key === 'Escape') { close() }
  }

  const Field = multiline ? 'textarea' : 'input'

  return (
    <div className="mi">
      <Field
        ref={ref}
        className={className}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        {...(multiline ? { rows } : { type: 'text' })}
        {...rest}
      />

      {term && (
        <div className="mi-menu" role="dialog" aria-label="Mention someone">
          <div className="mi-head">
            <span className="mi-title">Mention someone</span>
            <button type="button" className="mi-close" onClick={close} aria-label="Close">
              <X size={17} strokeWidth={2.2} />
            </button>
          </div>

          <div className="mi-search">
            <Search size={16} strokeWidth={2} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.stopPropagation(); close(); ref.current?.focus() }
              }}
              placeholder={`Search people`}
              aria-label="Search people to mention"
            />
          </div>

          {people.length === 0 ? (
            <p className="mi-none">No people match “{query.trim() || term}”.</p>
          ) : (
            <ul className="mi-list" role="listbox">
              {people.map((p, i) => {
                const isFollowing = following[p.username] ?? p.is_following ?? false
                return (
                  <li key={p.id}>
                    <div className={`mi-item ${i === active ? 'on' : ''}`}>
                      <button
                        type="button"
                        className="mi-pick"
                        onMouseDown={(e) => { e.preventDefault(); choose(p) }}
                        role="option"
                        aria-selected={i === active}
                      >
                        {p.photo_url
                          ? <img className="mi-av" src={p.photo_url} alt="" />
                          : (
                            <span
                              className="mi-av mi-av-fallback"
                              style={{ background: avatarTone(p.username || p.full_name) }}
                            >
                              {initialsOf(p.full_name)}
                            </span>
                          )}
                        <span className="mi-text">
                          <span className="mi-name-row">
                            <span className="mi-name">{p.full_name}</span>
                            {(p.is_verified || p.is_official) && <VerifiedBadge size={14} />}
                          </span>
                          <span className="mi-sub">
                            <span className="mi-handle">@{p.username}</span>
                            <span className="mi-dot">·</span>
                            {formatCount(p.followers_count ?? 0)} followers
                          </span>
                        </span>
                      </button>
                      {p.username && accessToken && (
                        <button
                          type="button"
                          className={`mi-follow ${isFollowing ? 'on' : ''}`}
                          onMouseDown={(e) => { e.preventDefault(); toggleFollow(p) }}
                        >
                          {isFollowing ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <style>{`
        .mi { position: relative; display: block; width: 100%; }

        /* --- "Mention someone" sheet, anchored above the field --- */
        .mi-menu {
          position: absolute; left: 0; right: 0; bottom: calc(100% + 8px); z-index: 60;
          padding: 14px 6px 6px;
          background: var(--panel-raised, var(--surface, #16181C));
          border: 1px solid var(--border, var(--surface-line));
          border-radius: 18px; box-shadow: var(--shadow-drop, 0 18px 40px rgba(0,0,0,0.45));
        }
        .mi-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 12px 12px;
        }
        .mi-title { font-size: 15.5px; font-weight: 700; color: var(--ink); letter-spacing: -0.01em; }
        .mi-close {
          width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center;
          color: var(--ink-dim); background: none;
        }
        @media (hover: hover) { .mi-close:hover { background: var(--surface-2); color: var(--ink); } }

        .mi-search {
          display: flex; align-items: center; gap: 9px; margin: 0 8px 8px;
          padding: 10px 13px; border-radius: 12px;
          background: var(--surface-2, rgba(255,255,255,0.05));
          color: var(--ink-faint);
        }
        .mi-search input {
          flex: 1; min-width: 0; border: 0; background: none; outline: none;
          font-size: 14.5px; color: var(--ink);
        }
        .mi-search input::placeholder { color: var(--ink-faint); }

        .mi-none { padding: 18px 14px 22px; font-size: 13.5px; color: var(--ink-faint); }

        .mi-list { list-style: none; margin: 0; padding: 0 2px 4px; max-height: 300px; overflow-y: auto; }
        .mi-item {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 8px; border-radius: 12px;
        }
        .mi-item.on { background: color-mix(in srgb, var(--lemon) 8%, transparent); }
        .mi-pick {
          flex: 1; min-width: 0; display: flex; align-items: center; gap: 11px;
          padding: 4px; text-align: left; color: var(--ink); background: none;
        }
        .mi-av {
          width: 40px; height: 40px; border-radius: 999px; object-fit: cover; flex: none;
          display: grid; place-items: center; font-size: 14px; font-weight: 800;
          background: var(--surface-2); color: var(--ink);
        }
        .mi-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .mi-name-row { display: flex; align-items: center; gap: 5px; min-width: 0; }
        .mi-name {
          font-size: 14.5px; font-weight: 700; letter-spacing: -0.01em;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .mi-sub {
          display: flex; align-items: center; gap: 5px;
          font-size: 12.5px; color: var(--ink-faint); white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .mi-dot { opacity: 0.7; }

        .mi-follow {
          flex: none; padding: 8px 16px; border-radius: 999px;
          font-size: 13px; font-weight: 700;
          background: var(--lemon); color: var(--on-accent);
          border: 1px solid transparent; transition: opacity 0.15s ease;
        }
        .mi-follow.on {
          background: transparent; color: var(--ink-dim);
          border-color: var(--surface-line);
        }
        @media (hover: hover) { .mi-follow:hover { opacity: 0.88; } }
      `}</style>
    </div>
  )
}
