import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useOnboarding, SUGGESTED_SKILLS } from '../OnboardingContext.jsx'
import StepShell from '../StepShell.jsx'

export default function SkillsStep({ progress, onNext, onBack }) {
  const { data, update } = useOnboarding()
  const [query, setQuery] = useState('')

  const suggestions = SUGGESTED_SKILLS.filter(
    (s) => !data.skills.includes(s) && s.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8)

  function addSkill(skill) {
    const trimmed = skill.trim()
    if (!trimmed || data.skills.includes(trimmed)) return
    update({ skills: [...data.skills, trimmed] })
    setQuery('')
  }

  function removeSkill(skill) {
    update({ skills: data.skills.filter((s) => s !== skill) })
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault()
      addSkill(query)
    }
  }

  return (
    <StepShell
      eyebrow="Step 4 of 9"
      title="What are your skills?"
      subtitle="Search or type your own \u2014 you can always add more later."
      progress={progress}
      onBack={onBack}
      onNext={onNext}
    >
      <div className="skills-input-wrap">
        <input
          className="skills-input"
          placeholder="Search skills or type your own\u2026"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {query.trim() && (
          <button type="button" className="skills-add-btn" onClick={() => addSkill(query)}>
            <Plus size={16} /> Add "{query.trim()}"
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="skills-suggestions">
          {suggestions.map((s) => (
            <button type="button" key={s} className="skill-suggestion" onClick={() => addSkill(s)}>
              <Plus size={13} /> {s}
            </button>
          ))}
        </div>
      )}

      {data.skills.length > 0 && (
        <div className="skills-selected">
          {data.skills.map((s) => (
            <span className="skill-tag" key={s}>
              {s}
              <button type="button" onClick={() => removeSkill(s)} aria-label={`Remove ${s}`}>
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      <style>{`
        .skills-input-wrap { position: relative; }
        .skills-input {
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 15px;
          color: var(--ink);
          font-family: var(--font-body);
        }
        .skills-input:focus { outline: none; border-color: var(--lemon); }
        .skills-add-btn {
          display: flex; align-items: center; gap: 6px;
          margin-top: 8px;
          font-size: 13.5px;
          color: var(--lemon);
          font-weight: 500;
        }
        .skills-suggestions {
          display: flex; flex-wrap: wrap; gap: 8px;
          margin-top: 14px;
        }
        .skill-suggestion {
          display: flex; align-items: center; gap: 5px;
          font-size: 13px;
          color: var(--ink-dim);
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 7px 12px;
        }
        .skill-suggestion:hover { border-color: var(--lemon); color: var(--ink); }
        .skills-selected {
          display: flex; flex-wrap: wrap; gap: 8px;
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid var(--border);
        }
        .skill-tag {
          display: flex; align-items: center; gap: 7px;
          font-size: 13.5px;
          font-weight: 500;
          color: var(--ink);
          background: rgba(196, 241, 53, 0.12);
          border: 1px solid var(--lemon);
          border-radius: 999px;
          padding: 7px 8px 7px 13px;
        }
        .skill-tag button { color: var(--ink-dim); display: flex; }
        .skill-tag button:hover { color: var(--danger); }
      `}</style>
    </StepShell>
  )
}
