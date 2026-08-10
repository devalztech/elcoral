import { useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'

// One focused editor per profile section, opened from a compact summary
// card — mirrors how LinkedIn edits a profile: tap a section, get a
// dedicated sheet for just that section's fields, save, close. Replaces
// the old pattern of every section being permanently expanded and
// editable inline on one long page.
export default function EditSheet({ title, subtitle, onClose, onSave, saving, error, children }) {
  const firstFieldRef = useRef(null)

  // Mount-only: this must NOT depend on onClose/onSave, since those are
  // recreated on every keystroke in the parent (ProfileEditorBody
  // re-renders on every onboarding `update()` call, which redefines
  // closeSheet/save as new function references each time). Re-running
  // this effect on every keystroke was re-adding the keydown listener
  // and re-focusing an element repeatedly, which is what was dropping
  // the mobile keyboard after the first character typed. Escape/close
  // still works correctly via the ref below, which always calls the
  // LATEST onClose without needing it in the dependency array.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const timer = setTimeout(() => firstFieldRef.current?.focus(), 50)
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="es-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="es-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="es-grabber" />
        <button className="es-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="es-head">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>

        <div className="es-body" ref={firstFieldRef} tabIndex={-1}>
          {children}
        </div>

        {error && <p className="es-error" role="alert">{error}</p>}

        <div className="es-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 size={15} className="es-spin" /> : 'Save'}
          </button>
        </div>
      </div>

      <style>{`
        .es-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: flex-end; justify-content: center;
          animation: esFade 0.2s ease;
        }
        @keyframes esFade { from { opacity: 0; } to { opacity: 1; } }
        .es-sheet {
          position: relative;
          width: 100%; max-width: 480px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-bottom: none;
          border-radius: 20px 20px 0 0;
          padding: 12px 22px 24px;
          max-height: 90vh; overflow-y: auto;
          animation: esSlideUp 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes esSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .es-grabber { width: 36px; height: 4px; border-radius: 999px; background: var(--border); margin: 0 auto 8px; }
        .es-close {
          position: absolute; top: 14px; right: 16px;
          color: var(--ink-faint); padding: 6px; border-radius: 8px;
        }
        .es-close:hover { color: var(--ink); background: var(--panel-raised); }
        .es-head { margin: 10px 0 20px; padding-right: 24px; }
        .es-head h2 { font-family: var(--font-head); font-size: 19px; font-weight: 700; color: var(--ink); }
        .es-head p { font-size: 13px; color: var(--ink-faint); margin-top: 4px; }
        .es-body { display: flex; flex-direction: column; gap: 14px; }
        .es-error {
          background: rgba(255,107,74,0.1); border: 1px solid rgba(255,107,74,0.3);
          color: var(--danger); font-size: 13px; padding: 10px 12px;
          border-radius: 8px; margin-top: 14px;
        }
        .es-actions { display: flex; gap: 10px; margin-top: 22px; }
        .es-actions .btn { flex: 1; }
        .es-spin { animation: esSpin 0.8s linear infinite; }
        @keyframes esSpin { to { transform: rotate(360deg); } }

        @media (min-width: 640px) {
          .es-overlay { align-items: center; padding: 24px; }
          .es-sheet { border-radius: 20px; border-bottom: 1px solid var(--border); }
          .es-grabber { display: none; }
        }
      `}</style>
    </div>
  )
}
