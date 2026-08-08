// Chat tab. Placeholder for Phase 8A — the WebSocket-backed live chat
// lands in Phase 8D. Shows the real permission/enabled state now so
// the gating is correct even before the socket exists.
import { MessageCircle } from 'lucide-react'

export default function ChatTab({ community, caps, loggedIn }) {
  if (!community.chat_enabled) {
    return <p className="ct-note">Chat is turned off for this community.</p>
  }
  if (loggedIn && !caps.is_member) {
    return <p className="ct-note">Join this community to see its chat.</p>
  }
  return (
    <div className="ct-placeholder">
      <MessageCircle size={32} strokeWidth={1.6} aria-hidden="true" />
      <p>Live chat is coming in the next update.</p>
      <style>{`
        .ct-note { margin: 0; font-size: 13.5px; color: var(--ink-faint); }
        .ct-placeholder {
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          padding: 40px 20px; color: var(--ink-faint); text-align: center;
        }
        .ct-placeholder p { margin: 0; font-size: 14px; }
      `}</style>
    </div>
  )
}
