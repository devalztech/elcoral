import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'
import ToggleRow from '../../features/settings/components/ToggleRow.jsx'
import { useSettings } from '../../features/settings/hooks/useSettings.jsx'

const ROWS = [
  { key: 'email_product_updates', label: 'Product updates', desc: 'New features and changes to Elcoral' },
  { key: 'email_weekly_digest', label: 'Weekly digest', desc: 'A summary of activity you missed' },
  { key: 'email_marketing', label: 'Tips & offers', desc: 'Occasional promotional email' },
]

export default function EmailSettings() {
  const { settings, loading, error, updateEmail } = useSettings()

  if (loading) return <SettingsSubpage title="Email preferences"><p className="set-loading">Loading…</p></SettingsSubpage>

  return (
    <SettingsSubpage title="Email preferences">
      {error && <p className="set-error" role="alert">{error}</p>}
      <p className="set-intro">Pick which emails land in your inbox.</p>
      {ROWS.map((row) => (
        <ToggleRow
          key={row.key}
          label={row.label}
          desc={row.desc}
          checked={settings.email[row.key]}
          onChange={(v) => updateEmail({ [row.key]: v })}
        />
      ))}
      {/* Security mail (password resets, new-login alerts, verification)
          can't be switched off — turning it off would mean an attacker
          could take over an account silently. Shown, locked on, and
          explained rather than hidden. */}
      <ToggleRow
        label="Security alerts"
        desc="Always on — password changes and sign-in alerts"
        checked
        disabled
        onChange={() => {}}
      />
    </SettingsSubpage>
  )
}
