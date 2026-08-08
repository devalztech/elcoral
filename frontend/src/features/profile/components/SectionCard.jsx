import { Pencil, ChevronRight } from 'lucide-react'

// The "closed" state of a profile section: label, a one-line preview of
// what's there (or an empty-state prompt), and a pencil to open the full
// editor. This is what replaces the old always-expanded EditSection —
// most of a profile is read-only summary; only the section being worked
// on should ever show its full form.
export default function SectionCard({ label, preview, isEmpty, onEdit }) {
  return (
    <button type="button" className="sc" onClick={onEdit}>
      <div className="sc-text">
        <span className="sc-label">{label}</span>
        <span className={`sc-preview ${isEmpty ? 'sc-preview-empty' : ''}`}>
          {preview}
        </span>
      </div>
      <span className="sc-action">
        {isEmpty ? <ChevronRight size={17} /> : <Pencil size={15} />}
      </span>
      <style>{`
        .sc {
          width: 100%;
          display: flex; align-items: center; justify-content: space-between; gap: 14px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px 18px;
          text-align: left;
          transition: border-color 0.15s ease;
        }
        .sc:hover { border-color: var(--ink-faint); }
        .sc-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
        .sc-label {
          font-family: var(--font-head); font-size: 13px; font-weight: 600;
          color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.04em;
        }
        .sc-preview {
          font-size: 14.5px; color: var(--ink);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .sc-preview-empty { color: var(--lemon); font-weight: 600; }
        .sc-action { color: var(--ink-faint); flex-shrink: 0; }
        .sc:hover .sc-action { color: var(--lemon); }
      `}</style>
    </button>
  )
}
