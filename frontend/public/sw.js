/*
 * Elcoral service worker.
 *
 * Its only job is notifications: the page asks it to raise a system
 * notification (`postMessage({type:'notify'})`), and it owns the click so
 * tapping the alert on a phone focuses the open tab — or opens the app at
 * the right screen when nothing is running. Android/Chrome refuses
 * `new Notification()` outside a service worker, which is exactly why
 * this file exists; without it the phone's notification tray stays empty.
 *
 * Deliberately no offline caching: stale JS chunks behind a live API are
 * worse than a network error.
 */
/* global self, clients */

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

function show(payload) {
  const data = payload || {}
  return self.registration.showNotification(data.title || 'Elcoral', {
    body: data.body || '',
    icon: data.icon || '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag || 'elcoral',
    renotify: true,
    silent: data.silent === true,
    timestamp: Date.now(),
    vibrate: data.vibrate === false ? undefined : [90, 40, 90],
    data: { url: data.url || '/home/notifications' },
  })
}

self.addEventListener('message', (event) => {
  const msg = event.data || {}
  if (msg.type === 'notify') event.waitUntil(show(msg.payload))
})

// Web Push, for when a push service is wired up server-side. Same
// rendering path as the in-page alerts so both look identical.
self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch { payload = { body: 'New activity on Elcoral' } }
  event.waitUntil(show(payload))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/home/notifications'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) client.navigate(url).catch(() => {})
          return undefined
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
