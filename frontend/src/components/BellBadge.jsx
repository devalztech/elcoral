/**
 * The little unread count that sits on a bell.
 *
 * Self-contained (own positioning + own styles) so it can be dropped
 * into any app bar without that bar needing to know about it — the only
 * requirement is that the parent is position: relative, which it sets
 * itself via the wrapper span.
 */
import { useNotifications } from '../features/notifications/useNotifications.jsx'

export default function BellBadge() {
  const { unread } = useNotifications()
  if (!unread) return null
  return (
    <span className="nb-badge" aria-label={`${unread} unread notifications`}>
      {unread > 99 ? '99+' : unread}
      <style>{`
        .nb-badge {
          position: absolute; top: 2px; right: 2px;
          min-width: 17px; height: 17px; padding: 0 4px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; background: var(--danger, #e5484d); color: #fff;
          font-size: 10.5px; font-weight: 800; line-height: 1;
          border: 2px solid var(--bg); box-sizing: content-box;
          pointer-events: none;
        }
      `}</style>
    </span>
  )
}
