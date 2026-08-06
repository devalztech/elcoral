import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, MailCheck } from 'lucide-react'
import { api, ApiError } from '../lib/api.js'
import AuthLayout from '../components/AuthLayout.jsx'
import FormField, { TextInput } from '../components/FormField.jsx'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setFormError('')
    setLoading(true)
    try {
      await api.forgotPassword(email)
      // Always show the same "check your email" state, whether or not the
      // account exists — mirrors the backend's account-enumeration
      // protection (see forgot_password in app/routers/auth.py).
      setSent(true)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout eyebrow="Check your inbox" title="Reset link sent">
        <div className="sent-state">
          <MailCheck size={36} className="icon-success" />
          <p>
            If an account exists for <strong>{email}</strong>, we've sent a link to reset your
            password. It expires in 1 hour.
          </p>
          <Link to="/login" className="btn btn-primary btn-block">Back to log in</Link>
        </div>
        <style>{`
          .sent-state { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
          .icon-success { color: var(--lemon); }
        `}</style>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Forgot password"
      title="Reset your password"
      subtitle="Enter the email on your account and we'll send you a reset link."
      footer={
        <>
          Remembered it? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FormField label="Email">
          <TextInput
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>

        {formError && <p className="form-error">{formError}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : 'Send reset link'}
        </button>
      </form>
      <style>{`
        .form-error {
          font-size: 13.5px;
          color: var(--danger);
          background: rgba(255, 107, 74, 0.1);
          border: 1px solid rgba(255, 107, 74, 0.25);
          border-radius: 8px;
          padding: 10px 12px;
          margin: -4px 0 16px;
        }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AuthLayout>
  )
}
