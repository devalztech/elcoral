import { useState } from 'react'
import ActivityFeed from '../components/ActivityFeed.jsx'
import AuthSheet from '../components/AuthSheet.jsx'

const CATEGORIES = [
  { name: 'Web & App Dev', count: '2,340 gigs' },
  { name: 'Design & Brand', count: '1,180 gigs' },
  { name: 'Writing & Content', count: '960 gigs' },
  { name: 'Video & Audio', count: '710 gigs' },
  { name: 'Data & AI', count: '540 gigs' },
  { name: 'Marketing', count: '890 gigs' },
]

const STEPS_CLIENT = [
  { label: 'Post the work', text: 'Describe what you need done and what you’ll pay. Takes about two minutes.' },
  { label: 'Compare proposals', text: 'See who applied, their past work, and rates — then message before you decide.' },
  { label: 'Pay on delivery', text: 'Funds sit in escrow until you approve the work. No surprises.' },
]

const STEPS_FREELANCER = [
  { label: 'Build your profile', text: 'Show your skills, portfolio, and rate. No degree or agency required.' },
  { label: 'Send proposals', text: 'Apply to jobs that fit. Chat directly with clients before you commit.' },
  { label: 'Get paid, guaranteed', text: 'Work is escrowed before you start. Delivered work gets paid, on time.' },
]

export default function Landing() {
  const [role, setRole] = useState('client')
  const steps = role === 'client' ? STEPS_CLIENT : STEPS_FREELANCER
  const [authState, setAuthState] = useState(null) // null | { role, mode }

  const openAuth = (r, mode = 'signup') => setAuthState({ role: r, mode })
  const closeAuth = () => setAuthState(null)

  return (
    <div className="page">
      <Nav onLogin={() => openAuth('client', 'login')} />
      <Hero onHire={() => openAuth('client', 'signup')} onWork={() => openAuth('freelancer', 'signup')} />
      <TrustBar />
      <HowItWorks role={role} setRole={setRole} steps={steps} />
      <Categories />
      <SecurityBlock />
      <FinalCTA onHire={() => openAuth('client', 'signup')} onWork={() => openAuth('freelancer', 'signup')} />
      <Footer />
      {authState && (
        <AuthSheet initialRole={authState.role} mode={authState.mode} onClose={closeAuth} />
      )}
      <style>{`
        .page { min-height: 100vh; }
        section { padding: 96px 0; }
        @media (max-width: 768px) { section { padding: 64px 0; } }
        h1, h2, h3 { font-family: var(--font-head); margin: 0; }
        p { line-height: 1.6; color: var(--ink-dim); }
      `}</style>
    </div>
  )
}

function Nav({ onLogin }) {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <div className="logo">
          <span className="logo-mark">el</span>coral
        </div>
        <nav className="nav-links">
          <a href="#how">How it works</a>
          <a href="#categories">Categories</a>
          <a href="#security">Security</a>
        </nav>
        <div className="nav-actions">
          <button onClick={onLogin} className="btn btn-ghost">Log in</button>
        </div>
      </div>
      <style>{`
        .nav { position: sticky; top: 0; z-index: 40; background: rgba(11,13,10,0.85); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); }
        .nav-inner { display: flex; align-items: center; justify-content: space-between; padding-top: 18px; padding-bottom: 18px; }
        .logo { font-family: var(--font-display); font-weight: 900; font-size: 20px; letter-spacing: -0.02em; }
        .logo-mark { color: var(--lemon); }
        .nav-links { display: flex; gap: 32px; }
        .nav-links a { font-size: 14.5px; color: var(--ink-dim); font-weight: 500; }
        .nav-links a:hover { color: var(--ink); }
        .nav-actions { display: flex; gap: 10px; align-items: center; }
        @media (max-width: 860px) { .nav-links { display: none; } }
        @media (max-width: 480px) { .nav-actions .btn-ghost { display: none; } }
      `}</style>
    </header>
  )
}

