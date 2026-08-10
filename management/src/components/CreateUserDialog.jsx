import { useState } from 'react'
import { X } from 'lucide-react'
import { adminApi } from '../api/client.js'

const ACCOUNT_TYPES = [
  { value: 'creative', label: 'Creative' },
  { value: 'business', label: 'Business' },
  { value: 'recruiter', label: 'Recruiter' },
]

export default function CreateUserDialog({ onClose, onCreated, canCreateAdmins }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    username: '',
    account_type: 'creative',
    mark_email_verified: true,
    grant_badge: false,
    role: 'user',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminApi.createUser({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        username: form.username.trim() || null,
        account_type: form.account_type,
        mark_email_verified: form.mark_email_verified,
        grant_badge: form.grant_badge,
        roles: form.role === 'user' ? [] : [form.role],
      })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create user">
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <h2>New user</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <label className="field">
          <span>Full name</span>
          <input required maxLength={80} value={form.full_name} onChange={set('full_name')} />
        </label>

        <label className="field">
          <span>Email</span>
          <input type="email" required value={form.email} onChange={set('email')} />
        </label>

        <label className="field">
          <span>Temporary password</span>
          <input
            type="text"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
            autoComplete="off"
          />
          <small>At least 8 characters. Share it with the member and ask them to change it after their first sign-in.</small>
        </label>

        <div className="field-row">
          <label className="field">
            <span>Username (optional)</span>
            <input value={form.username} onChange={set('username')} maxLength={30} placeholder="letters, numbers, _" />
          </label>

          <label className="field">
            <span>Account type</span>
            <select value={form.account_type} onChange={set('account_type')}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Role</span>
          <select value={form.role} onChange={set('role')}>
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin" disabled={!canCreateAdmins}>Admin</option>
            <option value="superadmin" disabled={!canCreateAdmins}>Superadmin</option>
          </select>
          {!canCreateAdmins && <small>Only a superadmin can create staff accounts.</small>}
        </label>

        <label className="check">
          <input type="checkbox" checked={form.mark_email_verified} onChange={set('mark_email_verified')} />
          <span>Mark the email as already confirmed (skips the confirmation email)</span>
        </label>

        <label className="check">
          <input type="checkbox" checked={form.grant_badge} onChange={set('grant_badge')} />
          <span>Grant the verification badge straight away</span>
        </label>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </div>
  )
}
