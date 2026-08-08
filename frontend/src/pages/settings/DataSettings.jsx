import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Trash2 } from 'lucide-react'
import { useAuth } from '../../features/auth/hooks/useAuth.jsx'
import { api } from '../../api/client.js'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'

export default function DataSettings() {
  const { accessToken } = useAuth()
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // The export is small enough to build in one request, so it downloads
  // straight away instead of the "we'll email you a link" flow bigger
  // platforms need.
  async function download() {
    setDownloading(true)
    setError('')
    setDone(false)
    try {
      const data = await api.exportMyData(accessToken)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `elcoral-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setDone(true)
    } catch (err) {
      setError(err.message || 'Could not prepare your download. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <SettingsSubpage title="Data & privacy">
      {error && <p className="set-error" role="alert">{error}</p>}

      <div className="data-card">
        <span className="data-icon"><Download size={20} strokeWidth={1.8} /></span>
        <div className="data-text">
          <p className="data-title">Download your data</p>
          <p className="data-desc">
            A JSON file with your account, profile, posts, settings, reports and block list.
            Passwords and tokens are never included.
          </p>
          <button type="button" className="data-btn" onClick={download} disabled={downloading}>
            {downloading ? 'Preparing…' : 'Download JSON'}
          </button>
          {done && <p className="data-done">Saved to your device.</p>}
        </div>
      </div>

      <div className="data-card data-card-danger">
        <span className="data-icon data-icon-danger"><Trash2 size={20} strokeWidth={1.8} /></span>
        <div className="data-text">
          <p className="data-title">Delete your account</p>
          <p className="data-desc">
            Permanently removes your profile, posts and account. This can't be undone — download your
            data first if you want to keep a copy.
          </p>
          {/* Deletion needs a password confirmation, which already lives on
              the Account screen — linking there beats maintaining two
              copies of the same destructive flow. */}
          <Link to="/home/settings/account" className="data-btn data-btn-danger">Go to account settings</Link>
        </div>
      </div>

      <style>{`
        .data-card {
          display: flex; gap: 14px; align-items: flex-start;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; padding: 16px; margin-bottom: 14px;
        }
        .data-card-danger { border-color: rgba(255,107,74,0.35); }
        .data-icon {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          display: grid; place-items: center;
          background: var(--panel-raised); color: var(--ink-dim);
        }
        .data-icon-danger { color: var(--danger); }
        .data-text { min-width: 0; }
        .data-title { margin: 0; font-family: var(--font-head); font-weight: 700; font-size: 15px; color: var(--ink); }
        .data-desc { margin: 5px 0 12px; font-size: 13px; color: var(--ink-faint); line-height: 1.6; }
        .data-btn {
          display: inline-block; font-size: 13px; font-weight: 700;
          background: var(--lemon); color: var(--bg);
          padding: 9px 15px; border-radius: 999px;
        }
        .data-btn:disabled { opacity: 0.6; }
        .data-btn-danger { background: transparent; color: var(--danger); border: 1px solid var(--danger); }
        .data-done { margin: 10px 0 0; font-size: 12.5px; color: var(--lemon); }
      `}</style>
    </SettingsSubpage>
  )
}
