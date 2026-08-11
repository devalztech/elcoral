/**
 * Settings › Notifications.
 *
 * Two halves, like WhatsApp: the device permission at the top (grant it,
 * see its state, fire a test alert, mute this device) and the per-event
 * account preferences below.
 */
import { BellRing, BellOff, Check, Smartphone } from 'lucide-react'
import { useState } from 'react'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'
import ToggleRow from '../../features/settings/components/ToggleRow.jsx'
import { useSettings } from '../../features/settings/hooks/useSettings.jsx'
import { useNotifications } from '../../features/notifications/useNotifications.jsx'
import Spinner from '../../components/Spinner.jsx'

const ROWS = [
  { key: 'notify_messages', label: 'Messages', desc: 'Someone sends you a direct message' },
  { key: 'notify_mentions', label: 'Mentions', desc: 'Someone mentions you in a post or comment' },
  { key: 'notify_follows', label: 'New followers', desc: 'Someone starts following you' },
  { key: 'notify_post_activity', label: 'Post activity', desc: 'Likes and comments on your posts' },
  { key: 'notify_job_matches', label: 'Job matches', desc: 'Opportunities that fit your intents and skills' },
]

function DevicePanel() {
  const { desktopPermission, enableDesktop, alertPrefs, setAlertPrefs, sendTestAlert } = useNotifications()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const granted = desktopPermission === 'granted'
  const denied = desktopPermission === 'denied'
  const unsupported = desktopPermission === 'unsupported'

  const grant = async () => {
    setBusy(true)
    setNote('')
    const result = await enableDesktop()
    setBusy(false)
    if (result === 'granted') setNote('Alerts are on for this device.')
    else if (result === 'denied') setNote('Your browser blocked alerts. Allow notifications for this site in your browser settings, then come back.')
    else if (result === 'unsupported') setNote('This browser cannot show system notifications.')
  }

  const test = async () => {
    const ok = await sendTestAlert()
    setNote(ok ? 'Test alert sent — check your notification tray.' : 'Could not show a test alert.')
  }

  return (
    <section className="nsd">
      <div className="nsd-head">
        <span className={`nsd-mark ${granted ? 'on' : ''}`} aria-hidden="true">
          {granted ? <BellRing size={20} strokeWidth={1.9} /> : <BellOff size={20} strokeWidth={1.9} />}
        </span>
        <div className="nsd-head-text">
          <h2 className="nsd-title">Alerts on this device</h2>
          <p className="nsd-sub">
            {granted
              ? 'Elcoral can show alerts in your notification tray, even when the tab is in the background.'
              : denied
                ? 'Blocked by your browser. Open the site permissions and allow notifications.'
                : unsupported
                  ? 'This browser does not support system notifications.'
                  : 'Turn on alerts to get messages and activity in your notification tray, like a chat app.'}
          </p>
        </div>
        <span className={`nsd-state ${granted ? 'ok' : denied ? 'bad' : ''}`}>
          {granted ? 'On' : denied ? 'Blocked' : unsupported ? 'N/A' : 'Off'}
        </span>
      </div>

      <div className="nsd-actions">
        {!granted && !unsupported && (
          <button type="button" className="nsd-btn primary" onClick={grant} disabled={busy || denied}>
            {busy ? 'Asking…' : denied ? 'Allow in browser settings' : 'Turn on notifications'}
          </button>
        )}
        {granted && (
          <button type="button" className="nsd-btn" onClick={test}>
            <Smartphone size={15} strokeWidth={2} /> Send a test alert
          </button>
        )}
      </div>

      {note && <p className="nsd-note"><Check size={14} strokeWidth={2.4} /> {note}</p>}

      {granted && (
        <>
          <ToggleRow
            label="Show alerts"
            desc="Mute every alert on this device without changing your account settings"
            checked={alertPrefs.alerts}
            onChange={(v) => setAlertPrefs({ alerts: v })}
          />
          <ToggleRow
            label="Message preview"
            desc="Include the message text in the alert"
            checked={alertPrefs.preview}
            onChange={(v) => setAlertPrefs({ preview: v })}
            disabled={!alertPrefs.alerts}
          />
          <ToggleRow
            label="Sound"
            desc="Play your system notification sound"
            checked={alertPrefs.sound}
            onChange={(v) => setAlertPrefs({ sound: v })}
            disabled={!alertPrefs.alerts}
          />
          <ToggleRow
            label="Vibration"
            desc="Vibrate on phones that support it"
            checked={alertPrefs.vibrate}
            onChange={(v) => setAlertPrefs({ vibrate: v })}
            disabled={!alertPrefs.alerts}
          />
        </>
      )}

      <style>{`
        .nsd { margin: 4px 0 22px; }
        .nsd-head { display: flex; align-items: flex-start; gap: 12px; }
        .nsd-mark {
          display: grid; place-items: center; width: 40px; height: 40px; flex: none;
          border-radius: 14px; border: 1px solid var(--border);
          background: var(--panel-raised); color: var(--ink-faint);
        }
        .nsd-mark.on { background: var(--lemon); border-color: var(--accent-ink); color: var(--bg); }
        .nsd-head-text { min-width: 0; flex: 1; }
        .nsd-title { font-size: 15px; font-weight: 700; color: var(--ink); margin: 2px 0 4px; }
        .nsd-sub { font-size: 12.5px; line-height: 1.5; color: var(--ink-faint); margin: 0; }
        .nsd-state {
          flex: none; font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
          text-transform: uppercase; padding: 4px 9px; border-radius: 999px;
          border: 1px solid var(--border); color: var(--ink-faint);
        }
        .nsd-state.ok { color: var(--bg); background: var(--lemon); border-color: var(--accent-ink); }
        .nsd-state.bad { color: crimson; border-color: color-mix(in srgb, crimson 40%, transparent); }
        .nsd-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 2px; }
        .nsd-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 14px; border-radius: 999px; cursor: pointer;
          font-size: 13.5px; font-weight: 600;
          border: 1px solid var(--border); background: var(--panel-raised); color: var(--ink);
        }
        .nsd-btn.primary { background: var(--lemon); border-color: var(--accent-ink); color: var(--bg); }
        .nsd-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .nsd-note {
          display: flex; align-items: flex-start; gap: 6px; margin: 10px 0 0;
          font-size: 12.5px; line-height: 1.5; color: var(--ink-faint);
        }
      `}</style>
    </section>
  )
}

export default function NotificationSettings() {
  const { settings, loading, error, updateNotifications } = useSettings()

  if (loading) return <SettingsSubpage title="Notifications"><Spinner page label="Loading settings" /></SettingsSubpage>

  return (
    <SettingsSubpage title="Notifications">
      {error && <p className="set-error" role="alert">{error}</p>}
      <DevicePanel />
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
