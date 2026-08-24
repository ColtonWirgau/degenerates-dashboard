/**
 * A label set around a circle ONE GLYPH AT A TIME — textPath warps these
 * (glyph advance along a tight arc shears the letterforms), so each letter
 * gets its own exact position and tangent rotation instead. Ported from
 * RoarTracker; only the ink changed (neon-ground foreground instead of
 * concrete ink).
 *
 * The grammar is the book spine's, mirrored per side so both edges match:
 *  - right arc (the panel bubbles): reads top→bottom, glyphs rotated +90°
 *  - left arc (the avatar):         reads bottom→top, glyphs rotated -90°
 */
export function ArcLabel({
  text,
  cx,
  cy,
  r,
  side,
  boxW,
  boxH,
  inset,
  fontSize,
  bias,
}: {
  text: string
  /** Circle center in the svg's own coordinates. */
  cx: number
  cy: number
  r: number
  side: 'left' | 'right'
  boxW: number
  boxH: number
  /** How far the svg overhangs its positioned parent (px, all sides). */
  inset: number
  fontSize: number
  /** Where the run's TOP END sits, in radians above the waist. */
  bias?: number
}) {
  const chars = text.split('')
  const n = chars.length
  // Arc length per glyph ≈ advance (0.6em) + tracking (0.2em).
  const step = (0.8 * fontSize) / r
  return (
    <svg
      viewBox={`0 0 ${boxW} ${boxH}`}
      className="pointer-events-none absolute"
      style={{ left: -inset, top: -inset, width: boxW, height: boxH }}
      aria-hidden
    >
      {chars.map((c, i) => {
        const t =
          side === 'right'
            ? i * step - (bias ?? 0)
            : Math.PI + (bias ?? 0) - (n - 1 - i) * step
        // Rounded: server and client trig can differ in the last float
        // bit, and React flags the stringified attribute as a hydration
        // mismatch.
        const x = +(cx + r * Math.cos(t)).toFixed(3)
        const y = +(cy + r * Math.sin(t)).toFixed(3)
        const rot = (t * 180) / Math.PI + 90
        return (
          <text
            key={i}
            x={x}
            y={y}
            transform={`rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--foreground)"
            opacity={0.6}
            style={{
              font: `700 ${fontSize}px var(--font-inter, system-ui)`,
              letterSpacing: '0.05em',
            }}
          >
            {c}
          </text>
        )
      })}
    </svg>
  )
}
