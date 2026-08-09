import { useMemo, useState } from 'react'

/**
 * Long text that opens in chunks instead of all at once.
 *
 * A very long post shouldn't dump 4,000 characters into the feed, and it
 * shouldn't need eight taps to read either. So the first chunk is `limit`
 * characters and every "Read more" after that reveals a chunk sized to
 * what's left — the longer the text, the bigger each step — capped so no
 * single step is overwhelming. Once everything is visible the control
 * flips to "Show less" and collapses back to the first chunk.
 *
 * Cuts land on a word boundary when there's one nearby, so a chunk never
 * ends mid-word.
 */

const STEP_MIN = 400
const STEP_MAX = 1200

function cutAt(text, index) {
  if (index >= text.length) return text.length
  // Prefer the last space in the final 15% of the chunk over a hard cut.
  const window = Math.max(20, Math.floor(index * 0.15))
  const space = text.lastIndexOf(' ', index)
  if (space > index - window) return space
  return index
}

export default function ExpandableText({
  text,
  limit = 280,
  className = '',
  moreLabel = 'Read more',
  lessLabel = 'Show less',
}) {
  const body = typeof text === 'string' ? text : ''
  const [shown, setShown] = useState(limit)

  const step = useMemo(() => {
    const remaining = Math.max(0, body.length - limit)
    // Reveal roughly a third of what's left each tap: short-ish posts
    // finish in one more tap, very long ones ramp up instead of crawling.
    return Math.min(STEP_MAX, Math.max(STEP_MIN, Math.round(remaining / 3)))
  }, [body.length, limit])

  if (!body) return null

  // A little slack: don't add a control to hide a dozen characters.
  if (body.length <= limit + 40) {
    return <p className={className}>{body}</p>
  }

  const full = shown >= body.length
  const end = full ? body.length : cutAt(body, shown)

  return (
    <p className={className}>
      {full ? body : `${body.slice(0, end).trimEnd()}… `}
      <button
        type="button"
        className="xt-more"
        data-stop="true"
        onClick={(e) => {
          // Feed cells are tappable; expanding must not open the post.
          e.stopPropagation()
          e.preventDefault()
          setShown((n) => (n >= body.length ? limit : n + step))
        }}
      >
        {full ? lessLabel : moreLabel}
      </button>
      <style>{`
        .xt-more {
          background: none; border: 0; padding: 0;
          font: inherit; font-weight: 600;
          color: var(--accent-ink); cursor: pointer;
        }
        @media (hover: hover) and (pointer: fine) { .xt-more:hover { text-decoration: underline; } }
      `}</style>
    </p>
  )
}
