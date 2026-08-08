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

  // Account settings (Settings -> Account / Security). Each of these
  // hits the authenticated account endpoints rather than the emailed
  // forgot-password flow, so they require the current access token.
  updateAccount: (payload, token) => request('/auth/me', { method: 'PATCH', body: payload, token }),
  changePassword: (currentPassword, newPassword, token) =>
    request('/auth/change-password', {
      method: 'POST',
      body: { current_password: currentPassword, new_password: newPassword },
      token,
    }),
  deleteAccount: (password, token) =>
    request('/auth/me', { method: 'DELETE', body: { password }, token }),

  // Onboarding
  usernameAvailable: (username) =>
    request(`/onboarding/username-available?username=${encodeURIComponent(username)}`),
  submitOnboarding: (payload, token) =>
    request('/onboarding', { method: 'POST', body: payload, token }),
  myProfile: (token) => request('/onboarding/me', { token }),

  // Profile editing. PATCH sends only the fields that changed, so saving
  // one section can't blank out fields the form never rendered (which is
  // what reusing POST /onboarding would do).
  getMyProfile: (token) => request('/profile/me', { token }),
  updateProfile: (payload, token) => request('/profile/me', { method: 'PATCH', body: payload, token }),
  updatePrivacy: (payload, token) =>
    request('/profile/me/privacy', { method: 'PATCH', body: payload, token }),

  // Viewer-aware availability check: doesn't report your own current
  // username as taken while you're editing your profile.
  usernameAvailableForEdit: (username, token) =>
    request(`/profile/username-available?username=${encodeURIComponent(username)}`, { token }),

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

  // Settings. One GET returns every preference group; each screen PATCHes
  // only its own slice, so saving Appearance can't clobber Notifications.
  getSettings: (token) => request('/settings', { token }),
  getSettingsOptions: () => request('/settings/options'),
  updateNotificationSettings: (payload, token) =>
    request('/settings/notifications', { method: 'PATCH', body: payload, token }),
  updateEmailSettings: (payload, token) =>
    request('/settings/email', { method: 'PATCH', body: payload, token }),
  updateAppearanceSettings: (payload, token) =>
    request('/settings/appearance', { method: 'PATCH', body: payload, token }),
  updateAccessibilitySettings: (payload, token) =>
    request('/settings/accessibility', { method: 'PATCH', body: payload, token }),
  updateLanguageSetting: (language, token) =>
    request('/settings/language', { method: 'PATCH', body: { language }, token }),

  getVerificationStatus: (token) => request('/settings/verification', { token }),

  listBlockedUsers: (token) => request('/settings/blocked', { token }),
  blockUser: (username, token) =>
    request('/settings/blocked', { method: 'POST', body: { username }, token }),
  unblockUser: (userId, token) =>
    request(`/settings/blocked/${encodeURIComponent(userId)}`, { method: 'DELETE', token }),

  listMyReports: (token) => request('/settings/reports', { token }),
  reportContent: (payload, token) =>
    request('/settings/reports', { method: 'POST', body: payload, token }),

  exportMyData: (token) => request('/settings/export', { token }),
  getAbout: () => request('/settings/about'),

  // Lookup typeaheads (proxied through the backend — see app/routers/lookup.py)
  searchCompanies: (q) => request(`/lookup/companies?q=${encodeURIComponent(q)}`),
  listAllCountries: () => request('/lookup/countries/all'),
  searchCountries: (q) => request(`/lookup/countries?q=${encodeURIComponent(q)}`),
  searchCities: (q, country) =>
    request(`/lookup/cities?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}`),

  // ---------------------------------------------------------------- social
  // Follow graph. `token` is optional on the read endpoints: anonymous
  // visitors still see counts, they just get is_following=false back.
  followState: (username, token) =>
    request(`/social/${encodeURIComponent(username)}/state`, { token }),
  followUser: (username, token) =>
    request(`/social/${encodeURIComponent(username)}/follow`, { method: 'POST', token }),
  unfollowUser: (username, token) =>
    request(`/social/${encodeURIComponent(username)}/follow`, { method: 'DELETE', token }),
  listFollowers: (username, token, cursor) =>
    request(
      `/social/${encodeURIComponent(username)}/followers${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      { token },
    ),
  listFollowing: (username, token, cursor) =>
    request(
      `/social/${encodeURIComponent(username)}/following${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      { token },
    ),
  followSuggestions: (token, limit = 10) => request(`/social/suggestions?limit=${limit}`, { token }),

  // -------------------------------------------------------------- messages
  listConversations: (token) => request('/messages/conversations', { token }),
  // Find-or-create: safe to call every time "Message" is tapped.
  startConversation: (username, token) =>
    request('/messages/conversations', { method: 'POST', body: { username }, token }),
  listMessages: (conversationId, token, cursor) =>
    request(
      `/messages/conversations/${conversationId}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      { token },
    ),
  sendMessage: (conversationId, body, token, mediaRefs) =>
    request(`/messages/conversations/${conversationId}`, {
      method: 'POST',
      body: { body, media_refs: mediaRefs ?? null },
      token,
    }),
  markConversationRead: (conversationId, token) =>
    request(`/messages/conversations/${conversationId}/read`, { method: 'POST', token }),
  unreadMessageCount: (token) => request('/messages/unread-count', { token }),

  // ----------------------------------------------------------- communities
  listCommunities: ({ scope = 'all', topic, q, limit, offset } = {}, token) => {
    const params = new URLSearchParams({ scope })
    if (topic) params.set('topic', topic)
    if (q) params.set('q', q)
    if (limit != null) params.set('limit', String(limit))
    if (offset != null) params.set('offset', String(offset))
    return request(`/communities?${params.toString()}`, { token })
  },
  communityOptions: () => request('/communities/options'),
  createCommunity: (payload, token) => request('/communities', { method: 'POST', body: payload, token }),
  getCommunity: (slug, token) => request(`/communities/${encodeURIComponent(slug)}`, { token }),
  updateCommunity: (slug, payload, token) =>
    request(`/communities/${encodeURIComponent(slug)}`, { method: 'PATCH', body: payload, token }),
  joinCommunity: (slug, token) =>
    request(`/communities/${encodeURIComponent(slug)}/join`, { method: 'POST', token }),
  leaveCommunity: (slug, token) =>
    request(`/communities/${encodeURIComponent(slug)}/join`, { method: 'DELETE', token }),
  listCommunityMembers: (slug, token) =>
    request(`/communities/${encodeURIComponent(slug)}/members`, { token }),

  // Discussions. The cross-community feed powers the "Top discussions"
  // section; the per-community one powers a community's own page.
  listDiscussions: ({ scope = 'top', topic, q, limit, offset } = {}, token) => {
    const params = new URLSearchParams({ scope })
    if (topic) params.set('topic', topic)
    if (q) params.set('q', q)
    if (limit != null) params.set('limit', String(limit))
    if (offset != null) params.set('offset', String(offset))
    return request(`/communities/discussions?${params.toString()}`, { token })
  },
  listCommunityDiscussions: (slug, token) =>
    request(`/communities/${encodeURIComponent(slug)}/discussions`, { token }),
  createDiscussion: (slug, payload, token) =>
    request(`/communities/${encodeURIComponent(slug)}/discussions`, {
      method: 'POST',
      body: payload,
      token,
    }),
  getDiscussion: (id, token) => request(`/communities/discussions/${id}`, { token }),
  deleteDiscussion: (id, token) =>
    request(`/communities/discussions/${id}`, { method: 'DELETE', token }),
  likeDiscussion: (id, liked, token) =>
    request(`/communities/discussions/${id}/like`, { method: liked ? 'POST' : 'DELETE', token }),
  saveDiscussion: (id, saved, token) =>
    request(`/communities/discussions/${id}/save`, { method: saved ? 'POST' : 'DELETE', token }),
  listDiscussionComments: (id, token) => request(`/communities/discussions/${id}/comments`, { token }),
  createDiscussionComment: (id, body, token) =>
    request(`/communities/discussions/${id}/comments`, { method: 'POST', body: { body }, token }),
}


export { ApiError }
