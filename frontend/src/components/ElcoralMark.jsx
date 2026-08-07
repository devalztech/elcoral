/**
 * The Elcoral "E" glyph — two interlocking hook bars forming the brand mark.
 * Pure vector, single `currentColor` fill, no background baked in, so it can
 * be dropped into a tile (building card), a nav header, or anywhere else at
 * any size without rasterization loss.
 */
export default function ElcoralMark({ size = 24, color = 'currentColor', className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        fill={color}
        d="
          M 76 21
          L 43 21
          C 31 21 21.2 30.8 21.2 42.8
          L 21.2 48.5
          C 21.2 51 23.2 53 25.7 53
          L 39 53
          C 41.5 53 43.5 51 43.5 48.5
          C 43.5 46 41.5 44 39 44
          L 33.8 44
          C 34.4 37.6 39.7 32.6 46.2 32.6
          L 76 32.6
          C 79 32.6 81.5 30.1 81.5 27
          C 81.5 23.9 79 21 76 21
          Z
        "
      />
      <path
        fill={color}
        d="
          M 76 79
          L 43 79
          C 31 79 21.2 69.2 21.2 57.2
          L 21.2 51.5
          C 21.2 49 23.2 47 25.7 47
          L 39 47
          C 41.5 47 43.5 49 43.5 51.5
          C 43.5 54 41.5 56 39 56
          L 33.8 56
          C 34.4 62.4 39.7 67.4 46.2 67.4
          L 76 67.4
          C 79 67.4 81.5 69.9 81.5 73
          C 81.5 76.1 79 79 76 79
          Z
        "
      />
    </svg>
  )
}
