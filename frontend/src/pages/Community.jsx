import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Bell, UserPlus, X, Crown, ArrowRight, ThumbsUp,
  MessageSquare, Eye, Bookmark, MoreHorizontal, Users, Rocket, Gamepad2,
  BarChart3, Palette, Leaf,
} from 'lucide-react'
import ElcoralMark from '../components/ElcoralMark.jsx'

/* ---------------------------------------------------------------- data ---- */

const FILTERS = ['For you', 'All', 'Tech', 'Design', 'Business', 'AI', 'Startups']

const MINE = [
  { id: 'm1', name: 'Elcoral Official', members: '12.4K members', brand: true, owner: true, tone: 'lemon' },
  { id: 'm2', name: 'Web Developers', members: '28.7K members', glyph: '</>', tone: 'lemon' },
  { id: 'm3', name: 'UI/UX Designers', members: '15.3K members', glyph: 'figma', tone: 'dark' },
  { id: 'm4', name: 'Startups Hub', members: '9.1K members', glyph: 'rocket', tone: 'dark' },
  { id: 'm5', name: 'Python Community', members: '17.6K members', glyph: 'python', tone: 'dark' },
  { id: 'm6', name: 'Data Science', members: '8.4K members', glyph: 'chart', tone: 'dark' },
]

const TRENDING = [
  {
    id: 't1', name: 'AI Builders', desc: 'Share, learn and build AI projects together.',
    members: '24.8K members', fresh: '380 new today', logo: 'ai', tone: 'violet',
  },
  {
    id: 't2', name: 'Open Source Hub', desc: 'Collaborate on open source and make an impact.',
    members: '18.5K members', fresh: '210 new today', logo: 'leaf', tone: 'leaf',
  },
  {
    id: 't3', name: 'Game Developers', desc: 'Everything about game development.',
    members: '11.2K members', fresh: '125 new today', logo: 'pad', tone: 'pink',
  },
]

const DISCUSSIONS = [
  {
    id: 'd1', title: 'What tech stack are you using in 2024?', author: 'Jane Cooper',
    group: 'Web Developers', groupIcon: 'leaf', time: '2h ago', likes: 128, comments: 56, views: '1.2K', av: 'a',
  },
  {
    id: 'd2', title: 'Best practices for UI design in mobile apps?', author: 'Alex Johnson',
    group: 'UI/UX Designers', groupIcon: 'palette', time: '5h ago', likes: 96, comments: 34, views: '870', av: 'b',
  },
  {
    id: 'd3', title: 'How I got my first 3 freelance clients', author: 'David Chen',
    group: 'Startups Hub', groupIcon: 'rocket', time: '1d ago', likes: 204, comments: 78, views: '2.1K', av: 'c',
  },
]

/* ------------------------------------------------------------- helpers ---- */

