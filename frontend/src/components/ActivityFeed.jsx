import { useEffect, useState } from 'react'

const EVENTS = [
  { tag: 'POSTED', role: 'client', text: 'Shopify storefront redesign', meta: '$800 fixed · 3 proposals', accent: true },
  { tag: 'HIRED', role: 'match', text: 'Amara K. → Logo & brand kit', meta: 'Started 2m ago' },
  { tag: 'POSTED', role: 'client', text: 'Python data pipeline, weekly', meta: '$40/hr · 7 proposals', accent: true },
  { tag: 'DELIVERED', role: 'freelancer', text: 'Voiceover, 12 min explainer', meta: 'Awaiting review' },
  { tag: 'HIRED', role: 'match', text: 'Deshawn R. → React dashboard', meta: 'Started just now' },
  { tag: 'POSTED', role: 'client', text: 'Ghostwritten newsletter, 4x', meta: '$220/mo · 2 proposals', accent: true },
  { tag: 'PAID', role: 'freelancer', text: 'Video edit, YouTube series', meta: 'Released from escrow' },
]

export default function ActivityFeed({ dense = false }) {
  const [visible, setVisible] = useState([0, 1, 2])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2800)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const next = (tick + 3) % EVENTS.length
    setVisible((v) => [v[1], v[2], next])
  }, [tick])

  return (
    <div className={`feed ${dense ? 'feed-dense' : ''}`} role="list" aria-label="Live marketplace activity">
      {visible.map((idx, i) => {
        const ev = EVENTS[idx]
        return (
          <div className="feed-card" key={`${idx}-${tick}-${i}`} role="listitem" style={{ animationDelay: `${i * 0.06}s` }}>
            <span className={`feed-tag ${ev.accent ? 'feed-tag-accent' : ''}`}>{ev.tag}</span>
            <div className="feed-body">
              <p className="feed-text">{ev.text}</p>
              <p className="feed-meta">{ev.meta}</p>
            </div>
          </div>
        )
      })}
      <style>{`
        .feed {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }
        .feed-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: var(--panel-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 14px 16px;
          animation: feedIn 0.5s ease both;
        }
        @keyframes feedIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .feed-tag {
          flex-shrink: 0;
          font-family: var(--font-head);
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          padding: 4px 8px;
          border-radius: 5px;
          background: var(--border);
          color: var(--ink-dim);
          margin-top: 1px;
        }
        .feed-tag-accent {
          background: rgba(196, 241, 53, 0.14);
          color: var(--lemon);
        }
        .feed-text {
          margin: 0;
          font-size: 14.5px;
          font-weight: 500;
          color: var(--ink);
        }
        .feed-meta {
          margin: 2px 0 0;
          font-size: 12.5px;
          color: var(--ink-faint);
        }
        .feed-dense .feed-card { padding: 11px 14px; }
      `}</style>
    </div>
  )
}
