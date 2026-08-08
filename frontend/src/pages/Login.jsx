import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Mail, Lock } from 'lucide-react'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { ApiError } from '../api/client.js'
import AuthLayout from '../features/auth/components/AuthLayout.jsx'
import { AuthField, SocialButton, AuthDivider } from '../features/auth/components/AuthUI.jsx'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [remember, setRemember] = useState(true)
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setFormError('')
    setLoading(true)
    try {
      await login(form)
      navigate('/home')
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      badge="Welcome back to the community"
      brandTitle="Log back in and keep building on"
      brandBody="Pick up where you left off — your projects, communities and opportunities are waiting."
      title="Welcome back"
      subtitle="Log in to continue with Elcoral."
    >
      <div className="social-stack">
        <SocialButton provider="google" label="Log in with Google" />
        <SocialButton provider="github" label="Log in with GitHub" />
      </div>

      <AuthDivider label="or" />

      <form onSubmit={onSubmit} noValidate>
        <AuthField
          label="Email address"
          icon={Mail}
          type="email"
          placeholder="Enter your email address"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
        />
        <AuthField
          label="Password"
          icon={Lock}
          revealable
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
        />

        <div className="row">
          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span className="box" aria-hidden="true" />
            <span>Remember me</span>
          </label>
          <Link to="/forgot-password" className="forgot">Forgot password?</Link>
        </div>

        {formError && <p className="form-error">{formError}</p>}

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : 'Log in'}
        </button>

        <p className="switch-line">
          New to Elcoral? <Link to="/signup">Create an account</Link>
        </p>
      </form>

      <style>{`
        .social-stack { display: flex; flex-direction: column; gap: 12px; margin-top: 26px; }
        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 4px 0 22px;
        }
        .remember { display: flex; align-items: center; gap: 9px; font-size: 13px; color: var(--ink-dim); cursor: pointer; }
        .remember input { position: absolute; opacity: 0; width: 0; height: 0; }
        .remember .box {
          width: 18px; height: 18px;
          border-radius: 5px;
          border: 1px solid var(--lemon);
          position: relative;
          flex-shrink: 0;
        }
        .remember input:checked + .box { background: var(--lemon); }
        .remember input:checked + .box::after {
          content: '';
          position: absolute;
          left: 5px; top: 1px;
          width: 5px; height: 10px;
          border: solid var(--bg);
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        .forgot { font-size: 13px; color: var(--lemon); font-weight: 600; }
        .submit-btn {
          width: 100%;
          height: 54px;
          border-radius: 10px;
          background: var(--lemon);
          color: #0B0D0A;
          font-family: var(--font-head);
          font-size: 16px;
          font-weight: 700;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .submit-btn:hover:not(:disabled) { background: var(--ink); }
        .submit-btn:active { transform: scale(0.99); }
        .submit-btn:disabled { opacity: 0.7; cursor: default; }
        .switch-line { margin: 18px 0 0; text-align: center; font-size: 13.5px; color: var(--ink-dim); }
        .switch-line a { color: var(--lemon); font-weight: 600; }
        .form-error {
          font-size: 13.5px;
          color: var(--danger);
          background: rgba(255, 107, 74, 0.1);
          border: 1px solid rgba(255, 107, 74, 0.25);
          border-radius: 10px;
          padding: 10px 12px;
          margin: 0 0 16px;
        }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AuthLayout>
  )
}
