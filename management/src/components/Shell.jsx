import { NavLink, useNavigate } from 'react-router-dom'
import { BadgeCheck, LayoutDashboard, LogOut, ScrollText, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/roles', label: 'Roles', icon: ShieldCheck },
  { to: '/audit', label: 'Audit log', icon: ScrollText },
]

export default function Shell({ children }) {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="shell">
      <aside className="shell-nav">
        <div className="shell-brand">
          <BadgeCheck size={20} aria-hidden="true" />
          <span>Elcoral<strong>Admin</strong></span>
        </div>

        <nav>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `shell-link ${isActive ? 'is-active' : ''}`}>
              <Icon size={17} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="shell-foot">
          <p className="shell-who">{admin?.full_name}</p>
          <p className="shell-role">{admin?.is_superadmin ? 'Superadmin' : 'Admin'}</p>
          <button
            type="button"
            className="shell-signout"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      <main className="shell-main">{children}</main>
    </div>
  )
}
