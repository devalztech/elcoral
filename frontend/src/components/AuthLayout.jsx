import { Link } from 'react-router-dom'

// Shared shell for /login and /signup — split layout, brand panel on one
// side (reinforces what Elcoral is while someone's mid-signup), form on
// the other. Keeps both pages visually consistent without duplicating
// the chrome in each.
export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <Link to="/" className="logo">
          <span className="logo-mark">el</span>coral
        </Link>
        <div className="auth-brand-copy">
          <p className="eyebrow">A professional ecosystem</p>
          <h2>Defined by what you're trying to build \u2014 not your job title.</h2>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </div>
      <style>{`
        .auth-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .auth-brand {
          background: var(--panel);
          border-right: 1px solid var(--border);
          padding: 48px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .logo { font-family: var(--font-display); font-weight: 900; font-size: 20px; letter-spacing: -0.02em; color: var(--ink); }
        .logo-mark { color: var(--lemon); }
        .auth-brand-copy h2 {
          font-family: var(--font-head);
          font-weight: 600;
          font-size: clamp(24px, 2.6vw, 32px);
          line-height: 1.25;
          color: var(--ink);
          margin-top: 12px;
          max-width: 420px;
        }
        .auth-form-side {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
        }
        .auth-form-wrap { width: 100%; max-width: 380px; }
        .auth-title {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 32px;
          color: var(--ink);
          margin-top: 8px;
        }
        .auth-subtitle { margin-top: 8px; font-size: 14.5px; }
        .auth-footer { margin-top: 28px; font-size: 14px; color: var(--ink-dim); text-align: center; }
        .auth-footer a { color: var(--lemon); font-weight: 600; }
        @media (max-width: 900px) {
          .auth-shell { grid-template-columns: 1fr; }
          .auth-brand { display: none; }
        }
      `}</style>
    </div>
  )
}
