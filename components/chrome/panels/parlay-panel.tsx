'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { CheckCircle2, Minus, Skull } from 'lucide-react'
import { useViewedWeek } from '@/components/chrome/league-chrome-context'
import { cn } from '@/lib/utils'

export interface ParlayPanelLeg {
  id: string
  userId: string
  fullName: string | null
  email: string
  avatarUrl: string | null
  description: string
  odds: number
  result: 'win' | 'loss' | 'push' | null
}

export interface ParlayPanelWeek {
  legs: ParlayPanelLeg[]
  missing: Array<{
    userId: string
    fullName: string | null
    email: string
    avatarUrl: string | null
  }>
  totalOdds: string | null
}

/**
 * THE LAY — one row per person, always. Everyone in the league appears,
 * whether they've picked or not: a missing leg is a fact about that
 * person, not a separate category of thing, so there's no "still owing"
 * section pulling the roster apart.
 *
 * The order is how far along you are — settled first, then in but
 * pending, then the people who still owe one. So the top of the list is
 * what happened and the bottom is who we're waiting on.
 */
export function ParlayPanel({
  weeks,
}: {
  /** Every week's lay, keyed by week id. */
  weeks: Record<string, ParlayPanelWeek>
}) {
  const week = useViewedWeek()
  const lay = week ? weeks[week.id] : undefined

  if (!week || !lay) {
    return (
      <p className="text-muted-foreground px-1 py-4 text-xs italic">
        No parlay for this week.
      </p>
    )
  }

  // Settled → in but pending → still owing. Within a tier, keep the
  // order the server gave (leg order, then roster order).
  const rows: Row[] = [
    ...lay.legs
      .filter((l) => l.result !== null)
      .map((leg) => ({ kind: 'leg' as const, leg })),
    ...lay.legs
      .filter((l) => l.result === null)
      .map((leg) => ({ kind: 'leg' as const, leg })),
    ...lay.missing.map((person) => ({ kind: 'empty' as const, person })),
  ]

  const hit = lay.legs.filter((l) => l.result === 'win').length
  const graded = lay.legs.filter((l) => l.result !== null).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex shrink-0 items-baseline justify-between gap-2">
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.3em] uppercase">
          Week {week.weekNumber}
        </p>
        <p className="text-foreground/80 text-xs font-bold tabular-nums">
          {graded > 0 ? (
            <span className={hit === graded ? 'text-neon-blue' : 'text-foreground/80'}>
              {hit}/{graded} hit
            </span>
          ) : (
            lay.totalOdds
          )}
        </p>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2">
        {rows.map((row) =>
          row.kind === 'leg' ? (
            <LegRow key={row.leg.id} leg={row.leg} />
          ) : (
            <EmptyRow key={row.person.userId} person={row.person} />
          )
        )}
        {rows.length === 0 && (
          <p className="text-muted-foreground px-1 py-4 text-xs italic">
            Nobody in this league yet.
          </p>
        )}
      </div>
    </div>
  )
}

type Row =
  | { kind: 'leg'; leg: ParlayPanelLeg }
  | { kind: 'empty'; person: ParlayPanelWeek['missing'][number] }

/** One person, one card — their name, their leg, and how it went. */
function LegRow({ leg }: { leg: ParlayPanelLeg }) {
  const settled = leg.result !== null
  return (
    <div
      className={cn(
        'rounded-lg border px-2.5 py-2',
        leg.result === 'win'
          ? 'border-neon-blue/30 bg-neon-blue/5'
          : leg.result === 'loss'
            ? 'border-destructive/30 bg-destructive/5'
            : 'border-white/10 bg-white/[0.02]'
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar className="h-5 w-5 shrink-0 ring-1 ring-white/10">
          <AvatarImage src={leg.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="bg-primary/80 text-primary-foreground text-[8px] font-bold">
            {initialsOf(leg.fullName, leg.email)}
          </AvatarFallback>
        </Avatar>
        <span className="text-foreground/70 min-w-0 flex-1 truncate text-[11px] font-semibold">
          {firstNameOf(leg.fullName, leg.email)}
        </span>
        <span
          className={cn(
            'shrink-0 text-[11px] font-bold tabular-nums',
            leg.result === 'win'
              ? 'text-neon-blue'
              : leg.result === 'loss'
                ? 'text-destructive'
                : 'text-foreground/70'
          )}
        >
          {leg.odds > 0 ? `+${leg.odds}` : leg.odds}
        </span>
        {settled && <ResultMark result={leg.result} />}
      </div>
      <p className="text-foreground/90 mt-1 pl-7 text-xs leading-snug break-words">
        {leg.description}
      </p>
    </div>
  )
}

/** Same card, nothing in it — the person is present, the pick isn't. */
function EmptyRow({
  person,
}: {
  person: ParlayPanelWeek['missing'][number]
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 px-2.5 py-2">
      <Avatar className="h-5 w-5 shrink-0 opacity-50 ring-1 ring-white/10">
        <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="bg-white/10 text-[8px] font-bold">
          {initialsOf(person.fullName, person.email)}
        </AvatarFallback>
      </Avatar>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px] font-semibold">
        {firstNameOf(person.fullName, person.email)}
      </span>
      <span className="text-muted-foreground/60 shrink-0 text-[10px] italic">
        no pick
      </span>
    </div>
  )
}

function ResultMark({ result }: { result: ParlayPanelLeg['result'] }) {
  if (result === 'win')
    return <CheckCircle2 className="text-neon-blue h-3.5 w-3.5 shrink-0" />
  if (result === 'loss')
    return <Skull className="text-destructive h-3.5 w-3.5 shrink-0" />
  return <Minus className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
}

function initialsOf(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function firstNameOf(name: string | null, email: string): string {
  return name?.split(' ')[0] ?? email.split('@')[0] ?? email
}