function Hero({ onHire, onWork }) {
  return (
    <section className="hero">
      <div className="wrap hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">Digital work, done remotely</p>
          <h1 className="hero-title">
            Hire skill.<br />
            Do work.<br />
            <span className="accent">Get paid.</span>
          </h1>
          <p className="hero-sub">
            Elcoral connects people who need digital work done with people who can do it —
            no office, no borders, just the skill and the deal.
          </p>
          <div className="hero-ctas">
            <button onClick={onHire} className="btn btn-primary btn-lg">Hire talent</button>
            <button onClick={onWork} className="btn btn-ghost btn-lg">Find work</button>
          </div>
          <p className="hero-fineprint">Free to join. No fees until you get hired or hire someone.</p>
        </div>
        <div className="hero-visual">
          <div className="visual-label">Live on Elcoral</div>
          <ActivityFeed />
        </div>
      </div>
      <style>{`
        .hero { padding-top: 72px; padding-bottom: 72px; }
        .hero-inner { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 56px; align-items: center; }
        .hero-title {
          font-family: var(--font-display);
          font-weight: 900;
          font-size: clamp(42px, 6vw, 76px);
          line-height: 0.98;
          letter-spacing: -0.02em;
          margin-top: 14px;
          color: var(--ink);
        }
        .hero-title .accent { color: var(--lemon); }
        .hero-sub { font-size: 17px; max-width: 460px; margin-top: 22px; }
        .hero-ctas { display: flex; gap: 14px; margin-top: 32px; flex-wrap: wrap; }
        .btn-lg { padding: 16px 30px; font-size: 16px; }
        .hero-fineprint { font-size: 13px; color: var(--ink-faint); margin-top: 16px; }
        .hero-visual {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 20px;
        }
        .visual-label {
          font-family: var(--font-head);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-faint);
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .visual-label::before {
          content: '';
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--lemon);
          box-shadow: 0 0 0 3px rgba(196,241,53,0.2);
        }
        @media (max-width: 900px) {
          .hero-inner { grid-template-columns: 1fr; }
          .hero-visual { order: -1; }
        }
      `}</style>
    </section>
  )
}

