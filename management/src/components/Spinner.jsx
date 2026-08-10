export default function Spinner({ page = false, label = 'Loading' }) {
  return (
    <div className={page ? 'spinner-page' : 'spinner-inline'} role="status" aria-live="polite">
      <span className="spinner-dot" aria-hidden="true" />
      <span className="spinner-label">{label}…</span>
    </div>
  )
}
