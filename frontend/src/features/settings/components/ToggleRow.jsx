/**
 * The one switch row used by every settings screen. Extracted from
 * PrivacySettings so Notifications, Email and Accessibility don't each
 * grow a slightly different copy of the same control.
 */
export default function ToggleRow({ label, desc, checked, onChange, disabled = false }) {
  return (
    <div className="toggle-row">
      <div className="toggle-row-text">
        <span className="toggle-row-label">{label}</span>
        {desc && <span className="toggle-row-desc">{desc}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`toggle ${checked ? 'toggle-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-knob" />
      </button>
      <style>{`
        .toggle-row {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 16px 0; border-bottom: 1px solid var(--border);
        }
        .toggle-row-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .toggle-row-label { font-size: 14.5px; font-weight: 600; color: var(--ink); }
        .toggle-row-desc { font-size: 12.5px; color: var(--ink-faint); }
        .toggle {
          width: 44px; height: 26px; border-radius: 999px; flex-shrink: 0;
          background: var(--panel-raised); border: 1px solid var(--border);
          position: relative; transition: background 0.15s ease, border-color 0.15s ease;
        }
        .toggle:disabled { opacity: 0.5; cursor: not-allowed; }
        .toggle-on { background: var(--lemon); border-color: var(--lemon); }
        .toggle-knob {
          position: absolute; top: 2px; left: 2px;
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--ink); transition: transform 0.15s ease;
        }
        .toggle-on .toggle-knob { transform: translateX(18px); background: var(--bg); }
      `}</style>
    </div>
  )
}
