import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { api, ApiError } from '../lib/api.js'
import {
  OnboardingProvider, useOnboarding, toApiPayload,
  INTENT_OPTIONS, CATEGORY_OPTIONS, BUILDING_OPTIONS,
  SUGGESTED_SKILLS, SUGGESTED_INTERESTS,
} from '../onboarding/OnboardingContext.jsx'
import MultiSelectDropdown from '../components/MultiSelectDropdown.jsx'
import TagAutocomplete from '../components/TagAutocomplete.jsx'
import EditSheet from '../components/EditSheet.jsx'
import SectionCard from '../components/SectionCard.jsx'
import FormField, { TextInput } from '../components/FormField.jsx'

// Redesigned around LinkedIn's actual edit pattern: the page shows a
// closed, read-only summary card per section; tapping one opens a
// focused EditSheet for just that section. Nothing is permanently
// expanded, and every multi-choice field is a closed dropdown
// (MultiSelectDropdown) instead of an always-visible wall of chips —
// ChipPicker stays reserved for onboarding's one-decision-per-screen
// flow, where a full-screen picker is the right shape.
//
// Saving still submits the WHOLE onboarding payload each time (see
// toApiPayload) — the backend doesn't have partial-update endpoints per
// section yet — but each sheet only lets the person touch the fields
// that section owns, so it reads and feels like a scoped edit.
export default function ProfileEditor() {
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
        <style>{`.profile-loading { display: flex; justify-content: center; padding: 60px 0; color: var(--ink-faint); } .spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (loadError) {
    return <p className="profile-error">{loadError}</p>
  }

  return (
    <OnboardingProvider initialData={initialData}>
      <Link to="/home/profile" className="back-link">
        <ArrowLeft size={15} /> Back to profile
      </Link>
      <ProfileEditorBody />
      <style>{`
        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13.5px; font-weight: 600; color: var(--ink-dim);
          margin-bottom: 18px;
        }
        .back-link:hover { color: var(--lemon); }
        .profile-error { text-align: center; color: var(--danger); padding: 40px 0; }
      `}</style>
    </OnboardingProvider>
  )
}

// One label per section id — SectionCard headers and EditSheet titles
// both read from this so they can't drift out of sync.
const SECTION_META = {
  identity: { label: 'Headline & bio', title: 'Headline & bio' },
  intents: { label: "What brings you here", title: "What brings you here" },
  categories: { label: "How you'd describe yourself", title: "How you'd describe yourself" },
  building: { label: "What you're building", title: "What you're building" },
  skills: { label: 'Skills', title: 'Skills' },
  interests: { label: 'Interests', title: 'Interests' },
}

function ProfileEditorBody() {
  const { data, update } = useOnboarding()
  const { accessToken } = useAuth()
  const [openSection, setOpenSection] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleIn(field, key) {
    const has = data[field].includes(key)
    update({ [field]: has ? data[field].filter((k) => k !== key) : [...data[field], key] })
  }

  async function save() {
    setError('')
    setSaving(true)
    try {
      const payload = toApiPayload(data)
      await api.submitOnboarding(payload, accessToken)
      setOpenSection(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function closeSheet() {
    setError('')
    setOpenSection(null)
  }

  const labelsFor = (field, options) =>
    options.filter((o) => data[field].includes(o.key)).map((o) => o.label)

  return (
    <div className="profile-editor">
      <h1 className="profile-title">Edit profile</h1>
      <p className="profile-sub">Tap any section to update it.</p>

      <div className="profile-sections">
        <SectionCard
          label={SECTION_META.identity.label}
          preview={data.headline || 'Add a headline'}
          isEmpty={!data.headline}
          onEdit={() => setOpenSection('identity')}
        />
        <SectionCard
          label={SECTION_META.intents.label}
          preview={labelsFor('intents', INTENT_OPTIONS).join(', ') || 'Not set'}
          isEmpty={data.intents.length === 0}
          onEdit={() => setOpenSection('intents')}
        />
        <SectionCard
          label={SECTION_META.categories.label}
          preview={labelsFor('categories', CATEGORY_OPTIONS).join(', ') || 'Not set'}
          isEmpty={data.categories.length === 0}
          onEdit={() => setOpenSection('categories')}
        />
        <SectionCard
          label={SECTION_META.building.label}
          preview={labelsFor('building', BUILDING_OPTIONS).join(', ') || 'Not set'}
          isEmpty={data.building.length === 0}
          onEdit={() => setOpenSection('building')}
        />
        <SectionCard
          label={SECTION_META.skills.label}
          preview={data.skills.join(', ') || 'Add your skills'}
          isEmpty={data.skills.length === 0}
          onEdit={() => setOpenSection('skills')}
        />
        <SectionCard
          label={SECTION_META.interests.label}
          preview={data.interests.join(', ') || 'Add your interests'}
          isEmpty={data.interests.length === 0}
          onEdit={() => setOpenSection('interests')}
        />
      </div>

      {openSection === 'identity' && (
        <EditSheet title={SECTION_META.identity.title} onClose={closeSheet} onSave={save} saving={saving} error={error}>
          <FormField label="Headline">
            <TextInput
              placeholder="e.g. Full-stack developer building AI tools"
              maxLength={120}
              value={data.headline}
              onChange={(e) => update({ headline: e.target.value })}
            />
          </FormField>
          <FormField label="Bio">
            <textarea
              className="es-textarea"
              placeholder="Tell people what you do and what you're looking for"
              maxLength={2000}
              rows={5}
              value={data.bio}
              onChange={(e) => update({ bio: e.target.value })}
            />
          </FormField>
          <style>{`
            .es-textarea {
              width: 100%; background: var(--panel); border: 1px solid var(--border);
              border-radius: 8px; padding: 12px 14px; font-size: 14.5px; color: var(--ink);
              font-family: var(--font-body); resize: vertical;
            }
            .es-textarea:focus { outline: none; border-color: var(--lemon); }
          `}</style>
        </EditSheet>
      )}

      {openSection === 'intents' && (
        <EditSheet
          title={SECTION_META.intents.title}
          subtitle="Select as many as apply."
          onClose={closeSheet} onSave={save} saving={saving} error={error}
        >
          <MultiSelectDropdown
            options={INTENT_OPTIONS}
            selected={data.intents}
            onToggle={(k) => toggleIn('intents', k)}
            placeholder="Select what brings you here"
          />
        </EditSheet>
      )}

      {openSection === 'categories' && (
        <EditSheet
          title={SECTION_META.categories.title}
          subtitle="Select as many as apply."
          onClose={closeSheet} onSave={save} saving={saving} error={error}
        >
          <MultiSelectDropdown
            options={CATEGORY_OPTIONS}
            selected={data.categories}
            onToggle={(k) => toggleIn('categories', k)}
            placeholder="Select your roles"
            searchable
          />
        </EditSheet>
      )}

      {openSection === 'building' && (
        <EditSheet
          title={SECTION_META.building.title}
          subtitle="Select as many as apply."
          onClose={closeSheet} onSave={save} saving={saving} error={error}
        >
          <MultiSelectDropdown
            options={BUILDING_OPTIONS}
            selected={data.building}
            onToggle={(k) => toggleIn('building', k)}
            placeholder="Select what you're building"
          />
        </EditSheet>
      )}

      {openSection === 'skills' && (
        <EditSheet title={SECTION_META.skills.title} onClose={closeSheet} onSave={save} saving={saving} error={error}>
          <TagAutocomplete
            suggestions={SUGGESTED_SKILLS}
            selected={data.skills}
            onAdd={(s) => update({ skills: [...data.skills, s] })}
            onRemove={(s) => update({ skills: data.skills.filter((x) => x !== s) })}
            placeholder="Search skills or type your own…"
          />
        </EditSheet>
      )}

      {openSection === 'interests' && (
        <EditSheet title={SECTION_META.interests.title} onClose={closeSheet} onSave={save} saving={saving} error={error}>
          <TagAutocomplete
            suggestions={SUGGESTED_INTERESTS}
            selected={data.interests}
            onAdd={(i) => update({ interests: [...data.interests, i] })}
            onRemove={(i) => update({ interests: data.interests.filter((x) => x !== i) })}
            placeholder="Search interests or type your own…"
          />
        </EditSheet>
      )}

      <style>{`
        .profile-title { font-family: var(--font-display); font-weight: 800; font-size: 26px; color: var(--ink); }
        .profile-sub { margin-top: 6px; margin-bottom: 24px; }
        .profile-sections { display: flex; flex-direction: column; gap: 10px; }
      `}</style>
    </div>
  )
}
