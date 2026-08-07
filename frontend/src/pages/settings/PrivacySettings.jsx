import { useEffect, useState } from 'react'
import { useAuth } from '../../features/auth/hooks/useAuth.jsx'
import { api } from '../../api/client.js'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'

export default function PrivacySettings() {
  const { accessToken, authLoading } = useAuth()

  const [prefs, setPrefs] = useState({ is_public: true, show_email: false, show_activity: true })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading || !accessToken) return
    let cancelled = false
    api
      .getMyProfile(accessToken)
      .then((profile) => {
        if (cancelled) return
        setPrefs({
          is_public: profile.is_public ?? true,
          show_email: profile.show_email ?? false,
          show_activity: profile.show_activity ?? true,
        })
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your privacy settings.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [accessToken, authLoading])

  // Optimistic: the toggle flips immediately and rolls back if the save
  // fails, so a one-tap setting never feels laggy.
  async function setPref(key, value) {
    const previous = prefs[key]
    setPrefs((p) => ({ ...p, [key]: value }))
    setError('')
    try {
      await api.updatePrivacy({ [key]: value }, accessToken)
    } catch (err) {
      setPrefs((p) => ({ ...p, [key]: previous }))
      setError(err.message || 'Could not save that change. Please try again.')
    }
  }

  if (authLoading || loading) {
    return (
      <SettingsSubpage title="Privacy">
        <p className="privacy-loading">Loading…</p>
        <style>{`.privacy-loading { font-size: 13.5px; color: var(--ink-faint); }`}</style>
      </SettingsSubpage>
    )
  }

  return (
    <SettingsSubpage title="Privacy">
      {error && <p className="privacy-error" role="alert">{error}</p>}
      <ToggleRow
        label="Public profile"
        desc="Anyone with the link can view your profile"
        checked={prefs.is_public}
        onChange={(v) => setPref('is_public', v)}
      />
      <ToggleRow
        label="Show email on profile"
        desc="Visible only to signed-in members"
        checked={prefs.show_email}
        onChange={(v) => setPref('show_email', v)}
      />
      <ToggleRow
        label="Show activity status"
        desc="Let others see when you're active"
        checked={prefs.show_activity}
        onChange={(v) => setPref('show_activity', v)}
      />
      <style>{`.privacy-error { font-size: 13px; color: var(--danger); margin-bottom: 12px; }`}</style>
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
