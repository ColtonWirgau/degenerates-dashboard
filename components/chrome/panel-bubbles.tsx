'use client'

import { useEffect, useState } from 'react'
import { Layers, ListTodo, Trophy } from 'lucide-react'
import {
  useLeagueChrome,
  useViewedWeek,
  type ChromeWeek,
} from '@/components/chrome/league-chrome-context'
import {
  openPanel,
  subscribePanel,
  type CanvasPanel,
} from '@/components/chrome/canvas-store'
import { ArcLabel } from '@/components/chrome/arc-label'
import { DISC_CENTER } from '@/components/chrome/bite-geometry'
import { railC, setRailCount } from '@/components/chrome/bubble-layout'

/**
 * The card's LEFT rail — the clipped-cutout construction ported from
 * RoarTracker, each bubble wearing its panel's live fact. In order,
 * always:
 *
 *   PARLAY  this week's twelve legs — who's in, who hit
 *   BOARD   your rank, opens the standings
 *   POLLS   this week's open votes
 *
 * The week list is NOT here any more. It had a bubble wearing the week's
 * number while the page's own title was that same number, six inches
 * away — so the title took the job: the slab in the top-left corner is
 * what opens the list now. The rail starts lower down to leave that
 * corner alone (see RAIL_TOP).
 *
 * The first and last come and go with the week (the preseason has no
 * parlay; most weeks have no polls) and the rail closes up behind them,
 * so it's never a ladder with a rung missing. Open, a bubble becomes its
 * own ✕. They render inside .page-sheet, so they ride every slide the
 * card makes.
 */
type Rung = 'parlay' | 'board' | 'polls'

export function PanelBubbles() {
  const chrome = useLeagueChrome()
  const week = useViewedWeek()
  const [panel, setPanel] = useState<CanvasPanel>(null)
  useEffect(() => subscribePanel(setPanel), [])

  const hasParlay = week?.parlayId != null
  const hasPolls = (week?.pollCount ?? 0) > 0

  // Rail order is fixed; presence is not. The clip follows exactly —
  // resolveBites carves this many holes, top-down.
  const rungs: Rung[] = []
  if (hasParlay) rungs.push('parlay')
  rungs.push('board')
  if (hasPolls) rungs.push('polls')

  const count = rungs.length
  useEffect(() => {
    setRailCount(count)
  }, [count])

  if (!chrome) return null

  return (
    <>
      {rungs.map((p, i) => {
        const open = panel === p
        return (
          <button
            key={p}
            type="button"
            data-sheet-bubble
            onClick={() => openPanel(p)}
            aria-label={open ? 'Close panel' : `${p} panel`}
            aria-expanded={open}
            // The default focus outline traces the rectangular hit-box —
            // a floating box around a circle reads as a glitch. Focus rings
            // the DISC instead.
            className="group hidden focus-visible:outline-none lg:block"
            style={{
              position: 'absolute',
              top: railC(i) - DISC_CENTER,
              left: 0,
              transform: 'translateX(-50%)',
              width: 64,
              height: 75,
              zIndex: 40,
            }}
          >
            {/* The panel's name curved around the bite, out on the canvas —
                letter-by-letter placement (see arc-label). */}
            <ArcLabel
              text={arcText(p)}
              cx={44}
              cy={49.5}
              r={39.5}
              side="right"
              boxW={88}
              boxH={99}
              inset={12}
              fontSize={8}
              bias={1.2}
            />
            {/* No painted outer circle: the bite is punched out of the card
                itself and the ambient canvas shows through. Only the neon
                disc floats in the hole. */}
            <span
              className="neon-disc group-focus-visible:ring-2 group-focus-visible:ring-white absolute flex items-center justify-center rounded-full"
              style={{ left: 10, top: 15.5, width: 44, height: 44 }}
            >
              <span
                key={`${p}-${open}-${faceKey(p, week, chrome.myRank)}`}
                className="face-pop flex items-center justify-center"
              >
                {open ? (
                  <span aria-hidden className="text-[1.15rem] leading-none">
                    ✕
                  </span>
                ) : (
                  <Face panel={p} week={week} myRank={chrome.myRank} />
                )}
              </span>
            </span>
          </button>
        )
      })}
    </>
  )
}

function arcText(panel: Rung): string {
  switch (panel) {
    case 'parlay':
      return 'THE LAY'
    case 'board':
      return 'BOARD'
    case 'polls':
      return 'POLLS'
  }
}

function faceKey(
  panel: Rung,
  week: ChromeWeek | null,
  myRank: number | null
): string | number {
  switch (panel) {
    case 'parlay':
      return week?.submissionCount ?? 0
    case 'board':
      return myRank ?? '–'
    case 'polls':
      return week?.openPollCount ?? 0
  }
}

function Face({
  panel,
  week,
  myRank,
}: {
  panel: Rung
  week: ChromeWeek | null
  myRank: number | null
}) {
  switch (panel) {
    case 'parlay':
      return (week?.submissionCount ?? 0) > 0 ? (
        <span className="font-display text-[1.05rem] leading-none">
          {week!.submissionCount}
        </span>
      ) : (
        <Layers size={19} strokeWidth={2.25} />
      )
    case 'board':
      return myRank != null ? (
        <span className="font-display text-[0.95rem] leading-none">#{myRank}</span>
      ) : (
        <Trophy size={20} strokeWidth={2.25} />
      )
    case 'polls':
      return (week?.openPollCount ?? 0) > 0 ? (
        <span className="font-display text-[1.05rem] leading-none">
          {week!.openPollCount}
        </span>
      ) : (
        <ListTodo size={20} strokeWidth={2.25} />
      )
  }
}
