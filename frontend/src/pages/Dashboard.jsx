import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, MessageCircle, Bell, Plus, BadgeCheck, MoreHorizontal, Heart,
  MessageSquare, Repeat2, Bookmark, Globe, Users, Briefcase, Rocket,
} from 'lucide-react'
import ElcoralMark from '../components/ElcoralMark.jsx'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'

/* ---------------------------------------------------------------- data ---- */

const STORIES = [
  { id: 'elcoral', name: 'Elcoral Official', tone: 'a', live: true, ring: true, brand: true },
  { id: 'jane', name: 'Jane Cooper', tone: 'b', online: true, ring: true },
  { id: 'dev', name: 'Dev Community', tone: 'c', brand: true },
  { id: 'designers', name: 'Designers Hub', tone: 'd', brand: true },
  { id: 'alex', name: 'Alex Johnson', tone: 'e', online: true },
  { id: 'sam', name: 'Sam Rivera', tone: 'f' },
]

const RECOMMENDED = [
  {
    id: 'david',
    title: 'David Chen',
    verified: true,
    subtitle: 'Full Stack Developer',
    chip: 'Open to work',
    chipDot: true,
    cta: 'Connect',
    tone: 'e',
  },
  {
    id: 'uiux',
    title: 'UI/UX Designers',
    subtitle: 'Community · 12.4K members',
    chip: 'Design',
    chipIcon: Users,
    cta: 'Join',
    tone: 'c',
    brand: true,
  },
  {
    id: 'rn',
    title: 'React Native Developer',
    subtitle: 'Job · Remote',
    chip: 'Full-time',
    chipIcon: Briefcase,
    cta: 'View',
    tone: 'a',
    brand: true,
  },
  {
    id: 'sarah',
    title: 'Sarah Lee',
    verified: true,
    subtitle: 'Product Designer',
    chip: 'Open to work',
    chipDot: true,
    cta: 'Connect',
    tone: 'b',
  },
]

const TABS = ['For you', 'Following', 'Projects', 'Jobs', 'Communities']

const POSTS = [
  {
    id: 'p1',
    author: 'Elcoral Official',
    handle: '@Elcoral',
    time: '2h ago',
    verified: true,
    brand: true,
    tone: 'a',
    body: `We're excited to announce new updates to Elcoral Platform.\nMore tools, more connections, more opportunities. 🚀\nBuild. Collaborate. Grow together.`,
    likes: 120,
    liked: true,
    comments: 24,
    reposts: 18,
  },
  {
    id: 'p2',
    author: 'Jane Cooper',
    handle: '@janecooper',
    time: '4h ago',
    verified: true,
    tone: 'b',
    body: `Just shipped the new dashboard for my project!\nWould love your feedback. 🙌`,
    attachment: {
      title: 'Project: TaskFlow Dashboard',
      desc: 'A modern dashboard for task and team management built with Next.js and Tailwind CSS.',
      tag: '#web-development',
    },
    likes: 98,
    liked: true,
    comments: 16,
    reposts: 10,
  },
  {
    id: 'p3',
    author: 'Dev Community',
    handle: '@devcommunity',
    time: '6h ago',
    verified: true,
    brand: true,
    tone: 'c',
    body: `What's the biggest challenge you face as a developer in 2024?\nDrop your thoughts below 👇`,
    likes: 64,
    comments: 41,
    reposts: 7,
  },
]

