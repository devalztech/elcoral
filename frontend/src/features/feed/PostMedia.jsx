/**
 * Media attached to a post.
 *
 * Rules this file exists to enforce:
 *   · one Elcoral frame — no browser default video chrome, no YouTube-ish
 *     grey embed box (see components/MediaPlayer.jsx)
 *   · SIZING: exactly like a DM attachment, every photo/clip in a post
 *     uses ONE fixed frame (MEDIA_W x MEDIA_H below). It is deliberately
 *     a little bigger than the messaging frame (246 x 328) so a feed
 *     photo reads larger than the same photo in a chat, while the feed
 *     still never jumps around as media loads.
 *   · a hairline is the strongest edge we ever draw; no thick borders and
 *     no card-inside-a-card
 */
import { useState } from 'react'
import { Link2 } from 'lucide-react'
import VoiceNote from '../messages/VoiceNote.jsx'
import MediaPlayer from '../../components/MediaPlayer.jsx'
import Lightbox from '../../components/Lightbox.jsx'

// The one media size used by every image and video in a post.
// Messages use 246 x 328; posts are one step up.
const MEDIA_W = 320
const MEDIA_H = Math.round((MEDIA_W * 4) / 3) // 427

function SingleImage({ url, onOpen }) {
  return (
    <div className="pm-frame pm-frame-single">
      <img src={url} alt="" loading="lazy" className="pm-item" onClick={onOpen} />
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
          return (
            <div key={i} className={`pm-frame ${single ? 'pm-frame-single' : ''}`}>
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

        if (single) return <SingleImage key={i} url={m.url} onOpen={() => open(m.url)} />

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
        /* A lone photo/clip is its own fixed box, not a full-bleed strip. */
        .pm.count-1 { width: ${MEDIA_W}px; max-width: 100%; }
        .pm.count-2, .pm.count-4 { grid-template-columns: 1fr 1fr; }
        .pm.count-3 { grid-template-columns: 1fr 1fr; }
        .pm.count-3 > :first-child { grid-column: 1 / -1; }
        .pm-frame {
          position: relative; display: block; width: 100%; aspect-ratio: 16 / 9;
          overflow: hidden;
          background: color-mix(in srgb, var(--ink) 7%, transparent);
        }
        /* THE post media size: fixed, one step larger than a DM's. */
        .pm-frame-single {
          width: ${MEDIA_W}px; max-width: 100%; height: ${MEDIA_H}px; aspect-ratio: auto;
        }
        @media (max-width: 420px) {
          .pm-frame-single { width: 100%; height: auto; aspect-ratio: 3 / 4; }
        }
        .pm-item {
          display: block; width: 100%; height: 100%; object-fit: cover;
          background: color-mix(in srgb, var(--ink) 7%, transparent);
        }
        .pm-doc {
          display: flex; align-items: center; gap: 8px; padding: 10px 12px;
          border-radius: 12px; font-size: 14px; color: var(--accent-ink);
          background: color-mix(in srgb, var(--ink) 6%, transparent);
        }
      `}</style>
    </div>
  )
}
