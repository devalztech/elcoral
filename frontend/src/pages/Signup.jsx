import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Check, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { ApiError } from '../lib/api.js'
import AuthLayout from '../components/AuthLayout.jsx'
import FormField, { TextInput } from '../components/FormField.jsx'

// Mirrors app/schemas/auth.py's SignupRequest.password_strength validator
// exactly, so the UI can show live pass/fail feedback instead of the
// person only finding out after submitting.
const PASSWORD_RULES = [
  { key: 'length', label: 'At least 10 characters', test: (v) => v.length >= 10 },
  { key: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { key: 'digit', label: 'One number', test: (v) => /\d/.test(v) },
]

export default function Signup() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
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
      setFormError('Password does not meet the requirements below.')
      return
    }

    setLoading(true)
    try {
      await signup(form)
      navigate('/onboarding')
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message)
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your account"
      subtitle="Takes about a minute. We'll ask what you're here to do next."
      footer={
        <>
          Already on Elcoral? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FormField label="Full name">
          <TextInput
            type="text"
            autoComplete="name"
            required
            value={form.full_name}
            onChange={(e) => update('full_name', e.target.value)}
          />
        </FormField>
        <FormField label="Email">
          <TextInput
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </FormField>
        <FormField label="Password">
          <TextInput
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onFocus={() => setPasswordFocused(true)}
            onChange={(e) => update('password', e.target.value)}
          />
        </FormField>

        {(passwordFocused || form.password) && (
          <ul className="password-rules">
            {PASSWORD_RULES.map((r) => {
              const pass = r.test(form.password)
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
          {loading ? <Loader2 size={18} className="spin" /> : 'Create account'}
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
        .password-rules li.rule-pass { color: var(--lemon); }
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
