import { Outlet, Link } from 'react-router-dom'

// Used for pages that must render for logged-out visitors (e.g. /u/:username).
// Deliberately lighter than AppShell — no BottomNav, since a visitor who
// hasn't signed up shouldn't see tabs for Jobs/Messages/Notifications in
// an app they're not using yet. Just a minimal top bar back to Elcoral.
export default function PublicShell() {
  return (
    <div className="pshell">
      <header className="pshell-header">
        <Link to="/" className="pshell-logo">Elcoral</Link>
      </header>
      <main className="pshell-content">
        <Outlet />
      </main>
      <style>{`
        .pshell-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }
        .pshell-logo {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 17px;
          color: var(--lemon);
        }
        .pshell-content {
          padding: 24px 20px 60px;
          max-width: 640px;
          margin: 0 auto;
        }
        @media (min-width: 860px) {
          .pshell-content { padding: 32px 40px 60px; max-width: 720px; }
        }
      `}</style>
    </div>
  )
}
