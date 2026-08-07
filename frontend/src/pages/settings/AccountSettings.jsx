import { useState } from 'react'
import { useAuth } from '../../features/auth/hooks/useAuth.jsx'
import FormField, { TextInput } from '../../components/FormField.jsx'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'

// Frontend-only for now — no PATCH /auth/me or username-change endpoint
// exists on the backend yet (see app/routers/auth.py). Fields are
// pre-filled from the logged-in user and editable, but Save doesn't
// submit anywhere until that endpoint exists. Wire up when the backend
// pass happens.
export default function AccountSettings() {
  const { user } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')

  return (
    <SettingsSubpage title="Account">
      <FormField label="Full name">
        <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </FormField>
      <FormField label="Email">
        <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormField>
      <button type="button" className="btn btn-primary btn-block">Save changes</button>

      <div className="danger-zone">
        <h2>Danger zone</h2>
        <button type="button" className="btn btn-ghost btn-block danger-btn">Delete account</button>
      </div>

      <style>{`
        .danger-zone { margin-top: 36px; padding-top: 24px; border-top: 1px solid var(--border); }
        .danger-zone h2 { font-family: var(--font-head); font-size: 14px; font-weight: 600; color: var(--danger); margin-bottom: 12px; }
        .danger-btn { border-color: var(--danger); color: var(--danger); }
        .danger-btn:hover { background: rgba(255,107,74,0.1); }
      `}</style>
    </SettingsSubpage>
  )
}
