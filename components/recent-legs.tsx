'use client'

import { ChevronRight, Clock, Minus, Skull, Trophy, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RecentLeg {
  id: string
  description: string
  odds: string
  result: 'win' | 'loss' | 'push' | null
  week_number: number
  week_id: string
}

interface RecentLegsProps {
  legs: RecentLeg[]
  maxDisplay?: number
  /** Tap a row → open that week's parlay in a sheet. */
  onOpenWeek: (weekId: string) => void
  /** Override the default "Recent Legs" header. */
  title?: string
  /** Skip rendering the header entirely. */
  hideHeader?: boolean
}

const formatOdds = (raw: string) => {
  const s = String(raw).trim()
  const n = parseInt(s.replace(/[^-\d]/g, ''), 10)
  if (isNaN(n)) return s
  return n > 0 ? `+${n}` : `${n}`
}

const RESULT_TONE: Record<
  'win' | 'loss' | 'push' | 'pending',
  { border: string; text: string; Icon: LucideIcon }
> = {
  win: {
    border: 'border-neon-blue/30 hover:border-neon-blue/60',
    text: 'text-neon-blue',
    Icon: Trophy,
  },
  loss: {
    border: 'border-destructive/30 hover:border-destructive/60',
    text: 'text-destructive',
    Icon: Skull,
  },
  push: {
    border: 'border-white/20 hover:border-white/40',
    text: 'text-foreground/70',
    Icon: Minus,
  },
  pending: {
    border: 'border-white/10 hover:border-primary/30',
    text: 'text-muted-foreground',
    Icon: Clock,
  },
}

export function RecentLegs({
  legs,
  maxDisplay = 5,
  onOpenWeek,
  title = 'Recent Legs',
  hideHeader = false,
}: RecentLegsProps) {
  const displayLegs = legs.slice(0, maxDisplay)

  return (
    <div className="flex flex-col">
      {!hideHeader && (
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground mb-3">
          {title}
        </p>
      )}
      {legs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">No legs submitted yet.</p>
      ) : (
        <div className="space-y-2.5">
          {displayLegs.map((leg) => {
            const tone = RESULT_TONE[leg.result ?? 'pending']
            const Icon = tone.Icon
            return (
              <button
                key={leg.id}
                type="button"
                onClick={() => onOpenWeek(leg.week_id)}
                className={cn(
                  'group flex items-center gap-3 w-full rounded-lg border bg-white/[0.02] px-3 py-3 transition-all hover:bg-white/[0.04] text-left',
                  tone.border
                )}
              >
                {/* Result icon (Trophy / Skull / Minus / Clock) — leftmost, sets tone */}
                <Icon className={cn('h-7 w-7 shrink-0', tone.text)} aria-hidden />

                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">
                    Wk {leg.week_number}
                  </span>
                  <p className="text-sm font-medium text-foreground/90 break-words line-clamp-2">
                    {leg.description || 'No description'}
                  </p>
                </div>

                {/* Odds inline with the more-icon — odds reads like a
                    Sleeper line value, ... is the tap-for-more hint. */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'text-base font-bold tabular-nums leading-none',
                      (parseInt(String(leg.odds).replace(/[^-\d]/g, ''), 10) || 0) > 0
                        ? 'text-foreground/90'
                        : 'text-muted-foreground'
                    )}
                  >
                    {formatOdds(leg.odds)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
