import { Link } from 'react-router-dom'
import {
  LayoutGrid, Pencil, Image as ImageIcon, Briefcase, Users, FileText, Calendar,
  ArrowRight, ChevronRight, Radio, BarChart3, Tag, Rocket,
} from 'lucide-react'

const TYPES = [
  { to: '/home/create/post', icon: Pencil, label: 'Post', desc: 'Share updates, ideas, announcements or thoughts.' },
  { to: '/home/create/project', icon: ImageIcon, label: 'Project', desc: "Showcase your work or an idea you're building." },
  { to: '/home/create/job', icon: Briefcase, label: 'Job', desc: 'Post a job opening and find the right talent.' },
  { to: '/home/create/community', icon: Users, label: 'Community', desc: 'Create a community around a topic or interest.' },
  { to: '/home/create/article', icon: FileText, label: 'Article', desc: 'Write a long-form article or tutorial to share knowledge.' },
  { to: '/home/create/event', icon: Calendar, label: 'Event', desc: 'Create an event and bring people together.' },
]

const QUICK = [
  { to: '/home/create/media', icon: ImageIcon, label: 'Upload Media', desc: 'Share a photo, video or document.' },
  { to: '/home/create/live', icon: Radio, label: 'Go Live', desc: 'Start a live session and engage in real time.' },
  { to: '/home/create/poll', icon: BarChart3, label: 'Create Poll', desc: 'Ask a question and see what others think.' },
  { to: '/home/create/listing', icon: Tag, label: 'Create Listing', desc: 'List a service, product or offer.' },
]

