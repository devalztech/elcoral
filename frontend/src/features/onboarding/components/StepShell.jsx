import { ArrowLeft } from 'lucide-react'

export default function StepShell({
  eyebrow,
  title,
  subtitle,
  progress,
  children,
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled = false,
  nextLoading = false,
  showBack = true,
}) {
  return (
    <div className="step-shell">
      <div className="step-topbar">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-label">{progress}% complete</span>
      </div>

      <div className="step-content">
        {showBack && (
          <button className="back-btn" onClick={onBack} type="button" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
        )}
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="step-title">{title}</h1>
        {subtitle && <p className="step-subtitle">{subtitle}</p>}

        <div className="step-body">{children}</div>

        <div className="step-actions">
          <button
            className="btn btn-primary btn-block"
            onClick={onNext}
            disabled={nextDisabled || nextLoading}
            type="button"
          >
            {nextLoading ? 'Saving…' : nextLabel}
          </button>
        </div>
      </div>

      <style>{`
        .step-shell { min-height: 100vh; display: flex; flex-direction: column; }
        .step-topbar {
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 14px;
          border-bottom: 1px solid var(--border);
        }
        .progress-track {
          flex: 1;
          height: 6px;
          background: var(--panel);
          border-radius: 999px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: var(--lemon);
          border-radius: 999px;
          transition: width 0.35s ease;
        }
        .progress-label {
          font-family: var(--font-head);
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink-faint);
          white-space: nowrap;
        }
        .step-content {
          flex: 1;
          max-width: 560px;
          width: 100%;
          margin: 0 auto;
          padding: 40px 24px 32px;
          display: flex;
          flex-direction: column;
        }
        .back-btn {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 999px;
          border: 1px solid var(--border);
          color: var(--ink-dim);
          margin-bottom: 20px;
        }
        .back-btn:hover { border-color: var(--accent-ink); color: var(--ink); }
        .step-title {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: clamp(26px, 4vw, 32px);
          color: var(--ink);
          margin-top: 8px;
          letter-spacing: -0.01em;
        }
        .step-subtitle { margin-top: 8px; font-size: 14.5px; }
        .step-body { margin-top: 28px; flex: 1; }
        .step-actions { margin-top: 32px; }
      `}</style>
    </div>
  )
}
