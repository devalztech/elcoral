import { useAuth } from '../hooks/useAuth.jsx'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="dash">
      <p className="eyebrow">Dashboard</p>
      <h1>{user?.full_name ? `Welcome, ${user.full_name.split(' ')[0]}` : 'Welcome'}</h1>
      <div className="dash-card">
        <p>
          This is where profile setup continues, and where {user?.role === 'freelancer' ? 'job matches' : 'proposals'}
          {' '}will show up once that is built. For now it is a placeholder — the bottom navigation below is live.
        </p>
      </div>
      <style>{`
        .dash h1 {
          font-family: var(--font-head); font-size: 26px; font-weight: 700;
          margin-top: 6px; margin-bottom: 20px; color: var(--ink);
        }
        .dash-card {
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 12px; padding: 18px;
        }
        .dash-card p { margin: 0; font-size: 14.5px; }
      `}</style>
    </div>
  )
}
