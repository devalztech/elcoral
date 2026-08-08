import { Sparkles } from 'lucide-react'

export default function WelcomeStep({ onNext, fullName }) {
  return (
    <div className="welcome-step">
      <div className="welcome-icon">
        <Sparkles size={28} />
      </div>
      <p className="eyebrow">You're in</p>
      <h1 className="welcome-title">Welcome to Elcoral{fullName ? `, ${fullName.split(' ')[0]}` : ''}</h1>
      <p className="welcome-sub">
        Let's build your professional identity. A few quick steps — what you're here to do,
        what you're building, and who you are. Takes about two minutes.
      </p>
      <button className="btn btn-primary btn-lg" onClick={onNext} type="button">
        Let's go
      </button>
      <style>{`
        .welcome-step {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
          max-width: 440px;
          margin: 0 auto;
        }
        .welcome-icon {
          width: 64px; height: 64px;
          border-radius: 18px;
          background: rgba(196, 241, 53, 0.12);
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--accent-ink);
          margin-bottom: 24px;
        }
        .welcome-title {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: clamp(28px, 5vw, 36px);
          color: var(--ink);
          margin-top: 8px;
          letter-spacing: -0.01em;
        }
        .welcome-sub { margin-top: 14px; font-size: 15px; margin-bottom: 32px; }
        .btn-lg { padding: 15px 40px; }
      `}</style>
    </div>
  )
}
