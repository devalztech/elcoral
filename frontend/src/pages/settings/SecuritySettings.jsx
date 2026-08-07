import { useState } from 'react'
import FormField, { TextInput } from '../../components/FormField.jsx'
import SettingsSubpage from '../../features/settings/components/SettingsSubpage.jsx'

// Frontend-only — no change-password endpoint exists on the backend yet
// (auth.py has forgot/reset-password via email token, but no authenticated
// "change while logged in" route). Form is real and validates client-side;
// wire the submit handler once that endpoint exists.
export default function SecuritySettings() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')

  return (
    <SettingsSubpage title="Security">
      <FormField label="Current password">
        <TextInput type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </FormField>
      <FormField label="New password">
        <TextInput type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      </FormField>
      <FormField label="Confirm new password">
        <TextInput type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </FormField>
      <button type="button" className="btn btn-primary btn-block">Update password</button>
    </SettingsSubpage>
  )
}
