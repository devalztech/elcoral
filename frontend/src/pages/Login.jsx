import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { ApiError } from '../api/client.js'
import AuthLayout from '../features/auth/components/AuthLayout.jsx'
import FormField, { TextInput } from '../components/FormField.jsx'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
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
      eyebrow="Welcome back"
      title="Log in"
      footer={
        <>
          New to Elcoral? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
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
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
          />
        </FormField>
        <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>

        {formError && <p className="form-error">{formError}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <Loader2 size={18} className="spin" /> : 'Log in'}
        </button>
      </form>
      <style>{`
        .forgot-link {
          display: block;
          font-size: 13px;
          color: var(--ink-faint);
          text-align: right;
          margin: -10px 0 20px;
        }
        .forgot-link:hover { color: var(--lemon); }
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
