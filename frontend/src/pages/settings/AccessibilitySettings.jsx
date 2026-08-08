import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'
import ToggleRow from '../../features/settings/components/ToggleRow.jsx'
import { useSettings } from '../../features/settings/hooks/useSettings.jsx'

const SCALES = [
  { key: 'small', label: 'A', size: 12 },
  { key: 'default', label: 'A', size: 15 },
  { key: 'large', label: 'A', size: 18 },
  { key: 'xlarge', label: 'A', size: 22 },
]

export default function AccessibilitySettings() {
  const { settings, loading, error, updateAccessibility } = useSettings()

  if (loading) return <SettingsSubpage title="Accessibility"><p className="set-loading">Loading…</p></SettingsSubpage>

  const a11y = settings.accessibility

  return (
    <SettingsSubpage title="Accessibility">
      {error && <p className="set-error" role="alert">{error}</p>}

      <h2 className="set-section">Text size</h2>
      <div className="a11y-scales">
        {SCALES.map((s) => (
          <button
            type="button"
            key={s.key}
            aria-label={`Text size ${s.key}`}
            aria-pressed={a11y.font_scale === s.key}
            className={`a11y-scale ${a11y.font_scale === s.key ? 'a11y-scale-on' : ''}`}
            onClick={() => updateAccessibility({ font_scale: s.key })}
          >
            <span style={{ fontSize: s.size, fontWeight: 700 }}>{s.label}</span>
          </button>
        ))}
      </div>

      <h2 className="set-section">Display</h2>
      <ToggleRow
        label="Reduce motion"
        desc="Turn off transitions and animated effects"
        checked={a11y.reduce_motion}
        onChange={(v) => updateAccessibility({ reduce_motion: v })}
      />
      <ToggleRow
        label="High contrast"
        desc="Stronger borders and brighter text"
        checked={a11y.high_contrast}
        onChange={(v) => updateAccessibility({ high_contrast: v })}
      />

      <style>{`
        .a11y-scales { display: flex; gap: 10px; margin-bottom: 8px; }
        .a11y-scale {
          flex: 1; height: 56px; border-radius: 12px;
          background: var(--panel); border: 1px solid var(--border); color: var(--ink-dim);
        }
        .a11y-scale-on { border-color: var(--accent-ink); color: var(--ink); }
      `}</style>
    </SettingsSubpage>
  )
}
