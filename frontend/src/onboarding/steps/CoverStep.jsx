import { useRef, useState } from 'react'
import { Image, Loader2, X } from 'lucide-react'
import { useOnboarding } from '../OnboardingContext.jsx'
import { useAuth } from '../../hooks/useAuth.jsx'
import { api, ApiError } from '../../lib/api.js'
import StepShell from '../StepShell.jsx'

export default function CoverStep({ progress, onNext, onBack }) {
  const { data, update } = useOnboarding()
  const { accessToken } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  async function onFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setUploading(true)
    try {
      const localPreview = URL.createObjectURL(file)
      const result = await api.uploadMedia(file, accessToken)
      update({ cover_ref: result.ref, cover_preview: localPreview })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function removeCover() {
    update({ cover_ref: null, cover_preview: null })
  }

  return (
    <StepShell
      eyebrow="Step 6 of 9"
      title="Add a cover banner"
      subtitle="Optional \u2014 shows at the top of your profile."
      progress={progress}
      onBack={onBack}
      onNext={onNext}
      nextLabel={data.cover_ref ? 'Continue' : 'Skip for now'}
    >
      <button
        type="button"
        className="cover-upload"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={data.cover_preview ? { backgroundImage: `url(${data.cover_preview})` } : undefined}
      >
        {uploading ? (
          <Loader2 size={26} className="spin" />
        ) : !data.cover_preview ? (
          <>
            <Image size={26} />
            <span>Upload a banner image</span>
          </>
        ) : null}
      </button>

      {data.cover_ref && !uploading && (
        <button type="button" className="cover-remove" onClick={removeCover}>
          <X size={14} /> Remove banner
        </button>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFileChange} />
      {error && <p className="cover-error">{error}</p>}

      <style>{`
        .cover-upload {
          width: 100%;
          aspect-ratio: 3 / 1;
          border-radius: 12px;
          background-color: var(--panel);
          background-size: cover;
          background-position: center;
          border: 2px dashed var(--border);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px;
          color: var(--ink-faint);
          font-size: 13.5px;
        }
        .cover-upload:hover { border-color: var(--lemon); color: var(--lemon); }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .cover-remove {
          display: flex; align-items: center; gap: 5px;
          font-size: 13px; color: var(--ink-faint);
          margin-top: 12px;
        }
        .cover-remove:hover { color: var(--danger); }
        .cover-error { font-size: 13px; color: var(--danger); margin-top: 10px; }
      `}</style>
    </StepShell>
  )
}
