import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { api, ApiError } from '../api/client.js'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('checking') // 'checking' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const tokenId = params.get('token_id')
    const token = params.get('token')

    if (!tokenId || !token) {
      setStatus('error')
      setErrorMessage('This verification link is missing information. Please use the link from your email.')
      return
    }

    api
      .verifyEmail(tokenId, token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error')
        setErrorMessage(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
      })
  }, [params])

  return (
    <div className="verify-shell">
      <div className="verify-card">
        <Link to="/" className="logo">
          <span className="logo-mark">el</span>coral
        </Link>

        {status === 'checking' && (
          <>
            <Loader2 size={40} className="spin icon-neutral" />
            <h1>Verifying your email…</h1>
            <p>This will only take a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={40} className="icon-success" />
            <h1>Email verified</h1>
            <p>Your account is confirmed. You're ready to finish setting up your profile.</p>
            <Link to="/onboarding" className="btn btn-primary btn-block">Continue</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={40} className="icon-error" />
            <h1>Verification failed</h1>
            <p>{errorMessage}</p>
            <Link to="/login" className="btn btn-primary btn-block">Go to log in</Link>
          </>
        )}
      </div>
      <style>{`
        .verify-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .verify-card {
          width: 100%;
          max-width: 400px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 40px 32px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .logo { font-family: var(--font-display); font-weight: 900; font-size: 18px; letter-spacing: -0.02em; color: var(--ink); margin-bottom: 20px; }
        .logo-mark { color: var(--lemon); }
        h1 { font-family: var(--font-head); font-size: 22px; color: var(--ink); margin: 14px 0 4px; }
        p { font-size: 14.5px; margin-bottom: 20px; }
        .icon-neutral { color: var(--ink-faint); }
        .icon-success { color: var(--lemon); }
        .icon-error { color: var(--danger); }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
