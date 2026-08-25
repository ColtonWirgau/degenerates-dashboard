'use client'

import { motion } from 'framer-motion'
import { Clock, Minus, Skull, Trophy, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConnectedDotsResult {
  weekNumber: number
  weekId: string
  result: 'win' | 'loss' | 'push' | null
  description?: string
  /**
   * What sits under the dot. Absent, it's the week number — which is
   * right when the row is ONE PERSON'S SEASON. When the row is one
   * week's LEAGUE, every dot shares a week and differs by whose leg it
   * is, so the label is their face instead.
   */
  label?: React.ReactNode
  /** Overrides the "Wk n · Win" tooltip when the row isn't weeks. */
  title?: string
}

interface ConnectedDotsProps {
  results: ConnectedDotsResult[] // chronological (oldest → newest)
  onOpenWeek?: (weekId: string) => void
  /** How tall the label band is. A number needs 12px; a face needs more. */
  labelHeight?: number
}

type Outcome = 'win' | 'loss' | 'push' | 'pending'

const TONES: Record<Outcome, { dot: string; line: string; ring: string; Icon: LucideIcon }> = {
  win: { dot: 'text-neon-blue', line: 'bg-neon-blue', ring: 'ring-neon-blue/40', Icon: Trophy },
  loss: { dot: 'text-destructive', line: 'bg-destructive', ring: 'ring-destructive/40', Icon: Skull },
  push: { dot: 'text-gray-300', line: 'bg-gray-400', ring: 'ring-white/25', Icon: Minus },
  pending: { dot: 'text-muted-foreground/50', line: 'bg-white/10', ring: 'ring-white/20', Icon: Clock },
}

// Wrapper is sized symmetrically around the dot row so that when the
// parent flex (`items-center`) centers it, the dots themselves land on
// the row's vertical mid — not the gap between the dots and the numbers
// below them.
const DOT_PX = 22
const NUMBER_GAP = 4
const NUMBER_HEIGHT = 12
const rowHeight = (labelHeight: number) =>
  2 * (DOT_PX / 2 + NUMBER_GAP + labelHeight) // symmetric about the dots
const PAD_X_PCT = 3

const outcomeKind = (r: ConnectedDotsResult['result']): Outcome =>
  r === 'win' ? 'win' : r === 'loss' ? 'loss' : r === 'push' ? 'push' : 'pending'

const outcomeText = (k: Outcome) =>
  k === 'win' ? 'Win' : k === 'loss' ? 'Loss' : k === 'push' ? 'Push' : 'Pending'

/**
 * Compact "connected dots" form chart. Each dot is a colored circle with
 * the result icon (Trophy / Skull / Minus / Clock) overlaid in page-bg
 * color so it reads as a punched-out shape. The week number sits as a
 * small watermark below each dot. Line segments between dots take the
 * LEFT dot's color, tracing win/loss runs.
 */
export function ConnectedDots({
  results,
  onOpenWeek,
  labelHeight = NUMBER_HEIGHT,
}: ConnectedDotsProps) {
  // No history yet (e.g., opening week with no graded legs) — render
  // nothing rather than an empty placeholder bar; the caller already
  // surfaces the stats above it.
  if (results.length === 0) return null

  const n = results.length
  const stepPct = n > 1 ? (100 - PAD_X_PCT * 2) / (n - 1) : 0
  const xFor = (i: number) => (n > 1 ? PAD_X_PCT + i * stepPct : 50)

  return (
    <div className="relative w-full" style={{ height: rowHeight(labelHeight) }}>
      {/* Line segments — colored by the LEFT dot's result. Sit at the
          wrapper's vertical mid (which is where the dots also sit). */}
      {results.slice(0, -1).map((r, i) => {
        const k = outcomeKind(r.result)
        const tone = TONES[k]
        return (
          <div
            key={`line-${r.weekId}`}
            aria-hidden
            className={cn('absolute h-1 z-0', tone.line)}
            style={{
              left: `${xFor(i)}%`,
              width: `${stepPct}%`,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
        )
      })}

      {/* Dots — centered exactly on the wrapper's vertical mid. */}
      {results.map((r, i) => {
        const k = outcomeKind(r.result)
        const tone = TONES[k]
        const Icon = tone.Icon
        const interactive = !!onOpenWeek
        const title =
          r.title ??
          (r.description
            ? `Wk ${r.weekNumber} · ${outcomeText(k)} — ${r.description}`
            : `Wk ${r.weekNumber} · ${outcomeText(k)}`)
        // Interactive: 44x44 invisible hit target wraps the visible 22px
        // dot so mobile tap is comfortable (Apple HIG minimum). Non-
        // interactive: render the visible dot directly.
        if (interactive) {
          return (
            <button
              key={r.weekId}
              type="button"
              onClick={() => onOpenWeek(r.weekId)}
              title={title}
              aria-label={title}
              className={cn(
                'group absolute z-10 inline-flex items-center justify-center transition-transform',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-blue/60'
              )}
              style={{
                left: `${xFor(i)}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 44,
                height: 44,
              }}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full ring-1 ring-inset transition-transform group-hover:scale-125',
                  tone.dot,
                  tone.ring
                )}
                style={{
                  width: DOT_PX,
                  height: DOT_PX,
                  backgroundColor: 'currentColor',
                }}
              >
                <Icon className="h-3 w-3" strokeWidth={2.75} style={{ color: '#0A0A0A' }} />
              </span>
            </button>
          )
        }
        return (
          <span
            key={r.weekId}
            aria-hidden
            className={cn(
              'absolute z-10 inline-flex items-center justify-center rounded-full ring-1 ring-inset',
              tone.dot,
              tone.ring
            )}
            style={{
              left: `${xFor(i)}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: DOT_PX,
              height: DOT_PX,
              backgroundColor: 'currentColor',
            }}
          >
            <Icon className="h-3 w-3" strokeWidth={2.75} style={{ color: '#0A0A0A' }} />
          </span>
        )
      })}

      {/* The label band, below the dots. A week number by default; a
          face when the row is a league rather than a season. */}
      {results.map((r, i) => {
        const k = outcomeKind(r.result)
        return (
          <span
            key={`label-${r.weekId}`}
            aria-hidden
            className={cn(
              'absolute leading-none',
              r.label == null &&
                'text-[9px] font-bold tracking-tighter tabular-nums',
              r.label == null &&
                (k === 'pending'
                  ? 'text-muted-foreground/50'
                  : 'text-muted-foreground/70')
            )}
            style={{
              left: `${xFor(i)}%`,
              top: `calc(50% + ${DOT_PX / 2 + NUMBER_GAP}px)`,
              transform: 'translateX(-50%)',
            }}
          >
            {r.label ?? r.weekNumber}
          </span>
        )
      })}
    </div>
  )
}

// ─── Mini variant — sparkline form, no labels ───────────────────────────────

const MINI_DOT_PX = 8
const MINI_PAD_X_PCT = 6

/**
 * Sparkline-sized variant of `<ConnectedDots>`. Each dot carries a
 * `layoutId="week-{id}"` so the same dot in the full chart morphs from
 * the mini position when wrapped in a Framer `<LayoutGroup>`.
 */
export function MiniConnectedDots({
  results,
  width = 100,
}: {
  results: ConnectedDotsResult[]
  width?: number
}) {
  if (results.length === 0) return null
  const n = results.length
  const stepPct = n > 1 ? (100 - MINI_PAD_X_PCT * 2) / (n - 1) : 0
  const xFor = (i: number) => (n > 1 ? MINI_PAD_X_PCT + i * stepPct : 50)

  return (
    <div className="relative" style={{ width, height: MINI_DOT_PX + 4 }}>
      {results.slice(0, -1).map((r, i) => {
        const tone = TONES[outcomeKind(r.result)]
        return (
          <div
            key={`mini-line-${r.weekId}`}
            aria-hidden
            className={cn('absolute h-px z-0', tone.line)}
            style={{
              left: `${xFor(i)}%`,
              width: `${stepPct}%`,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
        )
      })}
      {results.map((r, i) => {
        const tone = TONES[outcomeKind(r.result)]
        return (
          <motion.span
            key={r.weekId}
            layoutId={`week-${r.weekId}`}
            // Stable layoutDependency → Framer only re-measures this dot
            // on mount/unmount (when the dock toggles), not on every
            // parent render. Without this, sheet-opening side-effects
            // cause unrelated re-renders that re-measure the dot and
            // animate it back into place even though it didn't move.
            layoutDependency={r.weekId}
            transition={{ ease: 'linear', duration: 0.3 }}
            aria-hidden
            className={cn(
              'absolute z-10 inline-flex rounded-full ring-1 ring-inset',
              tone.dot,
              tone.ring
            )}
            style={{
              left: `calc(${xFor(i)}% - ${MINI_DOT_PX / 2}px)`,
              top: `calc(50% - ${MINI_DOT_PX / 2}px)`,
              width: MINI_DOT_PX,
              height: MINI_DOT_PX,
              backgroundColor: 'currentColor',
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Morphing variant — full chart with shared layoutIds ───────────────────

/**
 * Same shape as `<ConnectedDots>` but the dots use `layoutId="week-{id}"`
 * so they animate from `<MiniConnectedDots>`'s positions when the
 * surrounding dock expands. Week-number labels fade in separately.
 */
export function MorphingConnectedDots({ results, onOpenWeek }: ConnectedDotsProps) {
  if (results.length === 0) return null
  const n = results.length
  const stepPct = n > 1 ? (100 - PAD_X_PCT * 2) / (n - 1) : 0
  const xFor = (i: number) => (n > 1 ? PAD_X_PCT + i * stepPct : 50)
  // Dots take ~0.3s to morph into place. Lines + labels wait until the
  // dots arrive, then draw in sequence so the chart feels like it's
  // being constructed rather than appearing all at once.
  const DOT_DURATION = 0.3

  return (
    <div className="relative w-full" style={{ height: rowHeight(NUMBER_HEIGHT) }}>
      {results.slice(0, -1).map((r, i) => {
        const k = outcomeKind(r.result)
        const tone = TONES[k]
        return (
          <motion.div
            key={`line-${r.weekId}`}
            aria-hidden
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{
              duration: 0.25,
              ease: 'easeOut',
              delay: DOT_DURATION + i * 0.04,
            }}
            className={cn('absolute h-1 z-0', tone.line)}
            style={{
              left: `${xFor(i)}%`,
              width: `${stepPct}%`,
              top: `calc(50% - 2px)`,
              transformOrigin: 'left center',
            }}
          />
        )
      })}

      {results.map((r, i) => {
        const k = outcomeKind(r.result)
        const tone = TONES[k]
        const Icon = tone.Icon
        const interactive = !!onOpenWeek
        const title = r.description
          ? `Wk ${r.weekNumber} · ${outcomeText(k)} — ${r.description}`
          : `Wk ${r.weekNumber} · ${outcomeText(k)}`

        // Position-via-offsets (no `transform: translate`) so Framer's
        // layout transform doesn't fight CSS centering during the morph.
        return (
          <motion.span
            key={r.weekId}
            layoutId={`week-${r.weekId}`}
            layoutDependency={r.weekId}
            transition={{ ease: 'linear', duration: 0.3 }}
            // `whileHover` runs through Framer so the hover scale shares
            // the same transform pipeline as the layout morph — CSS
            // `transition-transform` would fight Framer here and cause
            // the dot to wobble during the layoutId animation.
            whileHover={interactive ? { scale: 1.15 } : undefined}
            aria-hidden={!interactive}
            title={title}
            onClick={interactive ? () => onOpenWeek(r.weekId) : undefined}
            className={cn(
              'absolute z-10 inline-flex items-center justify-center rounded-full ring-1 ring-inset',
              tone.dot,
              tone.ring,
              interactive && 'cursor-pointer'
            )}
            style={{
              left: `calc(${xFor(i)}% - ${DOT_PX / 2}px)`,
              top: `calc(50% - ${DOT_PX / 2}px)`,
              width: DOT_PX,
              height: DOT_PX,
              backgroundColor: 'currentColor',
            }}
          >
            <Icon className="h-3 w-3" strokeWidth={2.75} style={{ color: '#0A0A0A' }} />
          </motion.span>
        )
      })}

      {results.map((r, i) => {
        const k = outcomeKind(r.result)
        return (
          <motion.span
            key={`label-${r.weekId}`}
            aria-hidden
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.18,
              delay: DOT_DURATION + i * 0.025,
            }}
            className={cn(
              'absolute text-[9px] font-bold tabular-nums leading-none tracking-tighter',
              k === 'pending' ? 'text-muted-foreground/50' : 'text-muted-foreground/70'
            )}
            style={{
              left: `${xFor(i)}%`,
              top: `calc(50% + ${DOT_PX / 2 + NUMBER_GAP}px)`,
              transform: 'translateX(-50%)',
            }}
          >
            {r.weekNumber}
          </motion.span>
        )
      })}
    </div>
  )
}
