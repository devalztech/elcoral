/**
 * Verified badge.
 *
 * X renders verification as a *filled* rosette (a scalloped circle with a
 * white check knocked out of it) — not an outlined check like
 * lucide's <BadgeCheck/>. This is that exact glyph, so the tick reads the
 * same way it does on X at any size.
 *
 * Default size follows X's inline badge: 18.75px next to a 15px display
 * name (X ships it as 1.25em of the name's font-size).
 *
 * Colour: the rosette is filled with `--verified` (Twitter blue by
 * default, themable) and the check is knocked out in the page background
 * so it stays crisp in light and dark themes.
 */
export default function VerifiedBadge({ size = 18.75, className = '', title = 'Verified account' }) {
  return (
    <svg
      className={`vbadge ${className}`}
      viewBox="0 0 22 22"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      focusable="false"
    >
      <g>
        <path
          fill="currentColor"
          d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.443C12.276 1.812 11.646 1.615 11 1.6c-.646.015-1.276.212-1.817.569-.541.357-.972.856-1.245 1.443-.607-.223-1.264-.27-1.897-.14-.634.131-1.217.437-1.687.882-.445.47-.75 1.053-.882 1.687-.13.633-.083 1.29.14 1.897-.586.274-1.084.705-1.438 1.246-.355.541-.552 1.17-.57 1.816.018.646.215 1.275.57 1.816.354.54.852.972 1.438 1.246-.223.607-.27 1.264-.14 1.897.131.634.437 1.218.882 1.687.47.445 1.053.75 1.687.882.633.13 1.29.083 1.897-.14.273.587.704 1.086 1.245 1.443.541.357 1.17.554 1.817.569.646-.015 1.276-.212 1.817-.569.541-.357.972-.856 1.245-1.443.607.223 1.264.27 1.897.14.634-.131 1.217-.437 1.687-.882.445-.47.75-1.053.882-1.687.13-.633.083-1.29-.14-1.897.586-.274 1.084-.705 1.438-1.246.355-.541.552-1.17.57-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"
        />
      </g>
    </svg>
  )
}
