import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BadgeCheck, Plus, Search } from 'lucide-react'
import { adminApi } from '../api/client.js'
import Spinner from '../components/Spinner.jsx'
import CreateUserDialog from '../components/CreateUserDialog.jsx'
import { useAuth } from '../auth/AuthContext.jsx'

const PAGE_SIZE = 25

export default function Users() {
  const { isSuperadmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState(params.get('q') ?? '')

  const filters = useMemo(
    () => ({
      q: params.get('q') ?? '',
      role: params.get('role') ?? '',
      badge: params.get('badge') ?? '',
      active: params.get('active') ?? '',
      page: Number(params.get('page') ?? 1),
    }),
    [params],
  )

  const load = useCallback(() => {
    setError('')
    adminApi
      .listUsers({
        q: filters.q,
        role: filters.role,
        badge: filters.badge,
        active: filters.active,
        page: filters.page,
        page_size: PAGE_SIZE,
      })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [filters])

  useEffect(() => {
    document.title = 'Users · Elcoral Management'
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function setFilter(key, value) {
    const next = new URLSearchParams(params)
    if (value === '' || value === null) next.delete(key)
    else next.set(key, value)
    next.delete('page')
    setParams(next)
  }

  function goToPage(page) {
    const next = new URLSearchParams(params)
    next.set('page', String(page))
    setParams(next)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <>
      <header className="page-head page-head-row">
        <div>
          <h1>Users</h1>
          <p>{data ? `${data.total} account${data.total === 1 ? '' : 's'}` : 'Loading…'}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden="true" /> New user
        </button>
      </header>

      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault()
          setFilter('q', query.trim())
        }}
      >
        <label className="search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search name, email or username"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <select value={filters.role} onChange={(e) => setFilter('role', e.target.value)} aria-label="Role">
          <option value="">Any role</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>

        <select value={filters.badge} onChange={(e) => setFilter('badge', e.target.value)} aria-label="Badge">
          <option value="">Any badge state</option>
          <option value="true">Badged</option>
          <option value="false">Not badged</option>
        </select>

        <select value={filters.active} onChange={(e) => setFilter('active', e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Suspended</option>
        </select>
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}
      {!data && !error && <Spinner page label="Loading users" />}

      {data && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Badge</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link className="cell-user" to={`/users/${u.id}`}>
                        <span className="avatar" aria-hidden="true">
                          {u.photo_url ? <img src={u.photo_url} alt="" /> : (u.full_name || '?').charAt(0)}
                        </span>
                        <span>
                          <span className="cell-name">
                            {u.full_name}
                            {u.is_badge_verified && <BadgeCheck size={14} className="tick" aria-label="Verified" />}
                          </span>
                          {u.username && <span className="cell-sub">@{u.username}</span>}
                        </span>
                      </Link>
                    </td>
                    <td>
                      {u.email}
                      {!u.is_email_verified && <span className="chip chip-warn">unconfirmed</span>}
                    </td>
                    <td>
                      {u.roles.length === 0 ? (
                        <span className="chip">user</span>
                      ) : (
                        u.roles.map((r) => <span key={r} className="chip chip-role">{r}</span>)
                      )}
                    </td>
                    <td>{u.is_badge_verified ? <span className="chip chip-ok">verified</span> : '—'}</td>
                    <td>
                      {u.is_active ? <span className="chip chip-ok">active</span> : <span className="chip chip-bad">suspended</span>}
                    </td>
                    <td className="nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">No accounts match those filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <button type="button" className="btn" disabled={data.page <= 1} onClick={() => goToPage(data.page - 1)}>
              Previous
            </button>
            <span>Page {data.page} of {totalPages}</span>
            <button
              type="button"
              className="btn"
              disabled={data.page >= totalPages}
              onClick={() => goToPage(data.page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {creating && (
        <CreateUserDialog
          canCreateAdmins={isSuperadmin}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            load()
          }}
        />
      )}
    </>
  )
}
