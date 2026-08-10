import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Loader2, Camera, X, Plus, ChevronDown, ChevronRight,
  Link2, MapPin, UsersRound, SlidersHorizontal, Target, FileText, Info,
  Briefcase, UserRound, GraduationCap, MessagesSquare, Twitter, Linkedin, Github, Dribbble,
  Clock, Globe,
} from 'lucide-react'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { api, ApiError } from '../api/client.js'
import {
  OnboardingProvider, useOnboarding, toApiPayload, SUGGESTED_SKILLS, AVAILABILITY_OPTIONS,
} from '../features/onboarding/OnboardingContext.jsx'

// Full-page Edit Profile screen, built to the Elcoral mobile design spec:
// sticky topbar (back / title / Save), a cover + avatar media card, then
// stacked sections — Basic information, Location & Links, Skills,
// Looking for, About you. Everything still saves through the same
// onboarding payload endpoint the sectioned editor used.
export default function ProfileEditor() {
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [initialData, setInitialData] = useState(null)

  useEffect(() => {
    if (!accessToken) return
    api
      // /profile/me (not /onboarding/me): it always returns a row, and it
      // includes photo_ref/cover_ref, which the editor must send back
      // unchanged or a save would wipe the person's existing images.
      .getMyProfile(accessToken)
      .then((profile) => setInitialData(profile))
      .catch(() => setLoadError('Could not load your profile.'))
      .finally(() => setLoading(false))
  }, [accessToken])

  if (loading) {
    return (
      <div className="pe-loading">
        <Loader2 size={24} className="pe-spin" />
        <style>{`
          .pe-loading { display: flex; justify-content: center; padding: 60px 0; color: var(--ink-faint); }
          .pe-spin { animation: pe-spin 0.8s linear infinite; }
        .pe-field-error { font-size: 12.5px; color: var(--danger); margin-top: 6px; }
          @keyframes pe-spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  if (loadError) {
    return <p style={{ textAlign: 'center', color: 'var(--danger)', padding: '40px 0' }}>{loadError}</p>
  }

  return (
    <OnboardingProvider initialData={initialData}>
      <ProfileEditorBody />
    </OnboardingProvider>
  )
}

const LOOKING_FOR = [
  { key: 'find_work', label: 'Job opportunities', icon: Briefcase },
  { key: 'find_collaborators', label: 'Collaboration', icon: UsersRound },
  { key: 'showcase_work', label: 'Freelance', icon: UserRound },
  { key: 'learn', label: 'Internship', icon: GraduationCap },
  { key: 'mentor', label: 'Mentorship', icon: MessagesSquare },
]

const SOCIALS = [
  { key: 'twitter', label: 'Twitter', icon: Twitter, placeholder: '@username' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'linkedin.com/in/username' },
  { key: 'github', label: 'GitHub', icon: Github, placeholder: 'github.com/username' },
  { key: 'dribbble', label: 'Dribbble', icon: Dribbble, placeholder: 'dribbble.com/username' },
]

const TIMEZONES = [
  '(GMT+1) West Africa Time',
  '(GMT+0) Greenwich Mean Time',
  '(GMT+2) Central European Time',
  '(GMT+3) East Africa Time',
  '(GMT-5) Eastern Time',
  '(GMT-8) Pacific Time',
]

const BIO_MAX = 200

function ProfileEditorBody() {
  const { data, update } = useOnboarding()
  const { accessToken, user, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(null) // 'photo' | 'cover' | null
  const photoRef = useRef(null)
  const coverRef = useRef(null)

  // full_name lives on the user account, not the profile, so it saves
  // through PATCH /auth/me alongside the profile PATCH below.
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [timezone, setTimezone] = useState(data.timezone || TIMEZONES[0])
  const [socials, setSocials] = useState({
    twitter: data.twitter_url || '',
    linkedin: data.linkedin_url || '',
    github: data.github_url || '',
    dribbble: data.dribbble_url || '',
  })
  const [usernameError, setUsernameError] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [addingSkill, setAddingSkill] = useState(false)
  const [portfolioInput, setPortfolioInput] = useState('')

  useEffect(() => {
    if (user?.full_name) setFullName(user.full_name)
  }, [user?.full_name])

  const locationLabel = useMemo(
    () => [data.city, data.country_label].filter(Boolean).join(', '),
    [data.city, data.country_label],
  )

  const bio = data.bio || ''
  const usernameHandle = data.username || user?.username || ''

  async function onFile(kind, e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(kind)
    try {
      const preview = URL.createObjectURL(file)
      const result = await api.uploadMedia(file, accessToken)
      update(kind === 'photo'
        ? { photo_ref: result.ref, photo_preview: preview }
        : { cover_ref: result.ref, cover_preview: preview })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(null)
      e.target.value = ''
    }
  }

  function addSkill(value) {
    const skill = value.trim()
    if (!skill || data.skills.includes(skill)) return
    update({ skills: [...data.skills, skill] })
    setSkillInput('')
  }

  function removeSkill(skill) {
    update({ skills: data.skills.filter((s) => s !== skill) })
  }

  function addPortfolioLink() {
    const trimmed = portfolioInput.trim()
    if (!trimmed || data.portfolio_links.includes(trimmed)) return
    update({ portfolio_links: [...data.portfolio_links, trimmed] })
    setPortfolioInput('')
  }

  function removePortfolioLink(link) {
    update({ portfolio_links: data.portfolio_links.filter((l) => l !== link) })
  }

  function toggleLookingFor(key) {
    const has = data.intents.includes(key)
    update({ intents: has ? data.intents.filter((k) => k !== key) : [...data.intents, key] })
  }

  async function save() {
    setError('')
    setUsernameError('')
    setSaved(false)

    const username = (data.username || '').trim()
    if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      setUsernameError('3-30 characters, letters, numbers and underscores only.')
      return
    }
    if (fullName.trim() && fullName.trim().length < 2) {
      setError('Please enter your full name.')
      return
    }

    setSaving(true)
    try {
      // PATCH /profile/me, not POST /onboarding: a partial update leaves
      // every field this screen doesn't render (hiring details, budgets,
      // interests) exactly as it was, instead of blanking them.
      const payload = toApiPayload({
        ...data,
        username,
        timezone,
        linkedin_url: socials.linkedin,
        github_url: socials.github,
        twitter_url: socials.twitter,
        dribbble_url: socials.dribbble,
      })
      // An empty handle would fail the PATCH validator (min 3 chars);
      // omitting the key just leaves the stored username untouched.
      if (!username) delete payload.username
      const updated = await api.updateProfile(payload, accessToken)

      if (fullName.trim() && fullName.trim() !== (user?.full_name || '')) {
        await api.updateAccount({ full_name: fullName.trim() }, accessToken)
        await refreshUser(accessToken)
      }

      // Re-seed from the server response so refs/urls resolved backend-side
      // (e.g. a freshly uploaded photo) replace the local blob previews.
      update({
        photo_ref: updated.photo_ref || null,
        photo_preview: updated.photo_url || null,
        cover_ref: updated.cover_ref || null,
        cover_preview: updated.cover_url || null,
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not save. Please try again.'
      if (err instanceof ApiError && err.status === 409) setUsernameError(message)
      else setError(message)
    } finally {
      setSaving(false)
    }
  }

  const suggestions = SUGGESTED_SKILLS.filter(
    (s) => !data.skills.includes(s) && s.toLowerCase().includes(skillInput.trim().toLowerCase()),
  ).slice(0, 6)

  return (
    <div className="pe">
      <header className="pe-topbar">
        <div className="pe-topbar-inner">
          <button type="button" className="pe-back" onClick={() => navigate('/home/profile')} aria-label="Back to profile">
            <ArrowLeft size={24} />
          </button>
          <h1 className="pe-title">Edit Profile</h1>
          <button type="button" className="pe-save" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={17} className="pe-spin" /> : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </header>

      <div className="pe-body">
        {error && <p className="pe-error">{error}</p>}

        {/* ── Media card ─────────────────────────────────
            Cover photos were removed from Elcoral profiles: the profile
            photo is the only image a member sets. */}
        <section className="pe-card pe-media">
          <div className="pe-avatar-row">
            <div className="pe-avatar-wrap">
              <div className="pe-avatar">
                {data.photo_preview
                  ? <img src={data.photo_preview} alt="Profile" />
                  : <UserRound size={48} />}
              </div>
              <button type="button" className="pe-avatar-btn" onClick={() => photoRef.current?.click()} aria-label="Change profile photo">
                {uploading === 'photo' ? <Loader2 size={18} className="pe-spin" /> : <Camera size={18} />}
              </button>
              <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => onFile('photo', e)} />
            </div>
            <div className="pe-avatar-copy">
              <p className="pe-avatar-title">Profile photo</p>
              <p className="pe-avatar-hint">Recommended 400 x 400px</p>
            </div>
          </div>
        </section>

        {/* ── Basic information ──────────────────────── */}
        <SectionHeading icon={UsersRound}>Basic information</SectionHeading>
        <div className="pe-stack">
          <Field label="Full name">
            <input className="pe-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </Field>

          <Field label="Username">
            <input
              className="pe-input"
              value={usernameHandle ? `@${usernameHandle}` : ''}
              onChange={(e) => { setUsernameError(''); update({ username: e.target.value.replace(/^@/, '').trim() }) }}
              placeholder="@username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {usernameError && <p className="pe-field-error">{usernameError}</p>}
            {!usernameError && (
              <p className="pe-url">elcoral.com/{usernameHandle || 'username'}</p>
            )}
          </Field>

          <Field label="Headline">
            <input
              className="pe-input"
              maxLength={120}
              value={data.headline}
              onChange={(e) => update({ headline: e.target.value })}
              placeholder="e.g. Full Stack Developer"
            />
          </Field>

          <Field
            label={<>Bio <Info size={13} className="pe-info" /></>}
            footer={<span className="pe-counter">{bio.length}/{BIO_MAX}</span>}
          >
            <textarea
              className="pe-input pe-textarea"
              rows={2}
              maxLength={BIO_MAX}
              value={bio}
              onChange={(e) => update({ bio: e.target.value })}
              placeholder="Tell people what you do and what you're looking for"
            />
          </Field>
        </div>

        {/* ── Location & Links ───────────────────────── */}
        <SectionHeading icon={MapPin}>Location &amp; Links</SectionHeading>
        <div className="pe-stack">
          <div className="pe-grid-2">
            <Field
              label="Location"
              trailing={locationLabel ? <ClearBtn onClick={() => update({ city: '', country_code: '', country_label: '' })} /> : null}
            >
              <input
                className="pe-input"
                value={locationLabel}
                onChange={(e) => update({ city: e.target.value, country_label: '' })}
                placeholder="City, Country"
              />
            </Field>

            <Field label="Timezone" trailing={<ChevronDown size={18} className="pe-chev" />}>
              <select className="pe-input pe-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
          </div>

          <Field
            label="Website"
            leading={<Link2 size={19} className="pe-lead" />}
            trailing={data.website_url ? <ClearBtn onClick={() => update({ website_url: '' })} /> : null}
          >
            <input
              className="pe-input"
              value={data.website_url}
              onChange={(e) => update({ website_url: e.target.value })}
              placeholder="https://yourwebsite.com"
            />
          </Field>

          <p className="pe-sublabel">Social links</p>
          <div className="pe-grid-2">
            {SOCIALS.map(({ key, label, icon: Icon, placeholder }) => (
              <Field
                key={key}
                label={label}
                leading={<span className="pe-social-badge"><Icon size={20} /></span>}
                trailing={socials[key] ? <ClearBtn onClick={() => setSocials({ ...socials, [key]: '' })} /> : null}
              >
                <input
                  className="pe-input"
                  value={socials[key]}
                  onChange={(e) => setSocials({ ...socials, [key]: e.target.value })}
                  placeholder={placeholder}
                />
              </Field>
            ))}
          </div>

          <p className="pe-sublabel">Portfolio links</p>
          <div className="pe-portfolio-row">
            <div className="pe-field pe-portfolio-field">
              <Globe size={19} className="pe-lead" />
              <input
                className="pe-input"
                value={portfolioInput}
                onChange={(e) => setPortfolioInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPortfolioLink() } }}
                placeholder="Add a link to your work…"
              />
            </div>
            <button type="button" className="pe-portfolio-add" onClick={addPortfolioLink} aria-label="Add portfolio link">
              <Plus size={18} />
            </button>
          </div>
          {data.portfolio_links.length > 0 && (
            <div className="pe-chips">
              {data.portfolio_links.map((link) => (
                <span className="pe-chip" key={link}>
                  {link}
                  <button type="button" onClick={() => removePortfolioLink(link)} aria-label={`Remove ${link}`}>
                    <X size={15} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Skills ─────────────────────────────────── */}
        <div className="pe-heading-row">
          <SectionHeading icon={SlidersHorizontal} bare>Skills</SectionHeading>
          <button type="button" className="pe-add-skill" onClick={() => setAddingSkill((v) => !v)}>
            <Plus size={16} /> Add skill
          </button>
        </div>

        {addingSkill && (
          <div className="pe-skill-add">
            <input
              className="pe-input pe-skill-input"
              autoFocus
              value={skillInput}
              placeholder="Type a skill and press Enter"
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) } }}
            />
            {suggestions.length > 0 && (
              <div className="pe-suggestions">
                {suggestions.map((s) => (
                  <button type="button" key={s} className="pe-suggestion" onClick={() => addSkill(s)}>{s}</button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pe-chips">
          {data.skills.length === 0 && !addingSkill && (
            <p className="pe-empty">No skills yet — add the ones you want to be found for.</p>
          )}
          {data.skills.map((skill) => (
            <span className="pe-chip" key={skill}>
              {skill}
              <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
                <X size={15} />
              </button>
            </span>
          ))}
        </div>

        {/* ── Looking for ────────────────────────────── */}
        <SectionHeading icon={Target}>Looking for</SectionHeading>
        <div className="pe-looking">
          {LOOKING_FOR.map(({ key, label, icon: Icon }) => {
            const active = data.intents.includes(key)
            return (
              <button
                type="button"
                key={key}
                className={`pe-look${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleLookingFor(key)}
              >
                <Icon size={22} className="pe-look-icon" />
                <span className="pe-look-label">{label}</span>
                <span className="pe-look-box">{active && <CheckMark />}</span>
              </button>
            )
          })}
        </div>

        {/* ── About you ──────────────────────────────── */}
        <SectionHeading icon={FileText}>About you</SectionHeading>
        <button type="button" className="pe-row" onClick={() => document.getElementById('pe-about')?.focus()}>
          <span className="pe-row-label">Tell us more about yourself</span>
          <span className="pe-row-right">Optional <ChevronRight size={18} /></span>
        </button>
        <textarea
          id="pe-about"
          className="pe-input pe-textarea pe-about"
          rows={4}
          value={data.about || ''}
          onChange={(e) => update({ about: e.target.value })}
          placeholder="Anything else people should know about you…"
        />

        {/* ── Availability ───────────────────────────── */}
        <SectionHeading icon={Clock}>Availability</SectionHeading>
        <div className="pe-avail-options">
          {AVAILABILITY_OPTIONS.map(({ key, label }) => {
            const active = data.availability_status === key
            return (
              <button
                type="button"
                key={key}
                className={`pe-avail-option${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => update({ availability_status: active ? '' : key })}
              >
                <span className="pe-avail-dot" aria-hidden="true" />
                {label}
              </button>
            )
          })}
        </div>
        <Field label="Availability note" footer={<span className="pe-counter">{(data.availability_note || '').length}/120</span>}>
          <input
            className="pe-input"
            maxLength={120}
            value={data.availability_note || ''}
            onChange={(e) => update({ availability_note: e.target.value })}
            placeholder="e.g. Usually replies within 15 mins"
          />
        </Field>
      </div>

      <style>{`
        .pe {
          margin: -24px -20px calc(-88px - env(safe-area-inset-bottom));
          background: var(--bg);
          min-height: 100vh;
        }
        .pe-spin { animation: pe-spin 0.8s linear infinite; }
        @keyframes pe-spin { to { transform: rotate(360deg); } }

        /* Topbar */
        .pe-topbar {
          position: sticky; top: 0; z-index: 20;
          background: rgba(var(--bg-rgb), 0.94);
          backdrop-filter: blur(14px);
          padding-top: env(safe-area-inset-top);
        }
        .pe-topbar-inner {
          display: grid; grid-template-columns: 40px 1fr 40px;
          align-items: center; gap: 8px;
          max-width: 640px; margin: 0 auto;
          padding: 14px 16px 12px;
        }
        .pe-back { display: flex; align-items: center; color: var(--ink); }
        @media (hover: hover) and (pointer: fine) { .pe-back:hover { color: var(--accent-ink); } }
        .pe-title {
          margin: 0; text-align: center;
          font-family: var(--font-head); font-size: 21px; font-weight: 700;
          letter-spacing: -0.01em; color: var(--ink);
        }
        .pe-save {
          justify-self: end; display: inline-flex; align-items: center;
          font-family: var(--font-head); font-size: 17px; font-weight: 600;
          color: var(--accent-ink); white-space: nowrap;
        }
        .pe-save:disabled { opacity: 0.6; }

        .pe-body {
          max-width: 640px; margin: 0 auto;
          padding: 4px 16px calc(96px + env(safe-area-inset-bottom));
        }
        .pe-error {
          margin: 0 0 12px; padding: 10px 14px; border-radius: 10px;
          background: rgba(255, 107, 74, 0.12); border: 1px solid rgba(255, 107, 74, 0.35);
          color: var(--danger); font-size: 13.5px;
        }

        /* Media card */
        .pe-card {
          background: var(--field); border: 1px solid var(--field-border);
          border-radius: 16px; padding: 14px;
        }
        .pe-media { margin-bottom: 22px; }
        .pe-cover {
          display: block; width: 100%; aspect-ratio: 16 / 6.4;
          border: 1px dashed rgba(196, 241, 53, 0.38);
          border-radius: 12px; overflow: hidden;
          background-color: var(--field);
          background-size: cover; background-position: center;
          background-image:
            radial-gradient(120% 150% at 50% 120%, rgba(196, 241, 53, 0.14), transparent 62%),
            repeating-linear-gradient(78deg, rgba(196, 241, 53, 0.09) 0 1px, transparent 1px 7px);
          color: var(--accent-ink);
        }
        @media (hover: hover) and (pointer: fine) { .pe-cover:hover { border-color: var(--accent-ink); } }
        .pe-cover-inner {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 6px; height: 100%; padding: 10px;
        }
        .pe-cover-title {
          font-family: var(--font-body); font-size: 15px; font-weight: 600; color: var(--ink);
        }
        .pe-cover-hint { font-size: 12px; color: var(--ink-faint); }

        .pe-avatar-row {
          display: flex; align-items: center; gap: 16px;
          margin-top: -46px; padding-left: 2px;
        }
        .pe-avatar-wrap { position: relative; flex: 0 0 auto; }
        .pe-avatar {
          width: 108px; height: 108px; border-radius: 50%;
          background: var(--panel-raised); border: 3px solid var(--field);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; color: var(--ink-faint);
        }
        .pe-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .pe-avatar-btn {
          position: absolute; right: -4px; bottom: 4px;
          width: 40px; height: 40px; border-radius: 50%;
          background: var(--field); border: 1.5px solid var(--lemon);
          display: flex; align-items: center; justify-content: center;
          color: var(--accent-ink);
        }
        @media (hover: hover) and (pointer: fine) { .pe-avatar-btn:hover { background: rgba(196, 241, 53, 0.12); } }
        .pe-avatar-copy { padding-top: 42px; min-width: 0; }
        .pe-avatar-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--ink); }
        .pe-avatar-hint { margin: 3px 0 0; font-size: 12.5px; color: var(--ink-faint); }

        /* Section heading */
        .pe-section-head {
          display: flex; align-items: center; gap: 10px;
          margin: 26px 0 12px;
        }
        .pe-section-head svg { color: var(--accent-ink); flex: 0 0 auto; }
        .pe-section-head h2 {
          margin: 0; font-family: var(--font-head);
          font-size: 18.5px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink);
        }
        .pe-heading-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          margin: 26px 0 12px;
        }
        .pe-heading-row .pe-section-head { margin: 0; }
        .pe-add-skill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 16px; border-radius: 999px;
          border: 1px solid rgba(196, 241, 53, 0.5);
          color: var(--accent-ink); font-size: 14px; font-weight: 600;
        }
        @media (hover: hover) and (pointer: fine) { .pe-add-skill:hover { background: rgba(196, 241, 53, 0.1); } }

        /* Fields */
        .pe-stack { display: flex; flex-direction: column; gap: 10px; }
        .pe-field {
          position: relative; display: flex; align-items: center; gap: 12px;
          background: var(--field); border: 1px solid var(--field-border);
          border-radius: 12px; padding: 11px 14px;
          transition: border-color 0.15s ease;
        }
        .pe-field:focus-within { border-color: rgba(196, 241, 53, 0.55); }
        .pe-field-main { flex: 1 1 auto; min-width: 0; }
        .pe-label {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; color: var(--ink-faint); margin-bottom: 2px;
        }
        .pe-info { color: var(--ink-faint); }
        .pe-input {
          width: 100%; background: transparent; border: none; padding: 0;
          font-family: var(--font-body); font-size: 16px; color: var(--ink);
          line-height: 1.45;
        }
        .pe-input::placeholder { color: var(--field-placeholder); }
        .pe-input:focus { outline: none; }
        .pe-textarea { resize: vertical; min-height: 46px; }
        .pe-select { appearance: none; }
        .pe-select option { background: var(--panel); color: var(--ink); }
        .pe-chev, .pe-lead { color: var(--ink-faint); flex: 0 0 auto; }
        .pe-clear { display: flex; color: var(--ink-dim); flex: 0 0 auto; padding: 4px; }
        @media (hover: hover) and (pointer: fine) { .pe-clear:hover { color: var(--ink); } }
        .pe-url {
          margin: 6px 0 0; font-size: 12.5px; color: var(--ink-faint);
        }
        .pe-counter {
          display: block; text-align: right;
          font-size: 12.5px; color: var(--ink-faint); margin-top: 6px;
        }
        .pe-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .pe-sublabel { margin: 16px 0 8px; font-size: 13.5px; color: var(--ink-dim); }
        .pe-social-badge {
          width: 40px; height: 40px; border-radius: 50%;
          background: var(--ink); color: var(--bg);
          display: flex; align-items: center; justify-content: center; flex: 0 0 auto;
        }
        .pe-portfolio-row { display: flex; gap: 8px; }
        .pe-portfolio-field { flex: 1 1 auto; }
        .pe-portfolio-add {
          width: 46px; flex-shrink: 0; border-radius: 12px;
          background: var(--field); border: 1px solid var(--field-border);
          color: var(--ink-dim);
          display: flex; align-items: center; justify-content: center;
        }
        @media (hover: hover) and (pointer: fine) { .pe-portfolio-add:hover { border-color: var(--accent-ink); color: var(--accent-ink); } }

        /* Skills */
        .pe-skill-add { margin-bottom: 12px; }
        .pe-skill-input {
          background: var(--field); border: 1px solid var(--field-border);
          border-radius: 12px; padding: 12px 14px;
        }
        .pe-suggestions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .pe-suggestion {
          padding: 7px 13px; border-radius: 999px;
          border: 1px dashed var(--border); color: var(--ink-dim); font-size: 13.5px;
        }
        @media (hover: hover) and (pointer: fine) { .pe-suggestion:hover { border-color: var(--accent-ink); color: var(--accent-ink); } }
        .pe-chips { display: flex; flex-wrap: wrap; gap: 9px; }
        .pe-empty { margin: 0; font-size: 13.5px; color: var(--ink-faint); }
        .pe-chip {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 9px 14px; border-radius: 999px;
          background: var(--field); border: 1px solid var(--field-border);
          font-size: 14.5px; color: var(--ink);
        }
        .pe-chip button { display: flex; color: var(--ink-dim); }
        @media (hover: hover) and (pointer: fine) { .pe-chip button:hover { color: var(--danger); } }

        /* Looking for */
        .pe-looking {
          display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 9px;
        }
        .pe-look {
          display: flex; flex-direction: column; align-items: center; gap: 9px;
          padding: 14px 6px 12px; border-radius: 12px;
          background: var(--field); border: 1px solid var(--field-border);
          text-align: center; transition: border-color 0.15s ease, background 0.15s ease;
        }
        .pe-look-icon { color: var(--ink-dim); }
        .pe-look-label { font-size: 11.5px; line-height: 1.25; color: var(--ink-dim); }
        .pe-look-box {
          width: 18px; height: 18px; border-radius: 4px;
          border: 1.5px solid var(--border); display: flex; align-items: center; justify-content: center;
        }
        .pe-look.is-active { border-color: var(--accent-ink); background: rgba(196, 241, 53, 0.05); }
        .pe-look.is-active .pe-look-icon { color: var(--accent-ink); }
        .pe-look.is-active .pe-look-label { color: var(--ink); }
        .pe-look.is-active .pe-look-box { background: var(--lemon); border-color: var(--accent-ink); }

        /* About you */
        .pe-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          width: 100%; padding: 16px 14px; border-radius: 12px;
          background: var(--field); border: 1px solid var(--field-border);
        }
        @media (hover: hover) and (pointer: fine) { .pe-row:hover { border-color: rgba(196, 241, 53, 0.4); } }
        .pe-row-label { font-size: 15.5px; color: var(--ink); }
        .pe-row-right {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13.5px; color: var(--ink-faint);
        }
        .pe-about {
          margin-top: 10px; background: var(--field); border: 1px solid var(--field-border);
          border-radius: 12px; padding: 12px 14px;
        }

        /* Availability */
        .pe-avail-options { display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 12px; }
        .pe-avail-option {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 16px; border-radius: 999px;
          background: var(--field); border: 1px solid var(--field-border);
          font-size: 14px; color: var(--ink-dim);
        }
        .pe-avail-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          background: var(--ink-faint);
        }
        .pe-avail-option.is-active {
          border-color: var(--accent-ink); color: var(--ink); background: rgba(196, 241, 53, 0.05);
        }
        .pe-avail-option.is-active .pe-avail-dot { background: var(--lemon); }

        @media (max-width: 400px) {
          .pe-looking { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .pe-avatar { width: 92px; height: 92px; }
          .pe-avatar-copy { padding-top: 40px; }
        }
        @media (min-width: 860px) {
          .pe { margin: -32px -40px 0; }
          .pe-body { padding-bottom: 60px; }
        }
      `}</style>
    </div>
  )
}

function SectionHeading({ icon: Icon, children, bare = false }) {
  return (
    <div className="pe-section-head" style={bare ? { margin: 0 } : undefined}>
      <Icon size={21} />
      <h2>{children}</h2>
    </div>
  )
}

function Field({ label, children, leading = null, trailing = null, footer = null }) {
  return (
    <div className="pe-field">
      {leading}
      <div className="pe-field-main">
        <span className="pe-label">{label}</span>
        {children}
        {footer}
      </div>
      {trailing}
    </div>
  )
}

function ClearBtn({ onClick }) {
  return (
    <button type="button" className="pe-clear" onClick={onClick} aria-label="Clear field">
      <X size={18} />
    </button>
  )
}

function CheckMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
