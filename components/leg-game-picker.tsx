'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { SlateGame } from '@/lib/data/week-slate'

/**
 * WHICH GAME IS THIS ON — the field that was missing.
 *
 * A leg has always been free text, so nothing connected "Puka 90+ rec
 * yards" to Rams @ Jaguars. The slate papered over that by hashing the
 * leg id and scattering everyone's bets across the schedule at random,
 * which put your face, ringed in win-or-loss colour, on games you never
 * touched. Asking is the fix.
 *
 * NOT ONE GAME is a real answer, not an escape hatch. "DK/ASB combined
 * rec yards 150+" spans two of them and always will; forcing a single
 * choice there would manufacture exactly the kind of false link this
 * field exists to end.
 *
 * The slate's own order, so it reads like the page above it: day
 * groups, kickoff order, in-slate games first.
 */
export function LegGamePicker({
  games,
  value,
  onChange,
  className,
}: {
  games: SlateGame[]
  /** null = "not one game". undefined = nothing chosen yet. */
  value: string | null | undefined
  onChange: (gameId: string | null) => void
  className?: string
}) {
  // The league's own slate first — that's what people are betting — then
  // the rest of the week, because someone always takes a game off-slate.
  const ordered = useMemo(
    () =>
      [...games].sort((a, b) => {
        if (a.inSlate !== b.inSlate) return a.inSlate ? -1 : 1
        return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      }),
    [games]
  )

  if (ordered.length === 0) return null

  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.2em] uppercase">
        Which game
      </p>
      <div className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1">
        {ordered.map((g) => {
          const on = value === g.id
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onChange(on ? null : g.id)}
              aria-pressed={on}
              className={cn(
                'shrink-0 snap-start rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                on
                  ? 'border-neon-blue/60 bg-neon-blue/10'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/25'
              )}
            >
              <span
                className={cn(
                  'block text-[11px] font-bold tracking-wide whitespace-nowrap uppercase',
                  on ? 'text-neon-blue' : 'text-foreground/80'
                )}
              >
                {g.away.abbr}
                <span className="text-muted-foreground/50"> @ </span>
                {g.home.abbr}
              </span>
              <span className="text-muted-foreground/60 block text-[9px] whitespace-nowrap">
                {kickoffLabel(g.kickoff)}
                {!g.inSlate && ' · off slate'}
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={cn(
          'text-[10px] tracking-wide transition-colors',
          value === null
            ? 'text-foreground/70'
            : 'text-muted-foreground/50 hover:text-muted-foreground'
        )}
      >
        {value === null ? '✓ ' : ''}Not one game
      </button>
    </div>
  )
}

const kickoffLabel = (iso: string) =>
  new Date(iso)
    .toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      hour: 'numeric',
    })
    .replace(',', '')
    .toLowerCase()
