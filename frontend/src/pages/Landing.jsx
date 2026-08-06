import { useNavigate } from 'react-router-dom'
import ActivityFeed from '../components/ActivityFeed.jsx'

// Mirrors app/models/profile.py's INTENT_CHOICES — kept in sync manually
// since intents are curated, not user-generated. Icons are lucide-react,
// loaded from CDN per this project's convention (no emoji, ever).
const INTENTS = [
  { key: 'find_work', label: 'Find freelance work' },
  { key: 'hire', label: 'Hire professionals' },
  { key: 'build_startup', label: 'Build a startup' },
  { key: 'find_collaborators', label: 'Find collaborators' },
  { key: 'learn', label: 'Learn new skills' },
  { key: 'mentor', label: 'Mentor others' },
  { key: 'showcase_work', label: 'Showcase my work' },
  { key: 'network', label: 'Build my network' },
  { key: 'recruit', label: 'Recruit talent' },
]

const CATEGORIES = [
  { name: 'Developers', desc: 'Backend, frontend, mobile, DevOps' },
  { name: 'Designers', desc: 'UI/UX, brand, motion' },
  { name: 'Creators', desc: 'Video, writing, photography' },
  { name: 'Founders', desc: 'Startups, product, growth' },
  { name: 'Data & AI', desc: 'Analysts, ML, engineering' },
  { name: 'Business', desc: 'Marketing, recruiting, ops' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <Nav onLogin={() => navigate('/login')} onSignup={() => navigate('/signup')} />
      <Hero onSignup={() => navigate('/signup')} />
      <IntentBar />
      <HowItWorks />
      <Categories />
      <SecurityBlock />
      <FinalCTA onSignup={() => navigate('/signup')} />
      <Footer />
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

function Nav({ onLogin, onSignup }) {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <div className="logo">
          <span className="logo-mark">el</span>coral
        </div>
        <nav className="nav-links">
          <a href="#how">How it works</a>
          <a href="#categories">Who's here</a>
          <a href="#security">Security</a>
        </nav>
        <div className="nav-actions">
          <button onClick={onLogin} className="btn btn-ghost">Log in</button>
          <button onClick={onSignup} className="btn btn-primary">Join Elcoral</button>
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

function Hero({ onSignup }) {
  return (
    <section className="hero">
      <div className="wrap hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">A professional ecosystem</p>
          <h1 className="hero-title">
            Defined by what<br />
            you're trying to<br />
            <span className="accent">build.</span>
          </h1>
          <p className="hero-sub">
            Not your job title. Elcoral connects people by what they're actually trying to
            do — find work, hire, build a startup, learn, mentor, collaborate — so the right
            people find each other before either one has to search.
          </p>
          <div className="hero-ctas">
            <button onClick={onSignup} className="btn btn-primary btn-lg">Join Elcoral</button>
            <a href="#how" className="btn btn-ghost btn-lg">See how it works</a>
          </div>
          <p className="hero-fineprint">Free to join. Your profile, your goals, your network.</p>
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
          font-size: clamp(40px, 5.6vw, 68px);
          line-height: 1.02;
          letter-spacing: -0.02em;
          margin-top: 14px;
          color: var(--ink);
        }
        .hero-title .accent { color: var(--lemon); }
        .hero-sub { font-size: 17px; max-width: 480px; margin-top: 22px; }
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

function IntentBar() {
  return (
    <section className="intents">
      <div className="wrap">
        <p className="eyebrow">What brings you here?</p>
        <h2 className="intents-title">Pick as many as apply. That's the whole point.</h2>
        <div className="intents-grid">
          {INTENTS.map((it) => (
            <div className="intent-chip" key={it.key}>{it.label}</div>
          ))}
        </div>
      </div>
      <style>{`
        .intents-title { font-size: clamp(24px, 3.4vw, 32px); font-weight: 700; margin-top: 8px; margin-bottom: 32px; max-width: 560px; }
        .intents-grid { display: flex; flex-wrap: wrap; gap: 10px; }
        .intent-chip {
          font-family: var(--font-head);
          font-size: 14px;
          font-weight: 500;
          color: var(--ink-dim);
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 10px 18px;
          transition: border-color 0.15s ease, color 0.15s ease;
        }
        .intent-chip:hover { border-color: var(--lemon); color: var(--ink); }
      `}</style>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { label: 'Say what you\u2019re after', text: 'Not a job title \u2014 your actual goal. Hiring, learning, building, mentoring, or all of it.' },
    { label: 'Elcoral finds the overlap', text: 'A developer wanting a co-founder and a designer wanting the same thing get suggested to each other \u2014 no searching required.' },
    { label: 'Build in the open', text: 'Post your work, grow your network, and move projects forward with people who want the same outcome.' },
  ]
  return (
    <section id="how" className="how">
      <div className="wrap">
        <p className="eyebrow">How it works</p>
        <h2 className="how-title">Three steps. No job-board scrolling.</h2>
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
        .how-title { font-size: clamp(28px, 4vw, 40px); font-weight: 700; margin-top: 8px; margin-bottom: 48px; max-width: 640px; }
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
        <p className="eyebrow">Who's here</p>
        <h2 className="cats-title">Developers, designers, founders, creators \u2014 and everyone building alongside them.</h2>
        <div className="cats-grid">
          {CATEGORIES.map((c) => (
            <div className="cat-card" key={c.name}>
              <span className="cat-name">{c.name}</span>
              <span className="cat-desc">{c.desc}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .cats-title { font-size: clamp(26px, 4vw, 36px); font-weight: 700; margin-top: 8px; margin-bottom: 40px; max-width: 560px; }
        .cats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .cat-card {
          display: flex; flex-direction: column; gap: 6px;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: var(--radius); padding: 22px;
          transition: border-color 0.15s ease, transform 0.15s ease;
        }
        .cat-card:hover { border-color: var(--lemon); transform: translateY(-2px); }
        .cat-name { font-family: var(--font-head); font-weight: 600; font-size: 16.5px; color: var(--ink); }
        .cat-desc { font-size: 13px; color: var(--ink-faint); }
        @media (max-width: 768px) { .cats-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 480px) { .cats-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  )
}

function SecurityBlock() {
  const items = [
    ['Encrypted everywhere', 'Passwords are hashed, sessions use signed tokens, and traffic is TLS-only.'],
    ['Verified identities', 'Confirm who you are before your profile is visible to others.'],
    ['You control your data', 'Your profile, your intents, your visibility \u2014 nothing is sold or shared.'],
    ['Rate-limited & monitored', 'Automated abuse and bot protection watches every login.'],
  ]
  return (
    <section id="security" className="sec">
      <div className="wrap sec-inner">
        <div className="sec-copy">
          <p className="eyebrow">Built to be trusted</p>
          <h2 className="sec-title">Security isn't a feature here. It's the foundation.</h2>
          <p className="sec-sub">Your professional identity lives here. It's protected the same way, seriously, by default, without you having to ask.</p>
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

function FinalCTA({ onSignup }) {
  return (
    <section className="final">
      <div className="wrap final-inner">
        <h2 className="final-title">Your professional identity starts with what you want to build.</h2>
        <div className="hero-ctas">
          <button onClick={onSignup} className="btn btn-primary btn-lg">Join Elcoral</button>
        </div>
      </div>
      <style>{`
        .final-inner { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 28px; }
        .final-title { font-family: var(--font-display); font-weight: 800; font-size: clamp(28px, 5vw, 44px); max-width: 680px; letter-spacing: -0.01em; }
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
