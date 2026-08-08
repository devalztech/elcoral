/**
 * Small display helpers shared by the community, messaging and
 * follower screens. Kept out of the components so the "1.2K" in a
 * discussion's view count and the "1.2K" in a community's member count
 * can't drift apart.
 */

/** 950 -> "950", 1240 -> "1.2K", 2_400_000 -> "2.4M" */
export function formatCount(n) {
  const value = Number(n) || 0
  if (value < 1000) return String(value)
  if (value < 1_000_000) {
    const k = value / 1000
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}K`
  }
  const m = value / 1_000_000
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m)}M`
}

export function pluralize(n, singular, plural) {
  return `${formatCount(n)} ${Number(n) === 1 ? singular : plural ?? `${singular}s`}`
}

/** ISO timestamp -> "just now" / "2h ago" / "3d ago" / "12 Mar" */
export function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const seconds = Math.max(0, (Date.now() - then.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Clock time for a message bubble. */
export function timeOfDay(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Day separator label inside a conversation. */
export function dayLabel(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a, b) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function initialsOf(name) {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Stable avatar tone (av-a / av-b / av-c) for a person without a photo,
 * so the same member always gets the same colour instead of flickering
 * between renders.
 */
export function avatarTone(key) {
  const source = String(key ?? '')
  let hash = 0
  for (let i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) % 3
  return ['a', 'b', 'c'][hash]
}

/** Best available display name for a person payload from the API. */
export function displayName(person) {
  return person?.full_name || person?.username || 'Member'
}
