/**
 * Media attached to a post.
 *
 * Rules this file exists to enforce:
 *   · one Elcoral frame — no browser default video chrome, no YouTube-ish
 *     grey embed box (see components/MediaPlayer.jsx)
 *   · SIZING: exactly like a DM attachment. The whole media block is one
 *     object, 300px wide (a step up from the 246px messaging frame) in
 *     the same 3:4 shape with the same 6px corner, so a photo reads as
 *     the same object in a chat and in the feed — and the feed never
 *     jumps around as media loads.
 *   · a hairline is the strongest edge we ever draw; no thick borders and
 *     no card-inside-a-card
 */
import { useState } from 'react'
import { Link2 } from 'lucide-react'
import VoiceNote from '../messages/VoiceNote.jsx'
import MediaPlayer from '../../components/MediaPlayer.jsx'
import Lightbox from '../../components/Lightbox.jsx'
import MediaCarousel from '../../components/MediaCarousel.jsx'

// The one media size used by every image and video in a post.
// Messages use 246 x 328; posts are one step up in the same shape.
const MEDIA_W = 300
const MEDIA_H = Math.round((MEDIA_W * 4) / 3) // 400

export default function PostMedia({ media, lightbox = false }) {
  const [preview, setPreview] = useState(null)
  if (!media?.length) return null

  const open = (url) => (lightbox ? setPreview(url) : undefined)

  // Several photos/clips on one post are ONE swipeable frame with a
  // counter (Instagram's album model) rather than a grid of frames.
  const gallery = media.filter((m) => {
    const t = m.mime_type || ''
    return t.startsWith('image/') || t.startsWith('video/')
  })
  const others = media.filter((m) => !gallery.includes(m))
  if (gallery.length > 1) {
    return (
      <div className="pm count-1">
        <div className="pm-frame pm-frame-video">
          <MediaCarousel items={gallery} />
        </div>
        {others.map((m, i) =>
          (m.mime_type || '').startsWith('audio/')
            ? <VoiceNote key={i} src={m.url} title="Audio clip" />
            : (
              <a key={i} href={m.url} target="_blank" rel="noreferrer" className="pm-doc" data-stop="true">
                <Link2 size={16} /> Open attachment
              </a>
            ))}
        <style>{`
          .pm { display: grid; gap: 3px; margin-top: 10px; width: ${MEDIA_W}px; max-width: 100%; border-radius: 6px; overflow: hidden; }
          .pm-frame { position: relative; width: 100%; height: ${MEDIA_H}px; overflow: hidden; background: #000; }
          @media (max-width: 420px) {
            .pm { width: 100%; max-width: ${MEDIA_W}px; }
            .pm-frame { height: auto; aspect-ratio: 3 / 4; }
          }
          .pm-doc { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 6px; font-size: 14px; color: var(--accent-ink); background: color-mix(in srgb, var(--ink) 6%, transparent); }
        `}</style>
      </div>
    )
  }

  const count = Math.min(media.length, 4)

  return (
    <div className={`pm count-${count}`}>
      {media.map((m, i) => {
        const type = m.mime_type || ''

        if (type.startsWith('video/')) {
          return (
            <div key={i} className="pm-frame pm-frame-video">
              <MediaPlayer src={m.url} fill rounded={false} />
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

        return (
          <div key={i} className="pm-frame">
            <img src={m.url} alt="" loading="lazy" className="pm-item" onClick={() => open(m.url)} />
          </div>
        )
      })}

      {lightbox && <Lightbox src={preview} onClose={() => setPreview(null)} />}

      <style>{`
        /* The block is ONE object the width of a DM frame — never a
           full-bleed strip — so the feed keeps a steady measure. */
        .pm {
          display: grid; gap: 3px; margin-top: 10px;
          width: ${MEDIA_W}px; max-width: 100%;
          border-radius: 6px; overflow: hidden;
        }
        .pm.count-1 { grid-template-columns: 1fr; }
        .pm.count-2, .pm.count-4 { grid-template-columns: 1fr 1fr; }
        .pm.count-3 { grid-template-columns: 1fr 1fr; }
        .pm.count-3 > :first-child { grid-column: 1 / -1; }

        .pm-frame {
          position: relative; display: block; width: 100%; overflow: hidden;
          background: color-mix(in srgb, var(--ink) 6%, transparent);
        }
        /* A lone photo gets the full 3:4 frame; a set splits it. */
        .pm.count-1 .pm-frame { height: ${MEDIA_H}px; }
        .pm.count-2 .pm-frame,
        .pm.count-4 .pm-frame,
        .pm.count-3 .pm-frame { aspect-ratio: 1 / 1; }
        .pm.count-3 > .pm-frame:first-child { aspect-ratio: 16 / 10; }
        .pm-frame-video { background: #000; }

        /* On a narrow phone the block shrinks to the text measure but
           keeps the same shape, so it is one predictable size. */
        @media (max-width: 420px) {
          .pm { width: 100%; max-width: ${MEDIA_W}px; }
          .pm.count-1 .pm-frame { height: auto; aspect-ratio: 3 / 4; }
        }

        .pm-item {
          display: block; width: 100%; height: 100%; object-fit: cover;
          background: color-mix(in srgb, var(--ink) 7%, transparent);
          cursor: zoom-in;
        }
        .pm-doc {
          display: flex; align-items: center; gap: 8px; padding: 10px 12px;
          border-radius: 6px; font-size: 14px; color: var(--accent-ink);
          background: color-mix(in srgb, var(--ink) 6%, transparent);
        }
      `}</style>
    </div>
  )
}
