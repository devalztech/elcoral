import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth.jsx'
import { api } from '../../../api/client.js'

// Mirrors the server defaults in app/models/settings.py, so the UI renders
// something sane before the first fetch resolves and for logged-out
// visitors (who have no settings row at all).
export const DEFAULT_SETTINGS = {
  notifications: {
    notify_messages: true,
    notify_mentions: true,
    notify_follows: true,
    notify_post_activity: true,
    notify_job_matches: true,
  },
  email: {
    email_product_updates: true,
    email_weekly_digest: true,
    email_security_alerts: true,
    email_marketing: false,
  },
  appearance: { theme: 'dark', accent: 'lemon' },
  accessibility: { reduce_motion: false, high_contrast: false, font_scale: 'default' },
  language: 'en',
}

const SettingsContext = createContext(null)

function resolveTheme(theme) {
  if (theme !== 'system') return theme
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/**
 * Loads the signed-in member's preferences once and applies the visual
 * ones to <html> as data-* attributes, which src/styles/index.css keys
 * off. Doing it here rather than inside the Appearance screen means a
 * chosen theme/accent/font size holds on every page, not just while that
 * screen is open.
 */
export function SettingsProvider({ children }) {
  const { accessToken, authLoading } = useAuth()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!accessToken) {
      setSettings(DEFAULT_SETTINGS)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    api
      .getSettings(accessToken)
      .then((data) => { if (!cancelled) setSettings(data) })
      .catch(() => { if (!cancelled) setError('Could not load your settings.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [accessToken, authLoading])

  const { theme, accent } = settings.appearance
  const { reduce_motion: reduceMotion, high_contrast: highContrast, font_scale: fontScale } =
    settings.accessibility

  useEffect(() => {
    const root = document.documentElement
    const apply = () => { root.dataset.theme = resolveTheme(theme) }
    apply()

    // "System" has to keep tracking the OS setting after the initial
    // render — otherwise it's just a snapshot taken at page load.
    if (theme !== 'system' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.accent = accent
    root.dataset.fontScale = fontScale
    root.dataset.reduceMotion = reduceMotion ? 'true' : 'false'
    root.dataset.contrast = highContrast ? 'high' : 'normal'
  }, [accent, fontScale, reduceMotion, highContrast])

  // Optimistic across the board: preference toggles must feel instant, and
  // rolling back on failure is cheap because the previous value is right
  // here in state.
  const patch = useCallback(
    async (group, changes, saveFn) => {
      const previous = settings[group]
      const next =
        group === 'language' ? changes.language : { ...settings[group], ...changes }
      setSettings((s) => ({ ...s, [group]: next }))
      setError('')
      try {
        const fresh = await saveFn(accessToken)
        setSettings(fresh)
        return true
      } catch (err) {
        setSettings((s) => ({ ...s, [group]: previous }))
        setError(err.message || 'Could not save that change. Please try again.')
        return false
      }
    },
    [accessToken, settings],
  )

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      clearError: () => setError(''),
      updateNotifications: (changes) =>
        patch('notifications', changes, (t) => api.updateNotificationSettings(changes, t)),
      updateEmail: (changes) => patch('email', changes, (t) => api.updateEmailSettings(changes, t)),
      updateAppearance: (changes) =>
        patch('appearance', changes, (t) => api.updateAppearanceSettings(changes, t)),
      updateAccessibility: (changes) =>
        patch('accessibility', changes, (t) => api.updateAccessibilitySettings(changes, t)),
      updateLanguage: (language) =>
        patch('language', { language }, (t) => api.updateLanguageSetting(language, t)),
    }),
    [settings, loading, error, patch],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
