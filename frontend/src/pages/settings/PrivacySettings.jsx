import { useState } from 'react'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'

// Frontend-only — no privacy-preference fields exist on the backend
// profile model yet. Toggles hold local state so the UI is real and
// usable; wire to a persisted field when that's added server-side.
export default function PrivacySettings() {
  const [profileVisible, setProfileVisible] = useState(true)
  const [showEmail, setShowEmail] = useState(false)
  const [showActivity, setShowActivity] = useState(true)

  return (
    <SettingsSubpage title="Privacy">
      <ToggleRow
        label="Public profile"
        desc="Anyone with the link can view your profile"
        checked={profileVisible}
        onChange={setProfileVisible}
      />
      <ToggleRow
        label="Show email on profile"
        desc="Visible only to people you're connected with"
        checked={showEmail}
        onChange={setShowEmail}
      />
      <ToggleRow
        label="Show activity status"
        desc="Let others see when you're active"
        checked={showActivity}
        onChange={setShowActivity}
      />
    </SettingsSubpage>
  )
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className="toggle-row">
      <div className="toggle-row-text">
        <span className="toggle-row-label">{label}</span>
        <span className="toggle-row-desc">{desc}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
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
        .toggle-on { background: var(--lemon); border-color: var(--lemon); }
        .toggle-knob {
          position: absolute; top: 2px; left: 2px;
          width: 20px; height: 20px; border-radius: 50%;
          background: var(--ink); transition: transform 0.15s ease;
        }
        .toggle-on .toggle-knob { background: #0B0D0A; transform: translateX(18px); }
      `}</style>
    </div>
  )
}
