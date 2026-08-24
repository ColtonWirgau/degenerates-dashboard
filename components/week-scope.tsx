'use client'

import { useEffect, useState } from 'react'
import { Flame, Globe, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * HOW WIDE A NET THE SLATE CASTS — one control, three scopes, shared
 * between the week's header (where the switch lives) and the slate itself
 * (which does the filtering). A module store rather than props because
 * the two sit on opposite sides of a server component; same pattern as
 * the chrome's canvas-store.
 *
 * Narrowest first, so the switch reads left-to-right as a zoom out:
 * ACTION (games we've got money on) → SLATE (what this league may bet) →
 * ALL (everything the NFL is playing this week). "Action" is the
 * bettor's word for money already down, which beats "with bets".
 */
export const SCOPES = ['action', 'slate', 'all'] as const
export type SlateScope = (typeof SCOPES)[number]

export const SCOPE_LABEL: Record<SlateScope, string> = {
  action: 'Action',
  slate: 'Betting slate',
  all: 'All games',
}

const SCOPE_ICON: Record<SlateScope, typeof Flame> = {
  action: Flame,
  slate: Target,
  all: Globe,
}

const SCOPE_HINT: Record<SlateScope, string> = {
  action: 'Showing only games the league has money on',
  slate: "Showing the league's betting slate",
  all: 'Showing every game this week',
}

let scope: SlateScope = 'slate'
const listeners = new Set<(s: SlateScope) => void>()

/**
 * Reset to the week's natural scope when you move between weeks. A week
 * still open is a shopping trip — you want to see what's available. Once
 * it locks, the only games that matter are the ones we're riding on.
 */
export function resetSlateScope(postLock: boolean, actionCount: number) {
  setSlateScope(postLock && actionCount > 0 ? 'action' : 'slate')
}

export function setSlateScope(next: SlateScope) {
  if (scope === next) return
  scope = next
  listeners.forEach((l) => l(scope))
}

/** Advance one notch, wrapping — the whole pill is the button. */
export function cycleSlateScope() {
  setSlateScope(SCOPES[(SCOPES.indexOf(scope) + 1) % SCOPES.length]!)
}

export function useSlateScope(): SlateScope {
  const [s, setS] = useState<SlateScope>(scope)
  useEffect(() => {
    listeners.add(setS)
    setS(scope)
    return () => {
      listeners.delete(setS)
    }
  }, [])
  return s
}

/**
 * The switch: a dark disc SLIDES between three slots (a physical move, so
 * it gets a real ease, not a snap) while the icons trade ink under it.
 * The whole pill is one button — clicking anywhere advances a notch, so
 * you never have to aim at the icon you want.
 */
export function SlateScopePill({
  counts,
  className,
  hideLabel = false,
}: {
  /** How many games each scope would show. */
  counts: Record<SlateScope, number>
  className?: string
  /** The section header already names the scope — don't say it twice. */
  hideLabel?: boolean
}) {
  const current = useSlateScope()
  const index = SCOPES.indexOf(current)

  return (
    <button
      type="button"
      onClick={cycleSlateScope}
      aria-label={`${SCOPE_HINT[current]}. Click to change.`}
      title={SCOPE_HINT[current]}
      className={cn('group inline-flex flex-col items-end gap-1', className)}
    >
      {/* The word normally sits ABOVE the switch, naming what you're
          looking at. Where a section header already says it — the slate's
          own heading does — the switch goes wordless rather than
          repeating it a hand's width away. */}
      {!hideLabel && (
        <span className="text-muted-foreground group-hover:text-foreground/80 text-[10px] font-bold tracking-[0.25em] whitespace-nowrap uppercase tabular-nums transition-colors">
          {SCOPE_LABEL[current]} · {counts[current]}
        </span>
      )}
      <span className="relative flex items-center gap-1 rounded-full bg-white/[0.04] p-1 ring-1 ring-white/10">
        {/* The slider: size-7 disc, one gap (4px) over — 32px of travel. */}
        <span
          aria-hidden
          className="bg-neon-blue/20 ring-neon-blue/40 absolute top-1 left-1 size-7 rounded-full ring-1 transition-transform duration-[260ms] ease-[cubic-bezier(0.2,0.9,0.25,1)]"
          style={{ transform: `translateX(${index * 32}px)` }}
        />
        {SCOPES.map((s) => {
          const Icon = SCOPE_ICON[s]
          return (
            <span
              key={s}
              aria-hidden
              className={cn(
                'relative flex size-7 items-center justify-center transition-colors duration-200',
                s === current ? 'text-neon-blue' : 'text-muted-foreground/50'
              )}
            >
              <Icon size={14} strokeWidth={2.5} />
            </span>
          )
        })}
      </span>
    </button>
  )
}
