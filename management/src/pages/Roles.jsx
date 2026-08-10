import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../api/client.js'
import Spinner from '../components/Spinner.jsx'

export default function Roles() {
  const [catalog, setCatalog] = useState(null)
  const [staff, setStaff] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Roles · Elcoral Management'
    adminApi.roleCatalog().then((r) => setCatalog(r.roles)).catch((e) => setError(e.message))
    Promise.all([adminApi.listUsers({ role: 'admin', page_size: 100 }), adminApi.listUsers({ role: 'superadmin', page_size: 100 })])
      .then(([a, s]) => {
        const merged = new Map()
        ;[...a.items, ...s.items].forEach((u) => merged.set(u.id, u))
        setStaff([...merged.values()])
      })
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="form-error" role="alert">{error}</p>
  if (!catalog || !staff) return <Spinner page label="Loading roles" />

  return (
    <>
      <header className="page-head">
        <h1>Roles</h1>
        <p>
          Roles live in their own table, never on the user record — so no profile edit can ever
          turn into a privilege escalation. Only a superadmin can grant or revoke them.
        </p>
      </header>

      <div className="panel-grid">
        {catalog.map((r) => (
          <section key={r.value} className="panel">
            <h2>{r.label}</h2>
            <p>{r.description}</p>
            <p className="muted">
              {r.can_sign_in_to_admin ? 'Can sign in to this console.' : 'No access to this console.'}
            </p>
          </section>
        ))}
      </div>

      <div className="panel">
        <h2>Staff accounts</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Roles</th></tr></thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id}>
                  <td><Link to={`/users/${u.id}`}>{u.full_name}</Link></td>
                  <td>{u.email}</td>
                  <td>{u.roles.map((r) => <span key={r} className="chip chip-role">{r}</span>)}</td>
                </tr>
              ))}
              {staff.length === 0 && <tr><td colSpan={3} className="empty">No staff accounts yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
