import { useEffect, useState } from 'react'
import { adminApi } from '../api/client.js'
import Spinner from '../components/Spinner.jsx'

export default function Audit() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Audit log · Elcoral Management'
    adminApi.audit(100).then(setRows).catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="form-error" role="alert">{error}</p>
  if (!rows) return <Spinner page label="Loading audit log" />

  return (
    <>
      <header className="page-head">
        <h1>Audit log</h1>
        <p>Every admin action, written before the change is committed. Read-only, for everyone.</p>
      </header>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Detail</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.actor_email}</td>
                <td><span className="chip chip-role">{r.action}</span></td>
                <td>{r.target_email ?? '—'}</td>
                <td className="muted">{r.detail ? JSON.stringify(r.detail) : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="empty">Nothing logged yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
