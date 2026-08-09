import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'
import ToggleRow from '../../features/settings/components/ToggleRow.jsx'
import { useSettings } from '../../features/settings/hooks/useSettings.jsx'
import Spinner from '../../components/Spinner.jsx'

const ROWS = [
  { key: 'notify_messages', label: 'Messages', desc: 'Someone sends you a direct message' },
  { key: 'notify_mentions', label: 'Mentions', desc: 'Someone mentions you in a post or comment' },
  { key: 'notify_follows', label: 'New followers', desc: 'Someone starts following you' },
  { key: 'notify_post_activity', label: 'Post activity', desc: 'Likes and comments on your posts' },
  { key: 'notify_job_matches', label: 'Job matches', desc: 'Opportunities that fit your intents and skills' },
]

export default function NotificationSettings() {
  const { settings, loading, error, updateNotifications } = useSettings()

  if (loading) return <SettingsSubpage title="Notifications"><Spinner page label="Loading settings" /></SettingsSubpage>

  return (
    <SettingsSubpage title="Notifications">
      {error && <p className="set-error" role="alert">{error}</p>}
      <p className="set-intro">Choose what Elcoral pings you about. Changes save as you tap.</p>
      {ROWS.map((row) => (
        <ToggleRow
          key={row.key}
          label={row.label}
          desc={row.desc}
          checked={settings.notifications[row.key]}
          onChange={(v) => updateNotifications({ [row.key]: v })}
        />
      ))}
    </SettingsSubpage>
  )
}
