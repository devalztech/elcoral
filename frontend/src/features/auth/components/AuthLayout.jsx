import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Users, Briefcase, Rocket, Quote } from 'lucide-react'
import ElcoralMark from '../../../components/ElcoralMark.jsx'
import NetworkGraphic from './NetworkGraphic.jsx'

const HIGHLIGHTS = [
  {
    icon: Users,
    title: 'Build meaningful connections',
    body: 'Meet and collaborate with professionals around the world.',
  },
  {
    icon: Briefcase,
    title: 'Discover opportunities',
    body: 'Find jobs, projects and collaborations that match your skills.',
  },
  {
    icon: Rocket,
    title: 'Grow your career',
    body: 'Learn, share and grow with communities that inspire you.',
  },
]

/**
 * Split auth shell used by /signup and /login.
 * Left: brand story panel (badge, headline, network graphic, highlights,
 * testimonial, lemon wave glow). Right: the actual form column.
 * On mobile the brand panel collapses to just the logo + headline so the
 * form is immediately reachable without scrolling past marketing copy.
 */
export default function AuthLayout({
  badge = 'Join thousands of builders and creators',
  brandTitle,
  brandTitleAccent = 'Elcoral',
  brandBody,
  title,
  subtitle,
  children,
  backTo = '/',
}) {
  const navigate = useNavigate()

  return (
    <div className="auth-page">
      <div className="auth-shell">
        {/* ---------- brand panel ---------- */}
        <aside className="auth-brand">
          <Link to="/" className="brand-logo">
            <ElcoralMark size={34} color="var(--lemon)" />
            <span>Elcoral</span>
          </Link>

          <div className="brand-badge">
            <Users size={15} />
            <span>{badge}</span>
          </div>

          <h2 className="brand-title">
            {brandTitle} <span className="accent">{brandTitleAccent}</span>
          </h2>
          <p className="brand-body">{brandBody}</p>

          <div className="brand-graphic">
            <NetworkGraphic />
          </div>

          <div className="brand-card">
            {HIGHLIGHTS.map(({ icon: Icon, title: t, body }) => (
              <div className="highlight" key={t}>
                <Icon size={22} className="highlight-icon" />
                <div>
                  <p className="highlight-title">{t}</p>
                  <p className="highlight-body">{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="brand-card testimonial">
            <Quote size={20} className="quote-mark" />
            <p className="quote-text">
              Elcoral helped me find the right people and opportunities to turn my ideas into
              reality.
            </p>
            <div className="quote-author">
              <span className="avatar">DC</span>
              <div>
                <p className="author-name">David Chen</p>
                <p className="author-role">Full Stack Developer</p>
              </div>
            </div>
          </div>

          <div className="brand-wave" aria-hidden="true" />
        </aside>

        {/* ---------- form panel ---------- */}
        <main className="auth-form-side">
          <button type="button" className="back-btn" onClick={() => navigate(backTo)} aria-label="Go back">
            <ArrowLeft size={18} />
          </button>

          <div className="auth-form-wrap">
            <header className="auth-head">
              <h1 className="auth-title">{title}</h1>
              {subtitle && <p className="auth-subtitle">{subtitle}</p>}
            </header>

            {children}

            <div className="auth-safety">
              <p className="safety-line">
                <ShieldCheck size={14} /> Your data is safe with us.
              </p>
              <p className="safety-sub">
                We respect your privacy and will never share your information.
              </p>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        .auth-page {
          min-height: 100vh;
          background: var(--auth-page-bg);
          padding: 24px;
          display: flex;
          justify-content: center;
        }
        .auth-shell {
          width: 100%;
          max-width: 1180px;
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.15fr);
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 22px;
          overflow: hidden;
        }

        /* brand panel */
        .auth-brand {
          position: relative;
          padding: 34px 30px 60px;
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .brand-logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 26px;
          letter-spacing: -0.02em;
          color: var(--ink);
        }
        .brand-badge {
          margin-top: 34px;
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 15px;
          border-radius: 999px;
          background: var(--panel);
          border: 1px solid var(--border);
          font-size: 12.5px;
          color: var(--ink-dim);
        }
        .brand-badge svg { color: var(--accent-ink); flex-shrink: 0; }
        .brand-title {
          margin: 22px 0 0;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: clamp(26px, 2.6vw, 34px);
          line-height: 1.16;
          letter-spacing: -0.02em;
          color: var(--ink);
        }
        .brand-title .accent { color: var(--accent-ink); }
        .brand-body {
          margin: 14px 0 0;
          font-size: 14.5px;
          line-height: 1.65;
          color: var(--ink-dim);
          max-width: 360px;
        }
        .brand-graphic { margin: 26px 0 8px; }

        .brand-card {
          position: relative;
          z-index: 1;
          margin-top: 18px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 22px 20px;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .highlight { display: flex; gap: 14px; align-items: flex-start; }
        .highlight-icon { color: var(--accent-ink); flex-shrink: 0; margin-top: 2px; }
        .highlight-title {
          margin: 0;
          font-family: var(--font-head);
          font-size: 14.5px;
          font-weight: 600;
          color: var(--ink);
        }
        .highlight-body {
          margin: 6px 0 0;
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink-dim);
        }

        .testimonial { gap: 16px; }
        .quote-mark { color: var(--accent-ink); }
        .quote-text {
          margin: 0;
          font-size: 14.5px;
          line-height: 1.6;
          color: var(--ink);
        }
        .quote-author { display: flex; align-items: center; gap: 12px; }
        .avatar {
          width: 40px; height: 40px;
          border-radius: 50%;
          display: grid; place-items: center;
          background: linear-gradient(140deg, var(--lemon-deep), var(--panel-raised));
          color: var(--ink);
          font-family: var(--font-head);
          font-size: 13px;
          font-weight: 700;
        }
        .author-name { margin: 0; font-size: 14px; font-weight: 600; color: var(--ink); }
        .author-role { margin: 3px 0 0; font-size: 12.5px; color: var(--ink-dim); }

        .brand-wave {
          position: absolute;
          left: 0; right: 0; bottom: -40px;
          height: 220px;
          pointer-events: none;
          background:
            radial-gradient(120% 80% at 30% 100%, rgba(196,241,53,0.22), transparent 65%),
            radial-gradient(90% 60% at 75% 100%, rgba(196,241,53,0.12), transparent 70%);
        }

        /* form panel */
        .auth-form-side {
          position: relative;
          padding: 34px 40px 46px;
          display: flex;
          justify-content: center;
          background: var(--panel);
        }
        .back-btn {
          position: absolute;
          top: 30px; left: 30px;
          width: 38px; height: 38px;
          border-radius: 50%;
          display: grid; place-items: center;
          background: var(--panel-raised);
          border: 1px solid var(--border);
          color: var(--ink);
          transition: border-color 0.15s ease, color 0.15s ease;
        }
        @media (hover: hover) and (pointer: fine) { .back-btn:hover { border-color: var(--accent-ink); color: var(--accent-ink); } }
        .auth-form-wrap { width: 100%; max-width: 470px; padding-top: 26px; }
        .auth-head { text-align: center; }
        .auth-title {
          margin: 0;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: clamp(24px, 2.4vw, 30px);
          letter-spacing: -0.02em;
          color: var(--ink);
        }
        .auth-subtitle { margin: 10px 0 0; font-size: 14.5px; color: var(--ink-dim); }

        .auth-safety {
          margin-top: 26px;
          padding-top: 22px;
          border-top: 1px solid var(--border);
          text-align: center;
        }
        .safety-line {
          margin: 0;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          font-size: 13px; color: var(--ink-dim);
        }
        .safety-sub { margin: 8px 0 0; font-size: 12.5px; color: var(--ink-faint); }

        @media (max-width: 940px) {
          .auth-page { padding: 0; background: var(--bg); }
          .auth-shell {
            grid-template-columns: 1fr;
            border: none;
            border-radius: 0;
            min-height: 100vh;
          }
          .auth-brand {
            border-right: none;
            border-bottom: 1px solid var(--border);
            padding: 22px 18px 30px;
          }
          .brand-graphic, .brand-card { display: none; }
          .brand-wave { display: none; }
          .brand-badge { margin-top: 20px; }
          .brand-title { font-size: 26px; }
          .auth-form-side { padding: 26px 18px 42px; background: var(--bg); }
          .back-btn { top: 20px; left: 16px; }
          .auth-form-wrap { padding-top: 34px; max-width: 520px; }
        }
      `}</style>
    </div>
  )
}
