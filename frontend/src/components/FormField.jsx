export default function FormField({ label, error, children }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
      <style>{`
        .field { margin-bottom: 18px; }
        .field-label {
          display: block;
          font-family: var(--font-head);
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-dim);
          margin-bottom: 7px;
        }
        .field-error {
          font-size: 12.5px;
          color: var(--danger);
          margin: 6px 0 0;
        }
      `}</style>
    </div>
  )
}

export function TextInput(props) {
  return (
    <>
      <input {...props} className={`text-input ${props.className || ''}`} />
      <style>{`
        .text-input {
          width: 100%;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 15px;
          color: var(--ink);
          font-family: var(--font-body);
          transition: border-color 0.15s ease;
        }
        .text-input::placeholder { color: var(--ink-faint); }
        .text-input:focus { outline: none; border-color: var(--lemon); }
      `}</style>
    </>
  )
}
