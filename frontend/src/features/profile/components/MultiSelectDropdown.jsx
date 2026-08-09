import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'

// A closed-by-default multi-select: shows a compact summary in the
// trigger ("3 selected" or the actual labels if they fit), and opens a
// checklist menu on tap — same interaction family as CountrySelect and
// Typeahead, just for multi-pick instead of single-pick. This replaces
// ChipPicker for the profile editor, where a dozen always-visible option
// buttons per field made the page feel like a wall of tags rather than a
// considered form. ChipPicker itself is untouched and still used during
// onboarding, where one full-screen decision per step is the right shape.
export default function MultiSelectDropdown({ options, selected, onToggle, placeholder = 'Select…', searchable = false }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const wrapRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const selectedOptions = options.filter((o) => selected.includes(o.key))
  const filtered = filter
    ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
    : options

  let summary = placeholder
  if (selectedOptions.length === 1) summary = selectedOptions[0].label
  else if (selectedOptions.length > 1) summary = `${selectedOptions.length} selected`

  return (
    <div className="msd" ref={wrapRef}>
      <button type="button" className="msd-trigger" onClick={() => setOpen((o) => !o)}>
        <span className={selectedOptions.length ? 'msd-value' : 'msd-placeholder'}>{summary}</span>
        <ChevronDown size={16} className={`msd-chevron ${open ? 'msd-chevron-open' : ''}`} />
      </button>

      {selectedOptions.length > 0 && (
        <div className="msd-tags">
          {selectedOptions.map((o) => (
            <span key={o.key} className="msd-tag">
              {o.label}
              <button type="button" aria-label={`Remove ${o.label}`} onClick={() => onToggle(o.key)}>×</button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="msd-menu">
          {searchable && (
            <div className="msd-search">
              <Search size={14} />
              <input autoFocus placeholder="Search…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
          )}
          <div className="msd-list">
            {filtered.map((opt) => {
              const isSelected = selected.includes(opt.key)
              const Icon = opt.icon
              return (
                <button
                  type="button"
                  key={opt.key}
                  className={`msd-option ${isSelected ? 'msd-option-selected' : ''}`}
                  onClick={() => onToggle(opt.key)}
                >
                  <span className={`msd-checkbox ${isSelected ? 'msd-checkbox-checked' : ''}`}>
                    {isSelected && <Check size={12} />}
                  </span>
                  {Icon && <Icon size={15} className="msd-option-icon" />}
                  <span>{opt.label}</span>
                </button>
              )
            })}
            {filtered.length === 0 && <div className="msd-empty">No matches</div>}
          </div>
        </div>
      )}

      <style>{`
        .msd { position: relative; }
        .msd-trigger {
          width: 100%;
          display: flex; align-items: center; justify-content: space-between;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 14.5px;
        }
        @media (hover: hover) and (pointer: fine) { .msd-trigger:hover { border-color: var(--ink-faint); } }
        .msd-value { color: var(--ink); }
        .msd-placeholder { color: var(--ink-faint); }
        .msd-chevron { color: var(--ink-faint); transition: transform 0.15s ease; flex-shrink: 0; }
        .msd-chevron-open { transform: rotate(180deg); }

        .msd-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .msd-tag {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12.5px; color: var(--ink);
          background: rgba(196,241,53,0.1); border: 1px solid var(--lemon);
          border-radius: 999px; padding: 5px 6px 5px 12px;
        }
        .msd-tag button {
          color: var(--ink-faint); font-size: 14px; line-height: 1;
          padding: 2px 4px; border-radius: 50%;
        }
        @media (hover: hover) and (pointer: fine) { .msd-tag button:hover { color: var(--danger); } }

        .msd-menu {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 20;
          background: var(--panel-raised);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.35);
          overflow: hidden;
        }
        .msd-search {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 14px; border-bottom: 1px solid var(--border);
          color: var(--ink-faint);
        }
        .msd-search input {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 14px; color: var(--ink); font-family: var(--font-body);
        }
        .msd-list { max-height: 280px; overflow-y: auto; padding: 6px; }
        .msd-option {
          display: flex; align-items: center; gap: 10px;
          width: 100%; text-align: left;
          padding: 10px 10px;
          font-size: 14px; color: var(--ink-dim);
          border-radius: 8px;
        }
        @media (hover: hover) and (pointer: fine) { .msd-option:hover { background: var(--panel); } }
        .msd-option-selected { color: var(--ink); }
        .msd-option-icon { color: var(--ink-faint); flex-shrink: 0; }
        .msd-option-selected .msd-option-icon { color: var(--accent-ink); }
        .msd-checkbox {
          width: 16px; height: 16px; flex-shrink: 0;
          border: 1.5px solid var(--border); border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
          color: var(--on-accent);
        }
        .msd-checkbox-checked { background: var(--lemon); border-color: var(--accent-ink); }
        .msd-empty { padding: 16px 14px; font-size: 13.5px; color: var(--ink-faint); text-align: center; }
      `}</style>
    </div>
  )
}
