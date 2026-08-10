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
import { initialsOf } from '../features/social/format.js'

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
      api.searchPeople(term, accessToken)
        .then((data) => { if (!cancelled) { setPeople(data.items ?? []); setActive(0) } })
        .catch(() => { if (!cancelled) setPeople([]) })
    }, 160)
    return () => { cancelled = true; clearTimeout(t) }
  }, [term, accessToken])

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
    setTerm(null)
    setPeople([])
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
    else if (e.key === 'Escape') { setTerm(null); setPeople([]) }
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

      {people.length > 0 && (
        <ul className="mi-menu" role="listbox">
          {people.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className={`mi-item ${i === active ? 'on' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); choose(p) }}
                role="option"
                aria-selected={i === active}
              >
                {p.photo_url
                  ? <img className="mi-av" src={p.photo_url} alt="" />
                  : <span className="mi-av mi-av-fallback">{initialsOf(p.full_name)}</span>}
                <span className="mi-text">
                  <span className="mi-name">{p.full_name}</span>
                  <span className="mi-handle">@{p.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .mi { position: relative; display: block; width: 100%; }
        .mi-menu {
          position: absolute; left: 0; right: 0; bottom: calc(100% + 6px); z-index: 60;
          list-style: none; margin: 0; padding: 6px; max-height: 244px; overflow-y: auto;
          background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 12px; box-shadow: var(--shadow-drop);
        }
        .mi-item {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 8px; border-radius: 9px; text-align: left; color: var(--ink);
        }
        .mi-item.on { background: var(--panel); }
        .mi-av {
          width: 30px; height: 30px; border-radius: 999px; object-fit: cover; flex: none;
          display: grid; place-items: center; font-size: 12px; font-weight: 700;
          background: var(--panel); color: var(--ink);
        }
         /* Name and handle sit on ONE line — never stacked under the avatar. */
        .mi-text { display: flex; flex-direction: row; align-items: baseline; gap: 6px; min-width: 0; }
        .mi-name { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 0 1 auto; }
        .mi-handle { font-size: 12px; color: var(--ink-faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 0 1 auto; }
      `}</style>
    </div>
  )
}
