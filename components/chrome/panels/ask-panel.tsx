'use client'

/**
 * ASK — a question that settles nothing.
 *
 * Everything in ADD becomes a line in the league's book; this is the one
 * that doesn't — "what are we calling the trophy", "who's driving" — a
 * poll that lives on a WEEK and closes once it's had its answer.
 *
 * It's on the pod for every week now, not just the preseason. A week can
 * raise a question of its own (someone welched in week six and the
 * punishment needs settling) and the only way to open one used to be a
 * dashed tile sitting under every week that had none.
 */

import { useRouter } from 'next/navigation'
import {
  closePanel,
  markWeekDirty,
} from '@/components/chrome/canvas-store'
import { useViewedWeek } from '@/components/chrome/league-chrome-context'
import { AskTheLeague } from '@/components/polls/poll-composer'

export function AskPanel({
  leagueId,
  fallbackWeekId,
}: {
  leagueId: string
  /** Used only when nothing is on screen yet — the preseason week. */
  fallbackWeekId: string
}) {
  const router = useRouter()
  // THE WEEK YOU'RE LOOKING AT. It was pinned to the preseason week,
  // which was fine while asking was a preseason-only verb and wrong the
  // moment the pod grew an ASK on every week: a question raised in week
  // six would have been filed under week zero.
  const week = useViewedWeek()
  const nflWeekId = week?.id ?? fallbackWeekId
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AskTheLeague
        variant="panel"
        leagueId={leagueId}
        nflWeekId={nflWeekId}
        onCreated={() => {
          // The stage caches the week it's showing, so a new question
          // needs it told rather than just revalidated.
          markWeekDirty()
          router.refresh()
          closePanel()
        }}
      />
    </div>
  )
}
