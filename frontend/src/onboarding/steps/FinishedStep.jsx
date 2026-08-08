import { PartyPopper } from 'lucide-react'

export default function FinishedStep({ onContinue, completionPct }) {
  return (
    <div className="finished-step">
      <div className="finished-icon">
        <PartyPopper size={28} />
      </div>
      <p className="eyebrow">You're all set</p>
      <h1 className="finished-title">Your profile is live</h1>
      <p className="finished-sub">
        Profile completion: <strong>{completionPct}%</strong>. You can keep building it out anytime from your profile page.
      </p>
      <button className="btn btn-primary btn-lg" onClick={onContinue} type="button">
        Go to your feed
      </button>
      <style>{`
        .finished-step {
          min-height: 100vh;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: 24px; max-width: 440px; margin: 0 auto;
        }
        .finished-icon {
          width: 64px; height: 64px; border-radius: 18px;
          background: rgba(196, 241, 53, 0.12);
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--lemon); margin-bottom: 24px;
        }
        .finished-title {
          font-family: var(--font-display); font-weight: 800;
          font-size: clamp(28px, 5vw, 36px); color: var(--ink);
          margin-top: 8px; letter-spacing: -0.01em;
        }
        .finished-sub { margin-top: 14px; font-size: 15px; margin-bottom: 32px; }
        .finished-sub strong { color: var(--lemon); }
        .btn-lg { padding: 15px 40px; }
      `}</style>
    </div>
  )
}
