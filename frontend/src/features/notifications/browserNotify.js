/**
 * Browser/system notifications — the WhatsApp behaviour.
 *
 * Everything that raises an alert goes through `showAlert`, which prefers
 * the service worker (`registration.showNotification`). That matters on
 * phones: Android Chrome throws on `new Notification()`, and only the
 * service-worker path reaches the OS notification tray, where the alert
 * survives the tab being backgrounded. Desktop browsers without a worker
 * fall back to the constructor.
 *
 * Permission is never requested on page load — the user grants it from
 * Settings › Notifications, the same way WhatsApp asks. Local preferences
 * (alerts on/off, sound, vibration) live in localStorage because they are
 * device-specific, not account-specific.
 */
const PREFS_KEY = 'elcoral:alert-prefs'
const DEFAULT_PREFS = { alerts: true, sound: true, vibrate: true, preview: true }

export function supportsNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function permissionState() {
  if (!supportsNotifications()) return 'unsupported'
  return Notification.permission
}

export function readPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function writePrefs(next) {
  const merged = { ...readPrefs(), ...next }
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(merged)) } catch { /* private mode */ }
  return merged
}

let registration = null
let registering = null

export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null)
  if (registration) return Promise.resolve(registration)
  if (!registering) {
    registering = navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(async (reg) => {
        registration = (await navigator.serviceWorker.ready.catch(() => null)) || reg
        return registration
      })
      .catch(() => null)
  }
  return registering
}

export async function requestPermission() {
  if (!supportsNotifications()) return 'unsupported'
  if (Notification.permission === 'granted') {
    await registerServiceWorker()
    return 'granted'
  }
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission().catch(() => 'denied')
  if (result === 'granted') await registerServiceWorker()
  return result
}

/**
 * Raise one alert. Silently does nothing when the user hasn't granted
 * permission or has muted alerts on this device.
 */
export async function showAlert({ title = 'Elcoral', body = '', icon, url, tag, force = false } = {}) {
  if (!supportsNotifications() || Notification.permission !== 'granted') return false
  const prefs = readPrefs()
  if (!prefs.alerts && !force) return false

  const payload = {
    title,
    body: prefs.preview || force ? body : 'New activity on Elcoral',
    icon: icon || '/favicon.png',
    url: url || '/home/notifications',
    tag: tag || `elcoral-${Date.now()}`,
    silent: !prefs.sound,
    vibrate: prefs.vibrate,
  }

  const reg = await registerServiceWorker()
  if (reg) {
    try {
      await reg.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon,
        badge: '/favicon.png',
        tag: payload.tag,
        renotify: true,
        silent: payload.silent,
        vibrate: payload.vibrate ? [90, 40, 90] : undefined,
        data: { url: payload.url },
      })
      return true
    } catch { /* fall through to the constructor */ }
  }

  try {
    const note = new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      tag: payload.tag,
      silent: payload.silent,
    })
    note.onclick = () => {
      window.focus()
      window.location.href = payload.url
      note.close()
    }
    return true
  } catch {
    return false
  }
}
