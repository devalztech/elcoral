/**
 * Elcoral loading spinner.
 *
 * One loading language for the whole app: a small circular track with a
 * spinning accent arc — X / Twitter style, no logo, no wordmark, no
 * bouncing dots. Sizes are px so it can sit inline in a button, in a row,
 * or centred on a whole page.
 *
 *   <Spinner />                     · inline, 20px
 *   <Spinner size={28} />           · bigger
 *   <Spinner page />                · centred block for a whole screen
 *   <Spinner label="Loading feed" /> · custom screen-reader text
 */
export default function Spinner({ size = 20, page = false, label = 'Loading', className = '' }) {
  const stroke = Math.max(2, Math.round(size * 0.11))
  const spinner = (
    <span
      className={`el-spin ${className}`}
      style={{ width: size, height: size, borderWidth: stroke }}
      role="status"
      aria-label={label}
    />
  )

  if (!page) return spinner

  return (
    <div className="el-spin-page">
      {spinner}
      <style>{`
        .el-spin-page {
          display: grid; place-items: center;
          padding: 48px 20px; min-height: 140px;
        }
      `}</style>
    </div>
  )
}
