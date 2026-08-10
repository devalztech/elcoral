import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/** Labelled input with a leading lucide icon and optional password reveal. */
export function AuthField({
  label,
  icon: Icon,
  hint,
  error,
  type = 'text',
  revealable = false,
  ...props
}) {
  const [revealed, setRevealed] = useState(false)
  const inputType = revealable ? (revealed ? 'text' : 'password') : type

  return (
    <div className="auth-field">
      <label className="auth-label">{label}</label>
      <div className={`auth-input-wrap ${error ? 'has-error' : ''}`}>
        {Icon && <Icon size={17} className="lead-icon" />}
        <input {...props} type={inputType} className="auth-input" />
        {revealable && (
          <button
            type="button"
            className="reveal"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
          >
            {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
      {error ? <p className="auth-hint error">{error}</p> : hint ? <p className="auth-hint">{hint}</p> : null}

      <style>{`
        .auth-field { margin-bottom: 16px; }
        .auth-label {
          display: block;
          font-family: var(--font-head);
          font-size: 13.5px;
          font-weight: 500;
          color: var(--ink-dim);
          margin-bottom: 8px;
        }
        .auth-input-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--panel-raised);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 0 14px;
          height: 50px;
          transition: border-color 0.15s ease;
        }
        .auth-input-wrap:focus-within { border-color: var(--accent-ink); }
        .auth-input-wrap.has-error { border-color: var(--danger); }
        .lead-icon { color: var(--ink-faint); flex-shrink: 0; }
        .auth-input {
          flex: 1;
          min-width: 0;
          background: none;
          border: none;
          outline: none;
          color: var(--ink);
          font-family: var(--font-body);
          font-size: 15px;
        }
        .auth-input::placeholder { color: var(--ink-faint); }
        .reveal { color: var(--ink-faint); display: grid; place-items: center; }
        .reveal:hover { color: var(--accent-ink); }
        .auth-hint { margin: 8px 0 0; font-size: 12.5px; color: var(--ink-faint); }
        .auth-hint.error { color: var(--danger); }
      `}</style>
    </div>
  )
}

/** Google / GitHub style outlined social button. */
export function SocialButton({ provider, label, onClick }) {
  return (
    <button type="button" className="social-btn" onClick={onClick}>
      {provider === 'google' ? <GoogleGlyph /> : <GithubGlyph />}
      <span>{label}</span>
      <style>{`
        .social-btn {
          width: 100%;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: var(--panel-raised);
          border: 1px solid var(--border);
          border-radius: 10px;
          font-family: var(--font-head);
          font-size: 15px;
          font-weight: 600;
          color: var(--ink);
          transition: border-color 0.15s ease, transform 0.15s ease;
        }
        .social-btn:hover { border-color: var(--accent-ink); }
        .social-btn:active { transform: scale(0.99); }
      `}</style>
    </button>
  )
}

function GoogleGlyph() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C36.9 40.3 44 35 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  )
}

function GithubGlyph() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.3 11.3 0 0 1 6 0C17.7 4.6 18.7 5 18.7 5c.6 1.6.2 2.8.1 3.1.8.9 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
    </svg>
  )
}

/** "Join as" selectable account-type card with a radio dot. */
export function ChoiceCard({ icon: Icon, title, body, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`choice ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="choice-top">
        <Icon size={22} className="choice-icon" />
        <span className={`radio ${selected ? 'on' : ''}`} />
      </div>
      <p className="choice-title">{title}</p>
      <p className="choice-body">{body}</p>
      <style>{`
        .choice {
          text-align: left;
          background: var(--panel-raised);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .choice.is-selected {
          border-color: var(--accent-ink);
          background: rgba(196,241,53,0.05);
        }
        .choice-top { display: flex; align-items: center; justify-content: space-between; }
        .choice-icon { color: var(--accent-ink); }
        .radio {
          width: 18px; height: 18px;
          border-radius: 50%;
          border: 1px solid var(--ink-faint);
          display: inline-block;
          position: relative;
        }
        .radio.on { border-color: var(--accent-ink); background: var(--lemon); }
        .radio.on::after {
          content: '';
          position: absolute;
          inset: 5px;
          border-radius: 50%;
          background: var(--bg);
        }
        .choice-title {
          margin: 14px 0 0;
          font-family: var(--font-head);
          font-size: 15px;
          font-weight: 600;
          color: var(--ink);
        }
        .choice-body { margin: 6px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--ink-dim); }
      `}</style>
    </button>
  )
}

/** Horizontal rule with centered label ("or", "Join as"). */
export function AuthDivider({ label }) {
  return (
    <div className="divider">
      <span>{label}</span>
      <style>{`
        .divider {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 22px 0;
          color: var(--ink-dim);
          font-size: 13px;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }
      `}</style>
    </div>
  )
}
