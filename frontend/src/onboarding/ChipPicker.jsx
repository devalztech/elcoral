import { Check } from 'lucide-react'

export default function ChipPicker({ options, selected, onToggle, columns = 2 }) {
  return (
    <div className="chip-grid" style={{ '--cols': columns }}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.key)
        return (
          <button
            type="button"
            key={opt.key}
            className={`chip ${isSelected ? 'chip-selected' : ''}`}
            onClick={() => onToggle(opt.key)}
          >
            {isSelected && <Check size={14} className="chip-check" />}
            {opt.label}
          </button>
        )
      })}
      <style>{`
        .chip-grid {
          display: grid;
          grid-template-columns: repeat(var(--cols), 1fr);
          gap: 10px;
        }
        .chip {
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: center;
          font-family: var(--font-head);
          font-size: 14px;
          font-weight: 500;
          color: var(--ink-dim);
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 13px 14px;
          text-align: center;
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        .chip:hover { border-color: var(--ink-faint); }
        .chip-selected {
          background: rgba(196, 241, 53, 0.12);
          border-color: var(--lemon);
          color: var(--ink);
        }
        .chip-check { color: var(--lemon); flex-shrink: 0; }
        @media (max-width: 480px) {
          .chip-grid { grid-template-columns: repeat(1, 1fr); }
        }
      `}</style>
    </div>
  )
}
