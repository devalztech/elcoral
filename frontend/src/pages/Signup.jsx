import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, User, AtSign, Mail, Lock, Building2 } from 'lucide-react'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { ApiError } from '../api/client.js'
import AuthLayout from '../features/auth/components/AuthLayout.jsx'
import { AuthField, SocialButton, ChoiceCard, AuthDivider } from '../features/auth/components/AuthUI.jsx'

// Mirrors app/schemas/auth.py's SignupRequest.password_strength validator.
const PASSWORD_RULES = [
  { key: 'length', test: (v) => v.length >= 8 },
  { key: 'letter', test: (v) => /[A-Za-z]/.test(v) },
  { key: 'digit', test: (v) => /\d/.test(v) },
]

export default function Signup() {
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [accountType, setAccountType] = useState('individual')
  const [agreed, setAgreed] = useState(false)
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const passwordValid = PASSWORD_RULES.every((r) => r.test(form.password))

  async function onSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!passwordValid) {
      setFormError('Use at least 8 characters with letters and numbers.')
      return
    }
    if (form.password !== form.confirm) {
      setFormError('Passwords do not match.')
      return
    }
    if (!agreed) {
      setFormError('Please accept the Terms of Service and Privacy Policy.')
      return
    }

    setLoading(true)
    try {
      await signup({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        username: form.username || undefined,
        account_type: accountType,
      })
      navigate('/onboarding')
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
      brandTitle="Create your account and join"
      brandBody="Connect with amazing people, collaborate on projects and discover opportunities that help you grow."
      title="Create your account"
      subtitle="It's free and only takes a minute."
    >
      <div className="social-stack">
        <SocialButton provider="google" label="Sign up with Google" />
        <SocialButton provider="github" label="Sign up with GitHub" />
      </div>

      <AuthDivider label="or" />

      <form onSubmit={onSubmit} noValidate>
        <AuthField
          label="Full name"
          icon={User}
          placeholder="Enter your full name"
          autoComplete="name"
          required
          value={form.full_name}
          onChange={(e) => update('full_name', e.target.value)}
        />
        <AuthField
          label="Username"
          icon={AtSign}
          placeholder="Choose a username"
          autoComplete="username"
          hint="This will be your unique Elcoral profile link."
          value={form.username}
          onChange={(e) => update('username', e.target.value.replace(/\s/g, '').toLowerCase())}
        />
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
          placeholder="Create a password"
          autoComplete="new-password"
          required
          hint="At least 8 characters with letters and numbers."
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
        />
        <AuthField
          label="Confirm password"
          icon={Lock}
          revealable
          placeholder="Confirm your password"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={(e) => update('confirm', e.target.value)}
        />

        <label className="terms">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="box" aria-hidden="true" />
          <span className="terms-text">
            I agree to Elcoral's <Link to="/terms">Terms of Service</Link> and{' '}
            <Link to="/privacy">Privacy Policy</Link>
          </span>
        </label>

        {formError && <p className="form-error">{formError}</p>}

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : 'Create account'}
        </button>

        <p className="switch-line">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>

      <AuthDivider label="Join as" />

      <div className="join-as">
        <ChoiceCard
          icon={User}
          title="Individual"
          body="For individuals looking to connect and grow"
          selected={accountType === 'individual'}
          onSelect={() => setAccountType('individual')}
        />
        <ChoiceCard
          icon={Building2}
          title="Organization"
          body="For teams and companies recruiting or collaborating"
          selected={accountType === 'organization'}
          onSelect={() => setAccountType('organization')}
        />
      </div>

      <style>{`
        .social-stack { display: flex; flex-direction: column; gap: 12px; margin-top: 26px; }
        .terms {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin: 6px 0 20px;
          cursor: pointer;
        }
        .terms input { position: absolute; opacity: 0; width: 0; height: 0; }
        .terms .box {
          width: 18px; height: 18px;
          border-radius: 5px;
          border: 1px solid var(--lemon);
          flex-shrink: 0;
          margin-top: 1px;
          position: relative;
          transition: background 0.15s ease;
        }
        .terms input:checked + .box { background: var(--lemon); }
        .terms input:checked + .box::after {
          content: '';
          position: absolute;
          left: 5px; top: 1px;
          width: 5px; height: 10px;
          border: solid var(--bg);
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        .terms-text { font-size: 13px; line-height: 1.5; color: var(--ink-dim); }
        .terms-text a { color: var(--lemon); }
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
        .switch-line {
          margin: 18px 0 0;
          text-align: center;
          font-size: 13.5px;
          color: var(--ink-dim);
        }
        .switch-line a { color: var(--lemon); font-weight: 600; }
        .join-as { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
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
        @media (max-width: 480px) {
          .join-as { grid-template-columns: 1fr; }
        }
      `}</style>
    </AuthLayout>
  )
}
