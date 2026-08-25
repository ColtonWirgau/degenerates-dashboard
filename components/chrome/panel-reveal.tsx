'use client'

import { useEffect, useRef, useState } from 'react'
import {
  closePanel,
  subscribePanel,
  type CanvasPanel,
} from '@/components/chrome/canvas-store'
import { ResponsiveSheet, SheetPage } from '@/components/ui/responsive-sheet'
import { ScrollHint } from '@/components/ui/scroll-hint'
import { useLeagueChrome } from '@/components/chrome/league-chrome-context'
import { Skeleton } from '@/components/ui/skeleton'

/* Which panels are ABOUT the season, and so are lying while one is being
 * switched. SEASON is the panel you're pressing — skeletoning the list
 * you're using would be absurd — and PROFILE is you, which doesn't change
 * with the year. Everything else is that season's weeks, legs, standings
 * and votes, and holds last year's numbers until the refresh lands. */
const SEASON_BOUND = new Set<CanvasPanel>(['slate', 'parlay', 'board', 'submit'])

/**
 * Dual-posture wrapper for a canvas panel (the RoarTracker pattern, on
 * this app's ResponsiveSheet): mounted inside a CanvasSheet slot, it
 * renders its children straight into the slot at lg+ (the slot handles
 * show/hide), and as a portaled bottom sheet below lg (the slot div is
 * display:none there, but portals escape it).
 */
export function PanelReveal({
  panel,
  children,
}: {
  panel: Exclude<CanvasPanel, null>
  children: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState<CanvasPanel>(null)
  const [wide, setWide] = useState<boolean | null>(null)
  const chrome = useLeagueChrome()
  useEffect(() => subscribePanel(setCurrent), [])
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const body =
    chrome?.switching && SEASON_BOUND.has(panel) ? <PanelSkeleton /> : children

  // Before hydration settles, render the wide posture (harmless: the slot
  // is hidden below lg and no sheet can be open yet).
  if (wide !== false) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col">
          {body}
        </div>
        {/* Fog only — the panels are narrow and a chip would crowd them. */}
        <ScrollHint containerRef={scrollRef} showChip={false} />
      </div>
    )
  }

  return (
    <ResponsiveSheet
      open={current === panel}
      onClose={closePanel}
      sheetMaxHeight="92dvh"
      label={PANEL_LABELS[panel]}
    >
      {/* No title here: every panel already opens with its own heading,
          and SheetPage only paints one on a drilled-in page anyway. One
          heading, one place, at every width.

          THE SAME BOX THE DESKTOP SLOT GIVES. A panel is written once
          and shown in two places, and several of them reach their own
          corner with a negative margin that cancels this padding — the
          slab behind THE LAY, the one behind THE BOARD. The sheet used
          to hand them no padding at all, so those margins had nothing to
          cancel: the slab hung a full 20px off the left edge with the
          heading cut in half, and the odds ran off the right. */}
      <SheetPage name="main">
        <div className="flex min-h-0 flex-1 flex-col px-5 pt-3 pb-4">{body}</div>
      </SheetPage>
    </ResponsiveSheet>
  )
}

/** What the sheet is called when it announces itself, and what its close
 *  button says it closes. */
const PANEL_LABELS: Record<Exclude<CanvasPanel, null>, string> = {
  slate: 'weeks',
  board: 'the board',
  season: 'the season',
  parlay: 'the lay',
  profile: 'your profile',
  submit: 'your leg',
  ask: 'ask the league',
  compose: 'the book',
  keeper: 'keepers',
  venue: 'the room',
}

/** Every season-bound panel is the same object: a heading, then a column
 *  of rows. One skeleton serves all of them. */
function PanelSkeleton() {
  return (
    <div aria-busy="true" className="flex min-h-0 flex-1 flex-col">
      <Skeleton className="mb-3 h-6 w-32 shrink-0" />
      <div className="space-y-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-11 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
