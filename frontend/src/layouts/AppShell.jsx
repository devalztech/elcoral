import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import InstallPrompt from '../features/pwa/InstallPrompt.jsx'

export default function AppShell() {
  return (
    <div className="shell">
      <main className="shell-content">
        <Outlet />
      </main>
      <BottomNav />
      <InstallPrompt />
      <style>{`
        .shell { min-height: 100vh; }
        .shell-content {
          padding: 24px 20px calc(88px + env(safe-area-inset-bottom));
          max-width: 640px;
          margin: 0 auto;
        }
        @media (min-width: 860px) {
          .shell-content { padding: 32px 40px; margin-left: 88px; max-width: 720px; }
        }
      `}</style>
    </div>
  )
}
