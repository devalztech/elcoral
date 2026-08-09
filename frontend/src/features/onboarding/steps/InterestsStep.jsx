import { useOnboarding, SUGGESTED_INTERESTS } from '../OnboardingContext.jsx'
import StepShell from '../components/StepShell.jsx'

export default function InterestsStep({ progress, onNext, onBack, nextLoading }) {
  const { data, update } = useOnboarding()

  function toggle(interest) {
    const has = data.interests.includes(interest)
    update({ interests: has ? data.interests.filter((i) => i !== interest) : [...data.interests, interest] })
  }

  return (
    <StepShell
      eyebrow="Last step"
      title="What are you interested in?"
      subtitle="This shapes what shows up in your feed. Optional, but recommended."
      progress={progress}
      onBack={onBack}
      onNext={onNext}
      nextLabel="Finish setting up"
      nextLoading={nextLoading}
    >
      <div className="interest-chips">
        {SUGGESTED_INTERESTS.map((interest) => {
          const isSelected = data.interests.includes(interest)
          return (
            <button
              type="button"
              key={interest}
              className={`interest-chip ${isSelected ? 'interest-chip-selected' : ''}`}
              onClick={() => toggle(interest)}
            >
              {interest}
            </button>
          )
        })}
      </div>
      <style>{`
        .interest-chips { display: flex; flex-wrap: wrap; gap: 10px; }
        .interest-chip {
          font-family: var(--font-head);
          font-size: 14px;
          font-weight: 500;
          color: var(--ink-dim);
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 10px 18px;
        }
        @media (hover: hover) and (pointer: fine) { .interest-chip:hover { border-color: var(--ink-faint); } }
        .interest-chip-selected { background: rgba(196,241,53,0.12); border-color: var(--accent-ink); color: var(--ink); }
      `}</style>
    </StepShell>
  )
}
