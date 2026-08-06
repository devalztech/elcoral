import { Globe } from 'lucide-react'
import { useOnboarding } from '../OnboardingContext.jsx'
import { api } from '../../lib/api.js'
import StepShell from '../StepShell.jsx'
import Typeahead from '../Typeahead.jsx'

export default function LocationStep({ progress, onNext, onBack }) {
  const { data, update } = useOnboarding()

  function onSelectCountry(country) {
    // Changing country invalidates any previously picked city.
    update({ country_code: country.code, country_label: country.name, city: '' })
  }

  function onSelectCity(city) {
    update({ city: city.name })
  }

  return (
    <StepShell
      eyebrow="Step 7 of 9"
      title="Where are you based?"
      subtitle="Helps people find collaborators nearby \u2014 or mark yourself as fully remote."
      progress={progress}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!data.country_code}
    >
      <div className="location-fields">
        <div className="location-field">
          <label className="location-label">Country</label>
          <Typeahead
            placeholder="Search for your country\u2026"
            initialValue={data.country_label}
            fetchResults={api.searchCountries}
            getKey={(c) => c.code}
            getLabel={(c) => c.name}
            onSelect={onSelectCountry}
            renderOption={(c) => (
              <>
                {c.flag && <img src={c.flag} alt="" className="flag-icon" />}
                {c.name}
              </>
            )}
          />
        </div>

        <div className="location-field">
          <label className="location-label">City</label>
          <Typeahead
            key={data.country_code}
            placeholder={data.country_code ? 'Search for your city\u2026' : 'Pick a country first'}
            initialValue={data.city}
            fetchResults={(q) => api.searchCities(q, data.country_code)}
            getKey={(c) => c.geonameId}
            getLabel={(c) => c.name}
            onSelect={onSelectCity}
          />
        </div>

        <label className="remote-toggle">
          <input
            type="checkbox"
            checked={data.is_remote}
            onChange={(e) => update({ is_remote: e.target.checked })}
          />
          <Globe size={16} />
          <span>I work remotely / location doesn't matter</span>
        </label>
      </div>

      <style>{`
        .location-fields { display: flex; flex-direction: column; gap: 20px; }
        .location-label {
          display: block;
          font-family: var(--font-head);
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-dim);
          margin-bottom: 7px;
        }
        .flag-icon { width: 20px; height: 14px; object-fit: cover; border-radius: 2px; }
        .remote-toggle {
          display: flex; align-items: center; gap: 10px;
          font-size: 14px; color: var(--ink-dim);
          padding: 12px 14px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
        }
        .remote-toggle input { accent-color: var(--lemon); width: 16px; height: 16px; }
      `}</style>
    </StepShell>
  )
}
