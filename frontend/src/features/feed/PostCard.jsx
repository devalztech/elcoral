import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeCheck, Bookmark, Globe, Heart, Link2, MessageSquare, MoreHorizontal,
  Repeat2, Send, Trash2, Users2,
} from 'lucide-react'
import { api } from '../../api/client.js'
import { useAuth } from '../auth/hooks/useAuth.jsx'
import { avatarTone, formatCount, initialsOf, timeAgo } from '../social/format.js'
import VoiceNote from '../messages/VoiceNote.jsx'
import Lightbox from '../../components/Lightbox.jsx'

function Avatar({ person, size = 44 }) {
  const name = person?.full_name || person?.username || 'Member'
  if (person?.photo_url) {
    return (
      <img
        className="pc-av"
        src={person.photo_url}
        alt={name}
        style={{ width: size, height: size }}
        loading="lazy"
      />
    )
  }
  return (
    <span
      className={`pc-av pc-av-${avatarTone(person?.id || name)}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  )
}

function AuthorLine({ author, meta, size = 44 }) {
  const to = author?.username ? `/u/${author.username}` : '/home'
  return (
    <>
      <Link to={to} aria-label={author?.full_name}>
        <Avatar person={author} size={size} />
      </Link>
      <div className="pc-id">
        <h3>
          <Link to={to}>{author?.full_name || 'Member'}</Link>
          {author?.is_verified && <BadgeCheck className="pc-verified" size={16} />}
        </h3>
        <p>{meta}</p>
      </div>
    </>
  )
}

function MediaGrid({ media }) {
  const [preview, setPreview] = useState(null)
  if (!media?.length) return null
  return (
    <div className={`pc-media count-${Math.min(media.length, 4)}`}>
      {media.map((m, i) => {
        const type = m.mime_type || ''
        if (type.startsWith('video/')) {
          return (
            <div key={i} className="pc-frame">
              <video src={m.url} controls preload="metadata" playsInline className="pc-media-item" />
            </div>
          )
        }
        if (type.startsWith('audio/')) {
          return <VoiceNote key={i} src={m.url} title="Audio clip" />
        }
        if (type === 'application/pdf') {
          return (
            <a key={i} href={m.url} target="_blank" rel="noreferrer" className="pc-doc">
              <Link2 size={16} /> Open attachment
            </a>
          )
        }
        return (
          <button
            key={i}
            type="button"
            className="pc-frame pc-frame-btn"
            onClick={() => setPreview(m.url)}
            aria-label="Open image preview"
          >
            <img src={m.url} alt="" loading="lazy" className="pc-media-item" />
          </button>
        )
      })}
      <Lightbox src={preview} onClose={() => setPreview(null)} />
    </div>
  )
}

function Poll({ post, onVote, busy }) {
  const total = post.poll.reduce((sum, o) => sum + o.votes, 0)
  const voted = post.my_poll_vote !== null && post.my_poll_vote !== undefined
  return (
    <div className="pc-poll">
      {post.poll.map((option) => {
        const pct = total ? Math.round((option.votes / total) * 100) : 0
        const mine = post.my_poll_vote === option.index
        return (
          <button
            key={option.index}
            type="button"
            className={`pc-poll-option ${mine ? 'on' : ''}`}
            disabled={busy}
            onClick={() => onVote(option.index)}
          >
            <span className="pc-poll-fill" style={{ width: `${voted ? pct : 0}%` }} aria-hidden="true" />
            <span className="pc-poll-label">{option.label}</span>
            {voted && <span className="pc-poll-pct">{pct}%</span>}
          </button>
        )
      })}
      <p className="pc-poll-total">
        {total === 1 ? '1 vote' : `${formatCount(total)} votes`}
        {!voted && ' · tap an option to vote'}
      </p>
    </div>
  )
}

function Comments({ post, onCountChange }) {
  const { accessToken, user } = useAuth()
  const [items, setItems] = useState(null)
  const [value, setValue] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .listComments(post.id, accessToken)
      .then((data) => { if (!cancelled) setItems(data) })
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [post.id, accessToken])

  const submit = async (e) => {
    e.preventDefault()
    const body = value.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      const created = await api.createComment(post.id, { body, parentId: replyTo?.id }, accessToken)
      setItems((list) => [...(list ?? []), created])
      setValue('')
      setReplyTo(null)
      onCountChange?.(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const remove = async (comment) => {
    try {
      await api.deleteComment(comment.id, accessToken)
      setItems((list) => (list ?? []).filter((c) => c.id !== comment.id && c.parent_id !== comment.id))
      onCountChange?.(-1)
    } catch (err) {
      setError(err.message)
    }
  }

  const roots = (items ?? []).filter((c) => !c.parent_id)
  const repliesOf = (id) => (items ?? []).filter((c) => c.parent_id === id)

  const row = (comment, isReply = false) => (
    <li key={comment.id} className={`pc-comment ${isReply ? 'reply' : ''}`}>
      <Avatar person={comment.author} size={32} />
      <div className="pc-comment-body">
        <p className="pc-comment-meta">
          <b>{comment.author.full_name}</b>
          <span>{timeAgo(comment.created_at)}</span>
        </p>
        <p className="pc-comment-text">{comment.body}</p>
        <div className="pc-comment-tools">
          {!isReply && (
            <button type="button" onClick={() => setReplyTo(comment)}>Reply</button>
          )}
          {(comment.is_mine || post.is_mine) && (
            <button type="button" onClick={() => remove(comment)}>Delete</button>
          )}
        </div>
        {!isReply && repliesOf(comment.id).length > 0 && (
          <ul className="pc-replies">{repliesOf(comment.id).map((r) => row(r, true))}</ul>
        )}
      </div>
    </li>
  )

  return (
    <div className="pc-comments">
      {items === null && <p className="pc-hint">Loading comments…</p>}
      {items !== null && roots.length === 0 && <p className="pc-hint">No comments yet. Start the conversation.</p>}
      {roots.length > 0 && <ul className="pc-comment-list">{roots.map((c) => row(c))}</ul>}

      {user ? (
        <form className="pc-comment-form" onSubmit={submit}>
          {replyTo && (
            <p className="pc-replying">
              Replying to {replyTo.author.full_name}
              <button type="button" onClick={() => setReplyTo(null)}>Cancel</button>
            </p>
          )}
          <div className="pc-comment-input">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Write a comment…"
              maxLength={2000}
              aria-label="Write a comment"
            />
            <button type="submit" disabled={!value.trim() || sending} aria-label="Send comment">
              <Send size={18} strokeWidth={2} />
            </button>
          </div>
          {error && <p className="pc-error">{error}</p>}
        </form>
      ) : (
        <p className="pc-hint">
          <Link to="/login" className="pc-inline-link">Sign in</Link> to join the conversation.
        </p>
      )}
    </div>
  )
}

export default function PostCard({ post: initial, onDeleted }) {
  const { accessToken, user } = useAuth()
  const [post, setPost] = useState(initial)
  const [openComments, setOpenComments] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const menuRef = useRef(null)

  useEffect(() => setPost(initial), [initial])

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpen])

  const applyEngagement = useCallback((data) => {
    setPost((p) => ({
      ...p,
      like_count: data.like_count,
      comment_count: data.comment_count,
      repost_count: data.repost_count,
      liked_by_me: data.liked_by_me,
      reposted_by_me: data.reposted_by_me,
      saved_by_me: data.saved_by_me,
    }))
  }, [])

  const guard = () => {
    if (user) return true
    setError('Sign in to interact with posts.')
    return false
  }

  const run = async (fn, optimistic) => {
    if (!guard() || busy) return
    setError('')
    setBusy(true)
    if (optimistic) setPost((p) => ({ ...p, ...optimistic(p) }))
    try {
      applyEngagement(await fn())
    } catch (err) {
      setError(err.message)
      // Re-sync from the server rather than guessing what the truth is.
      try { setPost(await api.getPost(post.id, accessToken)) } catch { /* keep local */ }
    } finally {
      setBusy(false)
    }
  }

  const toggleLike = () =>
    run(
      () => (post.liked_by_me ? api.unlikePost(post.id, accessToken) : api.likePost(post.id, accessToken)),
      (p) => ({ liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) }),
    )

  const toggleRepost = () =>
    run(
      () => (post.reposted_by_me ? api.undoRepost(post.id, accessToken) : api.repostPost(post.id, accessToken)),
      (p) => ({ reposted_by_me: !p.reposted_by_me, repost_count: p.repost_count + (p.reposted_by_me ? -1 : 1) }),
    )

  const toggleSave = () =>
    run(
      () => (post.saved_by_me ? api.unsavePost(post.id, accessToken) : api.savePost(post.id, accessToken)),
      (p) => ({ saved_by_me: !p.saved_by_me }),
    )

  const vote = async (index) => {
    if (!guard() || busy) return
    setBusy(true)
    try {
      setPost(await api.votePoll(post.id, index, accessToken))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return
    try {
      await api.deletePost(post.id, accessToken)
      onDeleted?.(post.id)
    } catch (err) {
      setError(err.message)
    }
  }

  const handle = post.author?.username ? `@${post.author.username}` : post.author?.headline || 'Member'
  const meta = (
    <>
      {handle} · {timeAgo(post.created_at)}
      {post.edited_at ? ' · edited' : ''} ·{' '}
      {post.visibility === 'followers' ? <Users2 size={12} strokeWidth={2} /> : <Globe size={12} strokeWidth={2} />}
    </>
  )

  return (
    <article className="pc">
      {post.reposted_by && (
        <p className="pc-repost-note">
          <Repeat2 size={15} strokeWidth={2} /> {post.reposted_by.full_name} reposted
        </p>
      )}

      <header className="pc-head">
        <AuthorLine author={post.author} meta={meta} />
        <div className="pc-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="pc-more"
            aria-label="Post options"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal size={20} />
          </button>
          {menuOpen && (
            <div className="pc-menu" role="menu">
              <button type="button" onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/home/posts/${post.id}`)
                setMenuOpen(false)
              }}>
                <Link2 size={16} /> Copy link
              </button>
              {post.is_mine && (
                <button type="button" className="danger" onClick={remove}>
                  <Trash2 size={16} /> Delete post
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {post.title && <h2 className="pc-title">{post.title}</h2>}
      {post.body && <p className="pc-body">{post.body}</p>}

      {post.link_url && (
        <a className="pc-link" href={post.link_url} target="_blank" rel="noreferrer">
          <Link2 size={16} strokeWidth={2} />
          <span>{post.link_url}</span>
        </a>
      )}

      <MediaGrid media={post.media?.length ? post.media : (post.media_urls ?? []).map((url) => ({ url }))} />

      {post.poll?.length > 0 && <Poll post={post} onVote={vote} busy={busy} />}

      {post.tags?.length > 0 && (
        <div className="pc-tags">
          {post.tags.map((tag) => (
            <span key={tag} className="pc-tag">#{tag}</span>
          ))}
        </div>
      )}

      <footer className="pc-actions">
        <button
          type="button"
          className={`pc-action ${post.liked_by_me ? 'liked' : ''}`}
          onClick={toggleLike}
          aria-pressed={post.liked_by_me}
          aria-label="Like"
        >
          <Heart size={21} strokeWidth={1.9} fill={post.liked_by_me ? 'currentColor' : 'none'} />
          {formatCount(post.like_count)}
        </button>
        <button
          type="button"
          className={`pc-action ${openComments ? 'on' : ''}`}
          onClick={() => setOpenComments((v) => !v)}
          aria-expanded={openComments}
          aria-label="Comments"
        >
          <MessageSquare size={21} strokeWidth={1.9} />
          {formatCount(post.comment_count)}
        </button>
        <button
          type="button"
          className={`pc-action ${post.reposted_by_me ? 'reposted' : ''}`}
          onClick={toggleRepost}
          aria-pressed={post.reposted_by_me}
          aria-label="Repost"
        >
          <Repeat2 size={22} strokeWidth={1.9} />
          {formatCount(post.repost_count)}
        </button>
        <button
          type="button"
          className={`pc-action pc-save ${post.saved_by_me ? 'on' : ''}`}
          onClick={toggleSave}
          aria-pressed={post.saved_by_me}
          aria-label="Save post"
        >
          <Bookmark size={21} strokeWidth={1.9} fill={post.saved_by_me ? 'currentColor' : 'none'} />
        </button>
      </footer>

      {error && <p className="pc-error">{error}</p>}

      {openComments && (
        <Comments
          post={post}
          onCountChange={(delta) =>
            setPost((p) => ({ ...p, comment_count: Math.max(0, p.comment_count + delta) }))
          }
        />
      )}

      <style>{`
        .pc {
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 16px; padding: 14px; display: grid; gap: 12px;
        }
        .pc-av {
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; flex: none; overflow: hidden; object-fit: cover;
          font-family: var(--font-head); font-weight: 700; color: var(--ink);
          background: var(--panel-raised);
        }
        .pc-av-a { background: linear-gradient(145deg,#1d2415,#0f1309); color: var(--accent-ink); }
        .pc-av-b { background: linear-gradient(145deg,#3a2a20,#1a130e); }
        .pc-av-c { background: linear-gradient(145deg,#28303a,#12161b); }
        .pc-verified { color: var(--accent-ink); flex: none; }

        .pc-repost-note {
          margin: 0; display: flex; align-items: center; gap: 6px;
          font-size: 12.5px; color: var(--ink-dim);
        }
        .pc-repost-note svg { color: var(--accent-ink); }

        .pc-head { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 11px; }
        .pc-id { min-width: 0; }
        .pc-id h3 {
          margin: 0; display: flex; align-items: center; gap: 5px;
          font-family: var(--font-head); font-size: 15px; font-weight: 700; color: var(--ink);
        }
        .pc-id h3 a { color: inherit; }
        .pc-id p {
          margin: 2px 0 0; display: flex; align-items: center; gap: 5px;
          font-size: 12.5px; color: var(--ink-dim);
        }
        .pc-more { color: var(--ink-faint); display: grid; place-items: center; width: 34px; height: 34px; border-radius: 999px; }
        .pc-more:hover { background: var(--panel-raised); color: var(--ink); }
        .pc-menu-wrap { position: relative; }
        .pc-menu {
          position: absolute; right: 0; top: 38px; z-index: 20; min-width: 180px;
          background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 12px; padding: 6px; display: grid; gap: 2px;
        }
        .pc-menu button {
          display: flex; align-items: center; gap: 9px; width: 100%;
          padding: 10px; border-radius: 9px; font-size: 13.5px; color: var(--ink); text-align: left;
        }
        .pc-menu button:hover { background: var(--panel); }
        .pc-menu button.danger { color: #ff6b6b; }

        .pc-title { margin: 0; font-family: var(--font-head); font-size: 18px; font-weight: 700; color: var(--ink); }
        .pc-body { margin: 0; font-size: 14.5px; line-height: 1.55; color: var(--ink); white-space: pre-wrap; word-break: break-word; }

        .pc-link {
          display: flex; align-items: center; gap: 8px; padding: 11px 12px;
          background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 12px; font-size: 13px; color: var(--accent-ink);
        }
        .pc-link span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .pc-media { display: grid; gap: 6px; }
        .pc-media.count-2, .pc-media.count-4 { grid-template-columns: 1fr 1fr; }
        .pc-media.count-3 { grid-template-columns: 1fr 1fr; }
        .pc-media.count-3 > :first-child { grid-column: 1 / -1; }
        .pc-frame {
          position: relative; display: block; width: 100%; aspect-ratio: 16 / 9;
          padding: 0; border: 1px solid var(--border); border-radius: 14px;
          overflow: hidden; background: var(--panel-raised);
        }
        .pc-frame-btn { cursor: zoom-in; }
        .pc-frame-btn:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: 2px; }
        .pc-media-item {
          width: 100%; height: 100%; object-fit: cover;
          background: var(--panel-raised); display: block;
          transition: transform 200ms ease;
        }
        .pc-frame-btn:hover .pc-media-item { transform: scale(1.02); }
        @media (prefers-reduced-motion: reduce) { .pc-media-item { transition: none; } }
        .pc-audio { width: 100%; }
        .pc-doc {
          display: flex; align-items: center; gap: 8px; padding: 12px;
          border: 1px solid var(--border); border-radius: 12px; color: var(--accent-ink); font-size: 13.5px;
        }

        .pc-poll { display: grid; gap: 8px; }
        .pc-poll-option {
          position: relative; overflow: hidden; text-align: left;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 12px 14px; border-radius: 12px;
          border: 1px solid var(--border); background: var(--panel-raised); color: var(--ink);
          font-size: 14px; font-family: var(--font-head); font-weight: 600;
        }
        .pc-poll-option.on { border-color: var(--accent-ink); }
        .pc-poll-fill {
          position: absolute; inset: 0 auto 0 0; background: rgba(196, 241, 53, 0.14);
          transition: width .3s ease;
        }
        .pc-poll-label, .pc-poll-pct { position: relative; }
        .pc-poll-pct { color: var(--accent-ink); }
        .pc-poll-total { margin: 0; font-size: 12.5px; color: var(--ink-dim); }

        .pc-tags { display: flex; flex-wrap: wrap; gap: 7px; }
        .pc-tag {
          font-size: 12.5px; color: var(--accent-ink);
          background: var(--panel-raised); border-radius: 999px; padding: 5px 10px;
        }

        .pc-actions {
          display: flex; align-items: center; gap: 6px;
          border-top: 1px solid var(--border); padding-top: 10px;
        }
        .pc-action {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 12px; border-radius: 999px;
          font-family: var(--font-head); font-size: 13.5px; font-weight: 600;
          color: var(--ink-dim);
        }
        .pc-action:hover { background: var(--panel-raised); color: var(--ink); }
        .pc-action.liked { color: #ff5a7a; }
        .pc-action.reposted, .pc-action.on { color: var(--accent-ink); }
        .pc-save { margin-left: auto; }
        .pc-save.on { color: var(--accent-ink); }

        .pc-error { margin: 0; font-size: 12.5px; color: #ff6b6b; }
        .pc-hint { margin: 0; font-size: 13px; color: var(--ink-dim); }
        .pc-inline-link { color: var(--accent-ink); }

        .pc-comments { border-top: 1px solid var(--border); padding-top: 12px; display: grid; gap: 12px; }
        .pc-comment-list, .pc-replies { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
        .pc-replies { margin-top: 10px; padding-left: 6px; border-left: 1px solid var(--border); }
        .pc-comment { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 10px; }
        .pc-comment-meta { margin: 0; display: flex; gap: 8px; align-items: baseline; font-size: 13px; color: var(--ink-dim); }
        .pc-comment-meta b { color: var(--ink); font-family: var(--font-head); }
        .pc-comment-text { margin: 3px 0 0; font-size: 13.8px; line-height: 1.5; color: var(--ink); white-space: pre-wrap; word-break: break-word; }
        .pc-comment-tools { display: flex; gap: 12px; margin-top: 5px; }
        .pc-comment-tools button { font-size: 12px; color: var(--ink-dim); font-family: var(--font-head); font-weight: 600; }
        .pc-comment-tools button:hover { color: var(--accent-ink); }

        .pc-replying { margin: 0 0 8px; font-size: 12.5px; color: var(--ink-dim); display: flex; gap: 10px; }
        .pc-replying button { color: var(--accent-ink); font-size: 12.5px; }
        .pc-comment-input { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; }
        .pc-comment-input input {
          width: 100%; padding: 12px 14px; border-radius: 999px;
          background: var(--panel-raised); border: 1px solid var(--border);
          color: var(--ink); font-size: 14px;
        }
        .pc-comment-input input:focus { outline: none; border-color: var(--accent-ink); }
        .pc-comment-input button {
          width: 44px; height: 44px; border-radius: 999px; display: grid; place-items: center;
          background: var(--lemon); color: var(--on-accent);
        }
        .pc-comment-input button:disabled { opacity: .5; }
      `}</style>
    </article>
  )
}
