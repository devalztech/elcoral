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
        .back-link:hover { color: var(--accent-ink); }
        .settings-sub-title { font-family: var(--font-display); font-weight: 800; font-size: 22px; color: var(--ink); margin-bottom: 20px; }

        /* Shared helpers for every settings screen, defined once here so
           each subpage doesn't restate the same intro/error/loading CSS. */
        .settings-sub .set-intro { font-size: 13.5px; color: var(--ink-faint); line-height: 1.6; margin: 0 0 16px; }
        .settings-sub .set-error { font-size: 13px; color: var(--danger); margin: 0 0 12px; }
        .settings-sub .set-loading { font-size: 13.5px; color: var(--ink-faint); }
        .settings-sub .set-section {
          font-family: var(--font-head); font-size: 12.5px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--ink-faint); margin: 24px 0 12px;
        }
        .settings-sub .set-section:first-of-type { margin-top: 0; }
      `}</style>
    </div>
  )
}
