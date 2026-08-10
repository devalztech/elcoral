import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/hooks/useAuth.jsx'
import { api } from '../../api/client.js'
import FormField, { TextInput } from '../../components/FormField.jsx'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'

export default function AccountSettings() {
  const { user, accessToken, refreshUser, logout } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Delete-account confirmation
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // The session restores asynchronously on a hard refresh, so seed the
  // inputs whenever the user object arrives rather than only on mount.
  useEffect(() => {
    if (!user) return
    setFullName(user.full_name ?? '')
    setEmail(user.email ?? '')
  }, [user])

  const emailChanged = !!user && email.trim().toLowerCase() !== (user.email ?? '').toLowerCase()
  const nameChanged = !!user && fullName.trim() !== (user.full_name ?? '')
  const dirty = emailChanged || nameChanged

  async function handleSave() {
    setError('')
    setNotice('')

    if (fullName.trim().length < 2) {
      setError('Please enter your full name.')
      return
    }
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    // Only send what actually changed — the backend re-sends a
    // verification email on any email change, so an unchanged address
    // must not be included.
    const payload = {}
    if (nameChanged) payload.full_name = fullName.trim()
    if (emailChanged) payload.email = email.trim()

    setSaving(true)
    try {
      await api.updateAccount(payload, accessToken)
      await refreshUser(accessToken)
      setNotice(
        emailChanged
          ? 'Saved. Check your new inbox to verify the address.'
          : 'Your changes have been saved.',
      )
    } catch (err) {
      setError(err.message || 'Could not save your changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleteError('')
    if (!password) {
      setDeleteError('Enter your password to confirm.')
      return
    }
    setDeleting(true)
    try {
      await api.deleteAccount(password, accessToken)
      await logout()
      navigate('/', { replace: true })
    } catch (err) {
      setDeleteError(err.message || 'Could not delete your account. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <SettingsSubpage title="Account">
      <FormField label="Full name">
        <TextInput
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          disabled={saving}
        />
      </FormField>
      <FormField label="Email">
        <TextInput
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          disabled={saving}
        />
      </FormField>

      {emailChanged && (
        <p className="hint">
          You'll need to verify your new email address before it's confirmed.
        </p>
      )}
      {error && <p className="msg msg-error" role="alert">{error}</p>}
      {notice && <p className="msg msg-ok" role="status">{notice}</p>}

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={handleSave}
        disabled={saving || !dirty}
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>

      <div className="danger-zone">
        <h2>Danger zone</h2>
        {!confirming ? (
          <button
            type="button"
            className="btn btn-ghost btn-block danger-btn"
            onClick={() => setConfirming(true)}
          >
            Delete account
          </button>
        ) : (
          <div className="confirm">
            <p className="confirm-text">
              This permanently deletes your profile, posts and account. This can't be undone.
            </p>
            <FormField label="Confirm your password">
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={deleting}
              />
            </FormField>
            {deleteError && <p className="msg msg-error" role="alert">{deleteError}</p>}
            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setConfirming(false); setPassword(''); setDeleteError('') }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-ghost danger-btn"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .hint { font-size: 12.5px; color: var(--ink-faint); margin: -6px 0 14px; }
        .msg { font-size: 13px; margin-bottom: 12px; }
        .msg-error { color: var(--danger); }
        .msg-ok { color: var(--ink-dim); }
        .danger-zone { margin-top: 36px; padding-top: 24px; border-top: 1px solid var(--border); }
        .danger-zone h2 { font-family: var(--font-head); font-size: 14px; font-weight: 600; color: var(--danger); margin-bottom: 12px; }
        .danger-btn { border-color: var(--danger); color: var(--danger); }
        .danger-btn:hover { background: rgba(255,107,74,0.1); }
        .confirm-text { font-size: 13px; color: var(--ink-dim); margin-bottom: 14px; }
        .confirm-actions { display: flex; gap: 10px; }
        .confirm-actions .btn { flex: 1; }
      `}</style>
    </SettingsSubpage>
  )
}
