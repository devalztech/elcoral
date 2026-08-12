/**
 * Renders one attachment on a message bubble.
 *
 * The server sends a coarse `kind` (image / video / audio / file)
 * derived from the MIME type it was uploaded with, so the client never
 * has to sniff a URL to decide between an <img>, a <video>, a voice-note
 * player and a document row.
 *
 * SIZING: every photo and every clip in a DM uses ONE fixed frame —
 * MEDIA_W x MEDIA_H below — no matter what the file's own aspect ratio
 * is. A 9:16 phone clip, a 16:9 screen recording and a square photo all
 * occupy the same box, so a thread never jumps around as media loads.
 * The frame width is the voice-note width (246px, the messaging bubble
 * measure) and its height is that width x 4/3; change these two numbers
 * and every image/video bubble in messages follows.
 */
import { Download, FileText } from 'lucide-react'
import { useState } from 'react'
import VoiceNote from './VoiceNote.jsx'
import MediaPlayer from '../../components/MediaPlayer.jsx'
import MediaFallback from '../../components/MediaFallback.jsx'

function fileName(url) {
  try {
    const path = new URL(url, window.location.origin).pathname
    return decodeURIComponent(path.split('/').pop() || 'Document')
  } catch {
    return 'Document'
  }
}

// The one media size used by every image and video bubble in messages.
const MEDIA_W = 246
const MEDIA_H = Math.round((MEDIA_W * 4) / 3) // 328

const frameCss = `
  .ma-frame {
    display: block; position: relative;
    width: ${MEDIA_W}px; height: ${MEDIA_H}px;
    flex: none;
    padding: 0; background: color-mix(in srgb, var(--ink) 6%, transparent);
    border-radius: 6px; overflow: hidden;
  }
  .ma-frame > img, .ma-frame > video {
    display: block; width: 100%; height: 100%; object-fit: cover;
    background: color-mix(in srgb, var(--ink) 8%, transparent);
  }
  /* On a narrow phone the frame shrinks to the bubble but keeps the
     same shape, so it is still one predictable size everywhere. */
  @media (max-width: 420px) {
    .ma-frame { width: 100%; max-width: ${MEDIA_W}px; height: auto; aspect-ratio: 3 / 4; }
  }
`


export default function Attachment({ attachment, onOpenImage, onRetry }) {
  const { url, kind, mime_type: mime } = attachment
  const [failed, setFailed] = useState(false)

  const retry = onRetry
    ? async () => {
        const ok = await onRetry()
        if (ok !== false) setFailed(false)
      }
    : undefined

  if (kind === 'image') {
    return (
      <div className="ma-frame ma-image">
        {failed ? (
          <MediaFallback kind="image" onRetry={retry} compact />
        ) : (
          <button
            type="button"
            className="ma-image-btn"
            onClick={() => onOpenImage?.(url)}
            aria-label="Open image preview"
          >
            <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
          </button>
        )}
        <style>{`
          ${frameCss}
          .ma-image-btn { display: block; width: 100%; height: 100%; cursor: zoom-in; }
          .ma-image-btn:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: 2px; }
        `}</style>
      </div>
    )
  }

  if (kind === 'video') {
    // Elcoral's own player rather than the browser's default chrome, so
    // a clip in a DM looks the same as a clip in the feed — and it sits
    // in the exact same fixed frame a photo would. MediaPlayer manages
    // its own failed/retry state internally (see MediaPlayer.jsx), so
    // this doesn't need a second failed-state wrapper the way image/audio
    // do below.
    return (
      <div className="ma-frame ma-video">
        <MediaPlayer src={url} fill rounded={false} onRetry={onRetry} forceDarkFallback />
        <style>{`
          ${frameCss}
          .ma-video { background: #000; }
        `}</style>
      </div>
    )
  }


  if (kind === 'audio') {
    // Voice notes get the themed player: play button, scrubbable
    // progress bar and elapsed/total duration.
    if (failed) return <MediaFallback kind="audio" onRetry={retry} compact />
    return <VoiceNote src={url} onError={() => setFailed(true)} />
  }

  return (
    <a className="ma-file" href={url} target="_blank" rel="noreferrer" download>
      <span className="ma-file-icon"><FileText size={18} aria-hidden="true" /></span>
      <span className="ma-file-text">
        <span className="ma-file-name">{fileName(url)}</span>
        <span className="ma-file-kind">{mime || 'Document'}</span>
      </span>
      <Download size={16} aria-hidden="true" />
      <style>{`
        /* WhatsApp document row: 56px tall, 12px gap, 6px corner,
           capped at the same 330px as a media bubble. */
        .ma-file {
          display: flex; align-items: center; gap: 12px;
          min-height: 56px; padding: 8px 12px; border-radius: 6px;
          background: color-mix(in srgb, var(--ink) 7%, transparent);
          color: inherit; min-width: 220px; max-width: 330px;
        }
        .ma-file-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 8px; background: var(--panel); flex: none; }
        .ma-file-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .ma-file-name { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ma-file-kind { font-size: 12px; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </a>
  )
}
