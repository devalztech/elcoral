import { Monitor, Moon, Sun } from 'lucide-react'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'
import { useSettings } from '../../features/settings/hooks/useSettings.jsx'

const THEMES = [
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'system', label: 'System', icon: Monitor },
]

const ACCENTS = [
  { key: 'lemon', label: 'Lemon', swatch: '#C4F135' },
  { key: 'coral', label: 'Coral', swatch: '#FF7A5A' },
  { key: 'sky', label: 'Sky', swatch: '#5AC8FF' },
  { key: 'violet', label: 'Violet', swatch: '#A98BFF' },
  { key: 'amber', label: 'Amber', swatch: '#FFC14D' },
]

export default function AppearanceSettings() {
  const { settings, loading, error, updateAppearance } = useSettings()

  if (loading) return <SettingsSubpage title="Appearance"><p className="set-loading">Loading…</p></SettingsSubpage>

  const { theme, accent } = settings.appearance

  return (
    <SettingsSubpage title="Appearance">
      {error && <p className="set-error" role="alert">{error}</p>}

      <h2 className="set-section">Theme</h2>
      <div className="appearance-themes">
        {THEMES.map(({ key, label, icon: Icon }) => (
          <button
            type="button"
            key={key}
            aria-pressed={theme === key}
            className={`theme-card ${theme === key ? 'theme-card-on' : ''}`}
            onClick={() => updateAppearance({ theme: key })}
          >
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <h2 className="set-section">Accent color</h2>
      <div className="appearance-accents">
        {ACCENTS.map(({ key, label, swatch }) => (
          <button
            type="button"
            key={key}
            aria-label={label}
            aria-pressed={accent === key}
            className={`accent-dot ${accent === key ? 'accent-dot-on' : ''}`}
            style={{ '--swatch': swatch }}
            onClick={() => updateAppearance({ accent: key })}
          >
            <span className="accent-swatch" />
            <span className="accent-label">{label}</span>
          </button>
        ))}
      </div>

      <style>{`
        .appearance-themes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
        .theme-card {
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          padding: 16px 8px; border-radius: 12px;
          background: var(--panel); border: 1px solid var(--border);
          font-size: 13px; font-weight: 600; color: var(--ink-dim);
        }
        .theme-card-on { border-color: var(--lemon); color: var(--ink); }
        .appearance-accents { display: flex; flex-wrap: wrap; gap: 14px; }
        .accent-dot { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .accent-swatch {
          width: 34px; height: 34px; border-radius: 50%;
          background: var(--swatch); border: 2px solid transparent;
          box-shadow: 0 0 0 2px var(--bg);
        }
        .accent-dot-on .accent-swatch { box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--swatch); }
        .accent-label { font-size: 11.5px; color: var(--ink-faint); }
        .accent-dot-on .accent-label { color: var(--ink); }
      `}</style>
    </SettingsSubpage>
  )
}
