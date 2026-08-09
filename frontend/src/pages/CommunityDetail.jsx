import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Bell, Bookmark, Crown, Eye, Gamepad2, Globe, Leaf, Lock,
  MessageSquare, MoreHorizontal, Palette, Rocket, Settings, Share2,
  Shield, SquarePen, ThumbsUp, Trash2, Users, X,
} from 'lucide-react'
import ElcoralMark from '../components/ElcoralMark.jsx'
import FormField, { TextInput } from '../components/FormField.jsx'
import EditSheet from '../features/profile/components/EditSheet.jsx'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { api, ApiError } from '../api/client.js'
import { avatarTone, displayName, formatCount, initialsOf, pluralize, timeAgo } from '../features/social/format.js'
import MembersTab from '../features/community/MembersTab.jsx'
import ProjectsTab from '../features/community/ProjectsTab.jsx'
import ChatTab from '../features/community/ChatTab.jsx'
import SettingsSheet from '../features/community/SettingsSheet.jsx'
import Spinner from '../components/Spinner.jsx'

const TABS = ['Posts', 'Projects', 'Chat', 'Members']

/* ------------------------------------------------------------- helpers ---- */

// Same glyph vocabulary as the Communities list screen (Community.jsx),
// reused here so a community's tile/logo renders identically everywhere
// it appears.
function Glyph({ item, size }) {
  if (item?.icon_url) {
    return <img className="cd-tile-img" src={item.icon_url} alt="" width={size} height={size} />
  }
  if (item?.is_official) return <ElcoralMark size={Math.round(size * 0.5)} color="var(--lemon)" />

  const g = item?.glyph
  if (g === 'figma') {
    return (
      <svg width={size * 0.5} height={size * 0.62} viewBox="0 0 38 57" aria-hidden="true">
        <path fill="#1ABCFE" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" />
        <path fill="#0ACF83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 0 1-19 0Z" />
        <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" />
        <path fill="#F24E1E" d="M0 9.5A9.5 9.5 0 0 1 9.5 0H19v19H9.5A9.5 9.5 0 0 1 0 9.5Z" />
        <path fill="#A259FF" d="M0 28.5A9.5 9.5 0 0 1 9.5 19H19v19H9.5A9.5 9.5 0 0 1 0 28.5Z" />
      </svg>
    )
  }
  if (g === 'python') {
    return (
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#3B7DB1" d="M11.9 2c-2.6 0-4.4.6-4.4 3v2h4.6v.7H5.6C3.5 7.7 2 9 2 11.9c0 2.6 1.3 4.2 3.4 4.2h1.7v-2.5c0-2.3 2-4.2 4.3-4.2h4.1c1.8 0 3.1-1.4 3.1-3.1V5C18.6 3.2 17 2 14.9 2h-3Zm-2.5 1.7c.5 0 .9.4.9.9s-.4.9-.9.9a.9.9 0 0 1-.9-.9c0-.5.4-.9.9-.9Z" />
        <path fill="#F5C33B" d="M12.1 22c2.6 0 4.4-.6 4.4-3v-2h-4.6v-.7h6.5c2.1 0 3.6-1.3 3.6-4.2 0-2.6-1.3-4.2-3.4-4.2h-1.7v2.5c0 2.3-2 4.2-4.3 4.2H8.5c-1.8 0-3.1 1.4-3.1 3.1V19c0 1.8 1.6 3 3.7 3h3Zm2.5-1.7a.9.9 0 0 1-.9-.9c0-.5.4-.9.9-.9s.9.4.9.9-.4.9-.9.9Z" />
      </svg>
    )
  }
  if (g === 'ai') return <span className="cd-word">ai</span>
  if (g === 'leaf') {
    return (
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none"
           stroke="var(--lemon)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 4c0 9-5.5 15-13 15 0-8 5-15 13-15Z" />
        <path d="M4 20c2-4 5-7 9-9" />
      </svg>
    )
  }
  if (g === 'rocket') return <Rocket size={Math.round(size * 0.44)} strokeWidth={1.8} color="var(--lemon)" />
  if (g === 'chart') return <Rocket size={Math.round(size * 0.44)} strokeWidth={1.8} color="var(--lemon)" />
  if (g === 'pad') return <Gamepad2 size={Math.round(size * 0.48)} strokeWidth={1.8} color="#fff" />
  if (g === '</>') return <span className="cd-word code">{'</>'}</span>
  if (g) return <span className="cd-emoji" style={{ fontSize: Math.round(size * 0.42) }}>{g}</span>
  return <span className="cd-word">{initialsOf(item?.name)}</span>
}

function GroupIcon({ community, size = 14 }) {
  const g = community?.glyph
  const Icon = g === 'palette' ? Palette : g === 'rocket' ? Rocket : Leaf
  return <Icon size={size} strokeWidth={1.9} color="var(--lemon)" aria-hidden="true" />
}

