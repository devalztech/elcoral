import { useEffect, useState } from 'react'
import { UserX } from 'lucide-react'
import { useAuth } from '../../features/auth/hooks/useAuth.jsx'
import { api } from '../../api/client.js'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'

function initialsOf(name) {
  if (!name) return 'EL'
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'EL'
}

export default function BlockedSettings() {
  const { accessToken, authLoading } = useAuth()
  const [blocked, setBlocked] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [username, setUsername] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    if (authLoading || !accessToken) return
    let cancelled = false
    api
      .listBlockedUsers(accessToken)
      .then((list) => { if (!cancelled) setBlocked(list) })
      .catch(() => { if (!cancelled) setError('Could not load your blocked list.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [accessToken, authLoading])

  async function block(e) {
    e.preventDefault()
    const handle = username.trim().replace(/^@/, '')
    if (!handle) return
    setAdding(true)
    setError('')
    try {
      const entry = await api.blockUser(handle, accessToken)
      setBlocked((list) => [entry, ...list])
      setUsername('')
    } catch (err) {
      setError(err.message || 'Could not block that person.')
    } finally {
      setAdding(false)
    }
  }

  async function unblock(userId) {
    setBusyId(userId)
    setError('')
    try {
      await api.unblockUser(userId, accessToken)
      setBlocked((list) => list.filter((b) => b.user_id !== userId))
    } catch (err) {
      setError(err.message || 'Could not unblock that person.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <SettingsSubpage title="Blocked users">
      <p className="set-intro">
        Blocking hides your profile from them and theirs from you, in both directions.
      </p>

      <form className="block-form" onSubmit={block}>
        <input
          className="block-input"
          placeholder="Block by username, e.g. @amina"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-label="Username to block"
        />
        <button type="submit" className="block-btn" disabled={adding || !username.trim()}>
          {adding ? 'Blocking…' : 'Block'}
        </button>
      </form>

      {error && <p className="set-error" role="alert">{error}</p>}

      {loading && <p className="set-loading">Loading…</p>}

      {!loading && blocked.length === 0 && (
        <div className="block-empty">
          <UserX size={22} />
          <p className="block-empty-title">No one is blocked</p>
          <p className="block-empty-desc">People you block will show up here.</p>
        </div>
      )}

      {blocked.map((b) => (
        <div className="block-row" key={b.user_id}>
          <span className="block-avatar">
            {b.photo_url ? <img src={b.photo_url} alt="" /> : <span>{initialsOf(b.full_name)}</span>}
          </span>
          <span className="block-text">
            <span className="block-name">{b.full_name}</span>
            {b.username && <span className="block-handle">@{b.username}</span>}
          </span>
          <button
            type="button"
            className="block-undo"
            disabled={busyId === b.user_id}
            onClick={() => unblock(b.user_id)}
          >
            {busyId === b.user_id ? '…' : 'Unblock'}
          </button>
        </div>
      ))}

      <style>{`
        .block-form { display: flex; gap: 8px; margin-bottom: 16px; }
        .block-input {
          flex: 1; background: var(--panel); border: 1px solid var(--border);
          border-radius: 10px; padding: 11px 13px; font-size: 14px; color: var(--ink);
          font-family: var(--font-body);
        }
        .block-btn {
          background: var(--lemon); color: var(--bg); font-weight: 700; font-size: 13.5px;
          padding: 0 16px; border-radius: 10px;
        }
        .block-btn:disabled { opacity: 0.5; }
        .block-empty {
          text-align: center; padding: 30px 16px; color: var(--ink-faint);
          background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
        }
        .block-empty-title { margin: 10px 0 0; font-weight: 700; color: var(--ink); font-size: 14.5px; }
        .block-empty-desc { margin: 4px 0 0; font-size: 13px; }
        .block-row {
          display: flex; align-items: center; gap: 12px;
          padding: 13px 0; border-bottom: 1px solid var(--border);
        }
        .block-avatar {
          width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
          display: grid; place-items: center;
          background: var(--panel-raised); color: var(--ink-dim);
          font-size: 13px; font-weight: 700;
        }
        .block-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .block-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
        .block-name { font-size: 14.5px; font-weight: 600; color: var(--ink); }
        .block-handle { font-size: 12.5px; color: var(--ink-faint); }
        .block-undo {
          font-size: 12.5px; font-weight: 700; color: var(--ink);
          border: 1px solid var(--border); border-radius: 999px; padding: 7px 13px;
        }
        .block-undo:disabled { opacity: 0.5; }
      `}</style>
    </SettingsSubpage>
  )
}
