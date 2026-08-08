import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, Check, X, CheckCircle2 } from 'lucide-react'
import { api, ApiError } from '../api/client.js'
import AuthLayout from '../features/auth/components/AuthLayout.jsx'
import FormField, { TextInput } from '../components/FormField.jsx'

// Same rules as app/schemas/auth.py's _check_password_strength — kept in
// sync manually with Signup.jsx's identical list.
const PASSWORD_RULES = [
  { key: 'length', label: 'At least 10 characters', test: (v) => v.length >= 10 },
  { key: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { key: 'digit', label: 'One number', test: (v) => /\d/.test(v) },
]

export default function ResetPassword() {
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState('')
  const navigate = useNavigate()

  const tokenId = params.get('token_id')
  const token = params.get('token')
  const passwordValid = PASSWORD_RULES.every((r) => r.test(password))
  const linkMissing = !tokenId || !token

  async function onSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!passwordValid) {
      setFormError('Password does not meet the requirements below.')
      return
    }

    setLoading(true)
    try {
      await api.resetPassword(tokenId, token, password)
      setDone(true)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (linkMissing) {
    return (
      <AuthLayout eyebrow="Reset password" title="Invalid link">
        <p>This reset link is missing information. Please request a new one.</p>
        <Link to="/forgot-password" className="btn btn-primary btn-block" style={{ marginTop: 16 }}>
          Request a new link
        </Link>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout eyebrow="Reset password" title="Password updated">
        <div className="sent-state">
          <CheckCircle2 size={36} className="icon-success" />
          <p>Your password has been changed. All other sessions have been signed out.</p>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/login')}>
            Log in
          </button>
        </div>
        <style>{`
          .sent-state { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
          .icon-success { color: var(--accent-ink); }
        `}</style>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout eyebrow="Reset password" title="Choose a new password">
      <form onSubmit={onSubmit} noValidate>
        <FormField label="New password">
          <TextInput
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onFocus={() => setPasswordFocused(true)}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>

        {(passwordFocused || password) && (
          <ul className="password-rules">
            {PASSWORD_RULES.map((r) => {
              const pass = r.test(password)
              return (
                <li key={r.key} className={pass ? 'rule-pass' : ''}>
                  {pass ? <Check size={14} /> : <X size={14} />}
                  {r.label}
                </li>
              )
            })}
          </ul>
        )}

        {formError && <p className="form-error">{formError}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : 'Update password'}
        </button>
      </form>
      <style>{`
        .password-rules {
          list-style: none;
          margin: -8px 0 18px;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .password-rules li {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12.5px;
          color: var(--ink-faint);
        }
        .password-rules li.rule-pass { color: var(--accent-ink); }
        .form-error {
          font-size: 13.5px;
          color: var(--danger);
          background: rgba(255, 107, 74, 0.1);
          border: 1px solid rgba(255, 107, 74, 0.25);
          border-radius: 8px;
          padding: 10px 12px;
          margin: 0 0 16px;
        }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AuthLayout>
  )
}
