import { useEffect, useRef, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'

// Generic debounced typeahead. `fetchResults(query)` should return a
// promise resolving to an array; `renderOption`/`getLabel` control how
// each result displays and what gets shown once picked. Debounced at
// 300ms so typing doesn't fire a request per keystroke against the
// lookup APIs (see app/routers/lookup.py) — those proxy free third-party
// services with their own soft rate limits.
export default function Typeahead({
  placeholder,
  minChars = 2,
  fetchResults,
  getLabel,
  getKey,
  renderOption,
  onSelect,
  initialValue = '',
}) {
  const [query, setQuery] = useState(initialValue)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function onChange(value) {
    setQuery(value)
    setOpen(true)
    clearTimeout(debounceRef.current)

    if (value.trim().length < minChars) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await fetchResults(value.trim())
        setResults(data || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function pick(item) {
    setQuery(getLabel(item))
    setResults([])
    setOpen(false)
    onSelect(item)
  }

  return (
    <div className="typeahead" ref={wrapRef}>
      <div className="typeahead-input-wrap">
        <Search size={16} className="typeahead-icon" />
        <input
          className="typeahead-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        {loading && <Loader2 size={16} className="typeahead-spinner spin" />}
      </div>

      {open && results.length > 0 && (
        <div className="typeahead-menu">
          {results.map((item) => (
            <button
              type="button"
              key={getKey(item)}
              className="typeahead-option"
              onClick={() => pick(item)}
            >
              {renderOption ? renderOption(item) : getLabel(item)}
            </button>
          ))}
        </div>
      )}

      <style>{`
        .typeahead { position: relative; }
        .typeahead-input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
        }
        .typeahead-input-wrap:focus-within { border-color: var(--lemon); }
        .typeahead-icon { color: var(--ink-faint); flex-shrink: 0; }
        .typeahead-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 15px;
          color: var(--ink);
          font-family: var(--font-body);
        }
        .typeahead-input::placeholder { color: var(--ink-faint); }
        .typeahead-spinner { color: var(--ink-faint); flex-shrink: 0; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .typeahead-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0; right: 0;
          background: var(--panel-raised);
          border: 1px solid var(--border);
          border-radius: 10px;
          max-height: 260px;
          overflow-y: auto;
          z-index: 20;
          box-shadow: 0 12px 32px rgba(0,0,0,0.35);
        }
        .typeahead-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          text-align: left;
          padding: 11px 14px;
          font-size: 14.5px;
          color: var(--ink);
        }
        .typeahead-option:hover { background: var(--panel); }
      `}</style>
    </div>
  )
}
