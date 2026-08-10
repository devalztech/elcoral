import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BarChart3, FileText, Film, Globe, Hash, Image as ImageIcon, Link2,
  Loader2, Paperclip, Pencil, Plus, Trash2, Users2, X, CheckCircle2,
} from 'lucide-react'
import { api } from '../api/client.js'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'

/**
 * One composer for every post kind. The backend stores all of them in the
 * same `posts` table (see backend/app/models/post.py), so the differences
 * here are which fields are shown, not a different submit path.
 */

const KINDS = [
  { id: 'text', label: 'Post', icon: Pencil, placeholder: "What's happening in your world?" },
  { id: 'media', label: 'Media', icon: ImageIcon, placeholder: 'Say something about what you\u2019re sharing…' },
  { id: 'article', label: 'Article', icon: FileText, placeholder: 'Write your article…' },
  { id: 'poll', label: 'Poll', icon: BarChart3, placeholder: 'Ask your question…' },
  { id: 'link', label: 'Link', icon: Link2, placeholder: 'Add context for the link…' },
]

const SLUG_TO_KIND = { post: 'text', media: 'media', article: 'article', poll: 'poll', link: 'link' }

const MAX_MEDIA = 10
const BODY_LIMIT = { text: 3000, media: 3000, poll: 1000, link: 1000, article: 20000 }
const ACCEPT = 'image/*,video/*,audio/*,application/pdf'

