import { useEffect, useState } from 'react'
import { useAuth } from '../../features/auth/hooks/useAuth.jsx'
import { api } from '../../api/client.js'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'
import ToggleRow from '../../features/settings/components/ToggleRow.jsx'
import Spinner from '../../components/Spinner.jsx'

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
        <Spinner page label="Loading settings" />
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
