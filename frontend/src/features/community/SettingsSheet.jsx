// Community settings sheet. Phase 8A ships the basic detail edit
// (name/description), gated on caps.can_edit_settings exactly like the
// backend gates PATCH /communities/{slug} (admin+). Permission-policy
// toggles, role management and delete-community land in Phase 8B.
import { useState } from 'react'
import FormField, { TextInput } from '../../components/FormField.jsx'
import EditSheet from '../profile/components/EditSheet.jsx'
import { api } from '../../api/client.js'

export default function SettingsSheet({ community, caps, accessToken, onClose, onSaved }) {
  const [name, setName] = useState(community.name)
  const [description, setDescription] = useState(community.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const canEdit = caps.can_edit_settings

  async function save() {
    if (!canEdit) return
    if (name.trim().length < 3) {
      setError('Name must be at least 3 characters.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next = await api.updateCommunity(
        community.slug,
        { name: name.trim(), description: description.trim() || null },
        accessToken,
      )
      onSaved(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <EditSheet
      title="Community settings"
      subtitle={canEdit ? undefined : "You don't have permission to edit this community."}
      onClose={onClose}
      onSave={save}
      saving={saving}
      error={error}
    >
      <FormField label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} maxLength={80} />
      </FormField>
      <FormField label="Description">
        <textarea
          className="ss-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!canEdit}
          rows={4}
          maxLength={300}
        />
      </FormField>
      <p className="ss-note">
        Member roles, permissions and danger-zone actions are coming in the next update.
      </p>
      <style>{`
        .ss-textarea {
          width: 100%; background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
          padding: 12px 14px; font-size: 15px; color: var(--ink); font-family: var(--font-body);
          resize: vertical; transition: border-color .15s ease;
        }
        .ss-textarea:disabled { opacity: .6; }
        .ss-textarea:focus { outline: none; border-color: var(--accent-ink); }
        .ss-note { font-size: 12.5px; color: var(--ink-faint); margin: 4px 0 0; }
      `}</style>
    </EditSheet>
  )
}
