import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import InstallPrompt from '../features/pwa/InstallPrompt.jsx'

// A conversation thread is /home/messages/:id — the inbox list itself
// (/home/messages) still gets the nav, only the open chat hides it so
// the thread gets the full screen height, like a native messaging app.
// On desktop the nav is a left sidebar rather than a bottom bar, so it
// stays put there — only the mobile bottom bar hides for a thread.
const isConversationThread = (pathname) =>
  /^\/home\/messages\/[^/]+$/.test(pathname)

export default function AppShell() {
  const { pathname } = useLocation()
  const inThread = isConversationThread(pathname)

  return (
    <div className="shell">
      <main className={`shell-content ${inThread ? 'shell-content-full' : ''}`}>
        <Outlet />
      </main>
      <div className={inThread ? 'shell-nav-mobile-hidden' : undefined}>
        <BottomNav />
      </div>
      <InstallPrompt />
      <style>{`
        .shell { min-height: 100vh; }
        .shell-content {
          padding: 24px 20px calc(88px + env(safe-area-inset-bottom));
          max-width: 640px;
          margin: 0 auto;
        }
        .shell-content-full { padding: 0; max-width: none; }
        @media (min-width: 860px) {
          .shell-content { padding: 32px 40px; margin-left: 88px; max-width: 720px; }
          .shell-content-full { padding: 0; margin-left: 88px; max-width: none; }
        }
        .shell-nav-mobile-hidden { display: contents; }
        .shell-nav-mobile-hidden .bottom-nav { display: none; }
        @media (min-width: 860px) {
          .shell-nav-mobile-hidden .bottom-nav { display: flex; }
        }
      `}</style>
    </div>
  )
}
