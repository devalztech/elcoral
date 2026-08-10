import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { api } from '../lib/api.js'

// A real dropdown (not a typeahead) — fetches the full country list once
// and renders it as a scrollable, tappable list, closer to a native
// <select> than the search-driven Typeahead used for city/company. A
// plain <select> was ruled out because it can't show flags or a filter
// box, but this keeps the "pick from a visible list" feel that a raw
// search box doesn't (see feedback: "location is a search bar instead of
// dropdown menu").
export default function CountrySelect({ value, onSelect }) {
  const [open, setOpen] = useState(false)
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const wrapRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggleOpen() {
    setOpen((o) => !o)
    if (!countries.length && !loading) {
      setLoading(true)
      api
        .listAllCountries()
        .then(setCountries)
        .finally(() => setLoading(false))
    }
  }

  const filtered = filter
    ? countries.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
    : countries

  return (
    <div className="country-select" ref={wrapRef}>
      <button type="button" className="country-trigger" onClick={toggleOpen}>
        {value ? (
          <span className="country-trigger-value">
            {value.flag && <img src={value.flag} alt="" className="flag-icon" />}
            {value.name}
          </span>
        ) : (
          <span className="country-placeholder">Select your country</span>
        )}
        <ChevronDown size={16} className={`chevron ${open ? 'chevron-open' : ''}`} />
      </button>

      {open && (
        <div className="country-menu">
          <div className="country-filter">
            <Search size={14} />
            <input
              autoFocus
              placeholder="Filter countries\u2026"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="country-list">
            {loading && <div className="country-loading">Loading\u2026</div>}
            {!loading &&
              filtered.map((c) => (
                <button
                  type="button"
                  key={c.code}
                  className="country-option"
                  onClick={() => {
                    onSelect(c)
                    setOpen(false)
                    setFilter('')
                  }}
                >
                  {c.flag && <img src={c.flag} alt="" className="flag-icon" />}
                  {c.name}
                </button>
              ))}
            {!loading && filtered.length === 0 && <div className="country-empty">No matches</div>}
          </div>
        </div>
      )}

      <style>{`
        .country-select { position: relative; }
        .country-trigger {
          width: 100%;
          display: flex; align-items: center; justify-content: space-between;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 15px;
          color: var(--ink);
        }
        .country-trigger:hover { border-color: var(--ink-faint); }
        .country-trigger-value { display: flex; align-items: center; gap: 10px; }
        .country-placeholder { color: var(--ink-faint); }
        .chevron { color: var(--ink-faint); transition: transform 0.15s ease; flex-shrink: 0; }
        .chevron-open { transform: rotate(180deg); }
        .flag-icon { width: 20px; height: 14px; object-fit: cover; border-radius: 2px; flex-shrink: 0; }
        .country-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0; right: 0;
          background: var(--panel-raised);
          border: 1px solid var(--border);
          border-radius: 10px;
          z-index: 20;
          box-shadow: 0 12px 32px rgba(0,0,0,0.35);
          overflow: hidden;
        }
        .country-filter {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          color: var(--ink-faint);
        }
        .country-filter input {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 14px; color: var(--ink); font-family: var(--font-body);
        }
        .country-list { max-height: 260px; overflow-y: auto; }
        .country-option {
          display: flex; align-items: center; gap: 10px;
          width: 100%; text-align: left;
          padding: 11px 14px;
          font-size: 14.5px;
          color: var(--ink);
        }
        .country-option:hover { background: var(--panel); }
        .country-loading, .country-empty {
          padding: 16px 14px; font-size: 13.5px; color: var(--ink-faint); text-align: center;
        }
      `}</style>
    </div>
  )
}
