import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'
import ElcoralMark from '../../components/ElcoralMark.jsx'

export default function AboutSettings() {
  const [about, setAbout] = useState(null)

  // Version comes from the server rather than a hardcoded frontend
  // constant, so it can't drift from what's actually deployed.
  useEffect(() => {
    let cancelled = false
    api.getAbout().then((a) => { if (!cancelled) setAbout(a) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <SettingsSubpage title="About Elcoral">
      <div className="about-hero">
        <ElcoralMark size={44} />
        <p className="about-name">{about?.app_name ?? 'Elcoral'}</p>
        <p className="about-version">
          Version {about?.version ?? '—'}
          {about?.environment && about.environment !== 'production' ? ` · ${about.environment}` : ''}
        </p>
      </div>

      <p className="about-blurb">
        Elcoral connects people by intent, not job title — find work, hire, build a startup, find
        collaborators, learn, or mentor.
      </p>

      <div className="about-links">
        <a href={about?.terms_url ?? '/terms'} className="about-link">Terms of service</a>
        <a href={about?.privacy_url ?? '/privacy'} className="about-link">Privacy policy</a>
        <a href={`mailto:${about?.support_email ?? 'support@elcoral.com'}`} className="about-link">
          Contact support
        </a>
      </div>

      <p className="about-copy">© {new Date().getFullYear()} Elcoral. All rights reserved.</p>

      <style>{`
        .about-hero { text-align: center; padding: 10px 0 22px; }
        .about-name { margin: 12px 0 0; font-family: var(--font-display); font-weight: 800; font-size: 20px; color: var(--ink); }
        .about-version { margin: 4px 0 0; font-size: 12.5px; color: var(--ink-faint); }
        .about-blurb { font-size: 13.5px; color: var(--ink-dim); line-height: 1.65; text-align: center; margin: 0 0 22px; }
        .about-links { display: flex; flex-direction: column; }
        .about-link {
          padding: 15px 0; border-bottom: 1px solid var(--border);
          font-size: 14.5px; font-weight: 600; color: var(--ink);
        }
        .about-copy { margin-top: 22px; text-align: center; font-size: 12px; color: var(--ink-faint); }
      `}</style>
    </SettingsSubpage>
  )
}
