'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight } from 'lucide-react'
import {
  closeSeasonSheet,
  subscribeSeasonSheet,
} from '@/components/chrome/canvas-store'
import { ResponsiveSheet, SheetPage } from '@/components/ui/responsive-sheet'
import { setViewSeason } from '@/app/actions/view-season'
import { cn } from '@/lib/utils'
import type { LeagueSwitcherRow } from '@/components/league-sheet'

/**
 * THE SEASON — which league you're in, which year you're looking at, and
 * (off-season) the charter that defines it, on ONE sheet. Modelled on
 * RoarTracker's season panel: the title IS the active season, the body is
 * what the season is made of, and the alternatives list underneath.
 *
 * One channel, one trigger (the masthead lockup), so a click on the
 * season means the same thing at every width.
 */
export function SeasonSheet({
  season,
  availableSeasons,
  leagues,
  activeLeagueId,
  setup,
}: {
  season: string
  availableSeasons: string[]
  leagues: LeagueSwitcherRow[]
  activeLeagueId: string
  /** Season Setup (the charter + polls hub) — off/preseason only. */
  setup?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => subscribeSeasonSheet(setOpen), [])

  return (
    <ResponsiveSheet
      open={open}
      onClose={closeSeasonSheet}
      maxWidth="max-w-3xl"
      sheetMaxHeight="92dvh"
    >
      <SheetPage name="main" title={`${seasonLabel(season)} Season`}>
        <div className="space-y-7 pb-2">
          {setup}

          <Section label="Season">
            {availableSeasons.map((s) => (
              <SeasonRow
                key={s}
                season={s}
                active={s === season}
                isDefault={s === availableSeasons[0]}
              />
            ))}
          </Section>

          {/* Single-tenant today: with one league this renders nothing.
              Left in place so multi-league is a data question, not a
              rewrite, if it ever comes back. */}
          {leagues.length > 1 && (
            <Section label="League">
              {leagues.map((l) => (
                <LeagueRow key={l.id} league={l} active={l.id === activeLeagueId} />
              ))}
            </Section>
          )}
        </div>
      </SheetPage>
    </ResponsiveSheet>
  )
}

/** "2025-2026" → "2025". The span is implied; the year is the name. */
export function seasonLabel(season: string): string {
  return season.split('-')[0] ?? season
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-[10px] font-bold tracking-[0.3em] uppercase">
        {label}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function SeasonRow({
  season,
  active,
  isDefault,
}: {
  season: string
  active: boolean
  isDefault: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const pick = () => {
    if (active) return
    start(async () => {
      // Picking the calendar's own season clears the pin rather than
      // freezing you on it.
      await setViewSeason(isDefault ? null : season)
      router.refresh()
      closeSeasonSheet()
    })
  }

  return (
    <button
      type="button"
      onClick={pick}
      disabled={pending}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
        active
          ? 'border-neon-blue/40 bg-neon-blue/10'
          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]',
        pending && 'opacity-50'
      )}
    >
      <span
        className={cn(
          'font-display text-lg leading-none',
          active ? 'text-neon-blue' : 'text-foreground/80'
        )}
      >
        {seasonLabel(season)}
      </span>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px] tracking-wider uppercase">
        {season}
        {isDefault && !active ? ' · current' : ''}
      </span>
      {active ? (
        <Check className="text-neon-blue h-4 w-4 shrink-0" />
      ) : (
        <ChevronRight className="text-muted-foreground/50 h-4 w-4 shrink-0" />
      )}
    </button>
  )
}

function LeagueRow({
  league,
  active,
}: {
  league: LeagueSwitcherRow
  active: boolean
}) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        if (active) return
        closeSeasonSheet()
        router.push(`/leagues/${league.id}`)
      }}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
        active
          ? 'border-neon-blue/40 bg-neon-blue/10'
          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
      )}
    >
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm font-semibold',
          active ? 'text-neon-blue' : 'text-foreground/90'
        )}
      >
        {league.name}
      </span>
      <span className="text-muted-foreground shrink-0 text-[10px] tracking-[0.2em] uppercase">
        {league.role}
      </span>
      {active ? (
        <Check className="text-neon-blue h-4 w-4 shrink-0" />
      ) : (
        <ChevronRight className="text-muted-foreground/50 h-4 w-4 shrink-0" />
      )}
    </button>
  )
}
