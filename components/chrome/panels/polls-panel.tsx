'use client'

import { CheckCircle2, ChevronRight, Circle } from 'lucide-react'
import { closePanel } from '@/components/chrome/canvas-store'
import {
  useLeagueChrome,
  useViewedWeek,
} from '@/components/chrome/league-chrome-context'
import { cn } from '@/lib/utils'

export interface PollsPanelPoll {
  id: string
  /** Which week the poll lives in. */
  nflWeekId: string
  title: string
  status: string
  totalVotes: number
  viewerVoted: boolean
}

/**
 * THIS WEEK'S POLLS — what the league is deciding right now, and what
 * it already settled. Polls belong to weeks, so this panel shows only
 * the viewed week's; tapping one closes the reveal and puts you back on
 * the week, where the voting itself happens.
 */
export function PollsPanel({ polls }: { polls: PollsPanelPoll[] }) {
  const chrome = useLeagueChrome()
  const week = useViewedWeek()
  if (!chrome || !week) return null

  const mine = polls.filter((p) => p.nflWeekId === week.id)
  const open = mine.filter((p) => p.status === 'open')
  const closed = mine.filter((p) => p.status !== 'open')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="text-muted-foreground mb-3 shrink-0 text-[10px] font-bold tracking-[0.3em] uppercase">
        {week.kind === 'preseason' ? 'Preseason' : `Week ${week.weekNumber}`} polls
      </p>
      <div className="scrollbar-hide min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2">
        {open.map((p) => (
          <PollRow key={p.id} poll={p} memberCount={chrome.memberCount} open />
        ))}
        {closed.length > 0 && (
          <p className="text-muted-foreground/70 pt-2 pb-1 text-[9px] font-bold tracking-[0.3em] uppercase">
            Settled
          </p>
        )}
        {closed.map((p) => (
          <PollRow key={p.id} poll={p} memberCount={chrome.memberCount} />
        ))}
        {mine.length === 0 && (
          <p className="text-muted-foreground px-1 py-4 text-xs italic">
            Nothing to vote on this week.
          </p>
        )}
      </div>
    </div>
  )
}

function PollRow({
  poll,
  memberCount,
  open = false,
}: {
  poll: PollsPanelPoll
  memberCount: number
  open?: boolean
}) {
  return (
    <button
      type="button"
      onClick={closePanel}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
        open
          ? 'border-neon-blue/40 bg-neon-blue/10 hover:bg-neon-blue/15'
          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
      )}
    >
      {poll.viewerVoted ? (
        <CheckCircle2 className="text-neon-blue h-3.5 w-3.5 shrink-0" />
      ) : (
        <Circle
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            open ? 'text-neon-blue' : 'text-muted-foreground/50'
          )}
        />
      )}
      <span className="text-foreground/90 min-w-0 flex-1 truncate text-xs font-medium">
        {poll.title}
      </span>
      <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
        {poll.totalVotes}/{memberCount}
      </span>
      <ChevronRight className="text-muted-foreground/50 h-3.5 w-3.5 shrink-0" />
    </button>
  )
}
