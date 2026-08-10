import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bookmark, Globe, Heart, Link2, MessageSquare, MoreHorizontal,
  Repeat2, Send, Trash2, Users2,
} from 'lucide-react'
import { api } from '../../api/client.js'
import { useAuth } from '../auth/hooks/useAuth.jsx'
import { avatarTone, formatCount, initialsOf, timeAgo } from '../social/format.js'
import PostMedia from './PostMedia.jsx'
import VerifiedBadge from '../../components/VerifiedBadge.jsx'

// X's own post metrics, used verbatim below:
//   avatar 40px · avatar→content gutter 12px · card padding 12px 16px
//   name/handle/body 15px with a 20px line-box · media radius 16px
// AVATAR + GUTTER is the indent every line of post content sits on.
const AVATAR = 40
const GUTTER = 12

function Avatar({ person, size = AVATAR }) {
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


// Poll options are a real radio group: every row carries a 20px ring
// (2px stroke) that fills with a 10px dot on the chosen option, so the
// selection is visible before *and* after voting — the results bar is
// drawn behind the row instead of replacing the control.
function Poll({ post, onVote, busy }) {
  const total = post.poll.reduce((sum, o) => sum + o.votes, 0)
  const voted = post.my_poll_vote !== null && post.my_poll_vote !== undefined
  return (
    <div className="pc-poll" role="radiogroup" aria-label="Poll options">
      {post.poll.map((option) => {
        const pct = total ? Math.round((option.votes / total) * 100) : 0
        const mine = post.my_poll_vote === option.index
        return (
          <button
            key={option.index}
            type="button"
            className={`pc-poll-option ${mine ? 'on' : ''} ${voted ? 'voted' : ''}`}
            disabled={busy}
            onClick={() => onVote(option.index)}
            role="radio"
            aria-checked={mine}
          >
            {voted && (
              <span className="pc-poll-fill" style={{ width: `${pct}%` }} aria-hidden="true" />
            )}
            <span className="pc-poll-radio" aria-hidden="true">
              {mine && <span className="pc-poll-dot" />}
            </span>
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
      <Avatar person={comment.author} size={AVATAR} />
      <div className="pc-comment-body">
        <p className="pc-comment-meta">
          <b className="pc-comment-author">
            {comment.author.full_name}
            {comment.author.is_verified && <VerifiedBadge size={13} className="pc-comment-verified" />}
          </b>
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

export default function PostCard({ post: initial, onDeleted, detail = false }) {
  const { accessToken, user } = useAuth()
  const navigate = useNavigate()
  const [post, setPost] = useState(initial)
  const [openComments, setOpenComments] = useState(detail)
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
  const authorTo = post.author?.username ? `/u/${post.author.username}` : '/home'
  const media = post.media?.length ? post.media : (post.media_urls ?? []).map((url) => ({ url }))

  // Tapping the post — its text, its indent, its photo or its clip —
  // opens the full-screen view, the way X and TikTok do. Anything
  // genuinely interactive (links, buttons, the poll, the player chrome)
  // opts out with data-stop so it keeps its own behaviour.
  const openPost = (e) => {
    if (detail) return
    if (window.getSelection?.()?.toString()) return
    if (e.target.closest('a, button, input, textarea, video, [data-stop]')) return
    navigate(`/home/posts/${post.id}`)
  }

  return (
    <article
      className={`pc ${detail ? 'pc-detail' : 'pc-tappable'}`}
      onClick={openPost}
    >
      {post.reposted_by && (
        <p className="pc-repost-note">
          <Repeat2 size={16} strokeWidth={2} /> {post.reposted_by.full_name} reposted
        </p>
      )}

      {/* Two columns, exactly like X: a fixed 40px avatar rail and one
          content column. Everything the author posted — text, media,
          poll, tags, the action bar and the comment thread — lives in
          that second column, so it is all indented under the name. */}
      <div className="pc-grid">
        <div className="pc-rail">
          <Link to={authorTo} aria-label={post.author?.full_name}>
            <Avatar person={post.author} />
          </Link>
        </div>

        <div className="pc-col">
          <header className="pc-head">
            <div className="pc-id">
              <Link className="pc-name" to={authorTo}>{post.author?.full_name || 'Member'}</Link>
              {post.author?.is_verified && <VerifiedBadge size={18.75} className="pc-verified" />}
              <span className="pc-handle">{handle}</span>
              <span className="pc-dot">·</span>
              <span className="pc-time">{timeAgo(post.created_at)}</span>
              {post.edited_at && <span className="pc-time">· edited</span>}
              <span className="pc-scope">
                {post.visibility === 'followers'
                  ? <Users2 size={13} strokeWidth={2} />
                  : <Globe size={13} strokeWidth={2} />}
              </span>
            </div>
            <div className="pc-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="pc-more"
                aria-label="Post options"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={18.75} />
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

          <PostMedia media={media} lightbox={detail} />

          {post.poll?.length > 0 && (
            <div data-stop="true">
              <Poll post={post} onVote={vote} busy={busy} />
            </div>
          )}

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
              className={`pc-action ${openComments ? 'on' : ''}`}
              onClick={() => (detail ? setOpenComments((v) => !v) : navigate(`/home/posts/${post.id}`))}
              aria-expanded={openComments}
              aria-label="Comments"
            >
              <MessageSquare size={18.75} strokeWidth={1.8} />
              {formatCount(post.comment_count)}
            </button>
            <button
              type="button"
              className={`pc-action ${post.reposted_by_me ? 'reposted' : ''}`}
              onClick={toggleRepost}
              aria-pressed={post.reposted_by_me}
              aria-label="Repost"
            >
              <Repeat2 size={18.75} strokeWidth={1.8} />
              {formatCount(post.repost_count)}
            </button>
            <button
              type="button"
              className={`pc-action ${post.liked_by_me ? 'liked' : ''}`}
              onClick={toggleLike}
              aria-pressed={post.liked_by_me}
              aria-label="Like"
            >
              <Heart size={18.75} strokeWidth={1.8} fill={post.liked_by_me ? 'currentColor' : 'none'} />
              {formatCount(post.like_count)}
            </button>
            <button
              type="button"
              className={`pc-action pc-save ${post.saved_by_me ? 'on' : ''}`}
              onClick={toggleSave}
              aria-pressed={post.saved_by_me}
              aria-label="Save post"
            >
              <Bookmark size={18.75} strokeWidth={1.8} fill={post.saved_by_me ? 'currentColor' : 'none'} />
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
        </div>
      </div>


      <style>{`
        /* --------------------------------------------------------------
           Post metrics — measured off X (twitter.com) at mobile width:

             cell padding ............ 12px 16px
             avatar .................. 40 x 40, fully round
             avatar -> content gutter  12px  (so content indents 52px)
             display name ............ 15px / 20px, weight 700
             handle, time, body ...... 15px / 20px, weight 400
             verified badge .......... 18.75px, inline, 2px before handle
             text -> media ........... 12px
             media corner ............ 16px, 1px hairline border
             action bar .............. 18.75px icons, 13px counts,
                                       max-width 425px, space-between
           -------------------------------------------------------------- */
        .pc {
          border-bottom: 1px solid var(--border);
          padding: 12px 16px;
        }
        .pc-tappable { cursor: pointer; }
        .pc-tappable:hover { background: color-mix(in srgb, var(--ink) 3%, transparent); }
        .pc-detail { border-bottom: 0; }

        /* THE INDENT: fixed avatar rail + one content column. */
        .pc-grid {
          display: grid;
          grid-template-columns: ${AVATAR}px minmax(0, 1fr);
          column-gap: ${GUTTER}px;
          align-items: start;
        }
        .pc-rail { width: ${AVATAR}px; }
        .pc-col { min-width: 0; display: grid; gap: 8px; }

        .pc-av {
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; flex: none; overflow: hidden; object-fit: cover;
          font-family: var(--font-head); font-weight: 700; color: var(--ink);
          background: var(--panel-raised);
        }
        .pc-av-a { background: linear-gradient(145deg,#1d2415,#0f1309); color: var(--accent-ink); }
        .pc-av-b { background: linear-gradient(145deg,#3a2a20,#1a130e); }
        .pc-av-c { background: linear-gradient(145deg,#28303a,#12161b); }
        .pc-verified { color: var(--verified, #1D9BF0); flex: none; margin-left: 2px; }

        /* Reposted-by line sits on the same 52px indent as the content. */
        .pc-repost-note {
          margin: 0 0 4px; padding-left: ${AVATAR + GUTTER}px;
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; font-weight: 600; color: var(--ink-dim);
        }
        .pc-repost-note svg { color: var(--ink-faint); }

        .pc-head {
          display: grid; grid-template-columns: minmax(0, 1fr) auto;
          align-items: flex-start; gap: 8px; min-height: 20px;
        }
        .pc-id {
          min-width: 0; display: flex; align-items: center; gap: 4px;
          font-size: 15px; line-height: 20px; white-space: nowrap; overflow: hidden;
        }
        .pc-name {
          font-family: var(--font-head); font-weight: 700; color: var(--ink);
          overflow: hidden; text-overflow: ellipsis; max-width: 60%;
        }
        .pc-name:hover { text-decoration: underline; }
        .pc-handle {
          color: var(--ink-faint); overflow: hidden; text-overflow: ellipsis; min-width: 0;
        }
        .pc-dot, .pc-time { color: var(--ink-faint); flex: none; }
        .pc-scope { color: var(--ink-faint); display: inline-flex; align-items: center; margin-left: 2px; }

        .pc-more {
          color: var(--ink-faint); display: grid; place-items: center;
          width: 34.75px; height: 34.75px; border-radius: 999px; margin: -7px -8px 0 0;
        }
        .pc-more:hover { background: var(--panel-raised); color: var(--ink); }
        .pc-menu-wrap { position: relative; }
        .pc-menu {
          position: absolute; right: 0; top: 34px; z-index: 20; min-width: 190px;
          background: var(--panel-raised); border: 1px solid var(--border);
          border-radius: 12px; padding: 6px; display: grid; gap: 2px;
          box-shadow: var(--shadow-drop);
        }
        .pc-menu button {
          display: flex; align-items: center; gap: 9px; width: 100%;
          padding: 10px; border-radius: 9px; font-size: 14px; color: var(--ink); text-align: left;
        }
        .pc-menu button:hover { background: var(--panel); }
        .pc-menu button.danger { color: #ff6b6b; }

        .pc-title { margin: 0; font-family: var(--font-head); font-size: 17px; line-height: 22px; font-weight: 700; color: var(--ink); }
        .pc-body {
          margin: 0; font-size: 15px; line-height: 20px; color: var(--ink);
          white-space: pre-wrap; overflow-wrap: anywhere;
        }

        .pc-link {
          display: flex; align-items: center; gap: 8px; padding: 10px 12px;
          background: color-mix(in srgb, var(--ink) 5%, transparent); border-radius: 16px;
          font-size: 14px; color: var(--accent-ink);
        }
        .pc-link span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }


        /* ------------------------------ poll ------------------------------
           X poll rows are 32px tall bars; ours are 44px so the radio ring
           has a comfortable touch target:
             ring 20px / 2px stroke · dot 10px · ring -> label gap 12px
             row height 44px · corner 8px · results bar drawn behind
           ------------------------------------------------------------------ */
        .pc-poll { display: grid; gap: 8px; }
        .pc-poll-option {
          position: relative; overflow: hidden; isolation: isolate;
          width: 100%; min-height: 44px; text-align: left;
          display: flex; align-items: center; gap: 12px;
          padding: 8px 14px; border: 1px solid var(--border); border-radius: 8px;
          background: none; color: var(--ink);
          font-size: 15px; line-height: 20px; font-family: var(--font-head); font-weight: 600;
        }
        .pc-poll-option:not(.voted):hover { border-color: var(--accent-ink); }
        .pc-poll-option:disabled { opacity: .75; }
        .pc-poll-radio {
          position: relative; z-index: 1; flex: none;
          width: 20px; height: 20px; border-radius: 999px;
          border: 2px solid var(--ink-faint);
          display: grid; place-items: center;
          transition: border-color 140ms ease;
        }
        .pc-poll-option.on .pc-poll-radio { border-color: var(--accent-ink); }
        .pc-poll-dot {
          width: 10px; height: 10px; border-radius: 999px; background: var(--accent-ink);
        }
        .pc-poll-fill {
          position: absolute; inset: 0 auto 0 0; z-index: 0; display: block;
          background: color-mix(in srgb, var(--ink) 10%, transparent);
          transition: width .35s ease;
        }
        .pc-poll-option.on .pc-poll-fill { background: color-mix(in srgb, var(--accent-ink) 22%, transparent); }
        .pc-poll-label {
          position: relative; z-index: 1; min-width: 0; flex: 1;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pc-poll-option.on .pc-poll-label { color: var(--accent-ink); }
        .pc-poll-pct {
          position: relative; z-index: 1; flex: none;
          color: var(--ink-dim); font-weight: 700; font-variant-numeric: tabular-nums;
        }
        .pc-poll-option.on .pc-poll-pct { color: var(--accent-ink); }
        .pc-poll-total { margin: 0; font-size: 13px; color: var(--ink-faint); }

        .pc-tags { display: flex; flex-wrap: wrap; gap: 7px; }
        .pc-tag {
          font-size: 13px; color: var(--accent-ink);
          background: var(--panel-raised); border-radius: 999px; padding: 5px 10px;
        }

        /* Action bar: X caps it at 425px and spreads the four controls. */
        .pc-actions {
          display: flex; align-items: center; justify-content: space-between;
          max-width: 425px; margin-top: 4px;
        }
        .pc-action {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 8px; margin-left: -8px; border-radius: 999px;
          font-family: var(--font-head); font-size: 13px; line-height: 16px; font-weight: 500;
          color: var(--ink-faint);
        }
        .pc-action:hover { background: var(--panel-raised); color: var(--ink); }
        .pc-action.liked { color: #f91880; }
        .pc-action.reposted { color: #00ba7c; }
        .pc-action.on { color: var(--accent-ink); }
        .pc-save { margin-left: 0; }
        .pc-save.on { color: var(--accent-ink); }

        .pc-error { margin: 0; font-size: 13px; color: #ff6b6b; }
        .pc-hint { margin: 0; font-size: 13px; color: var(--ink-dim); }
        .pc-inline-link { color: var(--accent-ink); }

        .pc-comments { border-top: 1px solid var(--border); padding-top: 10px; display: grid; gap: 10px; }
        .pc-comment-list, .pc-replies { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
        /* Comments and replies align to the post's own avatar column
           (AVATAR + GUTTER) — no extra indent for replies, everything
           shares one left edge with the poster's avatar above. */
        .pc-replies { margin-top: 10px; }
        .pc-comment { display: grid; grid-template-columns: ${AVATAR}px minmax(0,1fr); column-gap: ${GUTTER}px; }
        .pc-comment-meta { margin: 0; display: flex; gap: 8px; align-items: baseline; font-size: 13px; color: var(--ink-faint); }
        .pc-comment-meta b { color: var(--ink); font-family: var(--font-head); font-size: 14px; }
        .pc-comment-author { display: inline-flex; align-items: center; gap: 3px; }
        .pc-comment-verified { flex: none; color: var(--verified, #1D9BF0); }
        .pc-comment-text { margin: 2px 0 0; font-size: 15px; line-height: 20px; color: var(--ink); white-space: pre-wrap; overflow-wrap: anywhere; }
        .pc-comment-tools { display: flex; gap: 16px; margin-top: 6px; }
        .pc-comment-tools button { font-size: 13px; color: var(--ink-faint); font-family: var(--font-head); font-weight: 600; }
        .pc-comment-tools button:hover { color: var(--accent-ink); }

        .pc-replying { margin: 0 0 8px; font-size: 13px; color: var(--ink-dim); display: flex; gap: 10px; }
        .pc-replying button { color: var(--accent-ink); font-size: 13px; }
        .pc-comment-input { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; }
        .pc-comment-input input {
          width: 100%; padding: 11px 14px; border-radius: 999px;
          background: var(--panel-raised); border: 1px solid var(--border);
          color: var(--ink); font-size: 15px;
        }
        .pc-comment-input input:focus { outline: none; border-color: var(--accent-ink); }
        .pc-comment-input button {
          width: 40px; height: 40px; border-radius: 999px; display: grid; place-items: center;
          background: var(--lemon); color: var(--on-accent);
        }
        .pc-comment-input button:disabled { opacity: .5; }
      `}</style>

    </article>
  )
}
