import { Github, Linkedin, Globe, Send, Link2, X, Plus } from 'lucide-react'
import { useState } from 'react'
import { useOnboarding } from '../OnboardingContext.jsx'
import StepShell from '../StepShell.jsx'

export default function LinksStep({ progress, onNext, onBack }) {
  const { data, update } = useOnboarding()
  const [portfolioInput, setPortfolioInput] = useState('')

  function addPortfolioLink() {
    const trimmed = portfolioInput.trim()
    if (!trimmed || data.portfolio_links.includes(trimmed)) return
    update({ portfolio_links: [...data.portfolio_links, trimmed] })
    setPortfolioInput('')
  }

  function removePortfolioLink(link) {
    update({ portfolio_links: data.portfolio_links.filter((l) => l !== link) })
  }

  return (
    <StepShell
      eyebrow="Optional"
      title="Link your work"
      subtitle="All optional — add what's relevant."
      progress={progress}
      onBack={onBack}
      onNext={onNext}
    >
      <div className="links-list">
        <LinkField
          icon={<Github size={17} />}
          placeholder="github.com/username"
          value={data.github_url}
          onChange={(v) => update({ github_url: v })}
        />
        <LinkField
          icon={<Linkedin size={17} />}
          placeholder="linkedin.com/in/username"
          value={data.linkedin_url}
          onChange={(v) => update({ linkedin_url: v })}
        />
        <LinkField
          icon={<Globe size={17} />}
          placeholder="yourwebsite.com"
          value={data.website_url}
          onChange={(v) => update({ website_url: v })}
        />
        <LinkField
          icon={<Send size={17} />}
          placeholder="@telegram_handle"
          value={data.telegram_handle}
          onChange={(v) => update({ telegram_handle: v })}
        />
      </div>

      <div className="portfolio-section">
        <label className="portfolio-label">Portfolio links</label>
        <div className="portfolio-input-row">
          <div className="link-field-wrap">
            <Link2 size={17} className="link-icon" />
            <input
              className="link-input"
              placeholder="Add a link to your work…"
              value={portfolioInput}
              onChange={(e) => setPortfolioInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPortfolioLink())}
            />
          </div>
          <button type="button" className="portfolio-add" onClick={addPortfolioLink}>
            <Plus size={16} />
          </button>
        </div>

        {data.portfolio_links.length > 0 && (
          <ul className="portfolio-list">
            {data.portfolio_links.map((link) => (
              <li key={link}>
                <span>{link}</span>
                <button type="button" onClick={() => removePortfolioLink(link)} aria-label="Remove">
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .links-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
        .portfolio-label {
          display: block;
          font-family: var(--font-head);
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-dim);
          margin-bottom: 7px;
        }
        .portfolio-input-row { display: flex; gap: 8px; }
        .portfolio-add {
          width: 46px; flex-shrink: 0;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--ink-dim);
          display: flex; align-items: center; justify-content: center;
        }
        .portfolio-add:hover { border-color: var(--accent-ink); color: var(--accent-ink); }
        .portfolio-list { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .portfolio-list li {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13.5px;
          color: var(--ink-dim);
        }
        .portfolio-list button { color: var(--ink-faint); }
        .portfolio-list button:hover { color: var(--danger); }
      `}</style>
    </StepShell>
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
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
          flex: 1;
        }
        .link-field-wrap:focus-within { border-color: var(--accent-ink); }
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
