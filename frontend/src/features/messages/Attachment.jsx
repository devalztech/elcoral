/**
 * Renders one attachment on a message bubble.
 *
 * The server sends a coarse `kind` (image / video / audio / file)
 * derived from the MIME type it was uploaded with, so the client never
 * has to sniff a URL to decide between an <img>, a <video>, a voice-note
 * player and a document row.
 *
 * Images and videos sit in a fixed 16:9 frame so a bubble never jumps
 * height while media loads, and every colour comes from a theme token so
 * the attachment follows light/dark like the rest of the app.
 */
import { Download, FileText } from 'lucide-react'
import VoiceNote from './VoiceNote.jsx'

function fileName(url) {
  try {
    const path = new URL(url, window.location.origin).pathname
    return decodeURIComponent(path.split('/').pop() || 'Document')
  } catch {
    return 'Document'
  }
}

const frameCss = `
  .ma-frame {
    display: block; position: relative; width: 100%;
    max-width: 320px; aspect-ratio: 16 / 9;
    padding: 0; background: color-mix(in srgb, var(--ink) 6%, transparent);
    border-radius: 12px; overflow: hidden;
  }
  .ma-frame > img, .ma-frame > video {
    display: block; width: 100%; height: 100%; object-fit: cover; background: color-mix(in srgb, var(--ink) 8%, transparent);
  }
  @media (max-width: 480px) { .ma-frame { max-width: 100%; } }
`

export default function Attachment({ attachment, onOpenImage }) {
  const { url, kind, mime_type: mime } = attachment

  if (kind === 'image') {
    return (
      <button
        type="button"
        className="ma-frame ma-image"
        onClick={() => onOpenImage?.(url)}
        aria-label="Open image preview"
      >
        <img src={url} alt="" loading="lazy" />
        <style>{`
          ${frameCss}
          .ma-image { cursor: zoom-in; }
          .ma-image > img { transition: transform 200ms ease; }
          .ma-image:hover > img { transform: scale(1.02); }
          .ma-image:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: 2px; }
          @media (prefers-reduced-motion: reduce) { .ma-image > img { transition: none; } }
        `}</style>
      </button>
    )
  }

  if (kind === 'video') {
    return (
      <div className="ma-frame">
        <video src={url} controls preload="metadata" playsInline />
        <style>{frameCss}</style>
      </div>
    )
  }

  if (kind === 'audio') {
    // Voice notes get the themed player: play button, scrubbable
    // progress bar and elapsed/total duration.
    return <VoiceNote src={url} />
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
        .ma-file {
          display: flex; align-items: center; gap: 9px;
          padding: 8px 10px; border-radius: 12px;
          background: color-mix(in srgb, var(--ink) 7%, transparent);
          color: inherit; min-width: 200px; max-width: 260px;
        }
        .ma-file-icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--panel); flex: none; }
        .ma-file-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .ma-file-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ma-file-kind { font-size: 11px; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </a>
  )
}
