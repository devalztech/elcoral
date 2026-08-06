import { Wallet } from 'lucide-react'
import SettingsSubpage from './SettingsSubpage.jsx'

// Frontend-only — payments/escrow isn't built on the backend yet. This
// is the placement for it once it exists; kept minimal rather than
// inventing numbers that don't mean anything.
export default function EarningsSettings() {
  return (
    <SettingsSubpage title="Earnings">
      <div className="earnings-empty">
        <Wallet size={28} />
        <p>No payment methods added yet.</p>
        <button type="button" className="btn btn-primary">Add payment method</button>
      </div>
      <style>{`
        .earnings-empty {
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          text-align: center; padding: 40px 20px;
          color: var(--ink-faint);
        }
        .earnings-empty p { font-size: 14px; }
      `}</style>
    </SettingsSubpage>
  )
}
