import { useParams } from 'react-router-dom'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'

const TITLES = {
  verification: 'Account verification',
  email: 'Email preferences',
  notifications: 'Notifications',
  appearance: 'Appearance',
  language: 'Language',
  accessibility: 'Accessibility',
  blocked: 'Blocked users',
  reports: 'Report history',
  data: 'Data & privacy',
  help: 'Help center',
  about: 'About Elcoral',
}

export default function SettingsPlaceholder() {
  const { slug } = useParams()
  const title = TITLES[slug] || 'Settings'

  return (
    <SettingsSubpage title={title}>
      <div className="sp-empty">
        <p className="sp-empty-title">Nothing here yet</p>
        <p className="sp-empty-desc">{title} is coming soon.</p>
      </div>
      <style>{`
        .sp-empty {
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; padding: 28px 18px; text-align: center;
        }
        .sp-empty-title { font-family: var(--font-head); font-weight: 700; font-size: 15px; color: var(--ink); margin: 0; }
        .sp-empty-desc { font-size: 13.5px; color: var(--ink-faint); margin: 6px 0 0; }
      `}</style>
    </SettingsSubpage>
  )
}
