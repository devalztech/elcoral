import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Lock } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Sign in · Elcoral Management'
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      // The backend answers with one generic message whether the email is
      // unknown, the password is wrong, or the account simply isn't an
      // admin — so this screen can't be used to enumerate the admin list.
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-mark"><BadgeCheck size={22} aria-hidden="true" /></div>
        <h1>Elcoral Management</h1>
        <p className="login-sub">Staff access only. Member accounts cannot sign in here.</p>

        {error && <p className="form-error" role="alert">{error}</p>}

        <label className="field">
          <span>Work email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="login-note">
          <Lock size={13} aria-hidden="true" />
          Sessions are short-lived and every action you take is written to the audit log.
        </p>
      </form>
    </div>
  )
}
