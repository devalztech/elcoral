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
import { api } from '../api/client.js'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { avatarTone, initialsOf } from '../features/social/format.js'
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

  // Look up the current fragment, debounced so a fast typist makes one
  // request per pause instead of one per keystroke.
  useEffect(() => {
    if (!term || !accessToken) { setPeople([]); return undefined }
    let cancelled = false
    const t = setTimeout(() => {
      api.searchPeople(term, accessToken, 8)
        .then((data) => { if (!cancelled) { setPeople(data.items ?? []); setActive(0) } })
        .catch(() => { if (!cancelled) setPeople([]) })
    }, 160)
    return () => { cancelled = true; clearTimeout(t) }
  }, [term, accessToken])

  const close = () => { setTerm(null); setPeople([]) }

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

      {term && people.length > 0 && (
        <ul className="mi-menu" role="listbox" aria-label="Mention someone">
          {people.map((p, i) => (
            <li key={p.id}>
              <div
                className={`mi-row ${i === active ? 'mi-row-on' : ''}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(p) }}
              >
                {p.photo_url
                  ? <img className="mi-av" src={p.photo_url} alt="" />
                  : (
                    <span
                      className="mi-av"
                      style={{ background: avatarTone(p.username || p.full_name) }}
                      aria-hidden="true"
                    >
                      {initialsOf(p.full_name)}
                    </span>
                  )}
                <span className="mi-text">
                  <span className="mi-name">
                    {p.full_name}
                    {(p.is_verified || p.is_official) && <VerifiedBadge size={14} className="mi-verified" />}
                  </span>
                  <span className="mi-sub">@{p.username}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .mi { position: relative; display: block; width: 100%; }

        /* Anchored above the field; same row rhythm as the followers list. */
        .mi-menu {
          position: absolute; left: 0; right: 0; bottom: calc(100% + 8px); z-index: 60;
          list-style: none; margin: 0; padding: 6px;
          max-height: 264px; overflow-y: auto;
          background: var(--panel-raised, var(--surface));
          border: 1px solid var(--border);
          border-radius: 14px; box-shadow: var(--shadow-drop);
        }
        .mi-row {
          display: flex; align-items: center; gap: 12px; padding: 8px 8px;
          border-radius: 12px; color: inherit; cursor: pointer;
        }
        .mi-row-on, .mi-row:active { background: color-mix(in srgb, var(--ink) 5%, transparent); }
        .mi-av {
          width: 40px; height: 40px; border-radius: 999px; object-fit: cover; flex: none;
          display: grid; place-items: center; font-family: var(--font-head); font-size: 14px;
          background: color-mix(in srgb, var(--ink) 10%, transparent); color: var(--ink);
        }
        .mi-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .mi-verified { color: var(--verified, #1D9BF0); flex: none; margin-left: 3px; vertical-align: -2px; }
        .mi-name {
          font-family: var(--font-head); font-size: 14.5px; font-weight: 600; color: var(--ink);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .mi-sub { font-size: 12.5px; color: var(--ink-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </div>
  )
}