function initialsOf(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function Avatar({ name, tone = 'a', brand = false, size = 44, className = '' }) {
  return (
    <span
      className={`hm-av tone-${tone} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      aria-hidden="true"
    >
      {brand ? <ElcoralMark size={Math.round(size * 0.62)} color="var(--lemon)" /> : initialsOf(name)}
    </span>
  )
}

/* --------------------------------------------------------------- screen ---- */

export default function Dashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('For you')
  const [likes, setLikes] = useState(() =>
    Object.fromEntries(POSTS.map((p) => [p.id, { count: p.likes, on: !!p.liked }])),
  )
  const [saved, setSaved] = useState({})

  const firstName = user?.full_name ? user.full_name.split(' ')[0] : 'Elcoral'
  const progress = 65

  const toggleLike = (id) =>
    setLikes((s) => ({
      ...s,
      [id]: s[id].on ? { count: s[id].count - 1, on: false } : { count: s[id].count + 1, on: true },
    }))

  return (
    <div className="hm">
      {/* ------------------------------------------------------- app bar --- */}
      <header className="hm-bar">
        <Link to="/home" className="hm-brand">
          <ElcoralMark size={30} color="var(--lemon)" />
          <span>Elcoral</span>
        </Link>
        <div className="hm-bar-actions">
          <Link to="/home/search" className="hm-icon-btn" aria-label="Search">
            <Search size={23} strokeWidth={1.9} />
          </Link>
          <Link to="/home/messages" className="hm-icon-btn" aria-label="Messages">
            <MessageCircle size={23} strokeWidth={1.9} />
          </Link>
          <Link to="/home/notifications" className="hm-icon-btn" aria-label="Notifications">
            <Bell size={23} strokeWidth={1.9} />
            <span className="hm-badge">3</span>
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------- stories --- */}
      <section className="hm-stories" aria-label="Stories">
        <div className="hm-rail">
          <Link to="/home/create/story" className="hm-story-create">
            <span className="hm-story-plus"><Plus size={26} strokeWidth={2.2} /></span>
            <span className="hm-story-create-label">Create story</span>
          </Link>

          {STORIES.map((s) => (
            <Link key={s.id} to={`/home/stories/${s.id}`} className="hm-story">
              <span className={`hm-story-ring ${s.ring ? 'on' : ''}`}>
                <Avatar name={s.name} tone={s.tone} brand={s.brand} size={82} />
                {s.live && <span className="hm-live">LIVE</span>}
                {s.online && <span className="hm-online" />}
              </span>
              <span className="hm-story-name">{s.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- greeting --- */}
      <section className="hm-greet">
        <span className="hm-greet-art" aria-hidden="true">
          <Rocket size={26} strokeWidth={1.6} />
        </span>
        <div className="hm-greet-text">
          <p className="hm-greet-title">Good evening, {firstName}! 👋</p>
          <p className="hm-greet-sub">Let's build something amazing today.</p>
        </div>
        <Link to="/home/profile/edit" className="hm-progress">
          <span className="hm-progress-text">
            <span className="hm-progress-label">Complete profile</span>
            <span className="hm-progress-value">
              <b>{progress}%</b> complete
            </span>
          </span>
          <span
            className="hm-ring"
            style={{ background: `conic-gradient(var(--lemon) ${progress * 3.6}deg, var(--border) 0deg)` }}
          />
        </Link>
      </section>

      {/* --------------------------------------------------- recommended --- */}
      <div className="hm-section-head">
        <h2>Recommended for you</h2>
        <Link to="/home/discover" className="hm-see-all">See all</Link>
      </div>

      <div className="hm-rail hm-rec-rail">
        {RECOMMENDED.map((r) => {
          const ChipIcon = r.chipIcon
          return (
            <article key={r.id} className="hm-rec">
              <div className="hm-rec-top">
                <Avatar name={r.title} tone={r.tone} brand={r.brand} size={40} />
                <div className="hm-rec-id">
                  <h3>
                    {r.title}
                    {r.verified && <BadgeCheck className="hm-verified" size={16} />}
                  </h3>
                  <p>{r.subtitle}</p>
                </div>
              </div>
              <span className="hm-chip">
                {r.chipDot && <i className="hm-chip-dot" />}
                {ChipIcon && <ChipIcon size={13} strokeWidth={2} />}
                {r.chip}
              </span>
              <button type="button" className="hm-rec-cta">{r.cta}</button>
            </article>
          )
        })}
      </div>

      {/* ------------------------------------------------------------ tabs --- */}
      <nav className="hm-tabs" aria-label="Feed filters">
        <div className="hm-rail hm-tabs-rail">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`hm-tab ${tab === t ? 'on' : ''}`}
              aria-current={tab === t ? 'page' : undefined}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      {/* ------------------------------------------------------------ feed --- */}
      <div className="hm-feed">
        {POSTS.map((p) => (
          <article key={p.id} className="hm-post">
            <header className="hm-post-head">
              <Avatar name={p.author} tone={p.tone} brand={p.brand} size={44} />
              <div className="hm-post-id">
                <h3>
                  {p.author}
                  {p.verified && <BadgeCheck className="hm-verified" size={17} />}
                </h3>
                <p>
                  {p.handle} · {p.time} · <Globe size={12} strokeWidth={2} />
                </p>
              </div>
              <button type="button" className="hm-post-more" aria-label="Post options">
                <MoreHorizontal size={20} />
              </button>
            </header>

            <p className="hm-post-body">{p.body}</p>

            {p.attachment && (
              <Link to="/home/projects/taskflow" className="hm-attach">
                <span className="hm-attach-thumb" aria-hidden="true" />
                <span className="hm-attach-text">
                  <span className="hm-attach-title">{p.attachment.title}</span>
                  <span className="hm-attach-desc">{p.attachment.desc}</span>
                  <span className="hm-attach-tag">{p.attachment.tag}</span>
                </span>
              </Link>
            )}

            <footer className="hm-actions">
              <button
                type="button"
                className={`hm-action ${likes[p.id].on ? 'liked' : ''}`}
                onClick={() => toggleLike(p.id)}
                aria-pressed={likes[p.id].on}
              >
                <Heart size={21} strokeWidth={1.9} fill={likes[p.id].on ? 'currentColor' : 'none'} />
                {likes[p.id].count}
              </button>
              <button type="button" className="hm-action">
                <MessageSquare size={21} strokeWidth={1.9} />
                {p.comments}
              </button>
              <button type="button" className="hm-action">
                <Repeat2 size={22} strokeWidth={1.9} />
                {p.reposts}
              </button>
              <button
                type="button"
                className={`hm-action hm-action-save ${saved[p.id] ? 'on' : ''}`}
                aria-label="Save post"
                onClick={() => setSaved((s) => ({ ...s, [p.id]: !s[p.id] }))}
              >
                <Bookmark size={21} strokeWidth={1.9} fill={saved[p.id] ? 'currentColor' : 'none'} />
              </button>
            </footer>
          </article>
        ))}
      </div>

      <Link to="/home/create" className="hm-fab" aria-label="Create">
        <Plus size={30} strokeWidth={2.4} />
      </Link>

      <style>{`
        /* full-bleed against AppShell's 20px page padding */
        .hm { --gut: 20px; margin: -24px -20px 0; padding-bottom: 8px; }
        @media (min-width: 860px) { .hm { margin: -32px -40px 0; --gut: 40px; } }

        .hm-av {
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; flex: none; overflow: hidden;
          font-family: var(--font-head); font-weight: 700; letter-spacing: .3px;
          color: var(--ink); background: var(--panel-raised);
        }
        .hm-av.tone-a { background: linear-gradient(145deg,#1d2415,#0f1309); color: var(--accent-ink); }
        .hm-av.tone-b { background: linear-gradient(145deg,#3a2a20,#1a130e); }
        .hm-av.tone-c { background: linear-gradient(145deg,#151a10,#0c0f08); }
        .hm-av.tone-d { background: linear-gradient(145deg,#101410,#0a0c07); }
        .hm-av.tone-e { background: linear-gradient(145deg,#28303a,#12161b); }
        .hm-av.tone-f { background: linear-gradient(145deg,#2b2233,#141019); }

        .hm-verified { color: var(--accent-ink); flex: none; }

        /* -------------------------------------------------------- app bar */
        .hm-bar {
          position: sticky; top: 0; z-index: 30;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 14px var(--gut) 12px;
          background: color-mix(in srgb, var(--bg) 88%, transparent);
          backdrop-filter: blur(14px);
        }
        .hm-brand { display: flex; align-items: center; gap: 9px; color: var(--ink); }
        .hm-brand span {
          font-family: var(--font-display); font-size: 22px; font-weight: 700; letter-spacing: -0.3px;
        }
        .hm-bar-actions { display: flex; align-items: center; gap: 6px; }
        .hm-icon-btn {
          position: relative; display: grid; place-items: center;
          width: 40px; height: 40px; border-radius: 999px; color: var(--ink);
          transition: background .15s ease, color .15s ease;
        }
        .hm-icon-btn:hover { background: var(--panel); color: var(--accent-ink); }
        .hm-badge {
          position: absolute; top: 2px; right: 2px; min-width: 17px; height: 17px;
          padding: 0 4px; border-radius: 999px; background: var(--lemon); color: var(--on-accent);
          font-family: var(--font-head); font-size: 10.5px; font-weight: 700;
          display: grid; place-items: center; border: 2px solid var(--bg);
        }

        /* --------------------------------------------------------- rails */
        .hm-rail {
          display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x proximity;
          padding: 0 var(--gut); -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .hm-rail::-webkit-scrollbar { display: none; }
        .hm-rail > * { scroll-snap-align: start; }

        /* ------------------------------------------------------- stories */
        .hm-stories { padding: 4px 0 6px; }
        .hm-story-create {
          flex: none; width: 96px; height: 122px; border-radius: 14px;
          background: var(--panel); border: 1px solid var(--border);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
          color: var(--ink); transition: border-color .15s ease;
        }
        .hm-story-create:hover { border-color: var(--accent-ink); }
        .hm-story-plus {
          width: 46px; height: 46px; border-radius: 999px; background: var(--lemon); color: var(--on-accent);
          display: grid; place-items: center;
        }
        .hm-story-create-label {
          font-family: var(--font-head); font-size: 12.5px; font-weight: 600;
          line-height: 1.15; text-align: center; max-width: 62px;
        }
        .hm-story { flex: none; width: 96px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .hm-story-ring {
          position: relative; width: 90px; height: 90px; border-radius: 999px;
          display: grid; place-items: center;
          border: 2px solid var(--border);
        }
        .hm-story-ring.on { border-color: var(--accent-ink); }
        .hm-live {
          position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
          background: var(--lemon); color: var(--on-accent); border: 2px solid var(--bg);
          font-family: var(--font-head); font-size: 9.5px; font-weight: 700; letter-spacing: .6px;
          padding: 2px 7px; border-radius: 999px;
        }
        .hm-online {
          position: absolute; right: 3px; bottom: 6px; width: 14px; height: 14px;
          border-radius: 999px; background: #2E9BF5; border: 2.5px solid var(--bg);
        }
        .hm-story-name {
          font-family: var(--font-head); font-size: 12.5px; font-weight: 600; color: var(--ink);
          text-align: center; line-height: 1.2;
        }

        /* ------------------------------------------------------- greeting */
        .hm-greet {
          margin: 12px var(--gut) 0; padding: 12px;
          display: flex; align-items: center; gap: 12px;
          background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
        }
        .hm-greet-art {
          width: 58px; height: 58px; flex: none; border-radius: 12px;
          background: var(--panel-raised); color: var(--accent-ink);
          display: grid; place-items: center;
        }
        .hm-greet-text { flex: 1; min-width: 0; }
        .hm-greet-title {
          margin: 0; font-family: var(--font-head); font-size: 15.5px; font-weight: 700; color: var(--ink);
        }
        .hm-greet-sub { margin: 3px 0 0; font-size: 13px; color: var(--ink-dim); }
        .hm-progress {
          flex: none; display: flex; align-items: center; gap: 10px;
          background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 12px; padding: 9px 11px; color: var(--ink);
        }
        .hm-progress-text { display: flex; flex-direction: column; gap: 2px; }
        .hm-progress-label { font-family: var(--font-head); font-size: 13px; font-weight: 600; }
        .hm-progress-value { font-size: 11.5px; color: var(--ink-dim); }
        .hm-progress-value b { color: var(--accent-ink); font-weight: 700; }
        .hm-ring {
          width: 34px; height: 34px; border-radius: 999px; flex: none;
          -webkit-mask: radial-gradient(circle, transparent 10px, #000 11px);
          mask: radial-gradient(circle, transparent 10px, #000 11px);
        }
        @media (max-width: 420px) {
          .hm-greet { flex-wrap: wrap; }
          .hm-progress { width: 100%; justify-content: space-between; }
        }

        /* ------------------------------------------------------ section head */
        .hm-section-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px var(--gut) 12px;
        }
        .hm-section-head h2 {
          margin: 0; font-family: var(--font-head); font-size: 17px; font-weight: 700; color: var(--ink);
        }
        .hm-see-all { font-family: var(--font-head); font-size: 14px; font-weight: 600; color: var(--accent-ink); }

        /* ----------------------------------------------------- recommended */
        .hm-rec-rail { padding-bottom: 4px; }
        .hm-rec {
          flex: none; width: 240px; padding: 12px;
          background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .hm-rec-top { display: flex; align-items: center; gap: 10px; }
        .hm-rec-id { min-width: 0; }
        .hm-rec-id h3 {
          margin: 0; display: flex; align-items: center; gap: 5px;
          font-family: var(--font-head); font-size: 14.5px; font-weight: 700; color: var(--ink);
          line-height: 1.2;
        }
        .hm-rec-id p { margin: 3px 0 0; font-size: 12px; color: var(--ink-dim); }
        .hm-chip {
          align-self: flex-start; display: inline-flex; align-items: center; gap: 6px;
          background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 999px; padding: 5px 11px;
          font-size: 12px; font-weight: 600; color: var(--ink-dim);
        }
        .hm-chip svg { color: var(--accent-ink); }
        .hm-chip-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--lemon); }
        .hm-rec-cta {
          width: 100%; border: 0; border-radius: 10px; padding: 11px 12px;
          background: var(--lemon); color: var(--on-accent); cursor: pointer;
          font-family: var(--font-head); font-size: 14.5px; font-weight: 700;
          transition: background .15s ease;
        }
        .hm-rec-cta:hover { background: var(--ink); }

        /* ------------------------------------------------------------ tabs */
        .hm-tabs {
          position: sticky; top: 64px; z-index: 20; margin-top: 16px;
          background: color-mix(in srgb, var(--bg) 92%, transparent);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }
        .hm-tabs-rail { gap: 4px; }
        .hm-tab {
          flex: none; background: none; border: 0; cursor: pointer;
          padding: 13px 12px; margin-bottom: -1px;
          border-bottom: 2px solid transparent;
          font-family: var(--font-head); font-size: 14.5px; font-weight: 600; color: var(--ink-dim);
          transition: color .15s ease;
        }
        .hm-tab:hover { color: var(--ink); }
        .hm-tab.on { color: var(--accent-ink); border-bottom-color: var(--accent-ink); }

        /* ------------------------------------------------------------ feed */
        .hm-feed { display: flex; flex-direction: column; gap: 12px; padding: 14px var(--gut) 0; }
        .hm-post {
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; padding: 14px;
        }
        .hm-post-head { display: flex; align-items: center; gap: 11px; }
        .hm-post-id { flex: 1; min-width: 0; }
        .hm-post-id h3 {
          margin: 0; display: flex; align-items: center; gap: 5px;
          font-family: var(--font-head); font-size: 15.5px; font-weight: 700; color: var(--ink);
        }
        .hm-post-id p {
          margin: 2px 0 0; display: flex; align-items: center; gap: 5px;
          font-size: 12.5px; color: var(--ink-faint);
        }
        .hm-post-more {
          background: none; border: 0; color: var(--ink-dim); cursor: pointer;
          width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center;
        }
        .hm-post-more:hover { background: var(--panel-raised); color: var(--ink); }
        .hm-post-body {
          margin: 12px 0 0; white-space: pre-line;
          font-size: 14.5px; line-height: 1.55; color: var(--ink);
        }

        .hm-attach {
          margin-top: 12px; display: flex; gap: 12px; padding: 10px;
          background: var(--panel-raised); border: 1px solid var(--border); border-radius: 12px;
          transition: border-color .15s ease;
        }
        .hm-attach:hover { border-color: var(--accent-ink); }
        .hm-attach-thumb {
          width: 108px; height: 74px; flex: none; border-radius: 8px;
          background:
            radial-gradient(120px 60px at 30% 20%, rgba(196,241,53,.18), transparent 70%),
            linear-gradient(135deg, #2A2352, #171233);
          border: 1px solid var(--border);
        }
        .hm-attach-text { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .hm-attach-title {
          font-family: var(--font-head); font-size: 14px; font-weight: 700; color: var(--ink); line-height: 1.25;
        }
        .hm-attach-desc { font-size: 12.5px; line-height: 1.4; color: var(--ink-dim); }
        .hm-attach-tag {
          align-self: flex-start; margin-top: 2px; padding: 3px 9px; border-radius: 999px;
          background: rgba(150,120,255,.14); color: #A99BFF; font-size: 11.5px; font-weight: 600;
        }
        @media (max-width: 380px) {
          .hm-attach { flex-direction: column; }
          .hm-attach-thumb { width: 100%; height: 120px; }
        }

        .hm-actions {
          margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border);
          display: flex; align-items: center; gap: 22px;
        }
        .hm-action {
          background: none; border: 0; cursor: pointer; padding: 2px;
          display: inline-flex; align-items: center; gap: 8px;
          color: var(--ink-dim);
          font-family: var(--font-head); font-size: 13.5px; font-weight: 600;
          transition: color .15s ease, transform .12s ease;
        }
        .hm-action:hover { color: var(--ink); }
        .hm-action:active { transform: scale(0.93); }
        .hm-action.liked { color: var(--accent-ink); }
        .hm-action-save { margin-left: auto; }
        .hm-action-save.on { color: var(--accent-ink); }

        /* ------------------------------------------------------------- fab */
        .hm-fab {
          position: fixed; right: 20px; z-index: 40;
          bottom: calc(92px + env(safe-area-inset-bottom));
          width: 62px; height: 62px; border-radius: 999px;
          display: grid; place-items: center;
          background: var(--lemon); color: var(--on-accent);
          box-shadow: 0 10px 26px rgba(196,241,53,.28);
          transition: transform .15s ease;
        }
        .hm-fab:active { transform: scale(0.94); }
        @media (min-width: 860px) { .hm-fab { bottom: 32px; right: 32px; } }
      `}</style>
    </div>
  )
}
