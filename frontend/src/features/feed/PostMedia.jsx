/**
 * Media attached to a post.
 *
 * Rules this file exists to enforce:
 *   · one Elcoral frame — no browser default video chrome, no YouTube-ish
 *     grey embed box (see components/MediaPlayer.jsx)
 *   · a single image or clip renders at its OWN width/height ratio, not
 *     cropped into a fixed 16:9 / 4:3 box
 *   · a hairline is the strongest edge we ever draw; no thick borders and
 *     no card-inside-a-card
 */
import { useState } from 'react'
import { Link2 } from 'lucide-react'
import VoiceNote from '../messages/VoiceNote.jsx'
import MediaPlayer from '../../components/MediaPlayer.jsx'
import Lightbox from '../../components/Lightbox.jsx'

function NaturalImage({ url, onOpen }) {
  const [ratio, setRatio] = useState(null)
  return (
    <div className="pm-frame pm-frame-auto" style={ratio ? { aspectRatio: ratio } : undefined}>
      <img
        src={url}
        alt=""
        loading="lazy"
        className="pm-item pm-item-contain"
        onClick={onOpen}
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget
          if (w && h) setRatio(w / h)
        }}
      />
    </div>
  )
}

export default function PostMedia({ media, lightbox = false }) {
  const [preview, setPreview] = useState(null)
  if (!media?.length) return null

  const single = media.length === 1
  const open = (url) => (lightbox ? setPreview(url) : undefined)

  return (
    <div className={`pm count-${Math.min(media.length, 4)}`}>
      {media.map((m, i) => {
        const type = m.mime_type || ''

        if (type.startsWith('video/')) {
          if (single) return <MediaPlayer key={i} src={m.url} />
          return (
            <div key={i} className="pm-frame">
              <MediaPlayer src={m.url} rounded={false} />
            </div>
          )
        }

        if (type.startsWith('audio/')) return <VoiceNote key={i} src={m.url} title="Audio clip" />

        if (type === 'application/pdf') {
          return (
            <a key={i} href={m.url} target="_blank" rel="noreferrer" className="pm-doc" data-stop="true">
              <Link2 size={16} /> Open attachment
            </a>
          )
        }

        if (single) return <NaturalImage key={i} url={m.url} onOpen={() => open(m.url)} />

        return (
          <div key={i} className="pm-frame">
            <img src={m.url} alt="" loading="lazy" className="pm-item" onClick={() => open(m.url)} />
          </div>
        )
      })}

      {lightbox && <Lightbox src={preview} onClose={() => setPreview(null)} />}

      <style>{`
        .pm {
          display: grid; gap: 2px; margin-top: 4px;
          border-radius: 16px; overflow: hidden;
        }
        .pm.count-2, .pm.count-4 { grid-template-columns: 1fr 1fr; }
        .pm.count-3 { grid-template-columns: 1fr 1fr; }
        .pm.count-3 > :first-child { grid-column: 1 / -1; }
        .pm-frame {
          position: relative; display: block; width: 100%; aspect-ratio: 16 / 9;
          overflow: hidden;
          background: color-mix(in srgb, var(--ink) 7%, transparent);
        }
        /* A lone photo/clip keeps its real proportions. */
        .pm-frame-auto { aspect-ratio: auto; max-height: 82vh; }
        .pm-item {
          display: block; width: 100%; height: 100%; object-fit: cover;
          background: color-mix(in srgb, var(--ink) 7%, transparent);
        }
        .pm-item-contain { height: auto; max-height: 82vh; object-fit: contain; }
        .pm-doc {
          display: flex; align-items: center; gap: 8px; padding: 10px 12px;
          border-radius: 12px; font-size: 14px; color: var(--accent-ink);
          background: color-mix(in srgb, var(--ink) 6%, transparent);
        }
      `}</style>
    </div>
  )
}
