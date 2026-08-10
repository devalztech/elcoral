import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function SettingsSubpage({ title, children }) {
  return (
    <div className="settings-sub">
      <Link to="/home/settings" className="back-link">
        <ArrowLeft size={15} /> Settings
      </Link>
      <h1 className="settings-sub-title">{title}</h1>
      {children}
      <style>{`
        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13.5px; font-weight: 600; color: var(--ink-dim);
          margin-bottom: 18px;
        }
        @media (hover: hover) and (pointer: fine) { .back-link:hover { color: var(--accent-ink); } }
        .settings-sub-title { font-family: var(--font-display); font-weight: 800; font-size: 22px; color: var(--ink); margin-bottom: 20px; }
      `}</style>
    </div>
  )
}
