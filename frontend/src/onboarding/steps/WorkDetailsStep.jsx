import { useOnboarding } from '../OnboardingContext.jsx'
import { api } from '../../lib/api.js'
import StepShell from '../StepShell.jsx'
import FormField, { TextInput } from '../../components/FormField.jsx'
import Typeahead from '../Typeahead.jsx'

const COMPANY_SIZES = [
  { key: 'solo', label: 'Just me' },
  { key: 'small', label: '2\u201310 people' },
  { key: 'medium', label: '11\u201350 people' },
  { key: 'large', label: '50+ people' },
]

// This step only renders fields relevant to intents the person actually
// picked in IntentsStep — someone who only wants to learn or network
// never sees rate/hiring fields at all, and the wizard skips this step
// entirely if neither applies (see OnboardingWizard.jsx's step list).
export default function WorkDetailsStep({ progress, onNext, onBack }) {
  const { data, update } = useOnboarding()
  const showRate = data.intents.includes('find_work')
  const showHiring = data.intents.includes('hire')

  return (
    <StepShell
      eyebrow="Step 9 of 9"
      title="A couple more details"
      subtitle="This helps the right people find you."
      progress={progress}
      onBack={onBack}
      onNext={onNext}
    >
      {showRate && (
        <FormField label="Hourly rate (USD)">
          <TextInput
            type="number"
            min="1"
            placeholder="e.g. 35"
            value={data.hourly_rate}
            onChange={(e) => update({ hourly_rate: e.target.value })}
          />
        </FormField>
      )}

      {showHiring && (
        <>
          <FormField label="Company name">
            <Typeahead
              placeholder="Search for your company…"
              initialValue={data.company_name}
              fetchResults={api.searchCompanies}
              getKey={(c) => c.domain || c.name}
              getLabel={(c) => c.name}
              onSelect={(c) => update({ company_name: c.name })}
              renderOption={(c) => (
                <>
                  {c.logo && <img src={c.logo} alt="" className="company-logo" />}
                  {c.name}
                </>
              )}
            />
          </FormField>

          <FormField label="What are you hiring for?">
            <TextInput
              placeholder="e.g. Backend developer for a 3-month project"
              value={data.hiring_for}
              onChange={(e) => update({ hiring_for: e.target.value })}
            />
          </FormField>

          <div className="size-field">
            <label className="size-label">Company size</label>
            <div className="size-options">
              {COMPANY_SIZES.map((s) => (
                <button
                  type="button"
                  key={s.key}
                  className={`size-chip ${data.company_size === s.key ? 'size-chip-selected' : ''}`}
                  onClick={() => update({ company_size: s.key })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="budget-row">
            <FormField label="Budget min (USD)">
              <TextInput
                type="number"
                min="0"
                value={data.budget_min}
                onChange={(e) => update({ budget_min: e.target.value })}
              />
            </FormField>
            <FormField label="Budget max (USD)">
              <TextInput
                type="number"
                min="0"
                value={data.budget_max}
                onChange={(e) => update({ budget_max: e.target.value })}
              />
            </FormField>
          </div>
        </>
      )}

      <style>{`
        .company-logo { width: 20px; height: 20px; border-radius: 4px; object-fit: contain; }
        .size-field { margin-bottom: 18px; }
        .size-label {
          display: block;
          font-family: var(--font-head);
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-dim);
          margin-bottom: 7px;
        }
        .size-options { display: flex; flex-wrap: wrap; gap: 8px; }
        .size-chip {
          font-size: 13.5px;
          color: var(--ink-dim);
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 9px 16px;
        }
        .size-chip-selected { background: rgba(196,241,53,0.12); border-color: var(--accent-ink); color: var(--ink); }
        .budget-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      `}</style>
    </StepShell>
  )
}
