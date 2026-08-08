import { Check } from 'lucide-react'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'
import { useSettings } from '../../features/settings/hooks/useSettings.jsx'

// Label + native name so someone who can't read the English name can
// still find their language.
const LANGUAGES = [
  { key: 'en', label: 'English', native: 'English' },
  { key: 'fr', label: 'French', native: 'Français' },
  { key: 'es', label: 'Spanish', native: 'Español' },
  { key: 'pt', label: 'Portuguese', native: 'Português' },
  { key: 'de', label: 'German', native: 'Deutsch' },
  { key: 'ar', label: 'Arabic', native: 'العربية' },
  { key: 'sw', label: 'Swahili', native: 'Kiswahili' },
]

export default function LanguageSettings() {
  const { settings, loading, error, updateLanguage } = useSettings()

  if (loading) return <SettingsSubpage title="Language"><p className="set-loading">Loading…</p></SettingsSubpage>

  return (
    <SettingsSubpage title="Language">
      {error && <p className="set-error" role="alert">{error}</p>}
      <p className="set-intro">
        Your preference is saved to your account. Elcoral's interface is in English today — the rest
        are being translated, and yours will switch over automatically once it ships.
      </p>
      <div className="lang-list">
        {LANGUAGES.map((lang) => (
          <button
            type="button"
            key={lang.key}
            className="lang-row"
            aria-pressed={settings.language === lang.key}
            onClick={() => updateLanguage(lang.key)}
          >
            <span className="lang-text">
              <span className="lang-label">{lang.label}</span>
              <span className="lang-native">{lang.native}</span>
            </span>
            {settings.language === lang.key && <Check size={17} className="lang-check" />}
          </button>
        ))}
      </div>
      <style>{`
        .lang-list { display: flex; flex-direction: column; }
        .lang-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          width: 100%; text-align: left; padding: 15px 0; border-bottom: 1px solid var(--border);
        }
        .lang-text { display: flex; flex-direction: column; gap: 2px; }
        .lang-label { font-size: 14.5px; font-weight: 600; color: var(--ink); }
        .lang-native { font-size: 12.5px; color: var(--ink-faint); }
        .lang-check { color: var(--accent-ink); flex-shrink: 0; }
      `}</style>
    </SettingsSubpage>
  )
}
