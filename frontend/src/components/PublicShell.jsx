import { Outlet, Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import BottomNav from './BottomNav.jsx'

// Shell for pages that must render for logged-out visitors (e.g. /u/:username).
//
// Logged out: a marketing top bar with the Elcoral mark, search, Log in and
// Sign up — matching the public profile design reference. No bottom nav,
// since a visitor who hasn't joined shouldn't see app tabs.
//
// Logged in: no top bar (the page renders its own back / overflow row) and
// the normal app bottom navigation.
export default function PublicShell() {
  const { user } = useAuth()

  return (
    <div className="pshell">
      {!user && (
        <header className="pshell-header">
          <div className="pshell-header-inner">
            <Link to="/" className="pshell-logo" aria-label="Elcoral home">
              <span className="pshell-logo-mark" aria-hidden="true">E</span>
              <span className="pshell-logo-word">Elcoral</span>
            </Link>
            <div className="pshell-actions">
              <Link to="/login" className="pshell-icon-link" aria-label="Search Elcoral">
                <Search size={22} />
              </Link>
              <Link to="/login" className="pshell-login">Log in</Link>
              <Link to="/signup" className="pshell-signup">Sign up</Link>
            </div>
          </div>
        </header>
      )}

      <main className={`pshell-content ${user ? 'pshell-content-app' : ''}`}>
        <Outlet />
      </main>

      {user && <BottomNav />}

      <style>{`
        .pshell { min-height: 100vh; }
        .pshell-header { padding: 14px 20px 4px; }
        .pshell-header-inner {
          max-width: 640px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between; gap: 14px;
        }
        .pshell-logo { display: inline-flex; align-items: center; gap: 10px; }
        .pshell-logo-mark {
          font-family: var(--font-display); font-weight: 800; font-size: 26px;
          line-height: 1; color: var(--accent-ink);
        }
        .pshell-logo-word {
          font-family: var(--font-display); font-weight: 800; font-size: 22px; color: var(--ink);
        }
        .pshell-actions { display: flex; align-items: center; gap: 14px; }
        .pshell-icon-link { color: var(--ink); display: inline-flex; }
        @media (hover: hover) and (pointer: fine) { .pshell-icon-link:hover { color: var(--accent-ink); } }
        .pshell-login { font-size: 15px; font-weight: 600; color: var(--ink-dim); }
        @media (hover: hover) and (pointer: fine) { .pshell-login:hover { color: var(--ink); } }
        .pshell-signup {
          background: var(--lemon); color: var(--on-accent);
          font-size: 15px; font-weight: 700;
          border-radius: 999px; padding: 11px 20px;
        }
        @media (hover: hover) and (pointer: fine) { .pshell-signup:hover { background: var(--lemon-dim); } }

        .pshell-content {
          padding: 16px 20px 60px;
          max-width: 640px;
          margin: 0 auto;
        }
        .pshell-content-app {
          padding: 20px 20px calc(92px + env(safe-area-inset-bottom));
        }
        @media (min-width: 860px) {
          .pshell-header-inner { max-width: 720px; }
          .pshell-content { padding: 24px 40px 60px; max-width: 720px; }
          .pshell-content-app { padding: 28px 40px 60px; margin-left: 88px; }
        }
      `}</style>
    </div>
  )
}
