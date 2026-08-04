import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

const COPY = {
  client: {
    eyebrow: 'Tell us what you need',
    title: "Let's set up your hiring profile",
    body: "Next we'll ask a few questions about the kind of work you post and how you like to work with freelancers — so we can match you with the right people faster.",
  },
  freelancer: {
    eyebrow: 'Show what you can do',
    title: "Let's build your profile",
    body: "Next we'll ask about your skills, experience, and rate — similar to setting up a LinkedIn or Upwork profile. It takes a few minutes and you can always edit it later.",
  },
}

export default function Onboarding() {
  const { role } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const copy = COPY[role] ?? COPY.client

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="onboarding-body">
          {user?.full_name ? `Welcome, ${user.full_name.split(' ')[0]}. ` : ''}
          {copy.body}
        </p>
        <div className="onboarding-note">
          The full question flow and verification step aren't built yet — this is a placeholder
          so signup has somewhere real to land. For now, continue straight to the dashboard.
        </div>
        <button className="btn btn-primary btn-block btn-lg" onClick={() => navigate('/dashboard')}>
          Continue to dashboard
        </button>
      </div>
      <style>{`
        .onboarding {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 24px;
        }
        .onboarding-card { max-width: 440px; width: 100%; }
        .onboarding-card h1 {
          font-family: var(--font-head); font-size: 28px; font-weight: 700;
          margin-top: 8px; margin-bottom: 14px; color: var(--ink);
        }
        .onboarding-body { font-size: 15.5px; margin-bottom: 20px; }
        .onboarding-note {
          font-size: 13px; color: var(--ink-faint);
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 10px; padding: 12px 14px; margin-bottom: 24px;
        }
      `}</style>
    </div>
  )
}
