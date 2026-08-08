// Members tab. Phase 8A ships a real, read-only roster (list + roles);
// role promotion/demotion, removal/ban and the manage screen land in
// Phase 8B on top of this same component.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Shield, ShieldCheck } from 'lucide-react'
import { api } from '../../api/client.js'
import { displayName } from '../social/format.js'
import { Avatar, SectionState } from '../../pages/CommunityDetail.jsx'

const ROLE_ICON = { owner: Crown, admin: ShieldCheck, moderator: Shield }
const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', moderator: 'Moderator', member: 'Member' }

export default function MembersTab({ community, accessToken }) {
  const [state, setState] = useState({ items: [], total: 0, loading: true, error: null })

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    api
      .communityRoster(community.slug, { limit: 50 }, accessToken ?? undefined)
      .then((data) => setState({ items: data.items, total: data.total, loading: false, error: null }))
      .catch((err) => setState({ items: [], total: 0, loading: false, error: err.message }))
  }, [community.slug, accessToken])

  useEffect(() => { load() }, [load])

  return (
    <div className="mt">
      <SectionState
        loading={state.loading}
        error={state.error}
        empty={state.items.length === 0}
        emptyText="No members yet."
        onRetry={load}
      />
      {state.items.length > 0 && (
        <ul className="mt-list">
          {state.items.map((m) => {
            const RoleIcon = ROLE_ICON[m.role]
            return (
              <li key={m.person.id} className="mt-row">
                <Avatar person={m.person} size={44} />
                <div className="mt-id">
                  {m.person.username ? (
                    <Link to={`/u/${m.person.username}`} className="mt-name">{displayName(m.person)}</Link>
                  ) : (
                    <span className="mt-name">{displayName(m.person)}</span>
                  )}
                  {m.person.headline && <p className="mt-headline">{m.person.headline}</p>}
                </div>
                {m.role !== 'member' && (
                  <span className={`mt-role mt-role-${m.role}`}>
                    {RoleIcon && <RoleIcon size={13} strokeWidth={2.2} />}
                    {ROLE_LABEL[m.role]}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <style>{`
        .mt-list { list-style: none; margin: 0; padding: 0; background: var(--panel); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; }
        .mt-list > li + li { border-top: 1px solid var(--border); }
        .mt-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
        .mt-id { flex: 1; min-width: 0; }
        .mt-name { font-family: var(--font-head); font-weight: 700; font-size: 14.5px; color: var(--ink); }
        .mt-name:hover { color: var(--accent-ink); }
        .mt-headline { margin: 2px 0 0; font-size: 12.5px; color: var(--ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mt-role {
          flex: none; display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 700;
          font-family: var(--font-head); background: var(--panel-raised); color: var(--ink-dim);
        }
        .mt-role-owner { color: var(--accent-ink); }
        .mt-role-admin { color: var(--ink); }
      `}</style>
    </div>
  )
}
