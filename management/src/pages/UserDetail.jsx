import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, ShieldOff, Trash2 } from 'lucide-react'
import { adminApi } from '../api/client.js'
import Spinner from '../components/Spinner.jsx'
import { useAuth } from '../auth/AuthContext.jsx'

const ROLE_OPTIONS = ['moderator', 'admin', 'superadmin']

export default function UserDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { admin, isSuperadmin } = useAuth()
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [role, setRole] = useState('moderator')

  const load = useCallback(() => {
    adminApi.getUser(userId).then(setUser).catch((e) => setError(e.message))
  }, [userId])

  useEffect(() => {
    document.title = 'User · Elcoral Management'
    load()
  }, [load])

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      const updated = await fn()
      if (updated) setUser(updated)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    // Deletion is irreversible and cascades to posts, messages and
    // everything else the account owns, so it asks for the email to be
    // typed rather than a one-click confirm.
    const typed = window.prompt(
      `This permanently deletes ${user.email} and everything they posted. Type their email to confirm.`,
    )
    if (typed?.trim().toLowerCase() !== user.email.toLowerCase()) return
    await run(async () => {
      await adminApi.deleteUser(user.id)
      navigate('/users', { replace: true })
      return null
    })
  }

  if (error && !user) return <p className="form-error" role="alert">{error}</p>
  if (!user) return <Spinner page label="Loading user" />

  const isSelf = admin?.id === user.id

  return (
    <>
      <Link to="/users" className="back-link"><ArrowLeft size={15} /> All users</Link>

      <header className="page-head page-head-row">
        <div className="detail-id">
          <span className="avatar avatar-lg" aria-hidden="true">
            {user.photo_url ? <img src={user.photo_url} alt="" /> : (user.full_name || '?').charAt(0)}
          </span>
          <div>
            <h1>
              {user.full_name}
              {user.is_badge_verified && <BadgeCheck size={18} className="tick" aria-label="Verified" />}
            </h1>
            <p>{user.username ? `@${user.username} · ` : ''}{user.email}</p>
          </div>
        </div>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="panel-grid">
        <section className="panel">
          <h2>Verification badge</h2>
          <p>
            {user.is_badge_verified
              ? `Granted ${new Date(user.badge_verified_at).toLocaleString()}.`
              : 'This account has no badge.'}
          </p>
          <p className="muted">
            Their email is {user.is_email_verified ? 'confirmed' : 'unconfirmed'} — which has no bearing on the
            badge either way.
          </p>
          {user.is_badge_verified ? (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => run(() => adminApi.revokeBadge(user.id))}>
              <ShieldOff size={15} /> Remove badge
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => adminApi.grantBadge(user.id, null))}>
              <BadgeCheck size={15} /> Grant badge
            </button>
          )}
        </section>

        <section className="panel">
          <h2>Roles</h2>
          <p>{user.roles.length ? user.roles.join(', ') : 'user (default)'}</p>
          {isSuperadmin ? (
            <>
              <div className="field-row">
                <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role to grant">
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button type="button" className="btn" disabled={busy} onClick={() => run(() => adminApi.grantRole(user.id, role))}>
                  Grant
                </button>
              </div>
              <div className="chip-row">
                {user.roles.map((r) => (
                  <button key={r} type="button" className="chip chip-role chip-btn" disabled={busy} onClick={() => run(() => adminApi.revokeRole(user.id, r))}>
                    {r} ✕
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Only a superadmin can change roles.</p>
          )}
        </section>

        <section className="panel">
          <h2>Account status</h2>
          <p>{user.is_active ? 'Active.' : 'Suspended — they cannot sign in and their sessions were revoked.'}</p>
          <button
            type="button"
            className="btn"
            disabled={busy || isSelf}
            onClick={() => run(() => adminApi.setActive(user.id, !user.is_active))}
          >
            {user.is_active ? 'Suspend account' : 'Restore account'}
          </button>
          {isSelf && <p className="muted">You can't suspend your own account.</p>}
        </section>

        <section className="panel panel-danger">
          <h2>Delete account</h2>
          <p>Removes the account and everything attached to it. This cannot be undone.</p>
          <button type="button" className="btn btn-danger" disabled={busy || isSelf} onClick={remove}>
            <Trash2 size={15} /> Delete permanently
          </button>
        </section>
      </div>
    </>
  )
}
