import { Briefcase, Code2, MessageSquare, MessagesSquare, Rocket } from 'lucide-react'

// Decorative globe-of-people illustration from the brand panel: a dotted
// world map glow, connecting lemon lines, member avatars and small
// icon-nodes. Pure CSS/SVG so it scales crisply at any panel width.
const NODES = [
  { top: '18%', left: '30%', type: 'icon', icon: Briefcase },
  { top: '14%', left: '58%', type: 'icon', icon: Code2 },
  { top: '30%', left: '10%', type: 'avatar', initials: 'AO' },
  { top: '28%', left: '76%', type: 'avatar', initials: 'DC' },
  { top: '56%', left: '4%', type: 'icon', icon: MessageSquare },
  { top: '54%', left: '82%', type: 'icon', icon: MessagesSquare },
  { top: '52%', left: '24%', type: 'avatar', initials: 'MK' },
  { top: '74%', left: '64%', type: 'avatar', initials: 'LS' },
  { top: '78%', left: '38%', type: 'icon', icon: Rocket },
]

export default function NetworkGraphic() {
  return (
    <div className="net">
      <svg className="net-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <g stroke="rgba(196,241,53,0.35)" strokeWidth="0.4" fill="none">
          <path d="M18 36 L36 58 L60 34 L82 32" />
          <path d="M36 58 L70 78 L86 58" />
          <path d="M18 36 L34 22 L62 18" />
          <path d="M12 60 L36 58" />
          <path d="M44 82 L70 78" />
        </g>
        <g fill="rgba(196,241,53,0.9)">
          <circle cx="36" cy="58" r="0.9" />
          <circle cx="60" cy="34" r="0.9" />
          <circle cx="70" cy="78" r="0.9" />
          <circle cx="18" cy="36" r="0.9" />
        </g>
      </svg>

      <div className="net-globe" aria-hidden="true" />

      {NODES.map((n, i) => (
        <div
          key={i}
          className={n.type === 'avatar' ? 'node node-avatar' : 'node node-icon'}
          style={{ top: n.top, left: n.left }}
        >
          {n.type === 'avatar' ? n.initials : <n.icon size={16} />}
        </div>
      ))}

      <style>{`
        .net {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 0.78;
          max-width: 360px;
          margin: 0 auto;
        }
        .net-lines { position: absolute; inset: 0; width: 100%; height: 100%; }
        .net-globe {
          position: absolute;
          inset: 16% 14%;
          border-radius: 50%;
          background:
            radial-gradient(circle at 50% 50%, rgba(196,241,53,0.16), transparent 62%);
          -webkit-mask-image: radial-gradient(circle, #000 62%, transparent 72%);
          mask-image: radial-gradient(circle, #000 62%, transparent 72%);
        }
        .net-globe::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background-image: radial-gradient(rgba(196,241,53,0.55) 1px, transparent 1.2px);
          background-size: 9px 9px;
          opacity: 0.7;
        }
        .node {
          position: absolute;
          display: grid;
          place-items: center;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }
        .node-icon {
          width: 38px; height: 38px;
          background: var(--bg);
          border: 1px solid var(--border);
          color: var(--accent-ink);
        }
        .node-avatar {
          width: 46px; height: 46px;
          background: linear-gradient(140deg, var(--lemon-deep), var(--panel-raised));
          border: 2px solid rgba(196,241,53,0.35);
          color: var(--ink);
          font-family: var(--font-head);
          font-size: 13px;
          font-weight: 700;
        }
      `}</style>
    </div>
  )
}
