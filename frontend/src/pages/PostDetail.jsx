/**
 * Full-screen post view.
 *
 * Reached by tapping a post anywhere in the app (its text, indent, photo
 * or clip, or the comment icon). Same card, same metrics — it just gets
 * the whole screen so the conversation can be read and replied to while
 * scrolling, X / TikTok style. No extra card, no extra border: the page
 * IS the post.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import PostCard from '../features/feed/PostCard.jsx'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { api } from '../api/client.js'

export default function PostDetail() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const { accessToken, authLoading } = useAuth()
  const [post, setPost] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setPost(await api.getPost(postId, accessToken))
    } catch (err) {
      setError(err.message)
    }
  }, [postId, accessToken])

  useEffect(() => {
    if (authLoading) return
    load()
  }, [authLoading, load])

  return (
    <div className="pd">
      <header className="pd-bar">
        <button type="button" className="pd-back" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <h1>Post</h1>
      </header>

      {!post && !error && <p className="pd-state">Loading…</p>}

      {error && (
        <div className="pd-state">
          <p>{error}</p>
          <button type="button" className="pd-retry" onClick={load}>
            <RefreshCw size={16} strokeWidth={2} /> Try again
          </button>
        </div>
      )}

      {post && (
        <PostCard
          post={post}
          detail
          onDeleted={() => navigate('/home')}
        />
      )}

      <style>{`
        /* full-bleed against AppShell's page padding, exactly like the feed */
        .pd { --gut: 16px; margin: -24px -20px 0; padding-bottom: 24px; }
        @media (min-width: 860px) { .pd { margin: -32px -40px 0; } }
        .pd-bar {
          position: sticky; top: 0; z-index: 30;
          display: flex; align-items: center; gap: 10px;
          padding: 12px var(--gut);
          background: color-mix(in srgb, var(--bg) 88%, transparent);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid var(--border);
        }
        .pd-bar h1 {
          margin: 0; font-family: var(--font-head);
          font-size: 17px; font-weight: 700; color: var(--ink);
        }
        .pd-back {
          display: grid; place-items: center; width: 36px; height: 36px;
          margin-left: -6px; border-radius: 999px; color: var(--ink); background: none;
        }
        .pd-back:hover { background: color-mix(in srgb, var(--ink) 8%, transparent); }
        .pd-state {
          display: grid; gap: 12px; justify-items: center;
          padding: 40px 20px; text-align: center;
          font-size: 14px; color: var(--ink-dim);
        }
        .pd-retry {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 16px; border-radius: 999px;
          background: var(--lemon); color: var(--on-accent);
          font-family: var(--font-head); font-weight: 700; font-size: 13.5px;
        }
      `}</style>
    </div>
  )
}
