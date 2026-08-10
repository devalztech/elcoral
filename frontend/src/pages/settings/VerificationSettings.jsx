import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, CircleAlert, Mail, UserCheck } from 'lucide-react'
import { useAuth } from '../../features/auth/hooks/useAuth.jsx'
import { api } from '../../api/client.js'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'
import Spinner from '../../components/Spinner.jsx'

export default function VerificationSettings() {
  const { accessToken, authLoading } = useAuth()
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [resent, setResent] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (authLoading || !accessToken) return
    let cancelled = false
    api
      .getVerificationStatus(accessToken)
      .then((s) => { if (!cancelled) setStatus(s) })
      .catch(() => { if (!cancelled) setError('Could not load your verification status.') })
    return () => { cancelled = true }
  }, [accessToken, authLoading])

  async function resend() {
    setResending(true)
    setError('')
    try {
      await api.resendVerification(accessToken)
      setResent(true)
    } catch (err) {
      setError(err.message || 'Could not send the email. Please try again.')
    } finally {
      setResending(false)
    }
  }

  if (!status) {
    return (
      <SettingsSubpage title="Account verification">
        {error ? <p className="set-error" role="alert">{error}</p> : <Spinner page label="Loading settings" />}
      </SettingsSubpage>
    )
  }

  return (
    <SettingsSubpage title="Account verification">
      {error && <p className="set-error" role="alert">{error}</p>}

      <div className={`verif-banner ${status.verified ? 'verif-banner-ok' : ''}`}>
        {status.verified ? <BadgeCheck size={26} /> : <CircleAlert size={26} />}
        <div>
          <p className="verif-banner-title">
            {status.verified ? 'Your account is verified' : 'Not fully verified yet'}
          </p>
          <p className="verif-banner-desc">
            {status.verified
              ? 'The check badge shows on your profile and posts.'
              : 'Finish the steps below to get the check badge on your profile.'}
          </p>
        </div>
      </div>

      <ul className="verif-steps">
        <VerifStep
          icon={Mail}
          done={status.email_verified}
          title="Confirm your email"
          desc={status.email}
          action={
            !status.email_verified && (
              <button type="button" className="verif-action" onClick={resend} disabled={resending || resent}>
                {resent ? 'Email sent' : resending ? 'Sending…' : 'Resend email'}
              </button>
            )
          }
        />
        <VerifStep
          icon={UserCheck}
          done={status.profile_complete}
          title="Complete your profile"
          desc={`${status.profile_completion_pct}% complete`}
          action={
            !status.profile_complete && (
              <Link to="/home/profile/edit" className="verif-action">Finish profile</Link>
            )
          }
        />
      </ul>

      {/* Deliberately honest: identity-document verification isn't built
          yet, so this screen doesn't pretend to offer it. */}
      <p className="verif-note">
        Member since {new Date(status.member_since).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.
        {' '}ID-document verification for hiring accounts is coming later.
        {!status.email_delivery_enabled && ' Email delivery is currently disabled on this environment.'}
      </p>

      <style>{`
        .verif-banner {
          display: flex; gap: 14px; align-items: flex-start;
          padding: 16px; border-radius: 14px; margin-bottom: 22px;
          background: var(--panel); border: 1px solid var(--border); color: var(--ink-dim);
        }
        .verif-banner-ok { border-color: var(--accent-ink); color: var(--accent-ink); }
        .verif-banner-title { margin: 0; font-family: var(--font-head); font-weight: 700; font-size: 15px; color: var(--ink); }
        .verif-banner-desc { margin: 4px 0 0; font-size: 13px; color: var(--ink-faint); }
        .verif-steps { list-style: none; margin: 0; padding: 0; }
        .verif-note { margin-top: 20px; font-size: 12.5px; color: var(--ink-faint); line-height: 1.6; }
        .verif-action {
          font-size: 12.5px; font-weight: 700; color: var(--bg); background: var(--lemon);
          padding: 7px 12px; border-radius: 999px; white-space: nowrap;
        }
        .verif-action:disabled { opacity: 0.6; }
      `}</style>
    </SettingsSubpage>
  )
}

function VerifStep({ icon: Icon, done, title, desc, action }) {
  return (
    <li className="verif-step">
      <span className={`verif-step-icon ${done ? 'verif-step-done' : ''}`}>
        <Icon size={18} strokeWidth={1.9} />
      </span>
      <span className="verif-step-text">
        <span className="verif-step-title">{title}</span>
        <span className="verif-step-desc">{desc}</span>
      </span>
      {done ? <BadgeCheck size={18} className="verif-step-check" /> : action}
      <style>{`
        .verif-step {
          display: flex; align-items: center; gap: 13px;
          padding: 15px 0; border-bottom: 1px solid var(--border);
        }
        .verif-step-icon {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          display: grid; place-items: center;
          background: var(--panel); border: 1px solid var(--border); color: var(--ink-dim);
        }
        .verif-step-done { color: var(--accent-ink); border-color: var(--accent-ink); }
        .verif-step-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
        .verif-step-title { font-size: 14.5px; font-weight: 600; color: var(--ink); }
        .verif-step-desc { font-size: 12.5px; color: var(--ink-faint); overflow: hidden; text-overflow: ellipsis; }
        .verif-step-check { color: var(--accent-ink); flex-shrink: 0; }
      `}</style>
    </li>
  )
}
