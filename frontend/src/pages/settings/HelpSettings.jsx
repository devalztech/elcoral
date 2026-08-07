import { useState } from 'react'
import { ChevronDown, Mail } from 'lucide-react'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'

const FAQS = [
  {
    q: 'How do I change my username?',
    a: 'Settings → Edit profile. Usernames are unique, so the editor checks availability as you type. Your old profile link stops working once you change it.',
  },
  {
    q: 'Why is my profile not showing up?',
    a: 'Check Settings → Privacy settings. If "Public profile" is off, only you can open your profile link.',
  },
  {
    q: "I didn't get my verification email",
    a: 'Open Settings → Account verification and resend it. Check your spam folder — and that the address on your account is the one you actually use.',
  },
  {
    q: 'How does blocking work?',
    a: "Blocking works both ways: they can't see your profile and you won't see theirs. You can undo it any time from Settings → Blocked users.",
  },
  {
    q: 'Can I get my data?',
    a: 'Yes — Settings → Data & privacy downloads everything Elcoral holds about you as a JSON file.',
  },
  {
    q: 'How do I delete my account?',
    a: "Settings → Account, at the bottom. You'll be asked for your password, and the deletion is permanent.",
  },
]

export default function HelpSettings() {
  const [open, setOpen] = useState(null)

  return (
    <SettingsSubpage title="Help center">
      <p className="set-intro">The questions we get asked most. Still stuck? Email us.</p>

      {FAQS.map((faq, i) => (
        <div className="faq" key={faq.q}>
          <button
            type="button"
            className="faq-q"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span>{faq.q}</span>
            <ChevronDown size={17} className={`faq-chev ${open === i ? 'faq-chev-open' : ''}`} />
          </button>
          {open === i && <p className="faq-a">{faq.a}</p>}
        </div>
      ))}

      <a className="help-contact" href="mailto:support@elcoral.com">
        <Mail size={17} /> Email support
      </a>

      <style>{`
        .faq { border-bottom: 1px solid var(--border); }
        .faq-q {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          width: 100%; text-align: left; padding: 15px 0;
          font-size: 14.5px; font-weight: 600; color: var(--ink);
        }
        .faq-chev { color: var(--ink-faint); transition: transform 0.15s ease; flex-shrink: 0; }
        .faq-chev-open { transform: rotate(180deg); }
        .faq-a { margin: 0 0 15px; font-size: 13.5px; color: var(--ink-dim); line-height: 1.65; }
        .help-contact {
          display: inline-flex; align-items: center; gap: 8px; margin-top: 22px;
          font-size: 13.5px; font-weight: 700; color: var(--bg); background: var(--lemon);
          padding: 11px 17px; border-radius: 999px;
        }
      `}</style>
    </SettingsSubpage>
  )
}
