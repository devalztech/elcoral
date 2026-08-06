import { useRef, useState } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import { useOnboarding } from '../OnboardingContext.jsx'
import { useAuth } from '../../hooks/useAuth.jsx'
import { api, ApiError } from '../../lib/api.js'
import StepShell from '../StepShell.jsx'

export default function PhotoStep({ progress, onNext, onBack }) {
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
      update({ photo_ref: result.ref, photo_preview: localPreview })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function removePhoto() {
    update({ photo_ref: null, photo_preview: null })
  }

  return (
    <StepShell
      eyebrow="Step 5 of 9"
      title="Add a profile photo"
      subtitle="Optional \u2014 profiles with a photo get more connections. You can add this later."
      progress={progress}
      onBack={onBack}
      onNext={onNext}
      nextLabel={data.photo_ref ? 'Continue' : 'Skip for now'}
    >
      <div className="photo-upload">
        <button
          type="button"
          className="photo-circle"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 size={26} className="spin" />
          ) : data.photo_preview ? (
            <img src={data.photo_preview} alt="Profile preview" />
          ) : (
            <Camera size={26} />
          )}
        </button>

        {data.photo_ref && !uploading && (
          <button type="button" className="photo-remove" onClick={removePhoto}>
            <X size={14} /> Remove photo
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFileChange} />

        {error && <p className="photo-error">{error}</p>}
      </div>

      <style>{`
        .photo-upload { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 20px 0 8px; }
        .photo-circle {
          width: 140px; height: 140px;
          border-radius: 50%;
          background: var(--panel);
          border: 2px dashed var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--ink-faint);
          overflow: hidden;
        }
        .photo-circle:hover { border-color: var(--lemon); color: var(--lemon); }
        .photo-circle img { width: 100%; height: 100%; object-fit: cover; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .photo-remove {
          display: flex; align-items: center; gap: 5px;
          font-size: 13px; color: var(--ink-faint);
        }
        .photo-remove:hover { color: var(--danger); }
        .photo-error { font-size: 13px; color: var(--danger); text-align: center; }
      `}</style>
    </StepShell>
  )
}
