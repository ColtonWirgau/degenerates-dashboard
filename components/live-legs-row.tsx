'use client'

import { motion } from 'framer-motion'
import { Clock, Minus, Skull, Trophy, type LucideIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export interface LiveLeg {
  id: string
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  result: 'win' | 'loss' | 'push' | null
}

interface LiveLegsRowProps {
  legs: LiveLeg[]
}

type Outcome = 'win' | 'loss' | 'push' | 'pending'

const TONES: Record<Outcome, { dot: string; line: string; ring: string; Icon: LucideIcon }> = {
  win: { dot: 'text-neon-blue', line: 'bg-neon-blue', ring: 'ring-neon-blue/40', Icon: Trophy },
  loss: { dot: 'text-destructive', line: 'bg-destructive', ring: 'ring-destructive/40', Icon: Skull },
  push: { dot: 'text-gray-300', line: 'bg-gray-400', ring: 'ring-white/25', Icon: Minus },
  // Pending = "still in flight" — bright yellow so it reads as live, not muted.
  pending: { dot: 'text-white/50', line: 'bg-white/30', ring: 'ring-white/20', Icon: Clock },
}

const ROW_HEIGHT = 50
const DOT_PX = 18
const PAD_X_PCT = 3

const initialsFor = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

const outcomeKind = (r: LiveLeg['result']): Outcome =>
  r === 'win' ? 'win' : r === 'loss' ? 'loss' : r === 'push' ? 'push' : 'pending'

/**
 * Member-axis variant of `<ConnectedDots>` — one dot per member's leg
 * during the live-tracking state. Cyan-tinted dot + Trophy for settled
 * wins, gray + Clock for pending, etc. Avatars sit beneath each dot in
 * place of the week-number watermark. Lines between dots take the LEFT
 * dot's tone, so a clean run of wins reads as a continuous cyan trace.
 */
export function LiveLegsRow({ legs }: LiveLegsRowProps) {
  if (legs.length === 0) return null
  const n = legs.length
  const stepPct = n > 1 ? (100 - PAD_X_PCT * 2) / (n - 1) : 0
  const xFor = (i: number) => (n > 1 ? PAD_X_PCT + i * stepPct : 50)

  return (
    <div className="relative w-full" style={{ height: ROW_HEIGHT }}>
      {/* Line segments — colored by the LEFT leg's result. */}
      {legs.slice(0, -1).map((leg, i) => {
        const tone = TONES[outcomeKind(leg.result)]
        return (
          <div
            key={`line-${leg.id}`}
            aria-hidden
            className={cn('absolute h-0.5 z-0', tone.line)}
            style={{
              left: `${xFor(i)}%`,
              width: `${stepPct}%`,
              top: DOT_PX / 2,
              transform: 'translateY(-50%)',
            }}
          />
        )
      })}

      {/* Dots — colored circle with the result icon as a black cutout. */}
      {legs.map((leg, i) => {
        const k = outcomeKind(leg.result)
        const tone = TONES[k]
        const Icon = tone.Icon
        return (
          <span
            key={leg.id}
            aria-hidden
            title={`${leg.fullName ?? leg.email} — ${k}`}
            className={cn(
              'absolute z-10 inline-flex items-center justify-center rounded-full ring-1 ring-inset',
              tone.dot,
              tone.ring
            )}
            style={{
              left: `${xFor(i)}%`,
              top: DOT_PX / 2,
              transform: 'translate(-50%, -50%)',
              width: DOT_PX,
              height: DOT_PX,
              backgroundColor: 'currentColor',
            }}
          >
            <Icon className="h-2.5 w-2.5" strokeWidth={2.75} style={{ color: '#0A0A0A' }} />
          </span>
        )
      })}

      {/* Avatar watermark — replaces the week-number label, below each dot. */}
      {legs.map((leg, i) => (
        <div
          key={`avatar-${leg.id}`}
          className="absolute"
          style={{
            left: `${xFor(i)}%`,
            top: DOT_PX + 6,
            transform: 'translateX(-50%)',
          }}
        >
          <Avatar className="h-5 w-5 ring-1 ring-white/15">
            <AvatarImage
              src={leg.avatarUrl ?? undefined}
              alt={leg.fullName ?? leg.email}
            />
            <AvatarFallback className="bg-primary text-primary-foreground text-[8px] font-bold">
              {initialsFor(leg.fullName, leg.email)}
            </AvatarFallback>
          </Avatar>
        </div>
      ))}
    </div>
  )
}

// ─── Mini variant ──────────────────────────────────────────────────────────

const MINI_DOT_PX = 8
const MINI_PAD_X_PCT = 6

/**
 * Compressed sparkline form of `<LiveLegsRow>` — colored dots + thin
 * connecting lines, no avatars, fixed narrow width. Used in the section
 * dock's trailing slot so the live tally reads at a glance before the
 * dock is expanded. Each dot carries a `layoutId="leg-{id}"` so the same
 * dot in the full chart (when the dock expands) animates between
 * positions.
 */
export function MiniLiveLegsRow({ legs, width = 80 }: { legs: LiveLeg[]; width?: number }) {
  if (legs.length === 0) return null
  const n = legs.length
  const stepPct = n > 1 ? (100 - MINI_PAD_X_PCT * 2) / (n - 1) : 0
  const xFor = (i: number) => (n > 1 ? MINI_PAD_X_PCT + i * stepPct : 50)

  return (
    <div className="relative" style={{ width, height: MINI_DOT_PX + 4 }}>
      {legs.slice(0, -1).map((leg, i) => {
        const tone = TONES[outcomeKind(leg.result)]
        return (
          <div
            key={`mini-line-${leg.id}`}
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
      {legs.map((leg, i) => {
        const k = outcomeKind(leg.result)
        const tone = TONES[k]
        // No `transform: translate` — Framer overrides transform when the
        // dot morphs via `layoutId`, which would knock the centering off.
        // Position with top/left offsets so the dot's final geometry is
        // independent of any transform Framer applies.
        return (
          <motion.span
            key={leg.id}
            layoutId={`leg-${leg.id}`}
            // See `MiniConnectedDots` for the layoutDependency rationale —
            // stable value here means Framer only re-measures on dock
            // toggle, not on every unrelated parent re-render.
            layoutDependency={leg.id}
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

// ─── Morphing variant for the expanded panel ────────────────────────────────

/**
 * Same shape as `<LiveLegsRow>` but dot circles use `layoutId="leg-{id}"`
 * so they can animate from the `<MiniLiveLegsRow>` positions when the
 * section dock expands. Avatars fade in independently.
 */
export function MorphingLiveLegsRow({ legs }: LiveLegsRowProps) {
  if (legs.length === 0) return null
  const n = legs.length
  const stepPct = n > 1 ? (100 - PAD_X_PCT * 2) / (n - 1) : 0
  const xFor = (i: number) => (n > 1 ? PAD_X_PCT + i * stepPct : 50)
  // Lines + avatars wait for the dot morph (~0.3s) before drawing in, so
  // the chart feels like it's being constructed rather than appearing
  // all at once.
  const DOT_DURATION = 0.3

  return (
    <div className="relative w-full" style={{ height: ROW_HEIGHT }}>
      {legs.slice(0, -1).map((leg, i) => {
        const tone = TONES[outcomeKind(leg.result)]
        return (
          <motion.div
            key={`line-${leg.id}`}
            aria-hidden
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{
              duration: 0.25,
              ease: 'easeOut',
              delay: DOT_DURATION + i * 0.03,
            }}
            className={cn('absolute h-0.5 z-0', tone.line)}
            style={{
              left: `${xFor(i)}%`,
              width: `${stepPct}%`,
              top: DOT_PX / 2 - 1,
              transformOrigin: 'left center',
            }}
          />
        )
      })}

      {legs.map((leg, i) => {
        const k = outcomeKind(leg.result)
        const tone = TONES[k]
        const Icon = tone.Icon
        // Position with top/left offsets (no centering transform) so
        // Framer's `layoutId` morph from the mini chart lands the dot at
        // the correct final geometry.
        return (
          <motion.span
            key={leg.id}
            layoutId={`leg-${leg.id}`}
            layoutDependency={leg.id}
            transition={{ ease: 'linear', duration: 0.3 }}
            aria-hidden
            title={`${leg.fullName ?? leg.email} — ${k}`}
            className={cn(
              'absolute z-10 inline-flex items-center justify-center rounded-full ring-1 ring-inset',
              tone.dot,
              tone.ring
            )}
            style={{
              left: `calc(${xFor(i)}% - ${DOT_PX / 2}px)`,
              top: 0,
              width: DOT_PX,
              height: DOT_PX,
              backgroundColor: 'currentColor',
            }}
          >
            <Icon className="h-2.5 w-2.5" strokeWidth={2.75} style={{ color: '#0A0A0A' }} />
          </motion.span>
        )
      })}

      {legs.map((leg, i) => (
        <motion.div
          key={`avatar-${leg.id}`}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: DOT_DURATION + i * 0.025 }}
          className="absolute"
          style={{
            left: `calc(${xFor(i)}% - 10px)`,
            top: DOT_PX + 6,
          }}
        >
          <Avatar className="h-5 w-5 ring-1 ring-white/15">
            <AvatarImage
              src={leg.avatarUrl ?? undefined}
              alt={leg.fullName ?? leg.email}
            />
            <AvatarFallback className="bg-primary text-primary-foreground text-[8px] font-bold">
              {initialsFor(leg.fullName, leg.email)}
            </AvatarFallback>
          </Avatar>
        </motion.div>
      ))}
    </div>
  )
}
