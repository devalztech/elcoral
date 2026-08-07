import { useEffect, useState } from 'react'
import { MailCheck, RotateCw } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.jsx'
import { api, ApiError } from '../../lib/api.js'

export default function CheckEmailStep({ onVerified }) {
  const { user, accessToken, logout, refreshUser } = useAuth()
  const [resent, setResent] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const fresh = await refreshUser(accessToken)
        if (fresh.is_verified) {
          clearInterval(interval)
          onVerified()
        }
      } catch {
        // ignore transient poll failures, just try again next tick
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [accessToken, refreshUser, onVerified])

  async function resend() {
    setError('')
    setResending(true)
    try {
      await api.resendVerification(accessToken)
      setResent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="check-email-step">
      <div className="check-email-icon">
        <MailCheck size={28} />
      </div>
      <p className="eyebrow">One more step</p>
      <h1 className="check-email-title">Verify your email</h1>
      <p className="check-email-sub">
        We sent a confirmation link to <strong>{user?.email}</strong>. Click it to unlock
        onboarding \u2014 this page will pick up automatically once you're verified.
      </p>

      <button className="btn btn-ghost" onClick={resend} disabled={resending} type="button">
        <RotateCw size={15} className={resending ? 'spin' : ''} />
        {resent ? 'Sent again' : resending ? 'Sending\u2026' : 'Resend email'}
      </button>

      {error && <p className="check-email-error">{error}</p>}

      <button className="check-email-logout" onClick={logout} type="button">
        Use a different account
      </button>

      <style>{`
        .check-email-step {
          min-height: 100vh;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: 24px; max-width: 440px; margin: 0 auto;
        }
        .check-email-icon {
          width: 64px; height: 64px; border-radius: 18px;
          background: rgba(196, 241, 53, 0.12);
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--lemon); margin-bottom: 24px;
        }
        .check-email-title {
          font-family: var(--font-display); font-weight: 800;
          font-size: clamp(26px, 5vw, 32px); color: var(--ink);
          margin-top: 8px; letter-spacing: -0.01em;
        }
        .check-email-sub { margin-top: 14px; font-size: 15px; margin-bottom: 28px; }
        .check-email-sub strong { color: var(--ink); }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .check-email-error { font-size: 13px; color: var(--danger); margin-top: 14px; }
        .check-email-logout {
          margin-top: 28px; padding: 8px 0; font-size: 13px; color: var(--ink-faint);
        }
        .check-email-logout:hover { color: var(--ink-dim); }
      `}</style>
    </div>
  )
}
