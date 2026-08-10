/**
 * Full-screen image preview.
 *
 * Purely client-side: tapping an image anywhere in the app opens this
 * overlay instead of navigating away or asking the server for anything.
 * Escape, the close button and a click on the backdrop all dismiss it,
 * and body scroll is locked while it's open.
 */
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Lightbox({ src, alt = '', onClose }) {
  useEffect(() => {
    if (!src) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [src, onClose])

  if (!src || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="lb"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <button type="button" className="lb-close" aria-label="Close preview" onClick={onClose}>
        <X size={20} />
      </button>
      <img className="lb-img" src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
      <style>{`
        .lb {
          position: fixed; inset: 0; z-index: 1000;
          display: grid; place-items: center;
          padding: 24px;
          background: color-mix(in srgb, #000 82%, transparent);
          backdrop-filter: blur(6px);
          animation: lb-fade 180ms ease-out;
        }
        .lb-img {
          max-width: min(100%, 1100px); max-height: 90vh;
          border-radius: 16px; object-fit: contain;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
          animation: lb-zoom 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .lb-close {
          position: absolute; top: 16px; right: 16px;
          width: 40px; height: 40px; border-radius: 999px;
          display: grid; place-items: center;
          background: color-mix(in srgb, #fff 16%, transparent);
          color: #fff; border: 0; cursor: pointer;
          transition: background 150ms ease;
        }
        @media (hover: hover) and (pointer: fine) { .lb-close:hover { background: color-mix(in srgb, #fff 28%, transparent); } }
        @keyframes lb-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lb-zoom { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) {
          .lb, .lb-img { animation: none; }
        }
      `}</style>
    </div>,
    document.body,
  )
}
