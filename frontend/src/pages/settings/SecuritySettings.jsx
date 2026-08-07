import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/hooks/useAuth.jsx'
import { api } from '../../api/client.js'
import FormField, { TextInput } from '../../components/FormField.jsx'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'

// Mirrors the backend rule in app/schemas/auth.py::_check_password_strength.
// Kept in sync manually so the user gets instant feedback instead of a
// round-trip 422.
function passwordProblem(value) {
  if (value.length < 10) return 'Password must be at least 10 characters.'
  if (!/[A-Z]/.test(value)) return 'Password must contain an uppercase letter.'
  if (!/[a-z]/.test(value)) return 'Password must contain a lowercase letter.'
  if (!/\d/.test(value)) return 'Password must contain a number.'
  return null
}

export default function SecuritySettings() {
  const { accessToken, logout } = useAuth()
  const navigate = useNavigate()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function handleSubmit() {
    setError('')
    setNotice('')

    if (!current) {
      setError('Enter your current password.')
      return
    }
    const problem = passwordProblem(next)
    if (problem) {
      setError(problem)
      return
    }
    if (next !== confirm) {
      setError("New passwords don't match.")
      return
    }
    if (next === current) {
      setError('Your new password must be different from your current one.')
      return
    }

    setSaving(true)
    try {
      await api.changePassword(current, next, accessToken)
      setCurrent('')
      setNext('')
      setConfirm('')
      setNotice('Password updated. Signing you back in…')

      // The backend revokes every refresh token on a password change, so
      // this session is intentionally dead — send the user to login
      // rather than leaving them on a page whose next request 401s.
      await logout()
      navigate('/login', { replace: true, state: { notice: 'Password updated. Please sign in again.' } })
    } catch (err) {
      setError(err.message || 'Could not update your password. Please try again.')
      setSaving(false)
    }
  }

  return (
    <SettingsSubpage title="Security">
      <FormField label="Current password">
        <TextInput
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          disabled={saving}
        />
      </FormField>
      <FormField label="New password">
        <TextInput
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          disabled={saving}
        />
      </FormField>
      <FormField label="Confirm new password">
        <TextInput
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          disabled={saving}
        />
      </FormField>

      <p className="hint">
        At least 10 characters, with an uppercase letter, a lowercase letter and a number.
      </p>
      {error && <p className="msg msg-error" role="alert">{error}</p>}
      {notice && <p className="msg msg-ok" role="status">{notice}</p>}

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={handleSubmit}
        disabled={saving}
      >
        {saving ? 'Updating…' : 'Update password'}
      </button>

      <style>{`
        .hint { font-size: 12.5px; color: var(--ink-faint); margin: -6px 0 14px; }
        .msg { font-size: 13px; margin-bottom: 12px; }
        .msg-error { color: var(--danger); }
        .msg-ok { color: var(--ink-dim); }
      `}</style>
    </SettingsSubpage>
  )
}
