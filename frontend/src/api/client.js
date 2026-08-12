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

/**
 * Turn any error body FastAPI can produce into one readable sentence.
 *
 * `detail` is a plain string for HTTPException, but a LIST of
 * {loc, msg, type} objects for a 422 validation failure. Rendering that
 * list straight into the UI is what produced "[object Object]".
 */
function errorMessage(data, status) {
  const detail = data?.detail

  if (typeof detail === 'string' && detail.trim()) return detail

  if (Array.isArray(detail)) {
    const lines = detail
      .map((item) => {
        if (typeof item === 'string') return item
        const msg = item?.msg || item?.message
        if (!msg) return ''
        // "body -> body" is noise; name the field only when it helps.
        const field = Array.isArray(item.loc)
          ? item.loc.filter((p) => p !== 'body' && typeof p === 'string').join(' ')
          : ''
        const text = String(msg).replace(/^Value error,\s*/i, '')
        return field ? `${field}: ${text}` : text
      })
      .filter(Boolean)
    if (lines.length) return lines.join('\n')
  }

  if (detail && typeof detail === 'object') {
    const msg = detail.msg || detail.message || detail.detail
    if (typeof msg === 'string' && msg.trim()) return msg
  }

  if (status === 401) return 'Please sign in again.'
  if (status === 403) return "You don't have permission to do that."
  if (status === 404) return 'Not found.'
  if (status === 413) return 'That file is too large.'
  if (status >= 500) return 'The server had a problem. Please try again.'
  return 'Something went wrong. Please try again.'
}

/**
 * Read the double-submit CSRF cookie the API sets on signup / login /
 * refresh. It is intentionally not httponly so we can echo it back in the
 * X-CSRF-Token header; the server compares the two (see
 * backend/app/core/csrf.py). Cookie-authenticated endpoints
 * (/auth/refresh, /auth/logout) reject a request where they disagree.
 */
function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

