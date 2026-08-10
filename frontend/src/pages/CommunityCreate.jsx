import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Users } from 'lucide-react'
import FormField, { TextInput } from '../components/FormField.jsx'
import { useAuth } from '../features/auth/hooks/useAuth.jsx'
import { api } from '../api/client.js'

export default function CommunityCreate() {
  const navigate = useNavigate()
  const { accessToken, authLoading, user } = useAuth()

  const [options, setOptions] = useState(null)
  const [optionsError, setOptionsError] = useState(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [topic, setTopic] = useState('other')
  const [tone, setTone] = useState('dark')
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .communityOptions()
      .then((o) => {
        setOptions(o)
        if (o.topics?.length) setTopic(o.topics[0])
        if (o.tones?.length) setTone(o.tones[0])
      })
      .catch((err) => setOptionsError(err.message))
  }, [])

  useEffect(() => {
    if (!authLoading && !accessToken) navigate('/login')
  }, [authLoading, accessToken, navigate])

  async function submit(e) {
    e.preventDefault()
    if (name.trim().length < 3) {
      setError('Give your community a name (at least 3 characters).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const community = await api.createCommunity(
        {
          name: name.trim(),
          description: description.trim() || null,
          topic,
          tone,
          glyph: null,
          icon_ref: null,
          cover_ref: null,
          is_private: isPrivate,
        },
        accessToken,
      )
      navigate(`/home/community/${community.slug}`, { replace: true })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (authLoading || !user) return null

  return (
    <div className="cc">
      <header className="cc-bar">
        <button type="button" className="cc-icon-btn" aria-label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <h1 className="cc-bar-title">New community</h1>
      </header>

      {optionsError && <p className="cc-error">Couldn't load community options: {optionsError}</p>}

      <form className="cc-form" onSubmit={submit}>
        <FormField label="Name">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. React Developers"
            maxLength={80}
            autoFocus
          />
        </FormField>

        <FormField label="Description (optional)">
          <textarea
            className="cc-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this community about?"
            rows={4}
            maxLength={300}
          />
        </FormField>

        {options && (
          <>
            <FormField label="Topic">
              <select className="cc-select" value={topic} onChange={(e) => setTopic(e.target.value)}>
                {options.topics.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Tone">
              <div className="cc-tone-grid">
                {options.tones.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`cc-tone-swatch tone-${t} ${tone === t ? 'on' : ''}`}
                    aria-pressed={tone === t ? 'true' : 'false'}
                    onClick={() => setTone(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </FormField>
          </>
        )}

        <div className="cc-privacy-row">
          <button
            type="button"
            className={`cc-privacy-opt ${!isPrivate ? 'on' : ''}`}
            aria-pressed={!isPrivate ? 'true' : 'false'}
            onClick={() => setIsPrivate(false)}
          >
            <Users size={18} strokeWidth={1.9} />
            <span>
              <strong>Public</strong>
              <small>Anyone can find and join</small>
            </span>
          </button>
          <button
            type="button"
            className={`cc-privacy-opt ${isPrivate ? 'on' : ''}`}
            aria-pressed={isPrivate ? 'true' : 'false'}
            onClick={() => setIsPrivate(true)}
          >
            <Lock size={18} strokeWidth={1.9} />
            <span>
              <strong>Private</strong>
              <small>Members only, by invite</small>
            </span>
          </button>
        </div>

        {error && <p className="cc-error">{error}</p>}

        <button type="submit" className="cc-submit" disabled={saving}>
          {saving ? 'Creating…' : 'Create community'}
        </button>
      </form>

      <style>{`
        .cc { --gut: 20px; margin: -24px -20px 0; padding-bottom: 40px; }
        @media (min-width: 860px) { .cc { margin: -32px -40px 0; --gut: 40px; } }

        .cc-bar {
          position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 6px;
          padding: 14px var(--gut) 8px; background: color-mix(in srgb, var(--bg) 92%, transparent);
          backdrop-filter: blur(14px);
        }
        .cc-icon-btn {
          width: 38px; height: 38px; border-radius: 999px; flex: none;
          display: inline-flex; align-items: center; justify-content: center; color: var(--ink);
        }
        .cc-icon-btn:hover { background: var(--panel); color: var(--accent-ink); }
        .cc-bar-title { margin: 0 0 0 4px; font-family: var(--font-head); font-weight: 700; font-size: 17px; color: var(--ink); }

        .cc-form { padding: 12px var(--gut) 0; display: flex; flex-direction: column; gap: 16px; max-width: 520px; }

        .cc-textarea, .cc-select {
          width: 100%; background: var(--field); border: 1px solid var(--field-border); border-radius: 8px;
          padding: 12px 14px; font-size: 15px; color: var(--ink); font-family: var(--font-body);
        }
        .cc-textarea { resize: vertical; }
        .cc-textarea:focus, .cc-select:focus { outline: none; border-color: var(--accent-ink); }

        .cc-tone-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .cc-tone-swatch {
          padding: 9px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; text-transform: capitalize;
          border: 1px solid var(--border); color: var(--ink-dim); background: var(--panel);
        }
        .cc-tone-swatch.on { border-color: var(--lemon); color: var(--accent-ink); background: color-mix(in srgb, var(--lemon) 14%, transparent); }

        .cc-privacy-row { display: flex; gap: 10px; }
        .cc-privacy-opt {
          flex: 1; display: flex; align-items: center; gap: 10px; padding: 13px 14px;
          border-radius: 14px; border: 1px solid var(--border); background: var(--panel); text-align: left;
          color: var(--ink-dim);
        }
        .cc-privacy-opt.on { border-color: var(--lemon); color: var(--ink); background: color-mix(in srgb, var(--lemon) 8%, var(--panel)); }
        .cc-privacy-opt strong { display: block; font-family: var(--font-head); font-size: 14px; color: var(--ink); }
        .cc-privacy-opt small { display: block; font-size: 12px; color: var(--ink-faint); margin-top: 1px; }

        .cc-error { margin: 0; font-size: 13.5px; color: var(--danger); }

        .cc-submit {
          margin-top: 4px; padding: 13px; border-radius: 12px; background: var(--lemon); color: var(--on-accent);
          font-family: var(--font-head); font-weight: 700; font-size: 15px;
        }
        .cc-submit:disabled { opacity: .6; }
        .cc-submit:not(:disabled):active { transform: scale(.98); }
      `}</style>
    </div>
  )
}
