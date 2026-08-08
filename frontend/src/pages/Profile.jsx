import { useEffect, useState } from 'react'
import { Loader2, Pencil, Check, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { api, ApiError } from '../lib/api.js'
import {
  OnboardingProvider, useOnboarding, toApiPayload,
  INTENT_OPTIONS, CATEGORY_OPTIONS, BUILDING_OPTIONS, SUGGESTED_INTERESTS,
} from '../onboarding/OnboardingContext.jsx'
import ChipPicker from '../onboarding/ChipPicker.jsx'

// Reuses the exact same fields/vocabulary as onboarding (see
// OnboardingContext.jsx) — profile editing IS onboarding, just presented
// as editable sections on one page instead of a forced step-by-step
// wizard, and pre-filled from whatever's already saved.
export default function Profile() {
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [initialData, setInitialData] = useState(null)

  useEffect(() => {
    api
      .myProfile(accessToken)
      .then((profile) => setInitialData(profile))
      .catch(() => setLoadError('Could not load your profile.'))
      .finally(() => setLoading(false))
  }, [accessToken])

  if (loading) {
    return (
      <div className="profile-loading">
        <Loader2 size={24} className="spin" />
      </div>
    )
  }

  if (loadError) {
    return <p className="profile-error">{loadError}</p>
  }

  return (
    <OnboardingProvider initialData={initialData}>
      <ProfileEditor initialData={initialData} />
      <style>{`
        .profile-loading { display: flex; justify-content: center; padding: 60px 0; color: var(--ink-faint); }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .profile-error { text-align: center; color: var(--danger); padding: 40px 0; }
      `}</style>
    </OnboardingProvider>
  )
}

function ProfileEditor() {
  const { data, update } = useOnboarding()
  const { accessToken } = useAuth()
  const [saving, setSaving] = useState(null) // which section is saving
  const [savedFlash, setSavedFlash] = useState(null)
  const [error, setError] = useState('')

  async function saveSection(section) {
    setError('')
    setSaving(section)
    try {
      const payload = toApiPayload(data)
      await api.submitOnboarding(payload, accessToken)
      setSavedFlash(section)
      setTimeout(() => setSavedFlash(null), 1800)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  function toggleIn(field, key) {
    const has = data[field].includes(key)
    update({ [field]: has ? data[field].filter((k) => k !== key) : [...data[field], key] })
  }

  return (
    <div className="profile-editor">
      <h1 className="profile-title">Your profile</h1>
      <p className="profile-sub">Everything here came from onboarding \u2014 edit any section anytime.</p>

      <EditSection
        title="What brings you here"
        saving={saving === 'intents'}
        saved={savedFlash === 'intents'}
        onSave={() => saveSection('intents')}
      >
        <ChipPicker options={INTENT_OPTIONS} selected={data.intents} onToggle={(k) => toggleIn('intents', k)} />
      </EditSection>

      <EditSection
        title="How you'd describe yourself"
        saving={saving === 'categories'}
        saved={savedFlash === 'categories'}
        onSave={() => saveSection('categories')}
      >
        <ChipPicker options={CATEGORY_OPTIONS} selected={data.categories} onToggle={(k) => toggleIn('categories', k)} />
      </EditSection>

      <EditSection
        title="What you're building"
        saving={saving === 'building'}
        saved={savedFlash === 'building'}
        onSave={() => saveSection('building')}
      >
        <ChipPicker options={BUILDING_OPTIONS} selected={data.building} onToggle={(k) => toggleIn('building', k)} />
      </EditSection>

      <EditSection
        title="Headline & bio"
        saving={saving === 'bio'}
        saved={savedFlash === 'bio'}
        onSave={() => saveSection('bio')}
      >
        <input
          className="profile-input"
          placeholder="Headline"
          maxLength={120}
          value={data.headline}
          onChange={(e) => update({ headline: e.target.value })}
        />
        <textarea
          className="profile-textarea"
          placeholder="Bio"
          maxLength={2000}
          rows={4}
          value={data.bio}
          onChange={(e) => update({ bio: e.target.value })}
        />
      </EditSection>

      <EditSection
        title="Interests"
        saving={saving === 'interests'}
        saved={savedFlash === 'interests'}
        onSave={() => saveSection('interests')}
      >
        <div className="interest-chips">
          {SUGGESTED_INTERESTS.map((interest) => {
            const isSelected = data.interests.includes(interest)
            return (
              <button
                type="button"
                key={interest}
                className={`interest-chip ${isSelected ? 'interest-chip-selected' : ''}`}
                onClick={() => toggleIn('interests', interest)}
              >
                {interest}
              </button>
            )
          })}
        </div>
      </EditSection>

      {error && <p className="profile-save-error">{error}</p>}

      <style>{`
        .profile-title { font-family: var(--font-display); font-weight: 800; font-size: 26px; color: var(--ink); }
        .profile-sub { margin-top: 6px; margin-bottom: 28px; }
        .profile-input, .profile-textarea {
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 14.5px;
          color: var(--ink);
          font-family: var(--font-body);
          margin-bottom: 10px;
        }
        .profile-input:focus, .profile-textarea:focus { outline: none; border-color: var(--lemon); }
        .interest-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .interest-chip {
          font-size: 13px; color: var(--ink-dim);
          background: var(--panel-raised);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 8px 14px;
        }
        .interest-chip-selected { background: rgba(196,241,53,0.12); border-color: var(--lemon); color: var(--ink); }
        .profile-save-error { color: var(--danger); font-size: 13.5px; text-align: center; margin-top: 16px; }
      `}</style>
    </div>
  )
}

function EditSection({ title, children, onSave, saving, saved }) {
  return (
    <div className="edit-section">
      <div className="edit-section-head">
        <h2>{title}</h2>
        <button type="button" className="save-btn" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 size={14} className="spin" /> : saved ? <Check size={14} /> : <Pencil size={13} />}
          {saving ? 'Saving' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
      {children}
      <style>{`
        .edit-section {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 20px;
          margin-bottom: 16px;
        }
        .edit-section-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px;
        }
        .edit-section-head h2 {
          font-family: var(--font-head);
          font-size: 15px;
          font-weight: 600;
          color: var(--ink);
        }
        .save-btn {
          display: flex; align-items: center; gap: 6px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink-dim);
          background: var(--panel-raised);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 6px 12px;
        }
        .save-btn:hover { border-color: var(--lemon); color: var(--ink); }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