export function Avatar({ person, size = 46 }) {
  const name = displayName(person)
  if (person?.photo_url) {
    return (
      <img
        className="cd-avatar cd-avatar-img"
        src={person.photo_url}
        alt=""
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className={`cd-avatar av-${avatarTone(person?.id ?? name)}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  )
}

export function SectionState({ loading, error, empty, emptyText, onRetry }) {
  if (loading) return <Spinner page label="Loading community" />
  if (error) {
    return (
      <p className="cd-state cd-state-error">
        {error}{' '}
        <button type="button" className="cd-retry" onClick={onRetry}>Try again</button>
      </p>
    )
  }
  if (empty) return <p className="cd-state">{emptyText}</p>
  return null
}

/* --------------------------------------------------------------- screen ---- */

export default function CommunityDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { accessToken, authLoading, user } = useAuth()

  const [state, setState] = useState({ community: null, loading: true, error: null, notFound: false })
  const [tab, setTab] = useState('Posts')
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [joinBusy, setJoinBusy] = useState(false)

  const load = useCallback(async () => {
    if (authLoading) return
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const community = await api.getCommunity(slug, accessToken ?? undefined)
      setState({ community, loading: false, error: null, notFound: false })
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setState({ community: null, loading: false, error: null, notFound: true })
      } else {
        setState({ community: null, loading: false, error: err.message, notFound: false })
      }
    }
  }, [slug, accessToken, authLoading])

  useEffect(() => { load() }, [load])

  // Called by any child action (join/leave/settings save/permissions
  // save) that gets a fresh CommunityOut back from the server, so the
  // header, capabilities and tab gating all update from one source of
  // truth instead of each child keeping its own copy.
  const applyCommunity = useCallback((next) => {
    setState((s) => ({ ...s, community: next }))
  }, [])

  async function toggleJoin() {
    if (!accessToken) return navigate('/login')
    if (!state.community || joinBusy) return
    setJoinBusy(true)
    try {
      const next = state.community.is_member
        ? await api.leaveCommunity(slug, accessToken)
        : await api.joinCommunity(slug, accessToken)
      applyCommunity(next)
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }))
    } finally {
      setJoinBusy(false)
    }
  }

  const caps = state.community?.capabilities ?? {}

  if (state.notFound) {
    return (
      <div className="cd cd-notfound">
        <Link to="/home/community" className="cd-back-link">
          <ArrowLeft size={18} strokeWidth={2} /> Back to Communities
        </Link>
        <div className="cd-notfound-body">
          <Users size={40} strokeWidth={1.6} className="cd-notfound-icon" aria-hidden="true" />
          <h1>Community not found</h1>
          <p>It may have been deleted, or the link might be wrong.</p>
        </div>
        <CommunityDetailStyles />
      </div>
    )
  }

  return (
    <div className="cd">
      <header className="cd-bar">
        <button type="button" className="cd-icon-btn" aria-label="Back" onClick={() => navigate('/home/community')}>
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <h1 className="cd-bar-title">{state.community?.name ?? ''}</h1>
        {state.community && (
          <div className="cd-bar-actions">
            <button type="button" className="cd-icon-btn" aria-label="Share">
              <Share2 size={20} strokeWidth={1.9} />
            </button>
            <div className="cd-menu-wrap">
              <button
                type="button"
                className="cd-icon-btn"
                aria-label="More options"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={22} strokeWidth={2} />
              </button>
              {menuOpen && (
                <CommunityMenu
                  community={state.community}
                  caps={caps}
                  onClose={() => setMenuOpen(false)}
                  onSettings={() => { setMenuOpen(false); setSettingsOpen(true) }}
                  onReport={() => setMenuOpen(false)}
                />
              )}
            </div>
          </div>
        )}
      </header>

      <SectionState loading={state.loading} error={state.error} empty={false} onRetry={load} />

      {state.community && (
        <>
          <CommunityHero
            community={state.community}
            caps={caps}
            joinBusy={joinBusy}
            onToggleJoin={toggleJoin}
            onOpenSettings={() => setSettingsOpen(true)}
            loggedIn={!!accessToken}
          />

          <div className="cd-tabs" role="tablist" aria-label="Community sections">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`cd-tab ${tab === t ? 'cd-tab-active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="cd-tabpanel">
            {tab === 'Posts' && (
              <PostsTab
                community={state.community}
                caps={caps}
                accessToken={accessToken}
                loggedIn={!!accessToken}
                currentUser={user}
              />
            )}
            {tab === 'Projects' && (
              <ProjectsTab
                community={state.community}
                caps={caps}
                accessToken={accessToken}
                loggedIn={!!accessToken}
              />
            )}
            {tab === 'Chat' && (
              <ChatTab
                community={state.community}
                caps={caps}
                accessToken={accessToken}
                loggedIn={!!accessToken}
                currentUser={user}
              />
            )}
            {tab === 'Members' && (
              <MembersTab
                community={state.community}
                caps={caps}
                accessToken={accessToken}
                currentUser={user}
                onCommunityChange={applyCommunity}
              />
            )}
          </div>
        </>
      )}

      {settingsOpen && state.community && (
        <SettingsSheet
          community={state.community}
          caps={caps}
          accessToken={accessToken}
          onClose={() => setSettingsOpen(false)}
          onSaved={(next) => { applyCommunity(next); setSettingsOpen(false) }}
          onDeleted={() => navigate('/home/community')}
        />
      )}

      <CommunityDetailStyles />
    </div>
  )
}

/* ----------------------------------------------------------------- menu ---- */

function CommunityMenu({ community, caps, onClose, onSettings, onReport }) {
  const ref = useRef(null)
  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [onClose])

  return (
    <div className="cd-menu" ref={ref} role="menu">
      {(caps.can_edit_settings || caps.can_manage_roles) && (
        <button type="button" className="cd-menu-item" role="menuitem" onClick={onSettings}>
          <Settings size={17} strokeWidth={1.9} /> Community settings
        </button>
      )}
      <button type="button" className="cd-menu-item" role="menuitem" onClick={onReport}>
        <Shield size={17} strokeWidth={1.9} /> Report community
      </button>
    </div>
  )
}

