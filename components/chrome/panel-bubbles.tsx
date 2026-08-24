'use client'

import { useEffect, useState } from 'react'
import { Calendar, ListTodo, Trophy } from 'lucide-react'
import { useLeagueChrome } from '@/components/chrome/league-chrome-context'
import {
  openPanel,
  subscribePanel,
  type CanvasPanel,
} from '@/components/chrome/canvas-store'
import { ArcLabel } from '@/components/chrome/arc-label'
import { DISC_CENTER } from '@/components/chrome/bite-geometry'
import { SLATE_C, BOARD_C, POLLS_C, setSeasonMode } from '@/components/chrome/bubble-layout'

/**
 * The LEAGUE'S STATE as bubbles on the card's LEFT edge — the clipped-
 * cutout construction ported from RoarTracker, each wearing its panel's
 * live fact: SLATE the week number, BOARD your rank, POLLS the open count.
 * Open, a bubble becomes its own ✕. They render inside .page-sheet, so
 * they ride every slide the card makes. (You + the action live on the
 * RIGHT edge — AvatarNotch / ActionBubble.)
 */
const BUBBLES: { panel: Exclude<CanvasPanel, null>; top: number }[] = [
  { panel: 'slate', top: SLATE_C - DISC_CENTER },
  { panel: 'board', top: BOARD_C - DISC_CENTER },
  { panel: 'polls', top: POLLS_C - DISC_CENTER },
]

export function PanelBubbles() {
  const chrome = useLeagueChrome()
  const [panel, setPanel] = useState<CanvasPanel>(null)
  useEffect(() => subscribePanel(setPanel), [])

  const offseason =
    chrome?.seasonKind === 'offseason' || chrome?.seasonKind === 'preseason'
  // The clip follows the chrome: off-/preseason carves no slate bite.
  useEffect(() => {
    setSeasonMode(offseason ? 'offseason' : 'in-season')
  }, [offseason])

  if (!chrome) return null
  const bubbles = offseason ? BUBBLES.filter((b) => b.panel !== 'slate') : BUBBLES

  const arcText = (p: Exclude<CanvasPanel, null>): string => {
    if (p === 'slate')
      return chrome.weekNumber != null ? `WEEK ${chrome.weekNumber}` : 'SLATE'
    if (p === 'board') return 'BOARD'
    return 'POLLS'
  }

  return (
    <>
      {bubbles.map(({ panel: p, top }) => {
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
              top,
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
                key={`${p}-${open}-${p === 'slate' ? chrome.weekNumber : p === 'board' ? chrome.myRank : chrome.openPollCount}`}
                className="face-pop flex items-center justify-center"
              >
                {open ? (
                  <span aria-hidden className="text-[1.15rem] leading-none">
                    ✕
                  </span>
                ) : p === 'slate' ? (
                  chrome.weekNumber != null ? (
                    <span className="font-display text-[1.05rem] leading-none">
                      {chrome.weekNumber}
                    </span>
                  ) : (
                    <Calendar size={20} strokeWidth={2.25} />
                  )
                ) : p === 'board' ? (
                  chrome.myRank != null ? (
                    <span className="font-display text-[0.95rem] leading-none">
                      #{chrome.myRank}
                    </span>
                  ) : (
                    <Trophy size={20} strokeWidth={2.25} />
                  )
                ) : chrome.openPollCount > 0 ? (
                  <span className="font-display text-[1.05rem] leading-none">
                    {chrome.openPollCount}
                  </span>
                ) : (
                  <ListTodo size={20} strokeWidth={2.25} />
                )}
              </span>
            </span>
          </button>
        )
      })}
    </>
  )
}
