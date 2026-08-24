'use client'

import { ArrowRight, Crown } from 'lucide-react'
import { openSeasonSheet } from '@/components/chrome/canvas-store'
import { seasonLabel } from '@/components/chrome/season-sheet'

/**
 * The off-season card's doorway. Season Setup itself — the charter, the
 * polls, the rules the league argues about — lives in the SEASON SHEET
 * (masthead lockup), because it's league business rather than the week's
 * content. This is the prompt that gets you there, wearing enough state
 * to be worth glancing at.
 */
export function SeasonSetupCallout({
  season,
  openPolls,
  lockedEntries,
  totalEntries,
}: {
  season: string
  openPolls: number
  lockedEntries: number
  totalEntries: number
}) {
  const remaining = Math.max(0, totalEntries - lockedEntries)

  return (
    <button
      type="button"
      onClick={openSeasonSheet}
      className="group border-primary/25 hover:border-primary/50 hover:bg-white/[0.04] relative w-full overflow-hidden rounded-xl border bg-white/[0.02] px-5 py-5 text-left transition-colors"
    >
      <Crown
        aria-hidden
        className="text-neon-blue pointer-events-none absolute -right-4 -bottom-5 h-28 w-28 opacity-[0.07]"
        strokeWidth={1.5}
      />

      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.3em] uppercase">
        {seasonLabel(season)} Season
      </p>
      <h2 className="text-neon-blue mt-1 text-2xl">Season Setup</h2>
      <p className="text-muted-foreground mt-1.5 max-w-md text-sm">
        {remaining > 0
          ? `${remaining} of ${totalEntries} charter items still open${
              openPolls > 0 ? ` · ${openPolls} poll${openPolls === 1 ? '' : 's'} need votes` : ''
            }.`
          : 'The charter is settled. Tap to review the rules.'}
      </p>

      <span className="text-neon-blue mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.25em] uppercase">
        Open setup
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}
