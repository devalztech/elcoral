/**
 * Presence bits shared by the inbox and the open thread, so the dot on a
 * conversation row and the dot in the thread header can't disagree.
 */
import { timeAgo } from '../social/format.js'

/** "Online" / "Last seen 2h ago" / "" when we've simply never seen them. */
export function presenceLabel(online, lastSeenAt) {
  if (online) return 'Online'
  if (!lastSeenAt) return ''
  return `Last seen ${timeAgo(lastSeenAt)}`
}

export function OnlineDot({ online, size = 11 }) {
  if (!online) return null
  return (
    <>
      <i
        className="ms-dot"
        style={{ width: size, height: size }}
        aria-label="Online"
        role="img"
      />
      <style>{`
        .ms-dot {
          position: absolute; right: -1px; bottom: -1px;
          border-radius: 999px;
          background: #22c55e;
          border: 2px solid var(--panel);
          display: block;
        }
      `}</style>
    </>
  )
}

/** The animated three dots used under a name while someone is typing. */
export function TypingDots({ label = 'typing' }) {
  return (
    <span className="ms-typing">
      {label}
      <i /><i /><i />
      <style>{`
        .ms-typing {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 12.5px; color: var(--accent-ink); font-weight: 600;
        }
        .ms-typing i {
          width: 4px; height: 4px; border-radius: 999px; background: currentColor;
          animation: ms-bounce 1.2s infinite ease-in-out;
        }
        .ms-typing i:nth-child(2) { animation-delay: 0.15s; }
        .ms-typing i:nth-child(3) { animation-delay: 0.3s; }
        @keyframes ms-bounce {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ms-typing i { animation: none; opacity: 0.6; }
        }
      `}</style>
    </span>
  )
}