function initialsOf(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function Glyph({ item, size }) {
  if (item.brand) return <ElcoralMark size={Math.round(size * 0.56)} color="var(--lemon)" />
  const g = item.glyph ?? item.logo
  if (g === 'figma') {
    return (
      <svg width={size * 0.5} height={size * 0.62} viewBox="0 0 38 57" aria-hidden="true">
        <path fill="#1ABCFE" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" />
        <path fill="#0ACF83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 0 1-19 0Z" />
        <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" />
        <path fill="#F24E1E" d="M0 9.5A9.5 9.5 0 0 1 9.5 0H19v19H9.5A9.5 9.5 0 0 1 0 9.5Z" />
        <path fill="#A259FF" d="M0 28.5A9.5 9.5 0 0 1 9.5 19H19v19H9.5A9.5 9.5 0 0 1 0 28.5Z" />
      </svg>
    )
  }
  if (g === 'python') {
    return (
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#3B7DB1" d="M11.9 2c-2.6 0-4.4.6-4.4 3v2h4.6v.7H5.6C3.5 7.7 2 9 2 11.9c0 2.6 1.3 4.2 3.4 4.2h1.7v-2.5c0-2.3 2-4.2 4.3-4.2h4.1c1.8 0 3.1-1.4 3.1-3.1V5C18.6 3.2 17 2 14.9 2h-3Zm-2.5 1.7c.5 0 .9.4.9.9s-.4.9-.9.9a.9.9 0 0 1-.9-.9c0-.5.4-.9.9-.9Z" />
        <path fill="#F5C33B" d="M12.1 22c2.6 0 4.4-.6 4.4-3v-2h-4.6v-.7h6.5c2.1 0 3.6-1.3 3.6-4.2 0-2.6-1.3-4.2-3.4-4.2h-1.7v2.5c0 2.3-2 4.2-4.3 4.2H8.5c-1.8 0-3.1 1.4-3.1 3.1V19c0 1.8 1.6 3 3.7 3h3Zm2.5-1.7a.9.9 0 0 1-.9-.9c0-.5.4-.9.9-.9s.9.4.9.9-.4.9-.9.9Z" />
      </svg>
    )
  }
  if (g === 'ai') return <span className="cm-word">ai</span>
  if (g === 'leaf') {
    return (
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none"
           stroke="var(--lemon)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 4c0 9-5.5 15-13 15 0-8 5-15 13-15Z" />
        <path d="M4 20c2-4 5-7 9-9" />
      </svg>
    )
  }
  if (g === 'rocket') return <Rocket size={Math.round(size * 0.46)} strokeWidth={1.8} color="var(--lemon)" />
  if (g === 'chart') return <BarChart3 size={Math.round(size * 0.46)} strokeWidth={1.8} color="var(--lemon)" />
  if (g === 'pad') return <Gamepad2 size={Math.round(size * 0.5)} strokeWidth={1.8} color="#fff" />
  if (g === '</>') return <span className="cm-word code">{'</>'}</span>
  if (g) return <span className="cm-emoji" style={{ fontSize: Math.round(size * 0.44) }}>{g}</span>
  return <span className="cm-word">{initialsOf(item.name)}</span>
}

function GroupIcon({ name }) {
  const Icon = name === 'palette' ? Palette : name === 'rocket' ? Rocket : Leaf
  return <Icon size={14} strokeWidth={1.9} color="var(--lemon)" aria-hidden="true" />
}

/* --------------------------------------------------------------- screen ---- */

export default function Community() {
  const [filter, setFilter] = useState('For you')
  const [promo, setPromo] = useState(true)
  const [joined, setJoined] = useState({})
  const [saved, setSaved] = useState({})

  return (
    <div className="cm">
      {/* -------------------------------------------------------- app bar --- */}
      <header className="cm-bar">
        <h1 className="cm-title">Communities</h1>
        <Link to="/home/notifications" className="cm-icon-btn" aria-label="Notifications">
          <Bell size={23} strokeWidth={1.9} />
          <span className="cm-badge">3</span>
        </Link>
        <Link to="/home/community/invite" className="cm-icon-btn" aria-label="Invite people">
          <UserPlus size={23} strokeWidth={1.9} />
        </Link>
      </header>

      <div className="cm-searchwrap">
        <label className="cm-search">
          <Search size={19} strokeWidth={2} />
          <input type="search" placeholder="Search communities or topics" aria-label="Search communities" />
        </label>
      </div>

      {/* -------------------------------------------------------- filters --- */}
      <nav className="cm-filters" aria-label="Community filters">
        <div className="cm-rail cm-filters-rail">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`cm-filter ${filter === f ? 'on' : ''}`}
              aria-current={filter === f ? 'true' : undefined}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
          <button type="button" className="cm-filter more" aria-label="More filters">
            <MoreHorizontal size={18} strokeWidth={2.2} />
          </button>
        </div>
      </nav>

      {/* -------------------------------------------------- my communities --- */}
      <div className="cm-section-head">
        <h2>My communities</h2>
        <Link to="/home/community/mine" className="cm-see-all">See all</Link>
      </div>

      <div className="cm-rail cm-mine-rail">
        {MINE.map((c) => (
          <Link key={c.id} to="/home/community/mine" className="cm-mine">
            <span className={`cm-tile tone-${c.tone}`} aria-hidden="true">
              <Glyph item={c} size={64} />
            </span>
            {c.owner && <span className="cm-crown" aria-label="Owner"><Crown size={13} strokeWidth={2.2} /></span>}
            <p className="cm-mine-name">{c.name}</p>
            <p className="cm-mine-meta">{c.members}<i className="cm-live" /></p>
          </Link>
        ))}
      </div>

      {/* ---------------------------------------------------------- promo --- */}
      {promo && (
        <section className="cm-promo">
          <span className="cm-promo-art" aria-hidden="true">
            <svg viewBox="0 0 160 120" width="132" height="99" fill="none">
              <g stroke="var(--lemon-deep)" strokeWidth="1.2" opacity=".85">
                <path d="M30 44 62 30M62 30 96 42M96 42 76 74M76 74 44 90M44 90 30 44M96 42 122 52M76 74 118 84M44 90 62 30M30 44 76 74" />
              </g>
              {[[62, 30, 15], [30, 44, 11], [96, 42, 12], [76, 74, 10], [44, 90, 11], [122, 52, 8], [118, 84, 8], [138, 34, 6]].map(([x, y, r], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r={r} fill="#0F1409" stroke="var(--lemon)" strokeWidth="1.4" />
                  <circle cx={x} cy={y - r * 0.22} r={r * 0.26} fill="var(--lemon)" />
                  <path d={`M${x - r * 0.42} ${y + r * 0.5}a${r * 0.42} ${r * 0.42} 0 0 1 ${r * 0.84} 0`} fill="var(--lemon)" />
                </g>
              ))}
            </svg>
          </span>
          <div className="cm-promo-text">
            <p className="cm-promo-title">Connect. Collaborate. Grow.</p>
            <p className="cm-promo-sub">Join communities that match your interests and build meaningful connections.</p>
            <Link to="/home/community/discover" className="cm-promo-cta">
              Discover communities <ArrowRight size={17} strokeWidth={2.2} />
            </Link>
          </div>
          <button type="button" className="cm-promo-close" aria-label="Dismiss" onClick={() => setPromo(false)}>
            <X size={20} strokeWidth={2} />
          </button>
        </section>
      )}

      {/* ------------------------------------------------------- trending --- */}
      <div className="cm-section-head">
        <h2>Trending communities</h2>
        <Link to="/home/community/trending" className="cm-see-all">See all</Link>
      </div>

      <ul className="cm-card cm-list">
        {TRENDING.map((c) => (
          <li key={c.id} className="cm-row">
            <span className={`cm-logo tone-${c.tone}`} aria-hidden="true">
              <Glyph item={c} size={56} />
            </span>
            <div className="cm-row-id">
              <h3>{c.name}</h3>
              <p className="cm-row-desc">{c.desc}</p>
              <p className="cm-row-meta">
                {c.members}<span className="cm-sep">•</span><span className="cm-fresh">{c.fresh}</span>
              </p>
            </div>
            <button
              type="button"
              className={`cm-join ${joined[c.id] ? 'on' : ''}`}
              aria-pressed={joined[c.id] ? 'true' : 'false'}
              onClick={() => setJoined((s) => ({ ...s, [c.id]: !s[c.id] }))}
            >
              {joined[c.id] ? 'Joined' : 'Join'}
            </button>
          </li>
        ))}
      </ul>

      {/* -------------------------------------------------- top discussions --- */}
      <div className="cm-section-head">
        <h2>Top discussions</h2>
        <Link to="/home/community/discussions" className="cm-see-all">See all</Link>
      </div>

      <ul className="cm-card cm-list">
        {DISCUSSIONS.map((d) => (
          <li key={d.id} className="cm-disc">
            <span className={`cm-avatar av-${d.av}`} aria-hidden="true">{initialsOf(d.author)}</span>
            <div className="cm-disc-body">
              <div className="cm-disc-top">
                <h3>{d.title}</h3>
                <button type="button" className="cm-more" aria-label="More options">
                  <MoreHorizontal size={19} strokeWidth={2.2} />
                </button>
              </div>
              <p className="cm-disc-meta">
                {d.author}<span className="cm-sep">•</span>in{' '}
                <span className="cm-disc-group"><GroupIcon name={d.groupIcon} />{d.group}</span>
                <span className="cm-disc-time">{d.time}</span>
              </p>
              <div className="cm-disc-stats">
                <span className="cm-stat"><ThumbsUp size={17} strokeWidth={1.9} />{d.likes}</span>
                <span className="cm-stat"><MessageSquare size={17} strokeWidth={1.9} />{d.comments}</span>
                <span className="cm-stat"><Eye size={17} strokeWidth={1.9} />{d.views}</span>
                <button
                  type="button"
                  className={`cm-save ${saved[d.id] ? 'on' : ''}`}
                  aria-label="Save discussion"
                  onClick={() => setSaved((s) => ({ ...s, [d.id]: !s[d.id] }))}
                >
                  <Bookmark size={18} strokeWidth={1.9} fill={saved[d.id] ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* ---------------------------------------------------------- create --- */}
      <section className="cm-create">
        <span className="cm-create-art" aria-hidden="true">
          <Users size={34} strokeWidth={1.7} />
        </span>
        <div className="cm-create-text">
          <p className="cm-create-title">Create your own community</p>
          <p className="cm-create-sub">Build a space around your passion and bring people together.</p>
        </div>
        <Link to="/home/create/community" className="cm-create-cta">Create community</Link>
      </section>

      <style>{`
        .cm { --gut: 20px; margin: -24px -20px 0; padding-bottom: 12px; }
        @media (min-width: 860px) { .cm { margin: -32px -40px 0; --gut: 40px; } }

        /* ------------------------------------------------------- app bar */
        .cm-bar {
          position: sticky; top: 0; z-index: 30;
          display: flex; align-items: center; gap: 8px;
          padding: 14px var(--gut) 8px;
          background: color-mix(in srgb, var(--bg) 92%, transparent);
          backdrop-filter: blur(14px);
        }
        .cm-title {
          margin: 0; flex: 1 1 auto; min-width: 0;
          font-family: var(--font-display); font-weight: 800;
          font-size: 28px; letter-spacing: -.6px; color: var(--ink);
        }
        .cm-icon-btn {
          position: relative; flex: none;
          width: 40px; height: 40px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--ink); transition: background .15s ease, color .15s ease;
        }
        .cm-icon-btn:hover { background: var(--panel); color: var(--lemon); }
        .cm-badge {
          position: absolute; top: 2px; right: 2px; min-width: 17px; height: 17px;
          padding: 0 4px; border-radius: 999px; background: var(--lemon); color: #0B0D0A;
          font-family: var(--font-head); font-size: 11px; font-weight: 700;
          display: inline-flex; align-items: center; justify-content: center;
          border: 2px solid var(--bg);
        }

        /* -------------------------------------------------------- search */
        .cm-searchwrap { padding: 4px var(--gut) 0; }
        .cm-search {
          display: flex; align-items: center; gap: 10px;
          height: 46px; padding: 0 14px; border-radius: 14px;
          background: var(--panel); border: 1px solid var(--border);
          color: var(--ink-faint);
        }
        .cm-search:focus-within { border-color: var(--lemon); }
        .cm-search input {
          flex: 1; min-width: 0; background: none; border: none; outline: none;
          color: var(--ink); font-family: var(--font-body); font-size: 15px;
        }
        .cm-search input::placeholder { color: var(--ink-faint); }
        .cm-search input::-webkit-search-cancel-button { display: none; }

        /* ------------------------------------------------------- filters */
        .cm-rail {
          display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x proximity;
          padding: 0 var(--gut); scrollbar-width: none; -webkit-overflow-scrolling: touch;
        }
        .cm-rail::-webkit-scrollbar { display: none; }
        .cm-filters { padding: 14px 0 4px; }
        .cm-filter {
          flex: none; padding: 9px 18px; border-radius: 999px;
          background: var(--panel); border: 1px solid var(--border);
          font-family: var(--font-head); font-weight: 600; font-size: 14px;
          color: var(--ink-dim); transition: all .15s ease; white-space: nowrap;
        }
        .cm-filter:hover { color: var(--ink); border-color: var(--lemon-deep); }
        .cm-filter.on { background: var(--lemon); border-color: var(--lemon); color: #0B0D0A; }
        .cm-filter.more { display: inline-flex; align-items: center; justify-content: center; width: 42px; padding: 0; }

        /* -------------------------------------------------- section heads */
        .cm-section-head {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 12px; padding: 20px var(--gut) 10px;
        }
        .cm-section-head h2 {
          margin: 0; font-family: var(--font-head); font-weight: 700;
          font-size: 18px; letter-spacing: -.2px; color: var(--ink);
        }
        .cm-see-all {
          font-family: var(--font-head); font-weight: 600; font-size: 14px; color: var(--lemon);
        }
        .cm-see-all:hover { text-decoration: underline; }

        /* ------------------------------------------------ my communities */
        .cm-mine-rail { padding-bottom: 4px; }
        .cm-mine {
          position: relative; flex: none; width: 138px; scroll-snap-align: start;
          padding: 14px 14px 12px; border-radius: 16px;
          background: var(--panel); border: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 10px;
          transition: border-color .15s ease, transform .15s ease;
        }
        .cm-mine:hover { border-color: var(--lemon-deep); }
        .cm-mine:active { transform: scale(.98); }
        .cm-tile {
          width: 64px; height: 64px; border-radius: 14px; flex: none;
          display: inline-flex; align-items: center; justify-content: center;
          background: #0F1309; border: 1px solid var(--border); overflow: hidden;
        }
        .cm-tile.tone-lemon { background: radial-gradient(120% 120% at 30% 20%, #1c2412, #0c1007); }
        .cm-tile.tone-dark { background: radial-gradient(120% 120% at 30% 20%, #191d13, #0b0e07); }
        .cm-word {
          font-family: var(--font-head); font-weight: 800; font-size: 24px;
          color: var(--lemon); letter-spacing: -.5px;
        }
        .cm-word.code { font-size: 22px; }
        .cm-emoji { line-height: 1; }
        .cm-crown {
          position: absolute; top: 10px; right: 10px;
          width: 22px; height: 22px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--lemon); color: #0B0D0A;
        }
        .cm-mine-name {
          margin: 0; font-family: var(--font-head); font-weight: 700; font-size: 15px;
          line-height: 1.25; color: var(--ink);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
          min-height: 38px;
        }
        .cm-mine-meta {
          margin: 0; display: flex; align-items: center; gap: 6px;
          font-size: 12.5px; color: var(--ink-dim);
        }
        .cm-live {
          width: 6px; height: 6px; border-radius: 999px; background: var(--lemon);
          box-shadow: 0 0 6px var(--lemon-dim); flex: none;
        }

        /* --------------------------------------------------------- promo */
        .cm-promo {
          position: relative; margin: 18px var(--gut) 0;
          display: flex; align-items: center; gap: 6px;
          padding: 16px 16px 18px; border-radius: 18px;
          background: linear-gradient(120deg, #12170C 0%, #0F1309 60%, #131808 100%);
          border: 1px solid var(--border); overflow: hidden;
        }
        .cm-promo-art { flex: none; display: none; opacity: .95; margin-left: -10px; margin-right: -4px; }
        @media (min-width: 400px) { .cm-promo-art { display: block; } }
        .cm-promo-text { flex: 1 1 auto; min-width: 0; padding-right: 22px; }
        .cm-promo-title {
          margin: 0; font-family: var(--font-head); font-weight: 700; font-size: 15px;
          color: var(--lemon); letter-spacing: -.3px; white-space: nowrap;
        }
        .cm-promo-sub {
          margin: 6px 0 0; font-size: 14px; line-height: 1.45; color: var(--ink-dim);
          padding-right: 16px;
        }
        .cm-promo-cta {
          margin-top: 14px; float: right;
          display: inline-flex; align-items: center; gap: 8px;
          padding: 11px 18px; border-radius: 12px;
          background: var(--lemon); color: #0B0D0A;
          font-family: var(--font-head); font-weight: 700; font-size: 14.5px;
          white-space: nowrap; transition: background .15s ease, transform .15s ease;
        }
        .cm-promo-cta:hover { background: var(--ink); }
        .cm-promo-cta:active { transform: scale(.97); }
        .cm-promo-close {
          position: absolute; top: 12px; right: 12px; color: var(--ink-dim);
          width: 28px; height: 28px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .cm-promo-close:hover { color: var(--ink); background: var(--panel-raised); }

        /* ---------------------------------------------------- card lists */
        .cm-card {
          margin: 0 var(--gut); padding: 0; list-style: none;
          background: var(--panel); border: 1px solid var(--border); border-radius: 18px;
          overflow: hidden;
        }
        .cm-list > li + li { border-top: 1px solid var(--border); }

        .cm-row { display: flex; align-items: center; gap: 12px; padding: 14px 14px; }
        .cm-logo {
          width: 56px; height: 56px; border-radius: 14px; flex: none;
          display: inline-flex; align-items: center; justify-content: center; overflow: hidden;
          border: 1px solid var(--border);
        }
        .cm-logo.tone-violet { background: linear-gradient(150deg,#8B45F0,#5B21C0); border-color: transparent; }
        .cm-logo.tone-violet .cm-word { color: #fff; }
        .cm-logo.tone-leaf { background: radial-gradient(120% 120% at 30% 20%, #1b2412, #0c1007); }
        .cm-logo.tone-pink { background: linear-gradient(150deg,#F0568E,#8B2BD9); border-color: transparent; }
        .cm-row-id { flex: 1 1 auto; min-width: 0; }
        .cm-row-id h3 {
          margin: 0; font-family: var(--font-head); font-weight: 700; font-size: 15.5px; color: var(--ink);
        }
        .cm-row-desc {
          margin: 3px 0 0; font-size: 13.5px; line-height: 1.35; color: var(--ink-dim);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .cm-row-meta {
          margin: 5px 0 0; display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
          font-size: 12.5px; color: var(--ink-faint);
        }
        .cm-sep { color: var(--ink-faint); }
        .cm-fresh { color: var(--lemon); font-weight: 600; }
        .cm-join {
          flex: none; padding: 9px 20px; border-radius: 10px;
          border: 1px solid var(--lemon); color: var(--lemon); background: transparent;
          font-family: var(--font-head); font-weight: 700; font-size: 14px;
          transition: background .15s ease, color .15s ease, transform .15s ease;
        }
        .cm-join:hover { background: color-mix(in srgb, var(--lemon) 14%, transparent); }
        .cm-join:active { transform: scale(.96); }
        .cm-join.on { background: var(--lemon); color: #0B0D0A; }

        /* ---------------------------------------------------- discussions */
        .cm-disc { display: flex; gap: 12px; padding: 14px 14px 12px; }
        .cm-avatar {
          width: 46px; height: 46px; border-radius: 999px; flex: none;
          display: inline-flex; align-items: center; justify-content: center;
          font-family: var(--font-head); font-weight: 700; font-size: 15px; color: #0B0D0A;
        }
        .cm-avatar.av-a { background: linear-gradient(150deg,#E7C98F,#B07B4C); }
        .cm-avatar.av-b { background: linear-gradient(150deg,#9FC7E8,#4B7BA8); }
        .cm-avatar.av-c { background: linear-gradient(150deg,#CBD5C0,#7C8C6A); }
        .cm-disc-body { flex: 1 1 auto; min-width: 0; }
        .cm-disc-top { display: flex; align-items: flex-start; gap: 8px; }
        .cm-disc-top h3 {
          margin: 0; flex: 1 1 auto; min-width: 0;
          font-family: var(--font-head); font-weight: 700; font-size: 15.5px;
          line-height: 1.3; color: var(--ink);
        }
        .cm-more { flex: none; color: var(--ink-dim); line-height: 0; }
        .cm-more:hover { color: var(--ink); }
        .cm-disc-meta {
          margin: 5px 0 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          font-size: 12.5px; color: var(--ink-dim);
        }
        .cm-disc-group { display: inline-flex; align-items: center; gap: 5px; color: var(--ink-dim); }
        .cm-disc-time { margin-left: auto; color: var(--ink-faint); white-space: nowrap; }
        .cm-disc-stats {
          margin-top: 10px; display: flex; align-items: center; gap: 22px;
          font-size: 13px; color: var(--ink-dim);
        }
        .cm-stat { display: inline-flex; align-items: center; gap: 7px; }
        .cm-save { margin-left: auto; color: var(--ink-dim); line-height: 0; }
        .cm-save:hover, .cm-save.on { color: var(--lemon); }

        /* -------------------------------------------------------- create */
        .cm-create {
          margin: 18px var(--gut) 4px;
          display: flex; align-items: center; gap: 14px;
          padding: 16px; border-radius: 18px;
          background: var(--panel); border: 1px solid var(--border);
        }
        .cm-create-art {
          width: 60px; height: 60px; border-radius: 16px; flex: none;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--lemon); border: 1px solid color-mix(in srgb, var(--lemon) 45%, transparent);
          background: radial-gradient(120% 120% at 30% 20%, #1a220f, #0d1108);
          box-shadow: 0 0 22px -12px var(--lemon);
        }
        .cm-create-text { flex: 1 1 auto; min-width: 0; }
        .cm-create-title {
          margin: 0; font-family: var(--font-head); font-weight: 700; font-size: 15.5px;
          line-height: 1.25; color: var(--lemon);
        }
        .cm-create-sub { margin: 5px 0 0; font-size: 13.5px; line-height: 1.4; color: var(--ink-dim); }
        .cm-create-cta {
          flex: none; padding: 12px 18px; border-radius: 12px;
          background: var(--lemon); color: #0B0D0A;
          font-family: var(--font-head); font-weight: 700; font-size: 14px;
          white-space: nowrap; transition: background .15s ease, transform .15s ease;
        }
        .cm-create-cta:hover { background: var(--ink); }
        .cm-create-cta:active { transform: scale(.97); }

        @media (max-width: 520px) {
          .cm-create { flex-wrap: wrap; gap: 12px; }
          .cm-create-text { flex: 1 1 55%; }
          .cm-create-cta { width: 100%; text-align: center; padding: 13px 18px; }
        }
      `}</style>
    </div>
  )
}
