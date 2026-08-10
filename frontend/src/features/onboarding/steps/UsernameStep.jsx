import { useEffect, useRef, useState } from 'react'
import { Check, X, Loader2, AtSign } from 'lucide-react'
import { useOnboarding } from '../OnboardingContext.jsx'
import { api } from '../../../api/client.js'
import { useAuth } from '../../auth/hooks/useAuth.jsx'
import StepShell from '../components/StepShell.jsx'

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/

export default function UsernameStep({ progress, onNext, onBack }) {
  const { data, update } = useOnboarding()
  const { accessToken } = useAuth()
  const [status, setStatus] = useState('idle') // idle | checking | available | taken | invalid
  const [takenReason, setTakenReason] = useState('')
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)

    if (!data.username) {
      setStatus('idle')
      return
    }
    if (!USERNAME_RE.test(data.username)) {
      setStatus('invalid')
      return
    }

    setStatus('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        // Viewer-aware check: the handle claimed at signup belongs to
        // this account already, so the anonymous endpoint would call it
        // "taken" and block the person on their own username.
        const res = accessToken
          ? await api.usernameAvailableForEdit(data.username, accessToken)
          : await api.usernameAvailable(data.username)
        setTakenReason(res.available ? '' : res.reason || '')
        setStatus(res.available ? 'available' : 'taken')
      } catch {
        setStatus('idle')
      }
    }, 400)

    return () => clearTimeout(debounceRef.current)
  }, [data.username, accessToken])

  return (
    <StepShell
      eyebrow="Almost there"
      title="Choose your username"
      subtitle="This is how people will find and mention you — letters, numbers, and underscores only."
      progress={progress}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={status !== 'available'}
    >
      <div className="username-field">
        <AtSign size={17} className="username-icon" />
        <input
          className="username-input"
          placeholder="username"
          value={data.username}
          onChange={(e) => update({ username: e.target.value.trim() })}
        />
        <StatusIcon status={status} />
      </div>

      {status === 'invalid' && (
        <p className="username-hint hint-error">Only letters, numbers, and underscores — at least 3 characters.</p>
      )}
      {status === 'taken' && (
        <p className="username-hint hint-error">{takenReason || 'That username is already taken.'}</p>
      )}
      {status === 'available' && <p className="username-hint hint-success">Available</p>}

      <style>{`
        .username-field {
          display: flex; align-items: center; gap: 10px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
        }
        .username-field:focus-within { border-color: var(--accent-ink); }
        .username-icon { color: var(--ink-faint); flex-shrink: 0; }
        .username-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 16px; color: var(--ink); font-family: var(--font-body);
        }
        .username-input::placeholder { color: var(--ink-faint); }
        .username-hint { font-size: 13px; margin-top: 8px; }
        .hint-error { color: var(--danger); }
        .hint-success { color: var(--accent-ink); }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </StepShell>
  )
}

function StatusIcon({ status }) {
  if (status === 'checking') return <Loader2 size={17} className="spin" style={{ color: 'var(--ink-faint)' }} />
  if (status === 'available') return <Check size={17} style={{ color: 'var(--lemon)' }} />
  if (status === 'taken' || status === 'invalid') return <X size={17} style={{ color: 'var(--danger)' }} />
  return null
}
