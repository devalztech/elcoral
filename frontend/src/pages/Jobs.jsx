import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Bell, SlidersHorizontal, X, Briefcase, BadgeCheck, Bookmark,
  Wifi, Users, MapPin,
} from 'lucide-react'
import ElcoralMark from '../components/ElcoralMark.jsx'

/* ---------------------------------------------------------------- data ---- */

const FILTERS = ['For you', 'All jobs', 'Remote', 'Full-time', 'Part-time', 'Internship']

import { FEATURED, RECOMMENDED } from '../features/jobs/jobs.js'

function initialsOf(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function Logo({ name, tone = 'a', brand = false, size = 56 }) {
  return (
    <span className={`jb-logo tone-${tone}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }} aria-hidden="true">
      {brand ? <ElcoralMark size={Math.round(size * 0.6)} color="var(--lemon)" /> : initialsOf(name)}
    </span>
  )
}

function Meta({ icon, children }) {
  const Icon = icon === 'pin' ? MapPin : icon === 'type' ? Users : Wifi
  return (
    <span className="jb-meta"><Icon size={14} strokeWidth={1.9} />{children}</span>
  )
}

/* --------------------------------------------------------------- screen ---- */

export default function Jobs() {
  const [filter, setFilter] = useState('For you')
  const [promo, setPromo] = useState(true)
  const [slide, setSlide] = useState(0)
  const [saved, setSaved] = useState({})
  const railRef = useRef(null)

  const onRailScroll = () => {
    const el = railRef.current
    if (!el) return
    const card = el.firstElementChild
    if (!card) return
    const step = card.getBoundingClientRect().width + 12
    setSlide(Math.round(el.scrollLeft / step))
  }

  const goSlide = (i) => {
    const el = railRef.current
    if (!el) return
    const card = el.firstElementChild
    if (!card) return
    const step = card.getBoundingClientRect().width + 12
    el.scrollTo({ left: i * step, behavior: 'smooth' })
  }

  const toggleSave = (id) => setSaved((s) => ({ ...s, [id]: !s[id] }))

  return (
    <div className="jb">
      {/* -------------------------------------------------------- app bar --- */}
      <header className="jb-bar">
        <h1 className="jb-title">Jobs</h1>
        <label className="jb-search">
          <Search size={19} strokeWidth={2} />
          <input type="search" placeholder="Search jobs, roles or companies" aria-label="Search jobs" />
        </label>
        <Link to="/home/notifications" className="jb-icon-btn" aria-label="Notifications">
          <Bell size={22} strokeWidth={1.9} />
          <span className="jb-badge">3</span>
        </Link>
        <button type="button" className="jb-icon-btn" aria-label="Filters">
          <SlidersHorizontal size={22} strokeWidth={1.9} />
        </button>
      </header>

      {/* -------------------------------------------------------- filters --- */}
      <nav className="jb-filters" aria-label="Job filters">
        <div className="jb-rail jb-filters-rail">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`jb-filter ${filter === f ? 'on' : ''}`}
              aria-current={filter === f ? 'true' : undefined}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </nav>

      {/* ---------------------------------------------------------- promo --- */}
      {promo && (
        <section className="jb-promo">
          <span className="jb-promo-art" aria-hidden="true">
            <Briefcase size={40} strokeWidth={1.7} />
            <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
          </span>
          <div className="jb-promo-text">
            <p className="jb-promo-title">Find the right opportunity</p>
            <p className="jb-promo-sub">Discover roles that match your skills, goals and passion.</p>
          </div>
          <Link to="/home/create/job" className="jb-promo-cta">Post a job</Link>
          <button type="button" className="jb-promo-close" aria-label="Dismiss" onClick={() => setPromo(false)}>
            <X size={20} strokeWidth={2} />
          </button>
        </section>
      )}

      {/* ------------------------------------------------------- featured --- */}
      <div className="jb-section-head">
        <h2>Featured jobs</h2>
        <Link to="/home/jobs/featured" className="jb-see-all">See all</Link>
      </div>

      <div className="jb-rail jb-feat-rail" ref={railRef} onScroll={onRailScroll}>
        {FEATURED.map((j) => (
          <article key={j.id} className="jb-feat">
            <div className="jb-feat-top">
              <Logo name={j.company} tone={j.tone} brand={j.brand} size={62} />
              <div className="jb-feat-id">
                <h3>
                  <span className="jb-feat-role">{j.title}</span>
                  {j.id === 'f1' && <span className="jb-pill">Featured</span>}
                </h3>
                <p className="jb-company">
                  {j.company}
                  {j.verified && <BadgeCheck className="jb-verified" size={16} />}
                </p>
                <div className="jb-metas">
                  <Meta icon="wifi">{j.remote}</Meta>
                  <Meta icon="type">{j.type}</Meta>
                </div>
              </div>
              <div className="jb-feat-right">
                <span className="jb-time">{j.time}</span>
                <button
                  type="button"
                  className={`jb-save ${saved[j.id] ? 'on' : ''}`}
                  aria-label="Save job"
                  onClick={() => toggleSave(j.id)}
                >
                  <Bookmark size={20} strokeWidth={1.9} fill={saved[j.id] ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>

            <p className="jb-feat-desc">{j.desc}</p>

            <div className="jb-feat-foot">
              <div className="jb-tags">
                {j.tags.map((t) => <span key={t} className="jb-tag">{t}</span>)}
                {j.extra ? <span className="jb-tag">+{j.extra}</span> : null}
              </div>
              <button type="button" className="jb-apply lg">Apply now</button>
            </div>
          </article>
        ))}
      </div>

      <div className="jb-dots" role="tablist" aria-label="Featured jobs pagination">
        {FEATURED.map((j, i) => (
          <button
            key={j.id}
            type="button"
            role="tab"
            aria-selected={slide === i}
            aria-label={`Go to featured job ${i + 1}`}
            className={`jb-dot ${slide === i ? 'on' : ''}`}
            onClick={() => goSlide(i)}
          />
        ))}
      </div>

      {/* ---------------------------------------------------- recommended --- */}
      <div className="jb-section-head">
        <h2>Recommended for you</h2>
        <Link to="/home/jobs/recommended" className="jb-see-all">See all</Link>
      </div>

      <ul className="jb-list">
        {RECOMMENDED.map((j) => (
          <li key={j.id}>
            <article className="jb-card">
              <Logo name={j.company} tone={j.tone} size={56} />
              <div className="jb-card-id">
                <h3>{j.title}</h3>
                <p className="jb-company">
                  {j.company}
                  {j.verified && <BadgeCheck className="jb-verified" size={15} />}
                </p>
                <div className="jb-metas">
                  <Meta icon={j.placeIcon}>{j.place}</Meta>
                  <span className="jb-sep">•</span>
                  <Meta icon="type">{j.type}</Meta>
                </div>
              </div>
              <div className="jb-card-right">
                <div className="jb-card-top">
                  {j.badge && <span className="jb-new">{j.badge}</span>}
                  <span className="jb-time">{j.time}</span>
                  <button
                    type="button"
                    className={`jb-save ${saved[j.id] ? 'on' : ''}`}
                    aria-label="Save job"
                    onClick={() => toggleSave(j.id)}
                  >
                    <Bookmark size={19} strokeWidth={1.9} fill={saved[j.id] ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <button type="button" className="jb-apply">Apply</button>
              </div>
            </article>
          </li>
        ))}
      </ul>

      {/* ------------------------------------------------------ get noticed --- */}
      <section className="jb-notice">
        <span className="jb-notice-art" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="60" height="60" fill="none" stroke="var(--lemon)" strokeWidth="2.2"
               strokeLinecap="round" strokeLinejoin="round">
            <rect x="10" y="6" width="38" height="48" rx="5" />
            <circle cx="24" cy="21" r="5" />
            <path d="M16 34c1.6-4 5-6 8-6s6.4 2 8 6" />
            <path d="M34 17h9M34 24h9M17 42h24M17 48h16" />
            <circle cx="46" cy="46" r="11" fill="var(--panel)" />
            <path d="m46 40 1.8 3.7 4.2.6-3 3 .7 4.1-3.7-2-3.7 2 .7-4.1-3-3 4.2-.6z" />
          </svg>
        </span>
        <div className="jb-notice-text">
          <p className="jb-notice-title">Get noticed by top companies</p>
          <p className="jb-notice-sub">Create a complete profile and let recruiters find you.</p>
        </div>
        <Link to="/home/profile/edit" className="jb-notice-cta">Complete profile</Link>
      </section>

      <style>{`
        .jb { --gut: 20px; margin: -24px -20px 0; padding-bottom: 12px; }
        @media (min-width: 860px) { .jb { margin: -32px -40px 0; --gut: 40px; } }

        .jb-logo {
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 16px; flex: none; overflow: hidden;
          font-family: var(--font-head); font-weight: 700; letter-spacing: .3px;
          color: var(--ink); background: var(--panel-raised);
          border: 1px solid var(--border);
        }
        .jb-logo.tone-a { background: linear-gradient(145deg,#1d2415,#0d1108); color: var(--accent-ink); }
        .jb-logo.tone-b { background: linear-gradient(145deg,#241a2c,#120d17); color: #E86FA8; }
        .jb-logo.tone-c { background: linear-gradient(145deg,#16210f,#0b1007); color: var(--accent-ink); }
        .jb-logo.tone-d { background: linear-gradient(145deg,#eef1f6,#cdd5e4); color: #2C4FE0; }
        .jb-logo.tone-e { background: linear-gradient(145deg,#8B45F0,#6C2BD9); color: #fff; }
        .jb-logo.tone-f { background: linear-gradient(145deg,#f7f9f2,#dfe4d6); color: #14170F; }

        .jb-verified { color: var(--accent-ink); flex: none; }

        /* ------------------------------------------------------- app bar */
        .jb-bar {
          position: sticky; top: 0; z-index: 30;
          display: flex; align-items: center; gap: 10px;
          padding: 14px var(--gut) 12px;
          background: color-mix(in srgb, var(--bg) 90%, transparent);
          backdrop-filter: blur(14px);
        }
        .jb-title {
          margin: 0; font-family: var(--font-display); font-weight: 800;
          font-size: 26px; letter-spacing: -.4px; color: var(--ink); flex: none;
        }
        .jb-search {
          flex: 1 1 auto; min-width: 0;
          display: flex; align-items: center; gap: 9px;
          height: 44px; padding: 0 14px; border-radius: 999px;
          background: var(--panel); border: 1px solid transparent;
          color: var(--ink-faint);
        }
        .jb-search:focus-within { border-color: var(--border); }
        .jb-search input {
          flex: 1; min-width: 0; background: none; border: none; outline: none;
          color: var(--ink); font-family: var(--font-body); font-size: 14px;
        }
        .jb-search input::placeholder { color: var(--ink-faint); }
        .jb-search input::-webkit-search-cancel-button { display: none; }

        .jb-icon-btn {
          position: relative; flex: none;
          display: inline-flex; align-items: center; justify-content: center;
          width: 38px; height: 38px; border-radius: 12px; color: var(--ink);
          transition: background .16s ease;
        }
        .jb-icon-btn:hover { background: var(--panel); }
        .jb-badge {
          position: absolute; top: -1px; right: -1px;
          min-width: 18px; height: 18px; padding: 0 5px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; background: var(--lemon); color: var(--on-accent);
          font-size: 11px; font-weight: 800; font-family: var(--font-head);
          border: 2px solid var(--bg);
        }

        /* ------------------------------------------------------ rails */
        .jb-rail {
          display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory;
          padding: 0 var(--gut); scrollbar-width: none; -webkit-overflow-scrolling: touch;
        }
        .jb-rail::-webkit-scrollbar { display: none; }

        .jb-filters { padding: 4px 0 0; }
        .jb-filters-rail { gap: 10px; padding-bottom: 4px; }
        .jb-filter {
          flex: none; scroll-snap-align: start;
          height: 40px; padding: 0 18px; border-radius: 999px;
          background: var(--panel); color: var(--ink);
          font-family: var(--font-head); font-size: 14px; font-weight: 600;
          border: 1px solid transparent; transition: all .16s ease; white-space: nowrap;
        }
        .jb-filter:hover { border-color: var(--border); }
        .jb-filter.on { background: var(--lemon); color: var(--on-accent); border-color: var(--accent-ink); }

        /* ------------------------------------------------------ promo */
        .jb-promo {
          position: relative;
          margin: 0 var(--gut); padding: 14px 0;
          display: flex; align-items: center; gap: 14px;
          border-radius: 0; border-bottom: 1px solid var(--border);
          background: none;
        }
        .jb-promo-art {
          position: relative; flex: none;
          width: 78px; height: 78px; border-radius: 18px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--accent-ink);
          background: radial-gradient(circle at 50% 50%, rgba(196,241,53,.14), transparent 70%);
        }
        .jb-promo-art .c {
          position: absolute; width: 14px; height: 14px;
          border: 2px solid var(--lemon); opacity: .8;
        }
        .jb-promo-art .tl { top: 0; left: 0; border-right: 0; border-bottom: 0; border-radius: 5px 0 0 0; }
        .jb-promo-art .tr { top: 0; right: 0; border-left: 0; border-bottom: 0; border-radius: 0 5px 0 0; }
        .jb-promo-art .bl { bottom: 0; left: 0; border-right: 0; border-top: 0; border-radius: 0 0 0 5px; }
        .jb-promo-art .br { bottom: 0; right: 0; border-left: 0; border-top: 0; border-radius: 0 0 5px 0; }

        .jb-promo-text { flex: 1 1 auto; min-width: 0; padding-right: 4px; }
        .jb-promo-title {
          margin: 0; font-family: var(--font-head); font-weight: 700;
          font-size: 16px; color: var(--accent-ink);
        }
        .jb-promo-sub { margin: 5px 0 0; font-size: 13.5px; line-height: 1.45; color: var(--ink-dim); }
        .jb-promo-cta {
          flex: none; display: inline-flex; align-items: center; justify-content: center;
          height: 44px; padding: 0 18px; border-radius: 12px;
          background: var(--lemon); color: var(--on-accent);
          font-family: var(--font-head); font-weight: 700; font-size: 14.5px;
          transition: filter .16s ease;
        }
        .jb-promo-cta:hover { filter: brightness(1.06); }
        .jb-promo-close {
          position: absolute; top: 8px; right: 8px;
          width: 28px; height: 28px; border-radius: 8px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--ink-dim);
        }
        .jb-promo-close:hover { background: var(--panel-raised); color: var(--ink); }

        /* ------------------------------------------------ section head */
        .jb-section-head {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 12px; padding: 22px var(--gut) 12px;
        }
        .jb-section-head h2 {
          margin: 0; font-family: var(--font-head); font-weight: 700;
          font-size: 17px; letter-spacing: -.2px; color: var(--ink);
        }
        .jb-see-all { font-size: 13.5px; font-weight: 600; color: var(--accent-ink); }

        /* ---------------------------------------------------- featured */
        .jb-feat-rail { padding-bottom: 2px; }
        .jb-feat {
          flex: none; width: min(88%, 520px); scroll-snap-align: center;
          border-radius: 0; border: 0;
          background: none; padding: 4px 14px 4px 0;
          display: flex; flex-direction: column; gap: 12px;
        }
        .jb-feat-top { display: flex; gap: 12px; align-items: flex-start; }
        .jb-feat-id { flex: 1 1 auto; min-width: 0; }
        .jb-feat-id h3 {
          margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          font-family: var(--font-head); font-weight: 700; font-size: 15.5px;
          line-height: 1.25; color: var(--ink);
        }
        .jb-pill {
          display: inline-flex; align-items: center; height: 21px; padding: 0 9px;
          border-radius: 999px; background: rgba(196,241,53,.16); color: var(--accent-ink);
          font-size: 11.5px; font-weight: 700; font-family: var(--font-head);
        }
        .jb-company {
          margin: 5px 0 0; display: flex; align-items: center; gap: 5px;
          font-size: 13.5px; font-weight: 600; color: var(--ink);
        }
        .jb-metas {
          margin-top: 7px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        }
        .jb-meta {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12.5px; color: var(--ink-dim);
        }
        .jb-sep { color: var(--ink-faint); font-size: 12px; }

        .jb-feat-right { flex: none; display: flex; align-items: center; gap: 10px; }
        .jb-time { font-size: 12px; color: var(--ink-dim); white-space: nowrap; }
        .jb-save {
          display: inline-flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 9px; color: var(--ink-dim);
          transition: color .16s ease, background .16s ease;
        }
        .jb-save:hover { background: var(--panel-raised); color: var(--ink); }
        .jb-save.on { color: var(--accent-ink); }

        .jb-feat-desc { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--ink-dim); }
        .jb-feat-foot {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .jb-tags { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; flex: 1 1 auto; }
        .jb-tag {
          display: inline-flex; align-items: center; height: 28px; padding: 0 11px;
          border-radius: 999px; border: 1px solid var(--border);
          font-size: 12px; color: var(--ink-dim); white-space: nowrap;
        }
        .jb-apply {
          flex: none; display: inline-flex; align-items: center; justify-content: center;
          height: 36px; padding: 0 18px; border-radius: 999px;
          background: var(--lemon); color: var(--on-accent);
          font-family: var(--font-head); font-weight: 700; font-size: 13.5px;
          transition: filter .16s ease;
        }
        .jb-apply.lg { height: 42px; padding: 0 20px; font-size: 14.5px; }
        .jb-apply:hover { filter: brightness(1.06); }

        .jb-dots { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 14px 0 0; }
        .jb-dot {
          width: 7px; height: 7px; border-radius: 999px; background: var(--border);
          transition: all .18s ease;
        }
        .jb-dot.on { width: 20px; background: var(--lemon); }

        /* ------------------------------------------------ recommended */
        /* Hairline-separated rows, same rhythm as a post cell. */
        .jb-list { list-style: none; margin: 0; padding: 0; display: grid; }
        .jb-card {
          display: flex; gap: 12px; align-items: flex-start;
          padding: 12px var(--gut); border-radius: 0;
          border: 0; border-bottom: 1px solid var(--border); background: none;
          transition: background .16s ease;
        }
        .jb-card:hover { background: color-mix(in srgb, var(--ink) 3%, transparent); }
        .jb-card-id { flex: 1 1 auto; min-width: 0; }
        .jb-card-id h3 {
          margin: 0; font-family: var(--font-head); font-weight: 700;
          font-size: 14.5px; line-height: 1.25; color: var(--ink);
        }
        .jb-card .jb-metas { flex-wrap: nowrap; gap: 8px; overflow: hidden; }
        .jb-card .jb-meta { white-space: nowrap; font-size: 12px; }
        .jb-card-right {
          flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 10px;
        }
        .jb-card-top { display: flex; align-items: center; gap: 8px; }
        .jb-new {
          display: inline-flex; align-items: center; height: 20px; padding: 0 8px;
          border-radius: 6px; background: rgba(196,241,53,.16); color: var(--accent-ink);
          font-size: 11px; font-weight: 700; font-family: var(--font-head);
        }

        /* --------------------------------------------------- get noticed */
        .jb-notice {
          margin: 0 var(--gut); padding: 14px 0;
          display: flex; align-items: center; gap: 14px;
          border-radius: 0; border-top: 1px solid var(--border);
          background: none;
        }
        .jb-notice-art { flex: none; display: inline-flex; }
        .jb-notice-text { flex: 1 1 auto; min-width: 0; }
        .jb-notice-title {
          margin: 0; font-family: var(--font-head); font-weight: 700;
          font-size: 15.5px; color: var(--accent-ink);
        }
        .jb-notice-sub { margin: 5px 0 0; font-size: 13px; line-height: 1.45; color: var(--ink-dim); }
        .jb-notice-cta {
          flex: none; display: inline-flex; align-items: center; justify-content: center;
          height: 42px; padding: 0 16px; border-radius: 12px;
          border: 1px solid var(--border); color: var(--ink);
          font-family: var(--font-head); font-weight: 700; font-size: 13.5px;
          transition: border-color .16s ease, background .16s ease;
        }
        .jb-notice-cta:hover { border-color: var(--accent-ink); background: var(--panel-raised); }

        /* --------------------------------------------------- narrow */
        @media (max-width: 420px) {
          .jb-bar { flex-wrap: wrap; }
          .jb-search { order: 3; flex-basis: 100%; }
          .jb-title { flex: 1 1 auto; }
          .jb-promo { flex-wrap: wrap; }
          .jb-promo-cta { width: 100%; }
          .jb-feat-foot { flex-direction: column; align-items: stretch; }
          .jb-apply.lg { width: 100%; }
        }
      `}</style>
    </div>
  )
}
