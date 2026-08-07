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

async function request(path, { method = 'GET', body, token, isFormData = false } = {}) {
  const headers = {}
  if (!isFormData) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include', // send/receive the httponly refresh-token cookie
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
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
  verifyEmail: (tokenId, token) =>
    request(`/auth/verify?token_id=${encodeURIComponent(tokenId)}&token=${encodeURIComponent(token)}`),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (tokenId, token, newPassword) =>
    request('/auth/reset-password', {
      method: 'POST',
      body: { token_id: tokenId, token, new_password: newPassword },
    }),
  resendVerification: (token) => request('/auth/resend-verification', { method: 'POST', token }),
  getMe: (token) => request('/auth/me', { token }),

  // Onboarding
  usernameAvailable: (username) =>
    request(`/onboarding/username-available?username=${encodeURIComponent(username)}`),
  submitOnboarding: (payload, token) =>
    request('/onboarding', { method: 'POST', body: payload, token }),
  myProfile: (token) => request('/onboarding/me', { token }),

  // Public/viewer-aware profile — token is optional (anonymous visitors
  // still get the public shape back; owner gets `private` populated too).
  publicProfile: (username, token) => request(`/profile/${encodeURIComponent(username)}`, { token }),

  // Posts by a specific author, for a profile page's post list.
  postsByUsername: (username) => request(`/posts?username=${encodeURIComponent(username)}`),

  // Media — multipart upload, needs the token passed explicitly since
  // this can be called before/outside a normal page render cycle.
  uploadMedia: (file, token) => {
    const form = new FormData()
    form.append('file', file)
    return request('/media/upload', { method: 'POST', body: form, token, isFormData: true })
  },

  // Lookup typeaheads (proxied through the backend — see app/routers/lookup.py)
  searchCompanies: (q) => request(`/lookup/companies?q=${encodeURIComponent(q)}`),
  listAllCountries: () => request('/lookup/countries/all'),
  searchCountries: (q) => request(`/lookup/countries?q=${encodeURIComponent(q)}`),
  searchCities: (q, country) =>
    request(`/lookup/cities?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}`),
}

export { ApiError }
