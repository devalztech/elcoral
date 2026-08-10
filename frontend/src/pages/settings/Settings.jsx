import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, User, ShieldCheck, Lock, Mail, Bell, Moon, Globe,
  Accessibility, EyeOff, Flag, Download, HelpCircle, Info, LogOut, Camera, Check,
} from 'lucide-react'
import { useAuth } from '../../features/auth/hooks/useAuth.jsx'
import { api } from '../../api/client.js'

const GROUPS = [
  {
    title: 'Account',
    items: [
      { to: '/home/profile/edit', icon: User, label: 'Edit profile', desc: 'Update your profile information and skills' },
      { to: '/home/settings/verification', icon: ShieldCheck, label: 'Account verification', desc: 'Verify your identity and get verified', pill: 'Verified' },
      { to: '/home/settings/security', icon: Lock, label: 'Security', desc: 'Password, 2FA, active sessions' },
      { to: '/home/settings/email', icon: Mail, label: 'Email preferences', desc: 'Manage emails and notifications' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { to: '/home/settings/notifications', icon: Bell, label: 'Notifications', desc: 'Choose what you want to be notified about' },
      { to: '/home/settings/appearance', icon: Moon, label: 'Appearance', desc: 'Choose theme, accent color and more' },
      { to: '/home/settings/language', icon: Globe, label: 'Language', desc: 'Select your preferred language' },
      { to: '/home/settings/accessibility', icon: Accessibility, label: 'Accessibility', desc: 'Adjust settings to make Elcoral easier to use' },
    ],
  },
  {
    title: 'Privacy & Safety',
    items: [
      { to: '/home/settings/privacy', icon: Lock, label: 'Privacy settings', desc: 'Manage who can see your content and profile' },
      { to: '/home/settings/blocked', icon: EyeOff, label: 'Blocked users', desc: "Manage people you've blocked" },
      { to: '/home/settings/reports', icon: Flag, label: 'Report history', desc: 'See your previously reported content' },
    ],
  },
  {
    title: 'Account & Support',
    items: [
      { to: '/home/settings/data', icon: Download, label: 'Data & privacy', desc: 'Download your data or delete your account' },
      { to: '/home/settings/help', icon: HelpCircle, label: 'Help center', desc: 'Get help and support' },
      { to: '/home/settings/about', icon: Info, label: 'About Elcoral', desc: 'Version, terms and policies' },
    ],
  },
]

function initialsOf(name) {
  if (!name) return 'EL'
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'EL'
}

export default function Settings() {
  const navigate = useNavigate()
  const { logout, accessToken } = useAuth()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    let alive = true
    api.myProfile(accessToken)
      .then((p) => { if (alive) setProfile(p) })
      .catch(() => {})
    return () => { alive = false }
  }, [accessToken])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="st">
      <header className="st-top">
        <button type="button" className="st-back" onClick={() => navigate(-1)} aria-label="Go back">
          <ChevronLeft size={26} strokeWidth={2.2} />
        </button>
        <h1 className="st-title">Settings</h1>
        <span className="st-back-spacer" aria-hidden="true" />
      </header>

      <section className="st-profile">
        <div className="st-avatar-wrap">
          <div className="st-avatar">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt={profile.full_name ? `${profile.full_name}'s profile photo` : 'Profile photo'} />
            ) : (
              <span>{initialsOf(profile?.full_name)}</span>
            )}
          </div>
          <Link to="/home/profile/edit" className="st-avatar-cam" aria-label="Change profile photo">
            <Camera size={13} strokeWidth={2.4} />
          </Link>
        </div>

        <div className="st-profile-text">
          <p className="st-name">
            <span className="st-name-txt">{profile?.full_name || 'Your name'}</span>
            <span className="st-check" aria-label="Verified account"><Check size={10} strokeWidth={4} /></span>
          </p>
          {profile?.username && <p className="st-handle">@{profile.username}</p>}
          {profile?.headline && <p className="st-headline">{profile.headline}</p>}
        </div>

        <Link to="/home/profile" className="st-view">
          View profile <ChevronRight size={16} />
        </Link>
      </section>

      {GROUPS.map((group) => (
        <section className="st-group" key={group.title}>
          <h2 className="st-group-title">{group.title}</h2>
          <div className="st-card">
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <Link to={item.to} key={item.label} className="st-row">
                  <span className="st-row-icon"><Icon size={22} strokeWidth={1.7} /></span>
                  <span className="st-row-text">
                    <span className="st-row-label">{item.label}</span>
                    <span className="st-row-desc">{item.desc}</span>
                  </span>
                  {item.pill && <span className="st-pill">{item.pill}</span>}
                  <ChevronRight size={18} className="st-row-chevron" />
                </Link>
              )
            })}
          </div>
        </section>
      ))}

      <button type="button" className="st-logout" onClick={handleLogout}>
        <LogOut size={18} strokeWidth={2.1} />
        Log out
      </button>

      <style>{`
        .st { padding-bottom: 8px; }

        .st-top {
          display: grid; grid-template-columns: 40px minmax(0,1fr) 40px;
          align-items: center; margin-bottom: 18px;
        }
        .st-back { color: var(--ink); display: inline-flex; align-items: center; justify-content: center; height: 40px; width: 40px; margin-left: -8px; border-radius: 999px; }
        .st-back:active { background: var(--panel); }
        .st-title {
          font-family: var(--font-display); font-weight: 800; font-size: 22px;
          color: var(--ink); text-align: center; margin: 0; letter-spacing: -0.01em;
        }

        .st-profile {
          display: grid; grid-template-columns: auto minmax(0,1fr) auto;
          align-items: center; gap: 14px;
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 16px; padding: 16px 14px; margin-bottom: 26px;
        }
        .st-avatar-wrap { position: relative; width: 62px; height: 62px; flex-shrink: 0; }
        .st-avatar {
          width: 62px; height: 62px; border-radius: 999px; overflow: hidden;
          background: var(--panel-raised); display: flex; align-items: center; justify-content: center;
          font-family: var(--font-head); font-weight: 700; font-size: 20px; color: var(--ink-dim);
        }
        .st-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .st-avatar-cam {
          position: absolute; right: -2px; bottom: -2px;
          width: 22px; height: 22px; border-radius: 999px;
          background: var(--lemon); color: var(--on-accent);
          display: flex; align-items: center; justify-content: center;
          border: 2px solid var(--panel);
        }

        .st-profile-text { min-width: 0; }
        .st-name { display: flex; align-items: center; gap: 6px; margin: 0; min-width: 0; }
        .st-name-txt {
          font-family: var(--font-head); font-weight: 700; font-size: 17px; color: var(--ink);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .st-check {
          flex-shrink: 0; width: 15px; height: 15px; border-radius: 999px;
          background: var(--lemon); color: var(--on-accent);
          display: inline-flex; align-items: center; justify-content: center;
        }
        .st-handle { margin: 3px 0 0; font-size: 13.5px; color: var(--ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .st-headline { margin: 3px 0 0; font-size: 13.5px; color: var(--ink-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .st-view {
          flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;
          border: 1px solid var(--border); border-radius: 999px;
          padding: 9px 12px 9px 14px;
          font-family: var(--font-head); font-weight: 600; font-size: 13.5px; color: var(--ink);
          white-space: nowrap;
        }
        .st-view:hover { border-color: var(--accent-ink); color: var(--accent-ink); }

        .st-group { margin-bottom: 26px; }
        .st-group-title {
          margin: 0 0 10px 2px; font-family: var(--font-head);
          font-size: 14px; font-weight: 600; color: var(--ink-faint);
        }
        .st-card {
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden;
        }
        .st-row {
          display: grid; grid-template-columns: 34px minmax(0,1fr) auto auto;
          align-items: center; gap: 12px;
          padding: 15px 14px;
          border-bottom: 1px solid var(--border);
        }
        .st-row:last-child { border-bottom: none; }
        .st-row:active { background: var(--panel-raised); }
        .st-row-icon { color: var(--accent-ink); display: inline-flex; align-items: center; justify-content: center; }
        .st-row-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .st-row-label { font-size: 15px; font-weight: 600; color: var(--ink); }
        .st-row-desc { font-size: 13px; line-height: 1.35; color: var(--ink-faint); }
        .st-pill {
          font-size: 11.5px; font-weight: 700; font-family: var(--font-head);
          color: var(--accent-ink); background: rgba(196, 241, 53, 0.12);
          border-radius: 999px; padding: 5px 10px; white-space: nowrap;
        }
        .st-row-chevron { color: var(--ink-faint); }

        .st-logout {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; margin-top: 4px;
          font-family: var(--font-head); font-size: 15px; font-weight: 700; color: var(--danger);
          background: transparent; border: 1px solid rgba(255, 107, 74, 0.45);
          border-radius: 14px; padding: 15px 16px;
        }
        .st-logout:hover { border-color: var(--danger); background: rgba(255, 107, 74, 0.07); }
        .st-logout:active { transform: scale(0.99); }

        @media (max-width: 380px) {
          .st-view { padding: 8px 10px; font-size: 12.5px; }
          .st-avatar, .st-avatar-wrap { width: 54px; height: 54px; }
        }
      `}</style>
    </div>
  )
}