/* ----------------------------------------------------------------- hero ---- */

function CommunityHero({ community, caps, joinBusy, onToggleJoin, onOpenSettings, loggedIn }) {
  return (
    <section className="cd-hero">
      <div className="cd-cover" style={community.cover_url ? { backgroundImage: `url(${community.cover_url})` } : undefined} aria-hidden="true" />
      <div className="cd-hero-body">
        <span className={`cd-tile tone-${community.tone}`} aria-hidden="true">
          <Glyph item={community} size={72} />
        </span>

        <div className="cd-hero-id">
          <div className="cd-hero-name-row">
            <h2 className="cd-hero-name">{community.name}</h2>
            {community.is_official && (
              <span className="cd-crown" aria-label="Official community"><Crown size={13} strokeWidth={2.2} /></span>
            )}
            {community.is_private ? (
              <Lock size={15} strokeWidth={2} className="cd-privacy-icon" aria-label="Private community" />
            ) : (
              <Globe size={15} strokeWidth={2} className="cd-privacy-icon" aria-label="Public community" />
            )}
          </div>
          {community.description && <p className="cd-hero-desc">{community.description}</p>}
          <p className="cd-hero-meta">
            <GroupIcon community={community} size={13} /> {community.topic}
            <span className="cd-sep">•</span>
            {pluralize(community.members_count, 'member')}
            {community.new_today > 0 && (
              <>
                <span className="cd-sep">•</span>
                <span className="cd-fresh">{formatCount(community.new_today)} new today</span>
              </>
            )}
          </p>
        </div>

        <div className="cd-hero-actions">
          {community.is_owner ? (
            <button type="button" className="cd-manage-btn" onClick={onOpenSettings}>
              <Settings size={16} strokeWidth={2} /> Manage
            </button>
          ) : loggedIn ? (
            <button
              type="button"
              className={`cd-join ${community.is_member ? 'on' : ''}`}
              aria-pressed={community.is_member ? 'true' : 'false'}
              disabled={joinBusy}
              onClick={onToggleJoin}
            >
              {joinBusy ? '…' : community.is_member ? 'Joined' : 'Join'}
            </button>
          ) : (
            <Link to="/login" className="cd-join">Join</Link>
          )}
          {community.is_member && !community.is_owner && (caps.can_edit_settings) && (
            <button type="button" className="cd-manage-btn cd-manage-btn-ghost" onClick={onOpenSettings}>
              <Settings size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- posts --- */

function PostsTab({ community, caps, accessToken, loggedIn, currentUser }) {
  const [state, setState] = useState({ items: [], loading: true, error: null })
  const [composerOpen, setComposerOpen] = useState(false)
  const [busy, setBusy] = useState({})
  const [openDiscussionId, setOpenDiscussionId] = useState(null)

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    api
      .listCommunityDiscussions(community.slug, { limit: 30 }, accessToken ?? undefined)
      .then((data) => setState({ items: data.items, loading: false, error: null }))
      .catch((err) => setState({ items: [], loading: false, error: err.message }))
  }, [community.slug, accessToken])

  useEffect(() => { load() }, [load])

  function replace(next) {
    setState((s) => ({ ...s, items: s.items.map((d) => (d.id === next.id ? next : d)) }))
  }
  function remove(id) {
    setState((s) => ({ ...s, items: s.items.filter((d) => d.id !== id) }))
  }

  async function toggleLike(d) {
    if (!accessToken || busy[d.id]) return
    setBusy((s) => ({ ...s, [d.id]: true }))
    try {
      const next = await api.likeDiscussion(d.id, !d.is_liked, accessToken)
      replace(next)
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }))
    } finally {
      setBusy((s) => ({ ...s, [d.id]: false }))
    }
  }

  async function toggleSave(d) {
    if (!accessToken || busy[d.id]) return
    setBusy((s) => ({ ...s, [d.id]: true }))
    try {
      const next = await api.saveDiscussion(d.id, !d.is_saved, accessToken)
      replace(next)
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }))
    } finally {
      setBusy((s) => ({ ...s, [d.id]: false }))
    }
  }

  async function deletePost(d) {
    if (!accessToken || busy[d.id]) return
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    setBusy((s) => ({ ...s, [d.id]: true }))
    try {
      await api.deleteDiscussion(d.id, accessToken)
      remove(d.id)
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }))
      setBusy((s) => ({ ...s, [d.id]: false }))
    }
  }

  function handleCreated(discussion) {
    setState((s) => ({ ...s, items: [discussion, ...s.items] }))
    setComposerOpen(false)
  }

  const openDiscussion = state.items.find((d) => d.id === openDiscussionId) ?? null

  return (
    <div className="cd-posts">
      {loggedIn && caps.can_post && (
        <button type="button" className="cd-composer-trigger" onClick={() => setComposerOpen(true)}>
          <Avatar person={currentUser ? { full_name: currentUser.full_name, photo_url: currentUser.photo_url } : null} size={38} />
          <span>Start a discussion…</span>
          <SquarePen size={18} strokeWidth={1.9} className="cd-composer-icon" />
        </button>
      )}
      {loggedIn && !caps.can_post && caps.is_member && (
        <p className="cd-note">Posting is limited to moderators and above in this community.</p>
      )}
      {loggedIn && !caps.is_member && !caps.is_banned && (
        <p className="cd-note">Join this community to start a discussion.</p>
      )}
      {caps.is_banned && (
        <p className="cd-note cd-note-danger">You've been removed from this community.</p>
      )}

      <SectionState
        loading={state.loading}
        error={state.error}
        empty={state.items.length === 0}
        emptyText="No posts yet — be the first to start a discussion."
        onRetry={load}
      />

      {state.items.length > 0 && (
        <ul className="cd-card cd-list">
          {state.items.map((d) => (
            <li key={d.id} className="cd-disc">
              <Avatar person={d.author} />
              <div className="cd-disc-body">
                <div className="cd-disc-top">
                  <button type="button" className="cd-disc-title-btn" onClick={() => setOpenDiscussionId(d.id)}>
                    {d.title}
                  </button>
                  {(d.can_delete) && (
                    <button
                      type="button"
                      className="cd-more"
                      aria-label="Delete post"
                      disabled={!!busy[d.id]}
                      onClick={() => deletePost(d)}
                    >
                      <Trash2 size={17} strokeWidth={1.9} />
                    </button>
                  )}
                </div>
                {d.body && <p className="cd-disc-snippet">{d.body}</p>}
                <p className="cd-disc-meta">
                  {d.author.username
                    ? <Link to={`/u/${d.author.username}`}>{displayName(d.author)}</Link>
                    : displayName(d.author)}
                  <span className="cd-sep">•</span>
                  <span className="cd-disc-time">{timeAgo(d.created_at)}</span>
                  {d.edited_at && <span className="cd-disc-edited">(edited)</span>}
                </p>
                <div className="cd-disc-stats">
                  <button
                    type="button"
                    className={`cd-stat cd-stat-btn ${d.is_liked ? 'on' : ''}`}
                    disabled={!loggedIn || !!busy[d.id]}
                    onClick={() => toggleLike(d)}
                  >
                    <ThumbsUp size={17} strokeWidth={1.9} fill={d.is_liked ? 'currentColor' : 'none'} />
                    {formatCount(d.likes_count)}
                  </button>
                  <button type="button" className="cd-stat cd-stat-btn" onClick={() => setOpenDiscussionId(d.id)}>
                    <MessageSquare size={17} strokeWidth={1.9} />{formatCount(d.comments_count)}
                  </button>
                  <span className="cd-stat"><Eye size={17} strokeWidth={1.9} />{formatCount(d.view_count)}</span>
                  {loggedIn && (
                    <button
                      type="button"
                      className={`cd-save ${d.is_saved ? 'on' : ''}`}
                      aria-label={d.is_saved ? 'Remove from saved' : 'Save discussion'}
                      aria-pressed={d.is_saved ? 'true' : 'false'}
                      disabled={!!busy[d.id]}
                      onClick={() => toggleSave(d)}
                    >
                      <Bookmark size={18} strokeWidth={1.9} fill={d.is_saved ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {composerOpen && (
        <PostComposer
          community={community}
          accessToken={accessToken}
          onClose={() => setComposerOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {openDiscussion && (
        <DiscussionThread
          discussion={openDiscussion}
          accessToken={accessToken}
          loggedIn={loggedIn}
          onClose={() => setOpenDiscussionId(null)}
          onChange={replace}
          onDeleted={() => { remove(openDiscussion.id); setOpenDiscussionId(null) }}
        />
      )}
    </div>
  )
}

function PostComposer({ community, accessToken, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    if (title.trim().length < 3) {
      setError('Give your post a title (at least 3 characters).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const discussion = await api.createDiscussion(
        community.slug,
        { title: title.trim(), body: body.trim() || null },
        accessToken,
      )
      onCreated(discussion)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <EditSheet title="New post" subtitle={`Posting in ${community.name}`} onClose={onClose} onSave={save} saving={saving} error={error}>
      <FormField label="Title">
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's this about?"
          maxLength={180}
          autoFocus
        />
      </FormField>
      <FormField label="Details (optional)">
        <textarea
          className="cd-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add more context, links, or questions…"
          rows={6}
          maxLength={8000}
        />
      </FormField>
    </EditSheet>
  )
}

/* ------------------------------------------------------ discussion thread --- */

function DiscussionThread({ discussion, accessToken, loggedIn, onClose, onChange, onDeleted }) {
  const [full, setFull] = useState(discussion)
  const [comments, setComments] = useState({ items: [], loading: true, error: null })
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.getDiscussion(discussion.id, accessToken ?? undefined).then((d) => {
      if (!cancelled) { setFull(d); onChange(d) }
    }).catch(() => {})
    api.listDiscussionComments(discussion.id, accessToken ?? undefined).then((items) => {
      if (!cancelled) setComments({ items, loading: false, error: null })
    }).catch((err) => {
      if (!cancelled) setComments({ items: [], loading: false, error: err.message })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussion.id])

  async function sendComment() {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const comment = await api.createDiscussionComment(discussion.id, text.trim(), accessToken)
      setComments((s) => ({ ...s, items: [...s.items, comment] }))
      setText('')
      const next = { ...full, comments_count: full.comments_count + 1 }
      setFull(next)
      onChange(next)
    } catch (err) {
      setComments((s) => ({ ...s, error: err.message }))
    } finally {
      setSending(false)
    }
  }

  async function deleteComment(id) {
    if (!window.confirm('Delete this comment?')) return
    try {
      await api.deleteDiscussionComment(id, accessToken)
      setComments((s) => ({ ...s, items: s.items.filter((c) => c.id !== id) }))
      const next = { ...full, comments_count: Math.max(0, full.comments_count - 1) }
      setFull(next)
      onChange(next)
    } catch (err) {
      setComments((s) => ({ ...s, error: err.message }))
    }
  }

  async function deletePost() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    try {
      await api.deleteDiscussion(discussion.id, accessToken)
      onDeleted()
    } catch (err) {
      setComments((s) => ({ ...s, error: err.message }))
    }
  }

  return (
    <div className="cd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cd-thread" role="dialog" aria-modal="true" aria-label={full.title}>
        <div className="cd-thread-head">
          <h2>{full.title}</h2>
          <button type="button" className="cd-thread-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="cd-thread-body">
          <div className="cd-thread-author">
            <Avatar person={full.author} size={40} />
            <div>
              <p className="cd-thread-author-name">{displayName(full.author)}</p>
              <p className="cd-thread-author-time">{timeAgo(full.created_at)}{full.edited_at ? ' · edited' : ''}</p>
            </div>
            {full.can_delete && (
              <button type="button" className="cd-thread-delete" onClick={deletePost}>
                <Trash2 size={16} strokeWidth={1.9} /> Delete
              </button>
            )}
          </div>
          {full.body && <p className="cd-thread-text">{full.body}</p>}

          <h3 className="cd-thread-comments-head">{pluralize(full.comments_count, 'comment')}</h3>
          <SectionState loading={comments.loading} error={comments.error} empty={!comments.loading && comments.items.length === 0} emptyText="No comments yet." />
          <ul className="cd-comments">
            {comments.items.map((c) => (
              <li key={c.id} className="cd-comment">
                <Avatar person={c.author} size={32} />
                <div className="cd-comment-body">
                  <p className="cd-comment-meta">
                    <span className="cd-comment-name">{displayName(c.author)}</span>
                    <span className="cd-sep">•</span>{timeAgo(c.created_at)}
                  </p>
                  <p className="cd-comment-text">{c.body}</p>
                </div>
                {c.can_delete && (
                  <button type="button" className="cd-comment-delete" aria-label="Delete comment" onClick={() => deleteComment(c.id)}>
                    <Trash2 size={14} strokeWidth={1.9} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {loggedIn ? (
          <div className="cd-thread-composer">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a reply…"
              maxLength={3000}
              onKeyDown={(e) => { if (e.key === 'Enter') sendComment() }}
            />
            <button type="button" disabled={!text.trim() || sending} onClick={sendComment}>
              {sending ? '…' : 'Reply'}
            </button>
          </div>
        ) : (
          <p className="cd-note" style={{ margin: '0 20px 16px' }}><Link to="/login">Sign in</Link> to reply.</p>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- styles ---- */

function CommunityDetailStyles() {
  return (
    <style>{`
      .cd { --gut: 20px; margin: -24px -20px 0; padding-bottom: 12px; }
      @media (min-width: 860px) { .cd { margin: -32px -40px 0; --gut: 40px; } }

      .cd-bar {
        position: sticky; top: 0; z-index: 30;
        display: flex; align-items: center; gap: 6px;
        padding: 14px var(--gut) 8px;
        background: color-mix(in srgb, var(--bg) 92%, transparent);
        backdrop-filter: blur(14px);
      }
      .cd-bar-title {
        margin: 0 0 0 4px; flex: 1 1 auto; min-width: 0;
        font-family: var(--font-head); font-weight: 700;
        font-size: 17px; color: var(--ink);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .cd-bar-actions { display: flex; align-items: center; gap: 2px; flex: none; }
      .cd-icon-btn {
        flex: none; width: 38px; height: 38px; border-radius: 999px;
        display: inline-flex; align-items: center; justify-content: center;
        color: var(--ink); transition: background .15s ease, color .15s ease;
      }
      @media (hover: hover) and (pointer: fine) { .cd-icon-btn:hover { background: var(--panel); color: var(--accent-ink); } }

      .cd-menu-wrap { position: relative; }
      .cd-menu {
        position: absolute; top: 44px; right: 0; z-index: 40; min-width: 210px;
        background: var(--panel-raised); border: 1px solid var(--border);
        border-radius: 14px; padding: 6px; box-shadow: var(--shadow-drop);
      }
      .cd-menu-item {
        width: 100%; display: flex; align-items: center; gap: 10px;
        padding: 11px 12px; border-radius: 10px;
        font-size: 14px; font-weight: 600; color: var(--ink); text-align: left;
      }
      @media (hover: hover) and (pointer: fine) { .cd-menu-item:hover { background: var(--panel); } }
      .cd-menu-item svg { color: var(--ink-dim); flex: none; }

      .cd-notfound { padding: 40px var(--gut); }
      .cd-back-link { display: inline-flex; align-items: center; gap: 8px; color: var(--ink-dim); font-weight: 600; font-size: 14px; }
      .cd-notfound-body { text-align: center; padding: 60px 20px; }
      .cd-notfound-icon { color: var(--ink-faint); margin-bottom: 14px; }
      .cd-notfound-body h1 { font-family: var(--font-head); font-size: 20px; color: var(--ink); margin: 0 0 8px; }
      .cd-notfound-body p { color: var(--ink-dim); font-size: 14px; margin: 0; }

      /* -------------------------------------------------------------- hero */
      .cd-hero { margin-bottom: 4px; }
      .cd-cover {
        height: 96px; background: var(--cover); background-size: cover; background-position: center;
      }
      .cd-hero-body { padding: 0 var(--gut) 16px; margin-top: -34px; }
      .cd-tile {
        width: 72px; height: 72px; border-radius: 18px; flex: none;
        display: inline-flex; align-items: center; justify-content: center;
        background: #0F1309; border: 3px solid var(--bg); overflow: hidden;
      }
      .cd-tile.tone-lemon { background: radial-gradient(120% 120% at 30% 20%, #1c2412, #0c1007); }
      .cd-tile.tone-dark { background: radial-gradient(120% 120% at 30% 20%, #191d13, #0b0e07); }
      .cd-tile.tone-violet { background: linear-gradient(150deg,#8B45F0,#5B21C0); }
      .cd-tile.tone-leaf { background: radial-gradient(120% 120% at 30% 20%, #1b2412, #0c1007); }
      .cd-tile.tone-pink { background: linear-gradient(150deg,#F0568E,#8B2BD9); }
      .cd-word { font-family: var(--font-head); font-weight: 800; font-size: 26px; color: var(--accent-ink); letter-spacing: -.5px; }
      .cd-word.code { font-size: 23px; }
      .cd-emoji { line-height: 1; }
      .cd-tile-img { width: 100%; height: 100%; object-fit: cover; }

      .cd-hero-id { margin-top: 12px; }
      .cd-hero-name-row { display: flex; align-items: center; gap: 8px; }
      .cd-hero-name { margin: 0; font-family: var(--font-display); font-weight: 800; font-size: 22px; letter-spacing: -.4px; color: var(--ink); }
      .cd-crown {
        width: 20px; height: 20px; border-radius: 999px; flex: none;
        display: inline-flex; align-items: center; justify-content: center;
        background: var(--lemon); color: var(--on-accent);
      }
      .cd-privacy-icon { color: var(--ink-faint); flex: none; }
      .cd-hero-desc { margin: 6px 0 0; font-size: 14.5px; line-height: 1.45; color: var(--ink-dim); }
      .cd-hero-meta { margin: 8px 0 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; color: var(--ink-faint); text-transform: capitalize; }
      .cd-sep { color: var(--ink-faint); text-transform: none; }
      .cd-fresh { color: var(--accent-ink); font-weight: 600; text-transform: none; }

      .cd-hero-actions { display: flex; gap: 8px; margin-top: 14px; }
      .cd-join {
        flex: 1; padding: 11px 20px; border-radius: 12px; text-align: center;
        border: 1px solid var(--lemon); color: var(--accent-ink); background: transparent;
        font-family: var(--font-head); font-weight: 700; font-size: 14.5px;
        transition: background .15s ease, color .15s ease, transform .15s ease;
      }
      @media (hover: hover) and (pointer: fine) { .cd-join:hover { background: color-mix(in srgb, var(--lemon) 14%, transparent); } }
      .cd-join:active { transform: scale(.97); }
      .cd-join.on { background: var(--lemon); color: var(--on-accent); }
      .cd-manage-btn {
        flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
        padding: 11px 20px; border-radius: 12px;
        background: var(--lemon); color: var(--on-accent);
        font-family: var(--font-head); font-weight: 700; font-size: 14.5px;
      }
      .cd-manage-btn:active { transform: scale(.97); }
      .cd-manage-btn-ghost {
        flex: none; width: 44px; padding: 0; background: var(--panel); color: var(--ink); border: 1px solid var(--border);
      }

      /* -------------------------------------------------------------- tabs */
      .cd-tabs {
        display: flex; border-bottom: 1px solid var(--border);
        padding: 0 var(--gut); overflow-x: auto; scrollbar-width: none; position: sticky; top: 58px; z-index: 20;
        background: var(--bg);
      }
      .cd-tabs::-webkit-scrollbar { display: none; }
      .cd-tab {
        flex: 1; padding: 13px 8px; text-align: center;
        font-family: var(--font-head); font-size: 14.5px; font-weight: 600; color: var(--ink-faint);
        border-bottom: 2px solid transparent; white-space: nowrap;
        transition: color .15s ease;
      }
      .cd-tab-active { color: var(--accent-ink); border-bottom-color: var(--accent-ink); }
      .cd-tabpanel { padding: 16px var(--gut) 4px; min-height: 200px; }

      .cd-note { margin: 0 0 14px; font-size: 13.5px; color: var(--ink-faint); }
      .cd-note-danger { color: var(--danger); }

      /* ------------------------------------------------------------ state */
      .cd-state { margin: 0; padding: 4px 0 6px; font-size: 14px; color: var(--ink-faint); }
      .cd-state-error { color: var(--ink-dim); }
      .cd-retry { font-family: var(--font-head); font-weight: 600; font-size: 14px; color: var(--accent-ink); text-decoration: underline; }

      /* -------------------------------------------------------- composer */
      .cd-composer-trigger {
        width: 100%; display: flex; align-items: center; gap: 12px;
        padding: 13px 14px; border-radius: 14px; margin-bottom: 16px;
        background: var(--panel); border: 1px solid var(--border); text-align: left;
      }
      .cd-composer-trigger span { flex: 1; color: var(--ink-faint); font-size: 14.5px; }
      .cd-composer-icon { color: var(--ink-faint); flex: none; }
      @media (hover: hover) and (pointer: fine) { .cd-composer-trigger:hover { border-color: var(--lemon-deep); } }

      .cd-textarea {
        width: 100%; background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
        padding: 12px 14px; font-size: 15px; color: var(--ink); font-family: var(--font-body);
        resize: vertical; transition: border-color .15s ease;
      }
      .cd-textarea::placeholder { color: var(--ink-faint); }
      .cd-textarea:focus { outline: none; border-color: var(--accent-ink); }

      /* ------------------------------------------------------------- list */
      .cd-card { margin: 0; padding: 0; list-style: none; background: var(--panel); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; }
      .cd-list > li + li { border-top: 1px solid var(--border); }
      .cd-disc { display: flex; gap: 12px; padding: 14px 14px 12px; }
      .cd-avatar {
        border-radius: 999px; flex: none;
        display: inline-flex; align-items: center; justify-content: center;
        font-family: var(--font-head); font-weight: 700; color: var(--on-accent);
      }
      .cd-avatar.av-a { background: linear-gradient(150deg,#E7C98F,#B07B4C); }
      .cd-avatar.av-b { background: linear-gradient(150deg,#9FC7E8,#4B7BA8); }
      .cd-avatar.av-c { background: linear-gradient(150deg,#CBD5C0,#7C8C6A); }
      .cd-avatar-img { object-fit: cover; }

      .cd-disc-body { flex: 1 1 auto; min-width: 0; }
      .cd-disc-top { display: flex; align-items: flex-start; gap: 8px; }
      .cd-disc-title-btn {
        flex: 1 1 auto; min-width: 0; text-align: left;
        font-family: var(--font-head); font-weight: 700; font-size: 15.5px; line-height: 1.3; color: var(--ink);
      }
      @media (hover: hover) and (pointer: fine) { .cd-disc-title-btn:hover { color: var(--accent-ink); } }
      .cd-disc-snippet {
        margin: 4px 0 0; font-size: 13.5px; line-height: 1.4; color: var(--ink-dim);
        display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
      }
      .cd-more { flex: none; color: var(--ink-faint); line-height: 0; padding: 2px; }
      @media (hover: hover) and (pointer: fine) { .cd-more:hover { color: var(--danger); } }
      .cd-disc-meta { margin: 6px 0 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12.5px; color: var(--ink-dim); }
      @media (hover: hover) and (pointer: fine) { .cd-disc-meta a:hover { color: var(--accent-ink); } }
      .cd-disc-time { color: var(--ink-faint); }
      .cd-disc-edited { color: var(--ink-faint); font-style: italic; }
      .cd-disc-stats { margin-top: 10px; display: flex; align-items: center; gap: 18px; font-size: 13px; color: var(--ink-dim); }
      .cd-stat { display: inline-flex; align-items: center; gap: 7px; }
      @media (hover: hover) and (pointer: fine) { .cd-stat-btn:hover { color: var(--ink); } }
      .cd-stat-btn.on { color: var(--accent-ink); }
      .cd-stat-btn:disabled { opacity: .6; }
      .cd-save { margin-left: auto; color: var(--ink-dim); line-height: 0; }
      @media (hover: hover) and (pointer: fine) { .cd-save:hover, .cd-save.on { color: var(--accent-ink); } }

      /* ---------------------------------------------------------- thread */
      .cd-overlay {
        position: fixed; inset: 0; z-index: 100; background: var(--scrim);
        display: flex; align-items: flex-end; justify-content: center;
      }
      .cd-thread {
        width: 100%; max-width: 560px; max-height: 88vh;
        background: var(--panel); border: 1px solid var(--border); border-bottom: none;
        border-radius: 20px 20px 0 0; display: flex; flex-direction: column;
      }
      .cd-thread-head {
        display: flex; align-items: flex-start; gap: 12px; padding: 18px 18px 12px;
        border-bottom: 1px solid var(--border);
      }
      .cd-thread-head h2 { flex: 1; margin: 0; font-family: var(--font-head); font-size: 17px; font-weight: 700; color: var(--ink); }
      .cd-thread-close { flex: none; color: var(--ink-faint); }
      @media (hover: hover) and (pointer: fine) { .cd-thread-close:hover { color: var(--ink); } }
      .cd-thread-body { flex: 1; overflow-y: auto; padding: 16px 18px; }
      .cd-thread-author { display: flex; align-items: center; gap: 10px; }
      .cd-thread-author-name { margin: 0; font-family: var(--font-head); font-weight: 700; font-size: 14.5px; color: var(--ink); }
      .cd-thread-author-time { margin: 2px 0 0; font-size: 12.5px; color: var(--ink-faint); }
      .cd-thread-delete { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--danger); font-weight: 600; }
      .cd-thread-text { margin: 14px 0 0; font-size: 14.5px; line-height: 1.55; color: var(--ink); white-space: pre-wrap; }
      .cd-thread-comments-head { margin: 22px 0 10px; font-family: var(--font-head); font-size: 14px; font-weight: 700; color: var(--ink-dim); }
      .cd-comments { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
      .cd-comment { display: flex; gap: 10px; align-items: flex-start; }
      .cd-comment-body { flex: 1; min-width: 0; }
      .cd-comment-meta { margin: 0; font-size: 12.5px; color: var(--ink-faint); }
      .cd-comment-name { font-weight: 700; color: var(--ink-dim); }
      .cd-comment-text { margin: 3px 0 0; font-size: 14px; line-height: 1.45; color: var(--ink); }
      .cd-comment-delete { flex: none; color: var(--ink-faint); margin-top: 2px; }
      @media (hover: hover) and (pointer: fine) { .cd-comment-delete:hover { color: var(--danger); } }
      .cd-thread-composer {
        display: flex; gap: 10px; padding: 12px 18px calc(14px + env(safe-area-inset-bottom));
        border-top: 1px solid var(--border);
      }
      .cd-thread-composer input {
        flex: 1; min-width: 0; background: var(--field); border: 1px solid var(--field-border); border-radius: 999px;
        padding: 11px 16px; color: var(--ink); font-size: 14.5px;
      }
      .cd-thread-composer input:focus { outline: none; border-color: var(--accent-ink); }
      .cd-thread-composer button {
        flex: none; padding: 11px 18px; border-radius: 999px; background: var(--lemon); color: var(--on-accent);
        font-family: var(--font-head); font-weight: 700; font-size: 14px;
      }
      .cd-thread-composer button:disabled { opacity: .5; }

      @media (min-width: 640px) {
        .cd-overlay { align-items: center; padding: 24px; }
        .cd-thread { border-radius: 20px; border-bottom: 1px solid var(--border); }
      }
    `}</style>
  )
}
