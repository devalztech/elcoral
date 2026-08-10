/**
 * One text renderer for every long-form surface in the app: posts,
 * comments, replies and DM bubbles.
 *
 * Two jobs:
 *
 *  1. TRUNCATION. Long text is clipped to `limit` characters and the
 *     toggle sits on the same line as the last words — "My text… More" —
 *     rather than on a line of its own. Expanding shows everything and
 *     swaps the toggle to "Less"; there is no chunked half-open state,
 *     which is what made the old control look broken.
 *
 *  2. MENTIONS. "@handle" is rendered as a link to that profile, so a
 *     mention in a post, comment, reply or DM is tappable.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'

const MENTION = /(@[A-Za-z0-9_.]{2,30})/g

const richTextCss = `
  .rt { overflow-wrap: anywhere; white-space: pre-wrap; }
  .rt-mention { color: var(--accent-ink); font-weight: 600; }
  .rt-toggle {
    display: inline; padding: 0; margin: 0; background: none; border: 0;
    font: inherit; font-weight: 700; color: var(--accent-ink); cursor: pointer;
    white-space: nowrap;
  }
`

function withMentions(text, keyPrefix) {
  return text.split(MENTION).map((part, i) => {
    if (i % 2 === 1) {
      const handle = part.slice(1).replace(/\.+$/, '')
      return (
        <Link
          key={`${keyPrefix}-m-${i}`}
          to={`/u/${handle}`}
          className="rt-mention"
          onClick={(e) => e.stopPropagation()}
        >
          @{handle}
        </Link>
      )
    }
    return <span key={`${keyPrefix}-t-${i}`}>{part}</span>
  })
}

export default function RichText({ text, className = '', limit = 280, as: Tag = 'p' }) {
  const [open, setOpen] = useState(false)
  const full = text || ''

  if (full.length <= limit) {
    return (
      <Tag className={`rt ${className}`}>
        {withMentions(full, 'f')}
        <style>{richTextCss}</style>
      </Tag>
    )
  }

  // Cut on a word boundary so the last word isn't sliced in half.
  let cut = full.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace > limit * 0.6) cut = cut.slice(0, lastSpace)

  return (
    <Tag className={`rt ${className}`}>
      {withMentions(open ? `${full} ` : `${cut}… `, open ? 'o' : 'c')}
      {/* Inline, immediately after the text, so it reads "…text More". */}
      <button
        type="button"
        className="rt-toggle"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setOpen((v) => !v)
        }}
      >
        {open ? 'Less' : 'More'}
      </button>
      <style>{richTextCss}</style>
    </Tag>
  )
}
