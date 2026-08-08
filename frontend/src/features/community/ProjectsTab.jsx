// Projects tab. Placeholder for Phase 8A — full create/collaborate/
// approve flow lands in Phase 8C. Wired to the real list endpoint now
// so the tab isn't showing fake data while it waits.
import { useCallback, useEffect, useState } from 'react'
import { Rocket } from 'lucide-react'
import { api } from '../../api/client.js'
import { SectionState } from '../../pages/CommunityDetail.jsx'

export default function ProjectsTab({ community, accessToken }) {
  const [state, setState] = useState({ items: [], loading: true, error: null })

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    api
      .listCommunityProjects(community.slug, { limit: 30 }, accessToken ?? undefined)
      .then((data) => setState({ items: data.items, loading: false, error: null }))
      .catch((err) => setState({ items: [], loading: false, error: err.message }))
  }, [community.slug, accessToken])

  useEffect(() => { load() }, [load])

  return (
    <div className="pt">
      <SectionState
        loading={state.loading}
        error={state.error}
        empty={state.items.length === 0}
        emptyText="No projects yet — this is coming in the next update."
        onRetry={load}
      />
      {state.items.length > 0 && (
        <ul className="pt-list">
          {state.items.map((p) => (
            <li key={p.id} className="pt-row">
              <span className="pt-icon" aria-hidden="true"><Rocket size={20} strokeWidth={1.8} /></span>
              <div className="pt-id">
                <p className="pt-name">{p.name}</p>
                {p.description && <p className="pt-desc">{p.description}</p>}
              </div>
              <span className="pt-status">{p.status}</span>
            </li>
          ))}
        </ul>
      )}
      <style>{`
        .pt-list { list-style: none; margin: 0; padding: 0; background: var(--panel); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; }
        .pt-list > li + li { border-top: 1px solid var(--border); }
        .pt-row { display: flex; align-items: center; gap: 12px; padding: 13px 14px; }
        .pt-icon { flex: none; width: 40px; height: 40px; border-radius: 12px; background: var(--panel-raised); color: var(--accent-ink); display: inline-flex; align-items: center; justify-content: center; }
        .pt-id { flex: 1; min-width: 0; }
        .pt-name { margin: 0; font-family: var(--font-head); font-weight: 700; font-size: 14.5px; color: var(--ink); }
        .pt-desc { margin: 2px 0 0; font-size: 12.5px; color: var(--ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pt-status { flex: none; font-size: 12px; font-weight: 700; color: var(--ink-dim); text-transform: capitalize; }
      `}</style>
    </div>
  )
}
