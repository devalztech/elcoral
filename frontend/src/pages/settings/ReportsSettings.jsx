import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import { useAuth } from '../../features/auth/hooks/useAuth.jsx'
import { api } from '../../api/client.js'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'
import Spinner from '../../components/Spinner.jsx'

const REASON_LABELS = {
  spam: 'Spam',
  harassment: 'Harassment or bullying',
  hate_speech: 'Hate speech',
  impersonation: 'Impersonation',
  scam_or_fraud: 'Scam or fraud',
  nudity_or_sexual_content: 'Nudity or sexual content',
  violence: 'Violence',
  intellectual_property: 'Intellectual property',
  other: 'Something else',
}

const STATUS_LABELS = {
  open: 'Received',
  reviewing: 'Under review',
  resolved: 'Action taken',
  dismissed: 'No action taken',
}

export default function ReportsSettings() {
  const { accessToken, authLoading } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading || !accessToken) return
    let cancelled = false
    api
      .listMyReports(accessToken)
      .then((list) => { if (!cancelled) setReports(list) })
      .catch(() => { if (!cancelled) setError('Could not load your report history.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [accessToken, authLoading])

  return (
    <SettingsSubpage title="Report history">
      <p className="set-intro">Everything you've reported, and where each one got to.</p>
      {error && <p className="set-error" role="alert">{error}</p>}
      {loading && <Spinner page label="Loading settings" />}

      {!loading && reports.length === 0 && (
        <div className="rep-empty">
          <Flag size={22} />
          <p className="rep-empty-title">No reports yet</p>
          <p className="rep-empty-desc">Reports you file from a profile or post will appear here.</p>
        </div>
      )}

      {reports.map((r) => (
        <div className="rep-row" key={r.id}>
          <div className="rep-head">
            <span className="rep-target">{r.target_label || (r.target_type === 'user' ? 'A member' : 'A post')}</span>
            <span className={`rep-status rep-status-${r.status}`}>{STATUS_LABELS[r.status] ?? r.status}</span>
          </div>
          <p className="rep-reason">{REASON_LABELS[r.reason] ?? r.reason}</p>
          {r.details && <p className="rep-details">{r.details}</p>}
          <p className="rep-date">{new Date(r.created_at).toLocaleDateString()}</p>
        </div>
      ))}

      <style>{`
        .rep-empty {
          text-align: center; padding: 30px 16px; color: var(--ink-faint);
          background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
        }
        .rep-empty-title { margin: 10px 0 0; font-weight: 700; color: var(--ink); font-size: 14.5px; }
        .rep-empty-desc { margin: 4px 0 0; font-size: 13px; }
        .rep-row { padding: 15px 0; border-bottom: 1px solid var(--border); }
        .rep-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .rep-target { font-size: 14.5px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rep-status {
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
          padding: 4px 9px; border-radius: 999px; flex-shrink: 0;
          background: var(--panel-raised); color: var(--ink-dim); border: 1px solid var(--border);
        }
        .rep-status-resolved { color: var(--accent-ink); border-color: var(--accent-ink); }
        .rep-status-dismissed { color: var(--ink-faint); }
        .rep-reason { margin: 6px 0 0; font-size: 13px; color: var(--ink-dim); }
        .rep-details { margin: 4px 0 0; font-size: 12.5px; color: var(--ink-faint); }
        .rep-date { margin: 6px 0 0; font-size: 11.5px; color: var(--ink-faint); }
      `}</style>
    </SettingsSubpage>
  )
}