async function request(path, { method = 'GET', body, token, isFormData = false } = {}) {
  const headers = {}
  if (!isFormData) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = csrfToken()
    if (csrf) headers['X-CSRF-Token'] = csrf
  }

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
    throw new ApiError(errorMessage(data, res.status), res.status, data?.detail)
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
  postsByUsername: (username, token) =>
    request(`/posts?username=${encodeURIComponent(username)}`, { token }),

  // ---------------------------------------------------------------- posts ----
  // The feed is viewer-aware: pass the token when signed in so the server
  // fills in liked/reposted/saved and honours followers-only visibility.
  feed: (token, { tab = 'for-you', cursor, tag } = {}) => {
    const params = new URLSearchParams({ tab })
    if (cursor) params.set('cursor', cursor)
    if (tag) params.set('tag', tag)
    return request(`/posts?${params.toString()}`, { token })
  },
  getPost: (postId, token) => request(`/posts/${postId}`, { token }),
  searchPosts: (q, token) => request(`/posts/search?q=${encodeURIComponent(q)}`, { token }),
  createPost: (payload, token) => request('/posts', { method: 'POST', body: payload, token }),
  updatePost: (postId, payload, token) =>
    request(`/posts/${postId}`, { method: 'PATCH', body: payload, token }),
  deletePost: (postId, token) => request(`/posts/${postId}`, { method: 'DELETE', token }),

  likePost: (postId, token) => request(`/posts/${postId}/like`, { method: 'POST', token }),
  unlikePost: (postId, token) => request(`/posts/${postId}/like`, { method: 'DELETE', token }),
  repostPost: (postId, token, quote) =>
    request(`/posts/${postId}/repost`, { method: 'POST', body: { quote: quote ?? null }, token }),
  undoRepost: (postId, token) => request(`/posts/${postId}/repost`, { method: 'DELETE', token }),
  savePost: (postId, token) => request(`/posts/${postId}/save`, { method: 'POST', token }),
  unsavePost: (postId, token) => request(`/posts/${postId}/save`, { method: 'DELETE', token }),
  votePoll: (postId, optionIndex, token) =>
    request(`/posts/${postId}/poll/vote`, { method: 'POST', body: { option_index: optionIndex }, token }),

  listComments: (postId, token) => request(`/posts/${postId}/comments`, { token }),
  // A comment can carry one photo (uploaded first via uploadMedia) with
  // the text acting as its caption; either half may be empty, not both.
  createComment: (postId, { body, parentId, mediaRef, mediaType } = {}, token) =>
    request(`/posts/${postId}/comments`, {
      method: 'POST',
      body: {
        body: body || null,
        parent_id: parentId ?? null,
        media_ref: mediaRef ?? null,
        media_type: mediaType ?? null,
      },
      token,
    }),
  deleteComment: (commentId, token) =>
    request(`/posts/comments/${commentId}`, { method: 'DELETE', token }),
  // Comments and replies can be liked, exactly like posts.
  likeComment: (commentId, token) =>
    request(`/posts/comments/${commentId}/like`, { method: 'POST', token }),
  unlikeComment: (commentId, token) =>
    request(`/posts/comments/${commentId}/like`, { method: 'DELETE', token }),
  listLikers: (postId, token) => request(`/posts/${postId}/likes`, { token }),

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
  // Typeahead behind the "@" mention menu.
  searchPeople: (q, token, limit = 8) =>
    request(`/social/search/people?q=${encodeURIComponent(q)}&limit=${limit}`, { token }),

  // --------------------------------------------------------- notifications
  // `kind` mirrors the tab strip on the Notifications screen: omit it for
  // "All", or pass one/many kinds ("post_like,comment_like").
  listNotifications: (token, limit = 50, kind) =>
    request(`/notifications?limit=${limit}${kind ? `&kind=${encodeURIComponent(kind)}` : ''}`, { token }),
  unreadNotificationCount: (token) => request('/notifications/unread-count', { token }),
  markNotificationRead: (id, token) =>
    request(`/notifications/${id}/read`, { method: 'POST', token }),
  markAllNotificationsRead: (token) =>
    request('/notifications/read-all', { method: 'POST', token }),

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
  // `attachments` is the array returned by uploadMedia calls:
  // [{ ref, mime_type }]. Types travel alongside the refs so the thread
  // can render a player/preview without sniffing the file.
  sendMessage: (conversationId, { body, attachments = [], replyToId } = {}, token) =>
    request(`/messages/conversations/${conversationId}`, {
      method: 'POST',
      body: {
        body: body || null,
        media_refs: attachments.map((a) => a.ref),
        media_types: attachments.map((a) => a.mime_type || ''),
        reply_to_id: replyToId ?? null,
      },
      token,
    }),

  // Message actions. One emoji per person per message: sending the same
  // one twice clears it, so the client only ever calls reactToMessage.
  reactToMessage: (messageId, emoji, token) =>
    request(`/messages/messages/${messageId}/reaction`, { method: 'PUT', body: { emoji }, token }),
  clearMessageReaction: (messageId, token) =>
    request(`/messages/messages/${messageId}/reaction`, { method: 'DELETE', token }),
  // scope: 'self' hides it for you only, 'everyone' tombstones it for both.
  deleteMessage: (messageId, scope, token) =>
    request(`/messages/messages/${messageId}?scope=${scope}`, { method: 'DELETE', token }),
  forwardMessage: (messageId, { conversationIds = [], usernames = [] } = {}, token) =>
    request(`/messages/messages/${messageId}/forward`, {
      method: 'POST',
      body: { conversation_ids: conversationIds, usernames },
      token,
    }),
  markConversationRead: (conversationId, token) =>
    request(`/messages/conversations/${conversationId}/read`, { method: 'POST', token }),
  unreadMessageCount: (token) => request('/messages/unread-count', { token }),
  // WebSocket URL for the direct-message socket. The token rides in the
  // query string because browsers can't set headers on a WS handshake;
  // it's the same short-lived access JWT used by every other call.
  messageSocketUrl: (token) => {
    const base = import.meta.env.VITE_API_URL ?? ''
    const httpOrigin = base || window.location.origin
    const wsOrigin = httpOrigin.replace(/^http/, 'ws')
    return `${wsOrigin}/api/messages/ws?token=${encodeURIComponent(token)}`
  },

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
  deleteCommunity: (slug, token) =>
    request(`/communities/${encodeURIComponent(slug)}`, { method: 'DELETE', token }),
  joinCommunity: (slug, token) =>
    request(`/communities/${encodeURIComponent(slug)}/join`, { method: 'POST', token }),
  leaveCommunity: (slug, token) =>
    request(`/communities/${encodeURIComponent(slug)}/join`, { method: 'DELETE', token }),
  // Simple member list (no role breakdown) — used where we only need
  // "who's in this community", e.g. an @mention picker.
  listCommunityMembers: (slug, { limit, offset } = {}, token) => {
    const params = new URLSearchParams()
    if (limit != null) params.set('limit', String(limit))
    if (offset != null) params.set('offset', String(offset))
    const qs = params.toString()
    return request(`/communities/${encodeURIComponent(slug)}/members${qs ? `?${qs}` : ''}`, { token })
  },

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
  listCommunityDiscussions: (slug, { limit, offset } = {}, token) => {
    const params = new URLSearchParams()
    if (limit != null) params.set('limit', String(limit))
    if (offset != null) params.set('offset', String(offset))
    const qs = params.toString()
    return request(`/communities/${encodeURIComponent(slug)}/discussions${qs ? `?${qs}` : ''}`, { token })
  },
  createDiscussion: (slug, payload, token) =>
    request(`/communities/${encodeURIComponent(slug)}/discussions`, {
      method: 'POST',
      body: payload,
      token,
    }),
  getDiscussion: (id, token) => request(`/communities/discussions/${id}`, { token }),
  updateDiscussion: (id, payload, token) =>
    request(`/communities/discussions/${id}`, { method: 'PATCH', body: payload, token }),
  deleteDiscussion: (id, token) =>
    request(`/communities/discussions/${id}`, { method: 'DELETE', token }),
  likeDiscussion: (id, liked, token) =>
    request(`/communities/discussions/${id}/like`, { method: liked ? 'POST' : 'DELETE', token }),
  saveDiscussion: (id, saved, token) =>
    request(`/communities/discussions/${id}/save`, { method: saved ? 'POST' : 'DELETE', token }),
  listDiscussionComments: (id, token) => request(`/communities/discussions/${id}/comments`, { token }),
  createDiscussionComment: (id, body, token) =>
    request(`/communities/discussions/${id}/comments`, { method: 'POST', body: { body }, token }),
  deleteDiscussionComment: (commentId, token) =>
    request(`/communities/comments/${commentId}`, { method: 'DELETE', token }),

  // -------------------------------------------------- members, roles, bans
  // Full roster with roles — powers the Members tab and manage screens.
  // Distinct from listCommunityMembers above (that one has no role/ban info).
  communityRoster: (slug, { role, q, limit, offset } = {}, token) => {
    const params = new URLSearchParams()
    if (role) params.set('role', role)
    if (q) params.set('q', q)
    if (limit != null) params.set('limit', String(limit))
    if (offset != null) params.set('offset', String(offset))
    const qs = params.toString()
    return request(`/communities/${encodeURIComponent(slug)}/roster${qs ? `?${qs}` : ''}`, { token })
  },
  setMemberRole: (slug, userId, role, token) =>
    request(`/communities/${encodeURIComponent(slug)}/members/${userId}/role`, {
      method: 'PATCH',
      body: { role },
      token,
    }),
  removeMember: (slug, userId, { ban = false, reason } = {}, token) =>
    request(`/communities/${encodeURIComponent(slug)}/members/${userId}`, {
      method: 'DELETE',
      body: { ban, reason: reason ?? null },
      token,
    }),
  unbanMember: (slug, userId, token) =>
    request(`/communities/${encodeURIComponent(slug)}/bans/${userId}`, { method: 'DELETE', token }),
  updateCommunityPermissions: (slug, payload, token) =>
    request(`/communities/${encodeURIComponent(slug)}/permissions`, {
      method: 'PATCH',
      body: payload,
      token,
    }),

  // ------------------------------------------------------------- projects
  listCommunityProjects: (slug, { status, limit, offset } = {}, token) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (limit != null) params.set('limit', String(limit))
    if (offset != null) params.set('offset', String(offset))
    const qs = params.toString()
    return request(`/communities/${encodeURIComponent(slug)}/projects${qs ? `?${qs}` : ''}`, { token })
  },
  createProject: (slug, payload, token) =>
    request(`/communities/${encodeURIComponent(slug)}/projects`, { method: 'POST', body: payload, token }),
  getProject: (id, token) => request(`/communities/projects/${id}`, { token }),
  updateProject: (id, payload, token) =>
    request(`/communities/projects/${id}`, { method: 'PATCH', body: payload, token }),
  deleteProject: (id, token) => request(`/communities/projects/${id}`, { method: 'DELETE', token }),
  requestToCollaborate: (projectId, note, token) =>
    request(`/communities/projects/${projectId}/join`, { method: 'POST', body: { note: note ?? null }, token }),
  withdrawCollaboration: (projectId, token) =>
    request(`/communities/projects/${projectId}/join`, { method: 'DELETE', token }),
  listCollaborators: (projectId, state, token) =>
    request(
      `/communities/projects/${projectId}/collaborators${state ? `?state=${encodeURIComponent(state)}` : ''}`,
      { token },
    ),
  decideCollaborator: (projectId, collaboratorId, state, token) =>
    request(`/communities/projects/${projectId}/collaborators/${collaboratorId}`, {
      method: 'PATCH',
      body: { state },
      token,
    }),

  // ----------------------------------------------------------------- chat
  // The socket (see wsUrl below) is receive-only — sending always goes
  // through this REST call, which persists the message and fans it out.
  listCommunityMessages: (slug, { before, limit } = {}, token) => {
    const params = new URLSearchParams()
    if (before) params.set('before', before)
    if (limit != null) params.set('limit', String(limit))
    const qs = params.toString()
    return request(`/communities/${encodeURIComponent(slug)}/messages${qs ? `?${qs}` : ''}`, { token })
  },
  sendCommunityMessage: (slug, { body, mediaRefs } = {}, token) =>
    request(`/communities/${encodeURIComponent(slug)}/messages`, {
      method: 'POST',
      body: { body: body || null, media_refs: mediaRefs && mediaRefs.length ? mediaRefs : null },
      token,
    }),
  deleteCommunityMessage: (messageId, token) =>
    request(`/communities/messages/${messageId}`, { method: 'DELETE', token }),
  // Builds the chat socket URL from the same base `request()` uses, so
  // dev (relative, proxied by Vite) and prod (VITE_API_URL) stay in sync
  // with zero extra config. http(s) -> ws(s); an empty base means
  // "same origin as the page", which is also correct for a raw WebSocket.
  wsUrl: (slug, token) => {
    const apiBase = import.meta.env.VITE_API_URL ?? ''
    let wsBase
    if (apiBase) {
      wsBase = apiBase.replace(/^http/, 'ws')
    } else {
      wsBase = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
    }
    return `${wsBase}/api/communities/ws/${encodeURIComponent(slug)}?token=${encodeURIComponent(token ?? '')}`
  },

  // --------------------------------------------------------------- discovery
  discoveryCategories: () => request('/communities/discovery/categories'),

  // ----------------------------------------------------------------- reports
  reportCommunityContent: (payload, token) =>
    request('/communities/reports', { method: 'POST', body: payload, token }),
}


export { ApiError }