export default function Create() {
  return (
    <div className="cr">
      <header className="cr-top">
        <div className="cr-head">
          <h1 className="cr-title">Create</h1>
          <p className="cr-sub">Share, build, and connect with the community.</p>
        </div>
        <Link to="/home/create/templates" className="cr-templates">
          <LayoutGrid size={17} strokeWidth={2} />
          Templates
        </Link>
      </header>

      <h2 className="cr-section">What would you like to create?</h2>
      <div className="cr-grid">
        {TYPES.map(({ to, icon: Icon, label, desc }) => (
          <Link key={to} to={to} className="cr-card">
            <span className="cr-card-icon">
              <Icon size={22} strokeWidth={1.9} />
            </span>
            <span className="cr-card-label">{label}</span>
            <span className="cr-card-desc">{desc}</span>
            <ArrowRight size={18} strokeWidth={1.9} className="cr-card-arrow" />
          </Link>
        ))}
      </div>

      <h2 className="cr-section">Quick actions</h2>
      <div className="cr-quick">
        {QUICK.map(({ to, icon: Icon, label, desc }) => (
          <Link key={to} to={to} className="cr-row">
            <span className="cr-row-icon">
              <Icon size={20} strokeWidth={1.9} />
            </span>
            <span className="cr-row-text">
              <span className="cr-row-label">{label}</span>
              <span className="cr-row-desc">{desc}</span>
            </span>
            <ChevronRight size={20} className="cr-row-chevron" />
          </Link>
        ))}
      </div>

      <section className="cr-promo">
        <div className="cr-promo-art" aria-hidden="true">
          <Rocket size={44} strokeWidth={1.5} />
        </div>
        <div className="cr-promo-text">
          <h3 className="cr-promo-title">New to Elcoral?</h3>
          <p className="cr-promo-desc">
            Get started by creating your first post or project and be part of the movement.
          </p>
        </div>
        <Link to="/home/create/post" className="cr-promo-cta">
          Get started
          <ChevronRight size={17} strokeWidth={2.3} />
        </Link>
      </section>

      <style>{`
        .cr { padding-bottom: 8px; }

        .cr-top {
          display: grid; grid-template-columns: minmax(0,1fr) auto;
          align-items: start; gap: 12px; margin-bottom: 22px;
        }
        .cr-head { min-width: 0; text-align: center; padding-left: 8px; }
        .cr-title {
          margin: 0; font-family: var(--font-display); font-weight: 800;
          font-size: 26px; letter-spacing: -0.01em; color: var(--ink);
        }
        .cr-sub { margin: 5px 0 0; font-size: 13.5px; color: var(--ink-dim); }
        .cr-templates {
          flex-shrink: 0; display: inline-flex; align-items: center; gap: 7px;
          border: 1px solid var(--border); border-radius: 999px;
          padding: 10px 16px; margin-top: 2px;
          font-family: var(--font-head); font-weight: 600; font-size: 14px;
          color: var(--ink); white-space: nowrap;
        }
        .cr-templates svg { color: var(--accent-ink); }
        .cr-templates:hover { border-color: var(--accent-ink); }
        .cr-templates:active { transform: scale(0.97); }

        .cr-section {
          margin: 0 0 12px 2px; font-family: var(--font-head);
          font-size: 16px; font-weight: 700; color: var(--ink);
        }

        .cr-grid {
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px; margin-bottom: 26px;
        }
        .cr-card {
          display: flex; flex-direction: column;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; padding: 14px 12px 12px;
        }
        .cr-card-icon {
          width: 42px; height: 42px; border-radius: 12px;
          background: var(--panel-raised); color: var(--accent-ink);
          display: inline-flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
        }
        .cr-card-label {
          font-family: var(--font-head); font-weight: 700; font-size: 15.5px;
          color: var(--ink); margin-bottom: 6px;
        }
        .cr-card-desc {
          font-size: 13px; line-height: 1.42; color: var(--ink-dim); flex: 1;
        }
        .cr-card-arrow { color: var(--accent-ink); margin-top: 14px; }
        .cr-card:hover { border-color: rgba(196, 241, 53, 0.35); }
        .cr-card:active { transform: scale(0.99); }

        .cr-quick { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
        .cr-row {
          display: grid; grid-template-columns: 44px minmax(0,1fr) auto;
          align-items: center; gap: 14px;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; padding: 14px 14px;
        }
        .cr-row-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: var(--panel-raised); color: var(--accent-ink);
          display: inline-flex; align-items: center; justify-content: center;
        }
        .cr-row-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .cr-row-label { font-family: var(--font-head); font-size: 15.5px; font-weight: 700; color: var(--ink); }
        .cr-row-desc { font-size: 13px; line-height: 1.35; color: var(--ink-dim); }
        .cr-row-chevron { color: var(--ink-faint); }
        .cr-row:hover { border-color: rgba(196, 241, 53, 0.35); }
        .cr-row:active { background: var(--panel-raised); }

        .cr-promo {
          display: grid; grid-template-columns: auto minmax(0,1fr) auto;
          align-items: center; gap: 14px;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; padding: 14px;
        }
        .cr-promo-art {
          width: 82px; height: 82px; border-radius: 12px; flex-shrink: 0;
          background: radial-gradient(circle at 50% 45%, rgba(196, 241, 53, 0.16), rgba(196, 241, 53, 0.03) 65%, transparent 72%), #0B0D0A;
          color: var(--accent-ink);
          display: flex; align-items: center; justify-content: center;
        }
        .cr-promo-text { min-width: 0; }
        .cr-promo-title {
          margin: 0; font-family: var(--font-head); font-weight: 700;
          font-size: 16.5px; color: var(--accent-ink);
        }
        .cr-promo-desc { margin: 5px 0 0; font-size: 13px; line-height: 1.42; color: var(--ink-dim); }
        .cr-promo-cta {
          flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px;
          background: var(--lemon); color: var(--on-accent);
          border-radius: 999px; padding: 12px 16px;
          font-family: var(--font-head); font-weight: 700; font-size: 14px;
          white-space: nowrap;
        }
        .cr-promo-cta:active { transform: scale(0.97); }

        @media (max-width: 420px) {
          .cr-title { font-size: 23px; }
          .cr-sub { font-size: 12.5px; }
          .cr-templates { padding: 9px 12px; font-size: 13px; }
          .cr-grid { gap: 8px; }
          .cr-card { padding: 12px 10px 10px; }
          .cr-card-desc { font-size: 12.5px; }
          .cr-promo { grid-template-columns: auto minmax(0,1fr); row-gap: 12px; }
          .cr-promo-cta { grid-column: 1 / -1; justify-content: center; }
        }
        @media (min-width: 860px) {
          .cr-grid { gap: 14px; }
        }
      `}</style>
    </div>
  )
}
