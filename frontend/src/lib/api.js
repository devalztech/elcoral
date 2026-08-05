// In dev, Vite proxies "/api" to localhost:8000 (see vite.config.js), so the
// relative path works with no env var needed. In production the frontend
// (Render) and backend (Pterodactyl) are different hosts, so VITE_API_URL
// must be set in Render's environment variables to the backend's public URL,
// e.g. https://api.elcoral.com — with no trailing slash.
const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`

class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  // TEMP DEBUG — remove once bug is found
  console.log('api request ->', `${BASE}${path}`, method)

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include', // send/receive the httponly refresh-token cookie
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // no body (e.g. 204)
  }

  if (!res.ok) {
    const message = data?.detail || 'Something went wrong. Please try again.'
    throw new ApiError(message, res.status, data?.detail)
  }

  return data
}

export const api = {
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  refresh: () => request('/auth/refresh', { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
}

export { ApiError }
