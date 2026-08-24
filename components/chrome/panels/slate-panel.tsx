'use client'

import Link from 'next/link'
import { CheckCircle2, Clock, Lock, Minus, Skull, Trophy } from 'lucide-react'
import { closePanel } from '@/components/chrome/canvas-store'
import { cn } from '@/lib/utils'

export interface SlatePanelWeek {
  /** URL id (the parlay id). */
  id: string
  weekNumber: number
  parlayState: 'open' | 'locked' | 'graded' | 'won' | 'lost'
  submissionCount: number
  memberCount: number
  /** The viewer's own result for the week, null while pending / absent. */
  myResult: 'win' | 'loss' | 'push' | null
  isCurrent: boolean
}

/**
 * The SLATE panel: the season's weeks, newest first, each a real route
 * (deep-linkable) — tapping one closes the reveal and navigates. The
 * current week rides on top wearing its live state.
 */
export function SlatePanel({
  leagueId,
  weeks,
}: {
  leagueId: string
  weeks: SlatePanelWeek[]
}) {
  const ordered = [...weeks].sort((a, b) => b.weekNumber - a.weekNumber)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="text-muted-foreground mb-3 shrink-0 text-[10px] font-bold tracking-[0.3em] uppercase">
        Season weeks
      </p>
      <div className="scrollbar-hide min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2">
        {ordered.map((w) => (
          <Link
            key={w.id}
            href={`/leagues/${leagueId}/weeks/${w.id}`}
            onClick={closePanel}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
              w.isCurrent
                ? 'border-neon-blue/40 bg-neon-blue/10 hover:bg-neon-blue/15'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
            )}
          >
            <span
              className={cn(
                'font-display w-12 shrink-0 text-lg leading-none',
                w.isCurrent ? 'text-neon-blue' : 'text-foreground/80'
              )}
            >
              W{w.weekNumber}
            </span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px] tracking-wider uppercase">
              {w.parlayState === 'open'
                ? `${w.submissionCount}/${w.memberCount} in`
                : w.parlayState === 'locked'
                  ? 'Locked'
                  : w.parlayState === 'graded'
                    ? 'Grading'
                    : w.parlayState === 'won'
                      ? 'Won'
                      : 'Lost'}
            </span>
            <StateIcon week={w} />
          </Link>
        ))}
        {ordered.length === 0 && (
          <p className="text-muted-foreground px-1 py-4 text-xs italic">
            No weeks yet — the season hasn&apos;t started.
          </p>
        )}
      </div>
    </div>
  )
}

function StateIcon({ week }: { week: SlatePanelWeek }) {
  if (week.parlayState === 'won')
    return <Trophy className="text-neon-blue h-4 w-4 shrink-0" />
  if (week.parlayState === 'lost')
    return <Skull className="text-destructive h-4 w-4 shrink-0" />
  if (week.parlayState === 'graded')
    return <CheckCircle2 className="text-muted-foreground h-4 w-4 shrink-0" />
  if (week.parlayState === 'locked')
    return <Lock className="text-neon-blue h-4 w-4 shrink-0" />
  if (week.myResult === 'push')
    return <Minus className="text-muted-foreground h-4 w-4 shrink-0" />
  return <Clock className="text-muted-foreground h-4 w-4 shrink-0" />
}
