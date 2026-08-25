'use client'

/**
 * ASK — a question that settles nothing.
 *
 * The pod's other verb. Everything in ADD becomes a line in the league's
 * book; this is the one that doesn't — "what are we calling the trophy",
 * "who's driving" — a poll that lives on the week and closes when it's
 * had its answer. Genuinely a different object from a charter item, which
 * is why it's a second bubble rather than a checkbox on the first.
 */

import { useRouter } from 'next/navigation'
import { closePanel } from '@/components/chrome/canvas-store'
import { AskTheLeague } from '@/components/polls/poll-composer'

export function AskPanel({
  leagueId,
  nflWeekId,
}: {
  leagueId: string
  nflWeekId: string
}) {
  const router = useRouter()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AskTheLeague
        variant="panel"
        leagueId={leagueId}
        nflWeekId={nflWeekId}
        onCreated={() => {
          router.refresh()
          closePanel()
        }}
      />
    </div>
  )
}
