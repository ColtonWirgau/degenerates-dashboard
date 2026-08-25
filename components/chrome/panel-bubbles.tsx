'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  useLeagueChrome,
  useOnRecap,
  type PodiumMember,
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
 * RoarTracker, the bubble wearing its panel's live fact:
 *
 *   BOARD   the season's podium, three faces in gold, silver and bronze
 *
 * The week list is NOT here any more. It had a bubble wearing the week's
 * number while the page's own title was that same number, six inches
 * away — so the title took the job: the slab in the top-left corner is
 * what opens the list now. The rail starts lower down to leave that
 * corner alone (see RAIL_TOP).
 *
 * There was a third, POLLS, and it's gone: the preseason page lists
 * every vote under ON THE BALLOT already, and a rung saying the same
 * thing smaller could only agree with it by accident.
 *
 * THE LAY was the other one, and it's gone the same way: the week hero's
 * right half IS the lay — everyone's leg, drawn — so pressing it opens
 * the panel. A rung wearing a count of the same legs was a second, worse
 * way of saying what a whole half of the hero already says.
 *
 * Open, a bubble becomes its own ✕. They render inside .page-sheet, so
 * they ride every slide the card makes.
 */
type Rung = 'board'

export function PanelBubbles() {
  const chrome = useLeagueChrome()
  const onRecap = useOnRecap()
  const [panel, setPanel] = useState<CanvasPanel>(null)
  useEffect(() => subscribePanel(setPanel), [])

  // ONE RUNG. The clip follows exactly — resolveBites carves this many
  // holes, top-down.
  //
  // The recap empties it: the BOARD is already the middle of that page,
  // and a rung that opens a panel over the thing it duplicates is a door
  // to the room you're standing in.
  const rungs: Rung[] = onRecap ? [] : ['board']

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
                key={`${p}-${open}-${faceKey(p, chrome.podium)}`}
                className="face-pop flex items-center justify-center"
              >
                {open ? (
                  <span aria-hidden className="text-[1.15rem] leading-none">
                    ✕
                  </span>
                ) : chrome.switching ? (
                  // Mid season-switch every one of these faces — the
                  // count, the verdict, the podium — is last year's. A
                  // bubble with nothing to say says nothing.
                  <span
                    aria-hidden
                    className="h-2 w-2 animate-pulse rounded-full bg-current opacity-40"
                  />
                ) : (
                  <Face panel={p} podium={chrome.podium} />
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
    case 'board':
      return 'BOARD'
  }
}

function faceKey(panel: Rung, podium: PodiumMember[]): string | number {
  switch (panel) {
    case 'board':
      return podium.map((m) => m.userId).join(',') || '–'
  }
}

function Face({ panel, podium }: { panel: Rung; podium: PodiumMember[] }) {
  switch (panel) {
    case 'board':
      return podium.length > 0 ? (
        <Podium members={podium} />
      ) : (
        <Trophy size={20} strokeWidth={2.25} />
      )
  }
}

/** Gold, silver, bronze — the only place in the app that reaches outside
 *  the blue/pink grammar, because a podium is a podium. */
const MEDAL = [
  { ring: 'ring-[#FFD24A]', z: 'z-30' },
  { ring: 'ring-[#CFD6DD]', z: 'z-20' },
  { ring: 'ring-[#D08B4F]', z: 'z-10' },
] as const

/* The disc is 44px and round, so the cluster has to live inside its
 * inscribed square, rings included — a 2px ring on each of three circles
 * is 12px of the budget on its own. These numbers are that budget spent:
 * first place high and centred, the other two tucked at the corners,
 * nothing touching the disc's edge. */
const PODIUM_BOX = 34
const PODIUM_SPOTS = [
  { left: 8, top: 0, size: 18 },
  { left: 1, top: 15, size: 15 },
  { left: 19, top: 15, size: 15 },
] as const

/**
 * THE PODIUM, clustered the way iMessage stacks a group: first place
 * front and centre, second and third tucked behind at the corners. It
 * says who's winning without a number, which is what a rank is for.
 */
function Podium({ members }: { members: PodiumMember[] }) {
  // Drawn back-to-front so first place overlaps the other two.
  const placed = members.slice(0, 3)
  const spots = PODIUM_SPOTS
  return (
    <span
      className="relative block"
      style={{ width: PODIUM_BOX, height: PODIUM_BOX }}
    >
      {placed
        .map((m, i) => ({ m, i }))
        .reverse()
        .map(({ m, i }) => (
          <Avatar
            key={m.userId}
            title={`${i + 1}. ${m.fullName ?? m.email}`}
            className={`absolute ring-[1.5px] ${MEDAL[i]!.ring} ${MEDAL[i]!.z}`}
            style={{
              left: spots[i]!.left,
              top: spots[i]!.top,
              width: spots[i]!.size,
              height: spots[i]!.size,
            }}
          >
            <AvatarImage src={m.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-primary/80 text-primary-foreground text-[6px] font-bold">
              {podiumInitials(m)}
            </AvatarFallback>
          </Avatar>
        ))}
    </span>
  )
}

function podiumInitials(m: PodiumMember): string {
  const name = m.fullName
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return m.email.slice(0, 2).toUpperCase()
}