export default function CreatePost() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { accessToken, user } = useAuth()
  const fileInput = useRef(null)

  const [kind, setKind] = useState(SLUG_TO_KIND[slug] ?? 'text')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [tagDraft, setTagDraft] = useState('')
  const [tags, setTags] = useState([])
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [attachments, setAttachments] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const active = useMemo(() => KINDS.find((k) => k.id === kind) ?? KINDS[0], [kind])
  const limit = BODY_LIMIT[kind] ?? 3000
  const uploading = attachments.some((a) => a.status === 'uploading')

  const addTag = () => {
    const value = tagDraft.trim().replace(/^#/, '').toLowerCase()
    if (!value) return
    if (tags.length >= 10 || tags.includes(value)) { setTagDraft(''); return }
    setTags((t) => [...t, value])
    setTagDraft('')
  }

  const pickFiles = async (event) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return

    const room = MAX_MEDIA - attachments.length
    if (room <= 0) {
      setError(`You can attach up to ${MAX_MEDIA} files per post.`)
      return
    }

    const queued = files.slice(0, room).map((file) => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      mime: file.type,
      previewUrl: file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : null,
      status: 'uploading',
      ref: null,
      file,
    }))
    setAttachments((list) => [...list, ...queued])
    if (kind === 'text') setKind('media')

    for (const item of queued) {
      try {
        const result = await api.uploadMedia(item.file, accessToken)
        setAttachments((list) =>
          list.map((a) => (a.key === item.key ? { ...a, status: 'done', ref: result.ref, mime: result.mime_type || a.mime } : a)),
        )
      } catch (err) {
        setError(err.message)
        setAttachments((list) => list.map((a) => (a.key === item.key ? { ...a, status: 'failed' } : a)))
      }
    }
  }

  const removeAttachment = (key) =>
    setAttachments((list) => {
      const target = list.find((a) => a.key === key)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return list.filter((a) => a.key !== key)
    })

  const ready = (() => {
    if (submitting || uploading) return false
    if (kind === 'article') return title.trim().length > 1 && body.trim().length > 0
    if (kind === 'poll') return body.trim().length > 0 && pollOptions.filter((o) => o.trim()).length >= 2
    if (kind === 'media') return attachments.some((a) => a.status === 'done')
    if (kind === 'link') return /^https?:\/\/\S+$/.test(linkUrl.trim())
    return body.trim().length > 0
  })()

  const submit = async (event) => {
    event.preventDefault()
    if (!ready) return
    setSubmitting(true)
    setError('')

    const uploaded = attachments.filter((a) => a.status === 'done')
    const payload = {
      kind,
      title: kind === 'article' ? title.trim() : null,
      body: body.trim() || (kind === 'link' ? linkUrl.trim() : ''),
      media_refs: uploaded.map((a) => a.ref),
      media_types: uploaded.map((a) => a.mime || 'application/octet-stream'),
      tags,
      link_url: kind === 'link' ? linkUrl.trim() : null,
      visibility,
      poll_options: kind === 'poll' ? pollOptions.map((o) => o.trim()).filter(Boolean) : [],
    }

    try {
      await api.createPost(payload, accessToken)
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const VIS = {
    public: { icon: Globe, label: 'Everyone', hint: 'Anyone on or off Elcoral' },
    followers: { icon: Users2, label: 'Followers', hint: 'Only people who follow you' },
  }
  const ActiveIcon = active.icon
  const HeaderVisIcon = VIS[visibility].icon

  return (
    <form className="cp" onSubmit={submit}>
      <header className="cp-bar">
        <button type="button" className="cp-back" onClick={() => navigate(-1)} aria-label="Close composer">
          <X size={24} strokeWidth={2} />
        </button>
        <div className="cp-head">
          <p className="cp-heading">
            <ActiveIcon size={19} strokeWidth={2} />
            Create {active.label}
          </p>
          <p className="cp-subheading">Share your thoughts</p>
        </div>
        <span className="cp-bar-spacer" aria-hidden="true" />
      </header>

      <nav className="cp-kinds" aria-label="Post type">
        {KINDS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`cp-kind ${kind === id ? 'on' : ''}`}
            aria-pressed={kind === id}
            onClick={() => setKind(id)}
          >
            <Icon size={17} strokeWidth={2} />
            {label}
          </button>
        ))}
      </nav>

      <section className="cp-compose">
        <div className="cp-identity">
          <span className="cp-avatar" aria-hidden="true">
            {user?.photo_url ? <img src={user.photo_url} alt="" /> : <span>{(user?.full_name ?? 'E').charAt(0)}</span>}
          </span>
          <p className="cp-who">
            Posting as <b>{user?.full_name ?? 'you'}</b>
          </p>
          <button
            type="button"
            className="cp-vis-pill"
            onClick={() => setVisibility((v) => (v === 'public' ? 'followers' : 'public'))}
            aria-label={`Visibility: ${VIS[visibility].label}. Tap to change`}
          >
            <HeaderVisIcon size={16} strokeWidth={2} />
            {VIS[visibility].label}
          </button>
        </div>

        {kind === 'article' && (
          <input
            className="cp-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Article title"
            maxLength={200}
            aria-label="Article title"
          />
        )}

        {kind === 'link' && (
          <input
            className="cp-input cp-input-flat"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com/something-worth-sharing"
            inputMode="url"
            maxLength={500}
            aria-label="Link URL"
          />
        )}

        <textarea
          className={`cp-body ${kind === 'article' ? 'tall' : ''}`}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, limit))}
          placeholder={active.placeholder}
          aria-label="Post text"
        />
        <p className="cp-count">
          {body.length} / {limit.toLocaleString()}
        </p>

        {kind === 'poll' && (
          <div className="cp-poll">
            {pollOptions.map((option, i) => (
              <div key={i} className="cp-poll-row">
                <input
                  className="cp-input"
                  value={option}
                  onChange={(e) =>
                    setPollOptions((list) => list.map((o, idx) => (idx === i ? e.target.value.slice(0, 120) : o)))
                  }
                  placeholder={`Option ${i + 1}`}
                  aria-label={`Poll option ${i + 1}`}
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    className="cp-icon-btn"
                    aria-label={`Remove option ${i + 1}`}
                    onClick={() => setPollOptions((list) => list.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 6 && (
              <button type="button" className="cp-add-option" onClick={() => setPollOptions((l) => [...l, ''])}>
                <Plus size={16} strokeWidth={2.3} /> Add option
              </button>
            )}
          </div>
        )}

        {attachments.length > 0 && (
          <ul className="cp-attachments">
            {attachments.map((a) => (
              <li key={a.key} className={`cp-attachment ${a.status}`}>
                {a.previewUrl && a.mime?.startsWith('video/') ? (
                  <video src={a.previewUrl} muted playsInline />
                ) : a.previewUrl ? (
                  <img src={a.previewUrl} alt="" />
                ) : (
                  <span className="cp-attachment-file">
                    <Paperclip size={18} />
                  </span>
                )}
                {a.status === 'uploading' && (
                  <span className="cp-attachment-state"><Loader2 size={18} className="cp-spin" /></span>
                )}
                {a.status === 'failed' && <span className="cp-attachment-state failed">Failed</span>}
                <button
                  type="button"
                  className="cp-attachment-remove"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => removeAttachment(a.key)}
                >
                  <X size={14} strokeWidth={2.6} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="cp-tools">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={pickFiles}
          />
          <button type="button" className="cp-tool" onClick={() => fileInput.current?.click()}>
            <ImageIcon size={18} strokeWidth={2} /> Photo
          </button>
          <button type="button" className="cp-tool" onClick={() => fileInput.current?.click()}>
            <Film size={18} strokeWidth={2} /> Video
          </button>
          <button type="button" className="cp-tool" onClick={() => fileInput.current?.click()}>
            <Paperclip size={18} strokeWidth={2} /> File
          </button>
          <button type="button" className="cp-tool" onClick={() => setKind('poll')}>
            <BarChart3 size={18} strokeWidth={2} /> Poll
          </button>
          <button type="button" className="cp-tool" onClick={() => setKind('link')}>
            <Link2 size={18} strokeWidth={2} /> Link
          </button>
        </div>

        <div className="cp-topics">
          <h2 className="cp-topics-title">Topics</h2>
          <div className="cp-tag-input">
            <Hash size={17} strokeWidth={2} />
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
              }}
              placeholder="Add a topic and press Enter"
              maxLength={40}
              aria-label="Add a topic"
            />
            <button type="button" onClick={addTag} disabled={!tagDraft.trim()}>Add</button>
          </div>
          {tags.length > 0 && (
            <div className="cp-tags">
              {tags.map((tag) => (
                <button key={tag} type="button" className="cp-tag" onClick={() => setTags((t) => t.filter((x) => x !== tag))}>
                  #{tag} <X size={13} strokeWidth={2.6} />
                </button>
              ))}
            </div>
          )}
        </div>

        <h2 className="cp-section">Who can see this</h2>
        <div className="cp-visibility">
          {['public', 'followers'].map((value) => {
            const { icon: Icon, label, hint } = VIS[value]
            const on = visibility === value
            return (
              <button
                key={value}
                type="button"
                className={`cp-vis ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => setVisibility(value)}
              >
                <Icon size={20} strokeWidth={1.9} />
                <span><b>{label}</b><i>{hint}</i></span>
                {on && <CheckCircle2 size={22} strokeWidth={2} className="cp-vis-check" />}
              </button>
            )
          })}
        </div>

        {error && <p className="cp-error">{error}</p>}
        {uploading && <p className="cp-note">Uploading attachments… publish unlocks when they finish.</p>}

        <div className="cp-actions">
          <button type="submit" className="cp-publish" disabled={!ready}>
            {submitting ? <Loader2 size={17} className="cp-spin" /> : null}
            {submitting ? 'Publishing' : 'Publish'}
          </button>
        </div>
      </section>

      <style>{`
        .cp { display: grid; gap: 18px; padding-bottom: 24px; }

        .cp-bar {
          display: grid; grid-template-columns: 40px minmax(0,1fr) 40px;
          align-items: center; gap: 8px;
        }
        .cp-back { width: 40px; height: 40px; border-radius: 999px; display: grid; place-items: center; color: var(--ink); }
        @media (hover: hover) and (pointer: fine) { .cp-back:hover { background: var(--panel); } }
        .cp-bar-spacer { display: block; width: 40px; }
        .cp-head { min-width: 0; text-align: center; }
        .cp-heading {
          margin: 0; display: inline-flex; align-items: center; gap: 8px;
          font-family: var(--font-display); font-size: 19px; font-weight: 800; color: var(--ink);
        }
        .cp-heading svg { color: var(--accent-ink); }
        .cp-subheading { margin: 2px 0 0; font-size: 13px; color: var(--ink-dim); }

        .cp-kinds {
          display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none;
          border-bottom: 1px solid var(--border);
          margin: 0 -20px; padding: 0 20px;
        }
        .cp-kinds::-webkit-scrollbar { display: none; }
        .cp-kind {
          flex: none; display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 14px 12px; background: none; border: none;
          border-bottom: 2px solid transparent; margin-bottom: -1px;
          font-family: var(--font-head); font-weight: 600; font-size: 14.5px; color: var(--ink-dim);
        }
        .cp-kind.on { color: var(--accent-ink); border-bottom-color: var(--accent-ink); }

        .cp-compose { display: grid; gap: 14px; }

        .cp-identity {
          display: grid; grid-template-columns: 40px minmax(0,1fr) auto;
          align-items: center; gap: 12px;
        }
        .cp-avatar {
          width: 40px; height: 40px; border-radius: 999px; overflow: hidden; flex-shrink: 0;
          display: grid; place-items: center; background: var(--tile); color: var(--accent-ink);
          font-family: var(--font-head); font-weight: 700; font-size: 15px;
        }
        .cp-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cp-who { margin: 0; min-width: 0; font-size: 14px; color: var(--ink-dim); }
        .cp-who b { color: var(--ink); font-family: var(--font-head); }
        .cp-vis-pill {
          flex-shrink: 0; display: inline-flex; align-items: center; gap: 7px;
          border: 1px solid var(--border); border-radius: 999px; background: none;
          padding: 8px 14px; white-space: nowrap;
          font-family: var(--font-head); font-weight: 600; font-size: 13.5px; color: var(--ink);
        }
        .cp-vis-pill:active { transform: scale(0.97); }

        .cp-title, .cp-input-flat, .cp-body {
          width: 100%; background: none; border: none; padding: 0;
          color: var(--ink); font-family: inherit;
        }
        .cp-title {
          font-family: var(--font-display); font-size: 26px; font-weight: 800;
          letter-spacing: -0.015em; padding: 2px 0;
        }
        .cp-input-flat { font-size: 15px; padding: 2px 0; }
        .cp-body { font-size: 16px; line-height: 1.6; min-height: 140px; resize: vertical; }
        .cp-body.tall { min-height: 320px; }
        .cp-title::placeholder, .cp-body::placeholder, .cp-input-flat::placeholder { color: var(--ink-faint); }
        .cp-title:focus, .cp-input-flat:focus, .cp-body:focus { outline: none; }
        .cp-count { margin: 0; text-align: right; font-size: 13px; color: var(--ink-faint); }

        .cp-input {
          width: 100%; background: var(--panel-raised); border: 1px solid transparent;
          border-radius: 10px; padding: 11px 12px; color: var(--ink); font-size: 14.5px; font-family: inherit;
        }
        .cp-input:focus { outline: none; border-color: var(--accent-ink); }
        .cp-poll { display: grid; gap: 8px; }
        .cp-poll-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: center; }
        .cp-icon-btn { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: var(--ink-dim); background: none; }
        .cp-add-option {
          justify-self: start; display: inline-flex; align-items: center; gap: 6px; background: none;
          font-family: var(--font-head); font-weight: 600; font-size: 13.5px; color: var(--accent-ink);
        }

        .cp-attachments { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
        .cp-attachment { position: relative; border-radius: 12px; overflow: hidden; background: var(--panel-raised); aspect-ratio: 1; }
        .cp-attachment img, .cp-attachment video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cp-attachment-file { width: 100%; height: 100%; display: grid; place-items: center; color: var(--ink-dim); }
        .cp-attachment-state {
          position: absolute; inset: 0; display: grid; place-items: center;
          background: rgba(0,0,0,.45); color: var(--lemon); font-size: 12px; font-weight: 700;
        }
        .cp-attachment-state.failed { color: #ff8a8a; }
        .cp-attachment-remove {
          position: absolute; top: 5px; right: 5px; width: 24px; height: 24px; border-radius: 999px;
          background: rgba(0,0,0,.65); color: #fff; display: grid; place-items: center;
        }

        .cp-tools {
          display: flex; flex-wrap: wrap; gap: 10px;
          border-top: 1px solid var(--border); padding-top: 18px; margin-top: 4px;
        }
        .cp-tool {
          display: inline-flex; align-items: center; gap: 9px; padding: 11px 16px;
          border-radius: 999px; background: none; border: 1px solid var(--border);
          font-family: var(--font-head); font-weight: 600; font-size: 14px; color: var(--ink);
        }
        .cp-tool svg { color: var(--ink-dim); }
        @media (hover: hover) and (pointer: fine) { .cp-tool:hover { border-color: var(--accent-ink); } }
        .cp-tool:active { transform: scale(0.97); }

        .cp-topics {
          border: 1px solid var(--border); border-radius: 14px;
          padding: 14px 16px 6px; display: grid; gap: 2px; margin-top: 6px;
        }
        .cp-topics-title { margin: 0; font-family: var(--font-head); font-size: 15px; font-weight: 700; color: var(--ink); }
        .cp-section { margin: 6px 0 -4px; font-family: var(--font-head); font-size: 15px; font-weight: 700; color: var(--ink); }

        .cp-tag-input { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 10px; background: none; color: var(--ink-faint); }
        .cp-tag-input input { background: none; border: none; padding: 10px 0; color: var(--ink); font-size: 14.5px; width: 100%; font-family: inherit; }
        .cp-tag-input input::placeholder { color: var(--ink-faint); }
        .cp-tag-input input:focus { outline: none; }
        .cp-tag-input button { background: none; font-family: var(--font-head); font-weight: 700; font-size: 14px; color: var(--accent-ink); }
        .cp-tag-input button:disabled { opacity: .45; }
        .cp-tags { display: flex; flex-wrap: wrap; gap: 7px; padding-bottom: 10px; }
        .cp-tag { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 999px; background: var(--panel-raised); color: var(--accent-ink); font-size: 12.5px; }

        .cp-visibility { display: grid; gap: 10px; }
        .cp-vis {
          display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: 14px; text-align: left;
          border: 1px solid var(--border); background: none; color: var(--ink-dim);
        }
        .cp-vis.on { border-color: var(--accent-ink); }
        .cp-vis span { display: grid; gap: 2px; min-width: 0; }
        .cp-vis b { font-family: var(--font-head); font-size: 15.5px; font-weight: 700; color: var(--ink); }
        .cp-vis i { font-style: normal; font-size: 13px; color: var(--ink-dim); }
        .cp-vis-check { color: var(--accent-ink); }

        .cp-actions { margin-top: 8px; }
        .cp-publish {
          width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          background: var(--lemon); color: var(--on-accent); border-radius: 999px;
          padding: 16px 20px; font-family: var(--font-head); font-weight: 700; font-size: 15.5px;
        }
        .cp-publish:disabled { opacity: .4; }
        .cp-publish:not(:disabled):active { transform: scale(0.985); }
        .cp-spin { animation: cp-rotate 1s linear infinite; }
        @keyframes cp-rotate { to { transform: rotate(360deg); } }

        .cp-error { margin: 0; font-size: 13px; color: #ff6b6b; }
        .cp-note { margin: 0; font-size: 12.5px; color: var(--ink-dim); }

        @media (min-width: 860px) {
          .cp-kinds { margin: 0 -40px; padding: 0 40px; }
          .cp-publish { width: auto; min-width: 220px; }
          .cp-actions { display: flex; justify-content: flex-end; }
        }
      `}</style>
    </form>
  )
}
