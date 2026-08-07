import { Check } from 'lucide-react'

export default function ChipPicker({ options, selected, onToggle, columns = 2 }) {
  return (
    <div className="chip-grid" style={{ '--cols': columns }}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.key)
        const Icon = opt.icon
        return (
          <button
            type="button"
            key={opt.key}
            className={`chip ${isSelected ? 'chip-selected' : ''}`}
            onClick={() => onToggle(opt.key)}
          >
            {Icon && <Icon size={16} className="chip-icon" />}
            <span className="chip-label">{opt.label}</span>
            {isSelected && <Check size={14} className="chip-check" />}
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
          gap: 10px;
          justify-content: flex-start;
          font-family: var(--font-head);
          font-size: 14px;
          font-weight: 500;
          color: var(--ink-dim);
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 13px 14px;
          text-align: left;
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        .chip-icon { flex-shrink: 0; color: var(--ink-faint); }
        .chip-label { flex: 1; }
        .chip:hover { border-color: var(--ink-faint); }
        .chip-selected {
          background: rgba(196, 241, 53, 0.12);
          border-color: var(--lemon);
          color: var(--ink);
        }
        .chip-selected .chip-icon { color: var(--lemon); }
        .chip-check { color: var(--lemon); flex-shrink: 0; }
        @media (max-width: 480px) {
          .chip-grid { grid-template-columns: repeat(1, 1fr); }
        }
      `}</style>
    </div>
  )
}
