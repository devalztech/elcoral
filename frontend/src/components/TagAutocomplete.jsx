import { useState } from 'react'
import { X, Plus } from 'lucide-react'

// Search-driven tag input with free-text add — the same interaction
// SkillsStep already used for onboarding, pulled out so the profile
// editor can reuse it for Skills and Interests instead of ChipPicker's
// always-visible grid.
export default function TagAutocomplete({ suggestions, selected, onAdd, onRemove, placeholder = 'Search or type your own…' }) {
  const [query, setQuery] = useState('')

  const matches = suggestions
    .filter((s) => !selected.includes(s) && s.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)

  function add(value) {
    const trimmed = value.trim()
    if (!trimmed || selected.includes(trimmed)) return
    onAdd(trimmed)
    setQuery('')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault()
      add(query)
    }
  }

  return (
    <div className="ta">
      <div className="ta-input-wrap">
        <input
          className="ta-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {query.trim() && (
          <button type="button" className="ta-add-btn" onClick={() => add(query)}>
            <Plus size={15} /> Add "{query.trim()}"
          </button>
        )}
      </div>

      {matches.length > 0 && (
        <div className="ta-suggestions">
          {matches.map((s) => (
            <button type="button" key={s} className="ta-suggestion" onClick={() => add(s)}>
              <Plus size={12} /> {s}
            </button>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="ta-selected">
          {selected.map((s) => (
            <span className="ta-tag" key={s}>
              {s}
              <button type="button" onClick={() => onRemove(s)} aria-label={`Remove ${s}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <style>{`
        .ta-input-wrap { position: relative; }
        .ta-input {
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 14.5px;
          color: var(--ink);
          font-family: var(--font-body);
        }
        .ta-input:focus { outline: none; border-color: var(--lemon); }
        .ta-add-btn {
          display: flex; align-items: center; gap: 6px;
          margin-top: 8px; padding: 6px 0; font-size: 13px; color: var(--lemon); font-weight: 500;
        }
        .ta-suggestions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
        .ta-suggestion {
          display: flex; align-items: center; gap: 5px;
          font-size: 12.5px; color: var(--ink-dim);
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 999px; padding: 6px 11px;
        }
        .ta-suggestion:hover { border-color: var(--lemon); color: var(--ink); }
        .ta-selected {
          display: flex; flex-wrap: wrap; gap: 7px;
          margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);
        }
        .ta-tag {
          display: flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 500; color: var(--ink);
          background: rgba(196, 241, 53, 0.12); border: 1px solid var(--lemon);
          border-radius: 999px; padding: 6px 7px 6px 12px;
        }
        .ta-tag button { color: var(--ink-dim); display: flex; }
        .ta-tag button:hover { color: var(--danger); }
      `}</style>
    </div>
  )
}
