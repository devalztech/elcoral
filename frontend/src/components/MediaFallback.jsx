/**
 * Shown in place of an <img>/<video>/<audio> that failed to load.
 *
 * Private media URLs are short-lived and viewer-bound (see
 * app/core/media_url.py) — a 403/401 here almost always means the
 * signature expired or the browser didn't send the auth cookie, not
 * that anything is actually wrong with the file. Never shows the
 * backend's error text, a storage ref, or anything else that hints at
 * the auth mechanism — just "unavailable" and a way to try again.
 *
 * Retry calls the caller's `onRetry`, which is expected to re-fetch the
 * PARENT object (the message, post, etc.) and hand back a freshly
 * signed URL — retrying the same URL again would just repeat the same
 * expired signature. `onRetry` is optional: pass nothing and this still
 * renders correctly as a dead-end "unavailable" state (e.g. contexts
 * with no cheap way to refetch just one item).
 */
import { useState } from 'react'
import { ImageOff, RefreshCw, Video, Volume2 } from 'lucide-react'

const ICONS = { image: ImageOff, video: Video, audio: Volume2 }
const LABELS = {
  image: 'Image unavailable',
  video: 'Video unavailable',
  audio: 'Audio unavailable',
}

/* `compact` fits inside a fixed message-bubble frame (Attachment.jsx);
   the default size suits a full-width feed/post card. `onDark` forces
   light-on-dark styling regardless of the active theme, for surfaces
   that are always a dark/black background (the full-screen MediaViewer)
   rather than following --ink, which flips with light/dark theme. */
export default function MediaFallback({ kind = 'image', onRetry, compact = false, onDark = false }) {
  const [retrying, setRetrying] = useState(false)
  const Icon = ICONS[kind] || ImageOff

  const handleRetry = async () => {
    if (!onRetry || retrying) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className={`mf ${compact ? 'mf-compact' : ''} ${onDark ? 'mf-on-dark' : ''}`} role="status">
      <Icon size={compact ? 20 : 26} strokeWidth={1.75} aria-hidden="true" />
      <span className="mf-label">{LABELS[kind] || 'Media unavailable'}</span>
      {onRetry && (
        <button type="button" className="mf-retry" onClick={handleRetry} disabled={retrying}>
          <RefreshCw size={13} strokeWidth={2} className={retrying ? 'mf-spin' : ''} />
          {retrying ? 'Retrying…' : 'Try again'}
        </button>
      )}
      <style>{`
        .mf {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; width: 100%; height: 100%; min-height: 120px; padding: 16px;
          color: color-mix(in srgb, var(--ink) 55%, transparent);
          background: color-mix(in srgb, var(--ink) 6%, transparent);
          text-align: center;
        }
        .mf-compact { min-height: 0; gap: 6px; padding: 10px; }
        .mf-label { font-size: 13px; font-weight: 600; }
        .mf-compact .mf-label { font-size: 12px; }
        .mf-retry {
          display: inline-flex; align-items: center; gap: 6px;
          margin-top: 2px; padding: 6px 12px; border: 0; border-radius: 999px;
          background: color-mix(in srgb, var(--ink) 10%, transparent);
          color: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
        }
        .mf-retry:disabled { opacity: 0.7; cursor: default; }
        @media (hover: hover) and (pointer: fine) {
          .mf-retry:hover:not(:disabled) { background: color-mix(in srgb, var(--ink) 15%, transparent); }
        }
        /* Always-dark surfaces (full-screen viewer) don't follow the
           theme toggle, so this fixes light-on-dark instead of --ink. */
        .mf-on-dark { color: rgba(255,255,255,0.85); background: transparent; }
        .mf-on-dark .mf-retry { background: rgba(255,255,255,0.14); color: #fff; }
        @media (hover: hover) and (pointer: fine) {
          .mf-on-dark .mf-retry:hover:not(:disabled) { background: rgba(255,255,255,0.22); }
        }
        .mf-spin { animation: mf-spin 900ms linear infinite; }
        @keyframes mf-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .mf-spin { animation: none; } }
      `}</style>
    </div>
  )
}
