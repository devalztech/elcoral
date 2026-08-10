import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { adminApi } from '../api/client.js'
import Spinner from '../components/Spinner.jsx'

const CARDS = [
  { key: 'total_users', label: 'Total users', icon: Users },
  { key: 'active_users', label: 'Active accounts', icon: Users },
  { key: 'badge_verified_users', label: 'Verified badges', icon: BadgeCheck },
  { key: 'email_verified_users', label: 'Confirmed emails', icon: BadgeCheck },
  { key: 'admins', label: 'Staff accounts', icon: ShieldCheck },
  { key: 'new_users_7d', label: 'New this week', icon: UserPlus },
]

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Dashboard · Elcoral Management'
    adminApi.stats().then(setStats).catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="form-error" role="alert">{error}</p>
  if (!stats) return <Spinner page label="Loading stats" />

  return (
    <>
      <header className="page-head">
        <h1>Dashboard</h1>
        <p>A live count straight from the database — nothing here is cached.</p>
      </header>

      <div className="stat-grid">
        {CARDS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="stat-card">
            <Icon size={16} aria-hidden="true" />
            <p className="stat-value">{stats[key]}</p>
            <p className="stat-label">{label}</p>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Confirmed emails are not badges</h2>
        <p>
          The two counts above are deliberately separate. Anyone can confirm their own email
          address; only an admin can grant the blue check on a profile, and every grant is
          recorded in the audit log with the name of the admin who made the call.
        </p>
        <Link className="btn" to="/users?badge=false">Review unbadged accounts</Link>
      </div>
    </>
  )
}