function TrustBar() {
  const stats = [
    ['18,400+', 'freelancers active'],
    ['$2.1M', 'paid out to date'],
    ['92%', 'jobs filled in 48h'],
    ['4.8/5', 'average client rating'],
  ]
  return (
    <section className="trust">
      <div className="wrap trust-grid">
        {stats.map(([num, label]) => (
          <div key={label} className="trust-item">
            <div className="trust-num">{num}</div>
            <div className="trust-label">{label}</div>
          </div>
        ))}
      </div>
      <style>{`
        .trust { padding: 40px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .trust-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        .trust-num { font-family: var(--font-display); font-weight: 800; font-size: 30px; color: var(--lemon); }
        .trust-label { font-size: 13px; color: var(--ink-faint); margin-top: 4px; }
        @media (max-width: 640px) { .trust-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </section>
  )
}

function HowItWorks({ role, setRole, steps }) {
  return (
    <section id="how" className="how">
      <div className="wrap">
        <div className="how-head">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="how-title">Two sides, one deal.</h2>
          </div>
          <div className="role-switch" role="tablist" aria-label="View steps for">
            <button
              role="tab"
              aria-selected={role === 'client'}
              className={role === 'client' ? 'active' : ''}
              onClick={() => setRole('client')}
            >
              I'm hiring
            </button>
            <button
              role="tab"
              aria-selected={role === 'freelancer'}
              className={role === 'freelancer' ? 'active' : ''}
              onClick={() => setRole('freelancer')}
            >
              I'm working
            </button>
          </div>
        </div>
        <div className="steps">
          {steps.map((s, i) => (
            <div className="step" key={s.label}>
              <div className="step-index">{String(i + 1).padStart(2, '0')}</div>
              <h3 className="step-label">{s.label}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .how-head { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 20px; margin-bottom: 48px; }
        .how-title { font-size: clamp(28px, 4vw, 40px); font-weight: 700; margin-top: 8px; }
        .role-switch { display: flex; background: var(--panel); border: 1px solid var(--border); border-radius: 999px; padding: 4px; }
        .role-switch button {
          border: none; background: transparent; color: var(--ink-dim);
          font-family: var(--font-head); font-weight: 600; font-size: 14px;
          padding: 10px 20px; border-radius: 999px; transition: all 0.15s ease;
        }
        .role-switch button.active { background: var(--lemon); color: #0B0D0A; }
        .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .step { border-top: 2px solid var(--lemon); padding-top: 20px; }
        .step-index { font-family: var(--font-display); font-size: 13px; color: var(--ink-faint); font-weight: 700; letter-spacing: 0.05em; }
        .step-label { font-size: 20px; font-weight: 600; margin-top: 10px; margin-bottom: 10px; color: var(--ink); }
        @media (max-width: 768px) { .steps { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  )
}

function Categories() {
  return (
    <section id="categories" className="cats">
      <div className="wrap">
        <p className="eyebrow">Popular categories</p>
        <h2 className="cats-title">Whatever the skill, someone's ready.</h2>
        <div className="cats-grid">
          {CATEGORIES.map((c) => (
            <a href="/work" className="cat-card" key={c.name}>
              <span className="cat-name">{c.name}</span>
              <span className="cat-count">{c.count}</span>
            </a>
          ))}
        </div>
      </div>
      <style>{`
        .cats-title { font-size: clamp(26px, 4vw, 36px); font-weight: 700; margin-top: 8px; margin-bottom: 40px; max-width: 500px; }
        .cats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .cat-card {
          display: flex; flex-direction: column; gap: 6px;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 22px;
          transition: border-color 0.15s ease, transform 0.15s ease;
        }
        .cat-card:hover { border-color: var(--lemon); transform: translateY(-2px); }
        .cat-name { font-family: var(--font-head); font-weight: 600; font-size: 16.5px; color: var(--ink); }
        .cat-count { font-size: 13px; color: var(--ink-faint); }
        @media (max-width: 768px) { .cats-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 480px) { .cats-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  )
}

function SecurityBlock() {
  const items = [
    ['Escrow by default', 'Payment is held before work starts and released only when you approve delivery.'],
    ['Encrypted everywhere', 'Passwords are hashed, sessions use signed tokens, and traffic is TLS-only.'],
    ['Verified identities', 'Freelancers and clients confirm who they are before money moves.'],
    ['Rate-limited & monitored', 'Automated abuse and bot protection watches every login and payment.'],
  ]
  return (
    <section id="security" className="sec">
      <div className="wrap sec-inner">
        <div className="sec-copy">
          <p className="eyebrow">Built to be trusted</p>
          <h2 className="sec-title">Security isn't a feature here. It's the foundation.</h2>
          <p className="sec-sub">Money and reputations move through Elcoral. Both are protected the same way: seriously, by default, without you having to ask.</p>
        </div>
        <div className="sec-grid">
          {items.map(([t, d]) => (
            <div className="sec-item" key={t}>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .sec { background: var(--panel); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .sec-inner { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 48px; }
        .sec-title { font-size: clamp(26px, 4vw, 34px); font-weight: 700; margin-top: 10px; line-height: 1.2; }
        .sec-sub { margin-top: 16px; max-width: 380px; }
        .sec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .sec-item h3 { font-size: 16.5px; font-weight: 600; color: var(--lemon); margin-bottom: 8px; }
        .sec-item p { font-size: 14.5px; }
        @media (max-width: 860px) { .sec-inner { grid-template-columns: 1fr; } }
        @media (max-width: 480px) { .sec-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  )
}

function FinalCTA({ onHire, onWork }) {
  return (
    <section className="final">
      <div className="wrap final-inner">
        <h2 className="final-title">Post a job or start earning — today.</h2>
        <div className="hero-ctas">
          <button onClick={onHire} className="btn btn-primary btn-lg">Hire talent</button>
          <button onClick={onWork} className="btn btn-ghost btn-lg">Find work</button>
        </div>
      </div>
      <style>{`
        .final-inner { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 28px; }
        .final-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(28px, 5vw, 44px); max-width: 640px; letter-spacing: -0.01em; }
      `}</style>
    </section>
  )
}

function Footer() {
  return (
    <footer className="foot">
      <div className="wrap foot-inner">
        <div className="logo"><span className="logo-mark">el</span>coral</div>
        <p className="foot-copy">&copy; {new Date().getFullYear()} Elcoral. All rights reserved.</p>
      </div>
      <style>{`
        .foot { padding: 40px 0; border-top: 1px solid var(--border); }
        .foot-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .foot-copy { font-size: 13px; color: var(--ink-faint); margin: 0; }
      `}</style>
    </footer>
  )
}
