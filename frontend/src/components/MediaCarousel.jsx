/**
 * A set of photos/clips shown as ONE frame you can swipe through, with a
 * "1/4" counter in the corner — the Instagram/WhatsApp album model.
 *
 * Before this, four photos meant four stacked frames flooding the feed
 * and the thread. Now a set always occupies exactly the space of a single
 * attachment, and tapping it opens the full-screen MediaViewer at the
 * slide you were looking at.
 *
 * The parent owns the frame size (a post frame is 300px wide, a DM frame
 * 246px); this component just fills it.
 */
import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import MediaPlayer from './MediaPlayer.jsx'
import MediaViewer from './MediaViewer.jsx'
import MediaFallback from './MediaFallback.jsx'

const isVideo = (item) =>
  item?.kind === 'video' || (item?.mime_type || '').startsWith('video/')

/* `onRetry(item)` is optional — omit it for a caller with no cheap way
   to refetch a fresh signed URL for just this item, and the fallback
   still renders correctly as a dead-end "unavailable" state.

   `onDark` must be passed explicitly by each caller rather than
   defaulting — this component has no fixed background of its own (see
   .mcar below), so whether light-on-dark or theme-following text reads
   correctly depends entirely on what background the PARENT frame uses.
   PostMedia.jsx and MessageThread.jsx wrap this in an always-black
   frame -> onDark. ChatTab.jsx wraps it in a theme-following panel
   (var(--panel)) -> no onDark. */
export default function MediaCarousel({ items, className = '', onRetry, onDark = false }) {
  const list = (Array.isArray(items) ? items : []).filter(Boolean)
  const [index, setIndex] = useState(0)
  const [viewer, setViewer] = useState(null) // { index, startAt, autoPlay }
  const [imgFailed, setImgFailed] = useState(() => new Set())
  // Playheads per slide, so the small frame and the full-screen viewer
  // hand the same position back and forth instead of restarting at 0:00.
  const times = useRef({})
  const touch = useRef(null)

  if (!list.length) return null

  const many = list.length > 1
  const item = list[index]
  const video = isVideo(item)
  const thisImgFailed = imgFailed.has(index)

  const retryImg = onRetry
    ? async () => {
        const ok = await onRetry(item)
        if (ok !== false) {
          setImgFailed((s) => { const next = new Set(s); next.delete(index); return next })
        }
      }
    : undefined

  const go = (next) => {
    if (next < 0 || next > list.length - 1) return
    setIndex(next)
  }

  const open = (startAt = times.current[index] ?? 0, autoPlay = false) => {
    setViewer({ index, startAt, autoPlay })
  }

  const onTouchStart = (event) => {
    const t = event.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (event) => {
    const start = touch.current
    touch.current = null
    if (!start || !many) return
    const t = event.changedTouches[0]
    const dx = t.clientX - start.x
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(t.clientY - start.y)) {
      go(index + (dx < 0 ? 1 : -1))
    }
  }

  return (
    <div
      className={`mcar ${className}`}
      data-stop="true"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {video ? (
        <MediaPlayer
          key={item.url}
          src={item.url}
          poster={item.poster}
          fill
          rounded={false}
          startAt={times.current[index] ?? 0}
          onTime={(at) => { times.current[index] = at }}
          // Expand opens OUR viewer, carrying the playhead over.
          onRequestFullscreen={(at) => open(at, true)}
          onRetry={onRetry ? () => onRetry(item) : undefined}
          forceDarkFallback={onDark}
        />
      ) : thisImgFailed ? (
        <MediaFallback kind="image" onRetry={retryImg} compact onDark={onDark} />
      ) : (
        <button type="button" className="mcar-img-btn" onClick={() => open()} aria-label="Open preview">
          <img
            src={item.url}
            alt={item.alt || ''}
            loading="lazy"
            onError={() => setImgFailed((s) => new Set(s).add(index))}
          />
        </button>
      )}

      {many && (
        <>
          <span className="mcar-count">{index + 1}/{list.length}</span>
          <button
            type="button"
            className="mcar-nav mcar-prev"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous item"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="mcar-nav mcar-next"
            onClick={() => go(index + 1)}
            disabled={index === list.length - 1}
            aria-label="Next item"
          >
            <ChevronRight size={16} />
          </button>
          <span className="mcar-dots" aria-hidden="true">
            {list.map((m, i) => (
              <i key={i} className={i === index ? 'on' : ''}>
                {isVideo(m) ? <Play size={5} fill="currentColor" strokeWidth={0} /> : null}
              </i>
            ))}
          </span>
        </>
      )}

      {viewer && (
        <MediaViewer
          items={list}
          index={viewer.index}
          startAt={viewer.startAt}
          autoPlay={viewer.autoPlay}
          onTime={(at) => { times.current[viewer.index] = at }}
          onClose={() => setViewer(null)}
        />
      )}

      <style>{`
        .mcar { position: relative; width: 100%; height: 100%; overflow: hidden; }
        .mcar-img-btn {
          display: block; width: 100%; height: 100%; padding: 0; border: 0;
          background: none; cursor: zoom-in;
        }
        .mcar-img-btn > img {
          display: block; width: 100%; height: 100%; object-fit: cover;
        }
        /* The counter is the whole point: a set reads as one frame that
           says how much more is inside. */
        .mcar-count {
          position: absolute; top: 8px; right: 8px; z-index: 3;
          padding: 2px 8px; border-radius: 999px;
          font-size: 11px; font-weight: 700; letter-spacing: 0.02em;
          color: #fff; background: rgba(0,0,0,0.55);
          backdrop-filter: blur(4px);
        }
        .mcar-nav {
          position: absolute; top: 50%; transform: translateY(-50%); z-index: 3;
          display: grid; place-items: center; width: 26px; height: 26px;
          border: 0; border-radius: 999px; cursor: pointer;
          color: #fff; background: rgba(0,0,0,0.45);
          opacity: 0; transition: opacity 120ms ease;
        }
        .mcar:hover .mcar-nav { opacity: 1; }
        .mcar-nav:disabled { opacity: 0 !important; }
        .mcar-prev { left: 6px; }
        .mcar-next { right: 6px; }
        .mcar-dots {
          position: absolute; left: 0; right: 0; bottom: 8px; z-index: 3;
          display: flex; gap: 4px; justify-content: center; pointer-events: none;
        }
        .mcar-dots i {
          display: grid; place-items: center;
          width: 5px; height: 5px; border-radius: 999px;
          background: rgba(255,255,255,0.55); color: transparent;
        }
        .mcar-dots i.on { background: #fff; }
        @media (hover: none) { .mcar-nav { display: none; } }
      `}</style>
    </div>
  )
}
