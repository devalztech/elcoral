/**
 * Renders one attachment on a message bubble.
 *
 * The server sends a coarse `kind` (image / video / audio / file)
 * derived from the MIME type it was uploaded with, so the client never
 * has to sniff a URL to decide between an <img>, a <video>, a voice-note
 * player and a document row.
 */
import { Download, FileText } from 'lucide-react'

function fileName(url) {
  try {
    const path = new URL(url, window.location.origin).pathname
    return decodeURIComponent(path.split('/').pop() || 'Document')
  } catch {
    return 'Document'
  }
}

export default function Attachment({ attachment, onOpenImage }) {
  const { url, kind, mime_type: mime } = attachment

  if (kind === 'image') {
    return (
      <button type="button" className="ma-image" onClick={() => onOpenImage?.(url)}>
        <img src={url} alt="" loading="lazy" />
        <style>{`
          .ma-image { display: block; padding: 0; border: 0; background: none; border-radius: 12px; overflow: hidden; }
          .ma-image img { display: block; width: 100%; max-height: 320px; object-fit: cover; }
        `}</style>
      </button>
    )
  }

  if (kind === 'video') {
    return (
      <video className="ma-video" src={url} controls preload="metadata" playsInline>
        <style>{`.ma-video { width: 100%; max-height: 340px; border-radius: 12px; background: #000; }`}</style>
      </video>
    )
  }

  if (kind === 'audio') {
    // Voice notes and audio clips share the native player: it already
    // handles scrubbing, duration and background playback correctly, and
    // a hand-rolled waveform would lose all three.
    return (
      <div className="ma-audio">
        <audio src={url} controls preload="metadata" />
        <style>{`
          .ma-audio audio { width: 100%; min-width: 220px; height: 38px; }
        `}</style>
      </div>
    )
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
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 12px;
          background: color-mix(in srgb, var(--ink) 7%, transparent);
          color: inherit; min-width: 200px; max-width: 260px;
        }
        .ma-file-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; background: var(--panel); flex: none; }
        .ma-file-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .ma-file-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ma-file-kind { font-size: 11px; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </a>
  )
}
