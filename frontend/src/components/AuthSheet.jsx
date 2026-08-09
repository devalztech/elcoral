import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { ApiError } from '../lib/api.js'

export default function AuthSheet({ initialRole = 'client', mode: initialMode = 'signup', onClose }) {
  const [mode, setMode] = useState(initialMode) // 'signup' | 'login'
  const [role, setRole] = useState(initialRole)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const sheetRef = useRef(null)
  const firstFieldRef = useRef(null)
  const { signup, login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    firstFieldRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setFieldErrors((f) => ({ ...f, [field]: undefined }))
  }

  function validate() {
    const errs = {}
    if (mode === 'signup' && form.full_name.trim().length < 2) {
      errs.full_name = 'Enter your full name'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Enter a valid email'
    }
    if (mode === 'signup') {
      if (form.password.length < 10) errs.password = 'At least 10 characters'
      else if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
        errs.password = 'Add an uppercase letter, lowercase letter, and a number'
      }
    } else if (!form.password) {
      errs.password = 'Enter your password'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    setLoading(true)
    try {
      if (mode === 'signup') {
        await signup({ ...form, role })
      } else {
        await login({ email: form.email, password: form.password })
      }
      navigate(`/onboarding/${role}`)
    } catch (err) {
      // TEMP DEBUG: log the raw error so it's visible in Eruda's console —
      // remove once the "something went wrong" bug is found.
      console.error('AuthSheet submit failed:', err)
      if (err instanceof ApiError) setFormError(err.message)
      else setFormError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sheet-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label={mode === 'signup' ? 'Sign up' : 'Log in'}>
        <div className="sheet-grabber" />
        <button className="sheet-close" onClick={onClose} aria-label="Close">×</button>

        <div className="sheet-head">
          <p className="eyebrow">{mode === 'signup' ? 'Join Elcoral' : 'Welcome back'}</p>
          <h2>{mode === 'signup' ? "Let's get you set up" : 'Log in to your account'}</h2>
        </div>

        {mode === 'signup' && (
          <div className="role-toggle" role="tablist" aria-label="I want to">
            <button
              type="button"
              role="tab"
              aria-selected={role === 'client'}
              className={role === 'client' ? 'active' : ''}
              onClick={() => setRole('client')}
            >
              Hire talent
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === 'freelancer'}
              className={role === 'freelancer' ? 'active' : ''}
              onClick={() => setRole('freelancer')}
            >
              Find work
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {mode === 'signup' && (
            <Field
              inputRef={firstFieldRef}
              label="Full name"
              value={form.full_name}
              onChange={(v) => update('full_name', v)}
              error={fieldErrors.full_name}
              autoComplete="name"
            />
          )}
          <Field
            inputRef={mode === 'login' ? firstFieldRef : undefined}
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => update('email', v)}
            error={fieldErrors.email}
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={(v) => update('password', v)}
            error={fieldErrors.password}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            hint={mode === 'signup' ? '10+ characters, with a mix of cases and a number' : undefined}
          />

          {formError && <p className="form-error" role="alert">{formError}</p>}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signup' ? `Create account` : 'Log in'}
          </button>
        </form>

        <p className="sheet-switch">
          {mode === 'signup' ? (
            <>Already have an account? <button type="button" onClick={() => setMode('login')}>Log in</button></>
          ) : (
            <>New to Elcoral? <button type="button" onClick={() => setMode('signup')}>Sign up</button></>
          )}
        </p>
      </div>

      <style>{`
        .sheet-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: flex-end; justify-content: center;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .sheet {
          position: relative;
          width: 100%; max-width: 440px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-bottom: none;
          border-radius: 20px 20px 0 0;
          padding: 12px 24px 28px;
          max-height: 92vh; overflow-y: auto;
          animation: slideUp 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .sheet-grabber {
          width: 36px; height: 4px; border-radius: 999px;
          background: var(--border); margin: 0 auto 8px;
        }
        .sheet-close {
          position: absolute; top: 14px; right: 18px;
          background: none; border: none; color: var(--ink-faint);
          font-size: 26px; line-height: 1; padding: 4px;
        }
        @media (hover: hover) and (pointer: fine) { .sheet-close:hover { color: var(--ink); } }
        .sheet-head { margin: 12px 0 20px; }
        .sheet-head h2 { font-family: var(--font-head); font-size: 24px; font-weight: 700; margin-top: 6px; color: var(--ink); }
        .role-toggle {
          display: flex; background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 12px; padding: 4px; margin-bottom: 22px;
        }
        .role-toggle button {
          flex: 1; border: none; background: transparent; color: var(--ink-dim);
          font-family: var(--font-head); font-weight: 600; font-size: 14px;
          padding: 11px 14px; border-radius: 9px; transition: all 0.15s ease;
        }
        .role-toggle button.active { background: var(--lemon); color: var(--on-accent); }
        .form-error {
          background: rgba(255,107,74,0.1); border: 1px solid rgba(255,107,74,0.3);
          color: var(--danger); font-size: 13.5px; padding: 10px 12px;
          border-radius: 8px; margin: 4px 0 16px;
        }
        .sheet-switch { text-align: center; font-size: 14px; color: var(--ink-faint); margin-top: 18px; }
        .sheet-switch button { background: none; border: none; color: var(--accent-ink); font-weight: 600; font-size: 14px; padding: 0 2px; }

        @media (min-width: 640px) {
          .sheet-overlay { align-items: center; padding: 24px; }
          .sheet { border-radius: 20px; border-bottom: 1px solid var(--border); }
          .sheet-grabber { display: none; }
        }
      `}</style>
    </div>
  )
}

function Field({ label, type = 'text', value, onChange, error, autoComplete, hint, inputRef }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        className={error ? 'invalid' : ''}
      />
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
      <style>{`
        .field { display: block; margin-bottom: 16px; }
        .field-label { display: block; font-size: 13px; font-weight: 600; color: var(--ink-dim); margin-bottom: 6px; }
        .field input {
          width: 100%; background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 10px; padding: 13px 14px; font-size: 15.5px; color: var(--ink);
          font-family: var(--font-body); transition: border-color 0.15s ease;
        }
        .field input:focus { outline: none; border-color: var(--accent-ink); }
        .field input.invalid { border-color: var(--danger); }
        .field-error { display: block; font-size: 12.5px; color: var(--danger); margin-top: 6px; }
        .field-hint { display: block; font-size: 12.5px; color: var(--ink-faint); margin-top: 6px; }
      `}</style>
    </label>
  )
}
