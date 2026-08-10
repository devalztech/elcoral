// Admin API client.
//
// Two deliberate differences from the member frontend's client:
//
// 1. No refresh-token cookie. The admin login returns one short-lived
//    access token and nothing else, so a stolen browser profile can't be
//    used to silently mint new admin sessions. When it expires the admin
//    signs in again — an hour-scale interruption is an acceptable price
//    for a console that can delete accounts.
// 2. The token lives in sessionStorage, not localStorage: closing the tab
//    ends the session, and it is never shared with other tabs/windows of
//    other origins.
const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/admin`

const TOKEN_KEY = 'elcoral_admin_token'

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const auth = token ?? tokenStore.get()
  if (auth) headers.Authorization = `Bearer ${auth}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // 204 and friends
  }

  if (!res.ok) {
    if (res.status === 401) tokenStore.clear()
    throw new ApiError(data?.detail || 'Something went wrong. Please try again.', res.status)
  }
  return data
}

const qs = (params) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, v)
  })
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const adminApi = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: (token) => request('/auth/me', { token }),
  stats: () => request('/stats'),
  roleCatalog: () => request('/roles'),

  listUsers: (params = {}) => request(`/users${qs(params)}`),
  getUser: (id) => request(`/users/${id}`),
  createUser: (payload) => request('/users', { method: 'POST', body: payload }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  setActive: (id, isActive) =>
    request(`/users/${id}/active`, { method: 'PATCH', body: { is_active: isActive } }),

  grantBadge: (id, reason) => request(`/users/${id}/badge`, { method: 'POST', body: { reason } }),
  revokeBadge: (id) => request(`/users/${id}/badge`, { method: 'DELETE' }),

  grantRole: (id, role) => request(`/users/${id}/roles`, { method: 'POST', body: { role } }),
  revokeRole: (id, role) => request(`/users/${id}/roles/${role}`, { method: 'DELETE' }),

  audit: (limit = 50) => request(`/audit${qs({ limit })}`),
}
