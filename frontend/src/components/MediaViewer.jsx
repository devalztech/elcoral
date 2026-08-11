/**
 * Full-screen media viewer — the one place Elcoral opens a photo or a
 * clip "big", from the feed and from a DM alike.
 *
 * Why this exists rather than the browser's own fullscreen:
 *   · iOS replaces our chrome with Safari's when a <video> goes native
 *     fullscreen, which is where the "it just starts from the beginning"
 *     bug came from. Here fullscreen is an in-app canvas, so the SAME
 *     MediaPlayer chrome (scrub bar, ±10s, double-tap) is on screen at
 *     both sizes.
 *   · A playhead handed in as `startAt` and handed back through
 *     `onTime` is what makes small frame -> fullscreen -> small frame
 *     continue from where you were instead of restarting.
 *   · A set of media is one swipeable deck with a "3 / 5" counter, like
 *     Instagram/WhatsApp, instead of five stacked frames.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import MediaPlayer from './MediaPlayer.jsx'

const isVideo = (item) =>
  item?.kind === 'video' || (item?.mime_type || '').startsWith('video/')

export default function MediaViewer({
  items,
  index = 0,
  startAt = 0,
  autoPlay = false,
  onClose,
  onTime,
}) {
  const list = Array.isArray(items) ? items : []
  const [current, setCurrent] = useState(index)
  // Per-item playheads, so swiping away from a clip and back resumes it.
  const times = useRef({ [index]: startAt || 0 })
  const touch = useRef(null)

  useEffect(() => { setCurrent(index) }, [index])

  const go = useCallback((next) => {
    setCurrent((c) => {
      const target = Math.min(Math.max(0, next), Math.max(0, list.length - 1))
      return target
    })
  }, [list.length])

  // Escape closes, arrows page — but only when the focused item is not a
  // video, where the player itself owns the arrow keys for seeking.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose?.() }
      if (isVideo(list[current])) return
      if (event.key === 'ArrowRight') { event.preventDefault(); go(current + 1) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(current - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, go, list, onClose])

  // Lock the page behind the viewer so the feed doesn't scroll under it.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  if (!list.length) return null

  const item = list[current]
  const video = isVideo(item)

  const onTouchStart = (event) => {
    const t = event.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (event) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const t = event.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    // A horizontal swipe pages the deck; a vertical one dismisses it.
    // Videos ignore horizontal swipes — there the surface is the
    // double-tap seek area, and stealing it would break scrubbing.
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && !video) {
      go(current + (dx < 0 ? 1 : -1))
    } else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
      onClose?.()
    }
  }

  return createPortal(
    <div className="mv" role="dialog" aria-modal="true" aria-label="Media preview">
      <div className="mv-top">
        {list.length > 1 && (
          <span className="mv-count" aria-live="polite">{current + 1} / {list.length}</span>
        )}
        <button type="button" className="mv-x" onClick={() => onClose?.()} aria-label="Close preview">
          <X size={20} strokeWidth={2.2} />
        </button>
      </div>

      <div
        className="mv-stage"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={(event) => { if (event.target === event.currentTarget) onClose?.() }}
      >
        {video ? (
          <div className="mv-video">
            <MediaPlayer
              key={item.url}
              src={item.url}
              poster={item.poster}
              immersive
              fill
              rounded={false}
              autoPlay={autoPlay || (times.current[current] ?? 0) > 0}
              startAt={times.current[current] ?? 0}
              onTime={(at) => {
                times.current[current] = at
                if (current === index) onTime?.(at)
              }}
              onRequestFullscreen={() => onClose?.()}
            />
          </div>
        ) : (
          <img className="mv-img" src={item.url} alt={item.alt || ''} />
        )}
      </div>

      {list.length > 1 && (
        <>
          <button
            type="button"
            className="mv-nav mv-prev"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            aria-label="Previous"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            className="mv-nav mv-next"
            onClick={() => go(current + 1)}
            disabled={current === list.length - 1}
            aria-label="Next"
          >
            <ChevronRight size={22} />
          </button>
          <div className="mv-dots" aria-hidden="true">
            {list.map((_, i) => (
              <i key={i} className={i === current ? 'on' : ''} />
            ))}
          </div>
        </>
      )}

      <style>{`
        .mv {
          position: fixed; inset: 0; z-index: 120;
          background: rgba(0,0,0,0.94);
          display: grid; grid-template-rows: auto 1fr auto;
          animation: mv-in 140ms ease-out;
        }
        @keyframes mv-in { from { opacity: 0 } to { opacity: 1 } }
        .mv-top {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: max(10px, env(safe-area-inset-top)) 14px 10px;
          color: #fff;
        }
        .mv-count { font-size: 13px; font-weight: 600; letter-spacing: 0.02em; opacity: 0.9; }
        .mv-x {
          margin-left: auto; display: grid; place-items: center;
          width: 36px; height: 36px; border: 0; border-radius: 999px;
          background: rgba(255,255,255,0.12); color: #fff; cursor: pointer;
        }
        .mv-x:hover { background: rgba(255,255,255,0.2); }
        .mv-stage {
          position: relative; display: grid; place-items: center;
          min-height: 0; padding: 0 8px 8px;
        }
        .mv-img { max-width: 100%; max-height: 100%; object-fit: contain; }
        /* The player owns the whole stage so its bar sits at the bottom
           of the screen, like a native full-screen player. */
        .mv-video { width: 100%; height: 100%; display: grid; }
        .mv-nav {
          position: absolute; top: 50%; transform: translateY(-50%);
          display: grid; place-items: center; width: 40px; height: 40px;
          border: 0; border-radius: 999px; cursor: pointer;
          background: rgba(255,255,255,0.12); color: #fff;
        }
        .mv-nav:disabled { opacity: 0.25; cursor: default; }
        .mv-prev { left: 10px; }
        .mv-next { right: 10px; }
        .mv-dots {
          display: flex; gap: 6px; justify-content: center;
          padding: 0 0 max(14px, env(safe-area-inset-bottom));
        }
        .mv-dots i {
          width: 6px; height: 6px; border-radius: 999px;
          background: rgba(255,255,255,0.35);
        }
        .mv-dots i.on { background: #fff; }
        @media (max-width: 640px) { .mv-nav { display: none; } }
      `}</style>
    </div>,
    document.body,
  )
}
