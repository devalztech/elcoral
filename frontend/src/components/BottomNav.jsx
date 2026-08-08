import { NavLink } from 'react-router-dom'

const ICONS = {
  home: (
    <path d="M3 11.5 12 4l9 7.5M5.5 10v9a1 1 0 0 0 1 1H10v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20h3.5a1 1 0 0 0 1-1v-9" />
  ),
  jobs: (
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8.5ZM9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M4 12.5h16" />
  ),
  create: (
    <path d="M12 5v14M5 12h14" />
  ),
  community: (
    <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 19v-1.5a3.5 3.5 0 0 0-2.6-3.38M15.5 4.6a3.5 3.5 0 0 1 0 6.78" />
  ),
  profile: (
    <path d="M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c1.2-3.6 4.2-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
  ),
}

const ITEMS = [
  { to: '/home', icon: 'home', label: 'Home' },
  { to: '/home/jobs', icon: 'jobs', label: 'Jobs' },
  { to: '/home/create', icon: 'create', label: 'Create' },
  { to: '/home/community', icon: 'community', label: 'Community' },
  { to: '/home/profile', icon: 'profile', label: 'Profile' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `bn-item ${isActive ? 'active' : ''}`}
          end={item.to === '/home'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[item.icon]}
          </svg>
          <span>{item.label}</span>
        </NavLink>
      ))}
      <style>{`
        .bottom-nav {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
          display: flex; justify-content: space-around; align-items: center;
          background: var(--panel);
          border-top: 1px solid var(--border);
          padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
        }
        .bn-item {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          color: var(--ink-faint);
          padding: 6px 10px;
          border-radius: 10px;
          transition: color 0.15s ease;
          flex: 1;
          max-width: 84px;
        }
        .bn-item span { font-size: 11px; font-weight: 600; font-family: var(--font-head); }
        .bn-item.active { color: var(--lemon); }
        .bn-item:active { transform: scale(0.94); }

        @media (min-width: 860px) {
          .bottom-nav {
            top: 0; bottom: auto; left: 0; right: auto;
            width: 88px; height: 100vh;
            flex-direction: column; justify-content: flex-start; gap: 28px;
            padding: 32px 0;
            border-top: none; border-right: 1px solid var(--border);
          }
          .bn-item { flex: none; }
        }
      `}</style>
    </nav>
  )
}
