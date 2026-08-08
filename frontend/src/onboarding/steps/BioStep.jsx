import { useOnboarding } from '../OnboardingContext.jsx'
import StepShell from '../StepShell.jsx'
import FormField, { TextInput } from '../../components/FormField.jsx'

const BIO_MAX = 2000

export default function BioStep({ progress, onNext, onBack }) {
  const { data, update } = useOnboarding()

  return (
    <StepShell
      eyebrow="Step 8 of 9"
      title="Tell people about yourself"
      subtitle="A short headline and a bio — both optional, both worth filling in."
      progress={progress}
      onBack={onBack}
      onNext={onNext}
    >
      <FormField label="Headline">
        <TextInput
          placeholder="e.g. Backend developer passionate about scalable APIs"
          maxLength={120}
          value={data.headline}
          onChange={(e) => update({ headline: e.target.value })}
        />
      </FormField>

      <div className="bio-field">
        <label className="bio-label">Bio</label>
        <textarea
          className="bio-textarea"
          placeholder="Share your background, what you're working on, and what you're looking for…"
          maxLength={BIO_MAX}
          rows={6}
          value={data.bio}
          onChange={(e) => update({ bio: e.target.value })}
        />
        <span className="bio-counter">{data.bio.length} / {BIO_MAX}</span>
      </div>

      <style>{`
        .bio-field { margin-top: 4px; }
        .bio-label {
          display: block;
          font-family: var(--font-head);
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-dim);
          margin-bottom: 7px;
        }
        .bio-textarea {
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 15px;
          color: var(--ink);
          font-family: var(--font-body);
          resize: vertical;
          min-height: 120px;
        }
        .bio-textarea:focus { outline: none; border-color: var(--accent-ink); }
        .bio-textarea::placeholder { color: var(--ink-faint); }
        .bio-counter {
          display: block;
          text-align: right;
          font-size: 12px;
          color: var(--ink-faint);
          margin-top: 6px;
        }
      `}</style>
    </StepShell>
  )
}
