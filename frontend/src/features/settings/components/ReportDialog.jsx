import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../auth/hooks/useAuth.jsx'
import { api } from '../../../api/client.js'

/**
 * Report a member or a post. Mirrors the reasons the backend accepts
 * (app/models/settings.py REPORT_REASONS) — anything not in this list is
 * rejected server-side, so the two must stay in step.
 */
export const REPORT_REASONS = [
  ['spam', 'Spam or unwanted commercial content'],
  ['harassment', 'Harassment or bullying'],
  ['hate_speech', 'Hate speech'],
  ['impersonation', 'Pretending to be someone else'],
  ['scam_or_fraud', 'Scam or fraud'],
  ['nudity_or_sexual_content', 'Nudity or sexual content'],
  ['violence', 'Violence or threats'],
  ['intellectual_property', 'Intellectual property violation'],
  ['other', 'Something else'],
]

export default function ReportDialog({ targetType, targetId, targetUsername, label, onClose }) {
  const { accessToken } = useAuth()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!reason || saving) return
    setSaving(true)
    setError('')
    try {
      await api.reportContent(
        {
          target_type: targetType,
          // Public profiles expose a username, never a raw id — the API
          // accepts either for member reports.
          ...(targetId ? { target_id: targetId } : { target_username: targetUsername }),
          reason,
          details: details.trim() || null,
        },
        accessToken,
      )
      setSent(true)
    } catch (err) {
      setError(err.message || 'Could not send your report. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rd-scrim" role="dialog" aria-modal="true" aria-label="Report">
      <div className="rd-sheet">
        <div className="rd-head">
          <p className="rd-title">{sent ? 'Report sent' : `Report ${label}`}</p>
          <button type="button" className="rd-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="rd-body">
            <p className="rd-note">
              Thanks — our team will review this. You can follow its status in
              Settings → Reports.
            </p>
            <button type="button" className="rd-submit" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form className="rd-body" onSubmit={submit}>
            {error && <p className="rd-error" role="alert">{error}</p>}
            <p className="rd-note">Tell us what's wrong. Reports are private.</p>

            <div className="rd-reasons">
              {REPORT_REASONS.map(([value, text]) => (
                <label key={value} className={`rd-reason ${reason === value ? 'rd-reason-on' : ''}`}>
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                  />
                  <span>{text}</span>
                </label>
              ))}
            </div>

            <textarea
              className="rd-details"
              rows={3}
              maxLength={2000}
              placeholder="Add any detail that helps (optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />

            <button type="submit" className="rd-submit" disabled={!reason || saving}>
              {saving ? 'Sending…' : 'Submit report'}
            </button>
          </form>
        )}
      </div>

      <style>{`
        .rd-scrim {
          position: fixed; inset: 0; z-index: 90;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);
          display: flex; align-items: flex-end; justify-content: center;
        }
        @media (min-width: 640px) { .rd-scrim { align-items: center; } }
        .rd-sheet {
          width: 100%; max-width: 460px; max-height: 88vh; overflow-y: auto;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 18px 18px 0 0;
        }
        @media (min-width: 640px) { .rd-sheet { border-radius: 18px; } }
        .rd-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 18px; border-bottom: 1px solid var(--border);
        }
        .rd-title { margin: 0; font-family: var(--font-head); font-weight: 700; font-size: 15.5px; color: var(--ink); }
        .rd-close { color: var(--ink-faint); display: grid; place-items: center; }
        .rd-body { padding: 16px 18px 20px; }
        .rd-note { margin: 0 0 14px; font-size: 13px; color: var(--ink-faint); line-height: 1.6; }
        .rd-error { margin: 0 0 12px; font-size: 13px; color: var(--danger); }
        .rd-reasons { display: flex; flex-direction: column; gap: 2px; margin-bottom: 14px; }
        .rd-reason {
          display: flex; align-items: center; gap: 11px; cursor: pointer;
          padding: 11px 12px; border-radius: 10px; font-size: 13.5px; color: var(--ink-dim);
        }
        .rd-reason-on { background: var(--panel-raised); color: var(--ink); }
        .rd-reason input { accent-color: var(--lemon); width: 16px; height: 16px; }
        .rd-details {
          width: 100%; resize: vertical; padding: 11px 12px; font: inherit; font-size: 13.5px;
          color: var(--ink); background: var(--panel-raised);
          border: 1px solid var(--border); border-radius: 10px; margin-bottom: 14px;
        }
        .rd-submit {
          width: 100%; padding: 12px; border-radius: 999px;
          font-size: 14px; font-weight: 700; background: var(--lemon); color: var(--bg);
        }
        .rd-submit:disabled { opacity: 0.5; }
      `}</style>
    </div>
  )
}
