import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Camera, Github, Linkedin, Globe, Send, Link2, X, Plus } from 'lucide-react'
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
import CountrySelect from '../onboarding/CountrySelect.jsx'
import Typeahead from '../onboarding/Typeahead.jsx'

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
  photo: { label: 'Profile photo', title: 'Profile photo' },
  identity: { label: 'Headline & bio', title: 'Headline & bio' },
  intents: { label: "What brings you here", title: "What brings you here" },
  categories: { label: "How you'd describe yourself", title: "How you'd describe yourself" },
  building: { label: "What you're building", title: "What you're building" },
  skills: { label: 'Skills', title: 'Skills' },
  interests: { label: 'Interests', title: 'Interests' },
  location: { label: 'Location', title: 'Location' },
  phone: { label: 'Phone number', title: 'Phone number' },
  links: { label: 'Links', title: 'Links' },
  experience: { label: 'Work experience', title: 'Work experience' },
}

function ProfileEditorBody() {
  const { data, update } = useOnboarding()
  const { accessToken } = useAuth()
  const [openSection, setOpenSection] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileRef = useRef(null)

  // Phone number has no backend field yet (see app/models/profile.py) —
  // held in local state only so the section is real and editable, but it
  // does not persist across reloads until the backend adds a column and
  // this gets folded into toApiPayload/fromApiProfile like every other
  // field here.
  const [phone, setPhone] = useState('')

  function toggleIn(field, key) {
    const has = data[field].includes(key)
    update({ [field]: has ? data[field].filter((k) => k !== key) : [...data[field], key] })
  }

  async function onPhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploadingPhoto(true)
    try {
      const localPreview = URL.createObjectURL(file)
      const result = await api.uploadMedia(file, accessToken)
      update({ photo_ref: result.ref, photo_preview: localPreview })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploadingPhoto(false)
      e.target.value = ''
    }
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

  function addExperience() {
    update({ work_experience: [...data.work_experience, { title: '', company: '', years: '' }] })
  }

  function updateExperience(index, patch) {
    const next = data.work_experience.map((exp, i) => (i === index ? { ...exp, ...patch } : exp))
    update({ work_experience: next })
  }

  function removeExperience(index) {
    update({ work_experience: data.work_experience.filter((_, i) => i !== index) })
  }

  const labelsFor = (field, options) =>
    options.filter((o) => data[field].includes(o.key)).map((o) => o.label)

  const locationPreview = [data.city, data.country_label, data.is_remote ? 'Remote' : null]
    .filter(Boolean)
    .join(', ')

  const linksCount = [data.github_url, data.linkedin_url, data.website_url, data.telegram_handle]
    .filter(Boolean).length + data.portfolio_links.length

  return (
    <div className="profile-editor">
      <h1 className="profile-title">Edit profile</h1>
      <p className="profile-sub">Tap any section to update it.</p>

      <div className="profile-sections">
        <SectionCard
          label={SECTION_META.photo.label}
          preview={data.photo_preview ? 'Added' : 'Add a profile photo'}
          isEmpty={!data.photo_preview}
          onEdit={() => setOpenSection('photo')}
        />
        <SectionCard
          label={SECTION_META.identity.label}
          preview={data.headline || 'Add a headline'}
          isEmpty={!data.headline}
          onEdit={() => setOpenSection('identity')}
        />
        <SectionCard
          label={SECTION_META.location.label}
          preview={locationPreview || 'Add your location'}
          isEmpty={!locationPreview}
          onEdit={() => setOpenSection('location')}
        />
        <SectionCard
          label={SECTION_META.phone.label}
          preview={phone || 'Add a phone number'}
          isEmpty={!phone}
          onEdit={() => setOpenSection('phone')}
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
        <SectionCard
          label={SECTION_META.experience.label}
          preview={data.work_experience.length ? `${data.work_experience.length} entries` : 'Add work experience'}
          isEmpty={data.work_experience.length === 0}
          onEdit={() => setOpenSection('experience')}
        />
        <SectionCard
          label={SECTION_META.links.label}
          preview={linksCount ? `${linksCount} links added` : 'Add links'}
          isEmpty={linksCount === 0}
          onEdit={() => setOpenSection('links')}
        />
      </div>

      {openSection === 'photo' && (
        <EditSheet title={SECTION_META.photo.title} onClose={closeSheet} onSave={save} saving={saving} error={error}>
          <div className="photo-edit">
            <button type="button" className="photo-circle" onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}>
              {uploadingPhoto ? (
                <Loader2 size={24} className="es-spin" />
              ) : data.photo_preview ? (
                <img src={data.photo_preview} alt="Profile preview" />
              ) : (
                <Camera size={24} />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhotoChange} />
            <button type="button" className="photo-change-link" onClick={() => fileRef.current?.click()}>
              {data.photo_preview ? 'Change photo' : 'Upload photo'}
            </button>
          </div>
          <style>{`
            .photo-edit { display: flex; flex-direction: column; align-items: center; gap: 12px; }
            .photo-circle {
              width: 96px; height: 96px; border-radius: 50%;
              background: var(--panel-raised); border: 1px dashed var(--border);
              display: flex; align-items: center; justify-content: center;
              overflow: hidden; color: var(--ink-faint);
            }
            .photo-circle:hover { border-color: var(--lemon); color: var(--lemon); }
            .photo-circle img { width: 100%; height: 100%; object-fit: cover; }
            .photo-change-link { font-size: 13.5px; font-weight: 600; color: var(--lemon); padding: 6px 0; }
          `}</style>
        </EditSheet>
      )}

      {openSection === 'location' && (
        <EditSheet title={SECTION_META.location.title} onClose={closeSheet} onSave={save} saving={saving} error={error}>
          <FormField label="Country">
            <CountrySelect
              value={data.country_code ? { name: data.country_label, code: data.country_code } : null}
              onSelect={(c) => update({ country_code: c.code, country_label: c.name, city: '' })}
            />
          </FormField>
          <FormField label="City">
            <Typeahead
              key={data.country_code}
              placeholder={data.country_code ? 'Search for your city…' : 'Pick a country first'}
              initialValue={data.city}
              fetchResults={(q) => api.searchCities(q, data.country_code)}
              getKey={(c) => c.geonameId}
              getLabel={(c) => c.name}
              onSelect={(c) => update({ city: c.name })}
            />
          </FormField>
          <label className="remote-toggle">
            <input type="checkbox" checked={data.is_remote} onChange={(e) => update({ is_remote: e.target.checked })} />
            <Globe size={16} />
            <span>I work remotely / location doesn't matter</span>
          </label>
          <style>{`
            .remote-toggle {
              display: flex; align-items: center; gap: 10px;
              font-size: 14px; color: var(--ink-dim);
              padding: 12px 14px; background: var(--panel); border: 1px solid var(--border);
              border-radius: 8px; cursor: pointer;
            }
            .remote-toggle input { accent-color: var(--lemon); width: 16px; height: 16px; }
          `}</style>
        </EditSheet>
      )}

      {openSection === 'phone' && (
        <EditSheet
          title={SECTION_META.phone.title}
          subtitle="Only visible to people you're connected with."
          onClose={closeSheet}
          onSave={() => setOpenSection(null)}
          saving={false}
          error={error}
        >
          <FormField label="Phone number">
            <TextInput
              type="tel"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </FormField>
        </EditSheet>
      )}

      {openSection === 'links' && (
        <EditSheet title={SECTION_META.links.title} onClose={closeSheet} onSave={save} saving={saving} error={error}>
          <div className="links-list">
            <LinkField icon={<Github size={17} />} placeholder="github.com/username" value={data.github_url} onChange={(v) => update({ github_url: v })} />
            <LinkField icon={<Linkedin size={17} />} placeholder="linkedin.com/in/username" value={data.linkedin_url} onChange={(v) => update({ linkedin_url: v })} />
            <LinkField icon={<Globe size={17} />} placeholder="yourwebsite.com" value={data.website_url} onChange={(v) => update({ website_url: v })} />
            <LinkField icon={<Send size={17} />} placeholder="@telegram_handle" value={data.telegram_handle} onChange={(v) => update({ telegram_handle: v })} />
          </div>
          <PortfolioLinks
            links={data.portfolio_links}
            onAdd={(l) => update({ portfolio_links: [...data.portfolio_links, l] })}
            onRemove={(l) => update({ portfolio_links: data.portfolio_links.filter((x) => x !== l) })}
          />
          <style>{`.links-list { display: flex; flex-direction: column; gap: 10px; }`}</style>
        </EditSheet>
      )}

      {openSection === 'experience' && (
        <EditSheet title={SECTION_META.experience.title} onClose={closeSheet} onSave={save} saving={saving} error={error}>
          <div className="exp-list">
            {data.work_experience.map((exp, i) => (
              <div className="exp-entry" key={i}>
                <button type="button" className="exp-remove" onClick={() => removeExperience(i)} aria-label="Remove entry">
                  <X size={14} />
                </button>
                <FormField label="Title">
                  <TextInput value={exp.title} onChange={(e) => updateExperience(i, { title: e.target.value })} placeholder="e.g. Frontend Developer" />
                </FormField>
                <FormField label="Company">
                  <TextInput value={exp.company} onChange={(e) => updateExperience(i, { company: e.target.value })} placeholder="e.g. Acme Inc." />
                </FormField>
                <FormField label="Years">
                  <TextInput value={exp.years} onChange={(e) => updateExperience(i, { years: e.target.value })} placeholder="e.g. 2022 – Present" />
                </FormField>
              </div>
            ))}
          </div>
          <button type="button" className="add-exp-btn" onClick={addExperience}>
            <Plus size={15} /> Add experience
          </button>
          <style>{`
            .exp-list { display: flex; flex-direction: column; gap: 8px; }
            .exp-entry {
              position: relative;
              background: var(--panel-raised); border: 1px solid var(--border);
              border-radius: 10px; padding: 16px; margin-bottom: 4px;
            }
            .exp-remove {
              position: absolute; top: 10px; right: 10px;
              color: var(--ink-faint); padding: 4px;
            }
            .exp-remove:hover { color: var(--danger); }
            .add-exp-btn {
              display: flex; align-items: center; justify-content: center; gap: 6px;
              width: 100%; font-size: 13.5px; font-weight: 600; color: var(--lemon);
              border: 1px dashed var(--border); border-radius: 10px; padding: 12px;
            }
            .add-exp-btn:hover { border-color: var(--lemon); }
          `}</style>
        </EditSheet>
      )}

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

function LinkField({ icon, placeholder, value, onChange }) {
  return (
    <div className="link-field-wrap">
      <span className="link-icon">{icon}</span>
      <input
        className="link-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <style>{`
        .link-field-wrap {
          display: flex; align-items: center; gap: 10px;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 8px; padding: 12px 14px;
        }
        .link-field-wrap:focus-within { border-color: var(--lemon); }
        .link-icon { color: var(--ink-faint); flex-shrink: 0; display: flex; }
        .link-input {
          flex: 1; background: transparent; border: none; outline: none;
          font-size: 14.5px; color: var(--ink); font-family: var(--font-body);
        }
        .link-input::placeholder { color: var(--ink-faint); }
      `}</style>
    </div>
  )
}

function PortfolioLinks({ links, onAdd, onRemove }) {
  const [input, setInput] = useState('')

  function add() {
    const trimmed = input.trim()
    if (!trimmed || links.includes(trimmed)) return
    onAdd(trimmed)
    setInput('')
  }

  return (
    <div className="portfolio-section">
      <label className="portfolio-label">Portfolio links</label>
      <div className="portfolio-input-row">
        <div className="link-field-wrap">
          <Link2 size={17} className="link-icon" />
          <input
            className="link-input"
            placeholder="Add a link to your work…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          />
        </div>
        <button type="button" className="portfolio-add" onClick={add}>
          <Plus size={16} />
        </button>
      </div>

      {links.length > 0 && (
        <ul className="portfolio-list">
          {links.map((link) => (
            <li key={link}>
              <span>{link}</span>
              <button type="button" onClick={() => onRemove(link)} aria-label="Remove">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .portfolio-section { margin-top: 20px; }
        .portfolio-label {
          display: block; font-family: var(--font-head); font-size: 13px; font-weight: 600;
          color: var(--ink-dim); margin-bottom: 7px;
        }
        .portfolio-input-row { display: flex; gap: 8px; }
        .portfolio-add {
          width: 46px; flex-shrink: 0;
          background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
          color: var(--ink-dim); display: flex; align-items: center; justify-content: center;
        }
        .portfolio-add:hover { border-color: var(--lemon); color: var(--lemon); }
        .portfolio-list { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .portfolio-list li {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
          padding: 10px 12px; font-size: 13.5px; color: var(--ink-dim);
        }
        .portfolio-list button { color: var(--ink-faint); }
        .portfolio-list button:hover { color: var(--danger); }
      `}</style>
    </div>
  )
}
