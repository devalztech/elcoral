import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Lock, Shield, Wallet, ChevronRight, LogOut } from 'lucide-react'
import { useAuth } from '../../features/auth/hooks/useAuth.jsx'

const ITEMS = [
  { to: '/home/settings/account', icon: User, label: 'Account', desc: 'Name, email, username' },
  { to: '/home/settings/privacy', icon: Lock, label: 'Privacy', desc: 'Who can see your profile and activity' },
  { to: '/home/settings/security', icon: Shield, label: 'Security', desc: 'Password, login activity' },
  { to: '/home/settings/earnings', icon: Wallet, label: 'Earnings', desc: 'Payouts and payment methods' },
]

export default function Settings() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="settings-home">
      <Link to="/home/profile" className="back-link">
        <ArrowLeft size={15} /> Back to profile
      </Link>

      <h1 className="settings-title">Settings</h1>

      <div className="settings-list">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <Link to={item.to} key={item.to} className="settings-row">
              <span className="settings-row-icon"><Icon size={18} /></span>
              <span className="settings-row-text">
                <span className="settings-row-label">{item.label}</span>
                <span className="settings-row-desc">{item.desc}</span>
              </span>
              <ChevronRight size={17} className="settings-row-chevron" />
            </Link>
          )
        })}
      </div>

      <button type="button" className="logout-row" onClick={handleLogout}>
        <LogOut size={18} />
        Log out
      </button>

      <style>{`
        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13.5px; font-weight: 600; color: var(--ink-dim);
          margin-bottom: 18px;
        }
        .back-link:hover { color: var(--lemon); }
        .settings-title { font-family: var(--font-display); font-weight: 800; font-size: 24px; color: var(--ink); margin-bottom: 20px; }
        .settings-list { display: flex; flex-direction: column; gap: 8px; }
        .settings-row {
          display: flex; align-items: center; gap: 14px;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 12px; padding: 14px 16px;
        }
        .settings-row:hover { border-color: var(--ink-faint); }
        .settings-row-icon { color: var(--lemon); flex-shrink: 0; }
        .settings-row-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
        .settings-row-label { font-size: 14.5px; font-weight: 600; color: var(--ink); }
        .settings-row-desc { font-size: 12.5px; color: var(--ink-faint); }
        .settings-row-chevron { color: var(--ink-faint); flex-shrink: 0; }
        .logout-row {
          display: flex; align-items: center; gap: 12px;
          width: 100%; margin-top: 24px;
          font-size: 14.5px; font-weight: 600; color: var(--danger);
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 12px; padding: 14px 16px;
        }
        .logout-row:hover { border-color: var(--danger); }
      `}</style>
    </div>
  )
}
