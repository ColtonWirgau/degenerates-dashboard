'use client'

import Link from 'next/link'
import { CheckCircle2, ChevronRight, Circle } from 'lucide-react'
import { closePanel } from '@/components/chrome/canvas-store'
import { cn } from '@/lib/utils'

export interface PollsPanelPoll {
  id: string
  title: string
  status: string
  totalVotes: number
  memberCount: number
  viewerVoted: boolean
}

/**
 * The POLLS panel: the league's open questions at a glance — what needs
 * your vote, what's already settled. The full voting flow lives on the
 * league page's hub; rows jump there.
 */
export function PollsPanel({
  leagueId,
  polls,
}: {
  leagueId: string
  polls: PollsPanelPoll[]
}) {
  const open = polls.filter((p) => p.status === 'open')
  const closed = polls.filter((p) => p.status !== 'open')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="text-muted-foreground mb-3 shrink-0 text-[10px] font-bold tracking-[0.3em] uppercase">
        League polls
      </p>
      <div className="scrollbar-hide min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-2">
        {open.map((p) => (
          <PollRow key={p.id} leagueId={leagueId} poll={p} open />
        ))}
        {closed.length > 0 && (
          <p className="text-muted-foreground/70 pt-2 pb-1 text-[9px] font-bold tracking-[0.3em] uppercase">
            Settled
          </p>
        )}
        {closed.map((p) => (
          <PollRow key={p.id} leagueId={leagueId} poll={p} />
        ))}
        {polls.length === 0 && (
          <p className="text-muted-foreground px-1 py-4 text-xs italic">
            No polls yet.
          </p>
        )}
      </div>
    </div>
  )
}

function PollRow({
  leagueId,
  poll,
  open = false,
}: {
  leagueId: string
  poll: PollsPanelPoll
  open?: boolean
}) {
  return (
    <Link
      href={`/leagues/${leagueId}`}
      onClick={closePanel}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors',
        open
          ? 'border-neon-purple/40 bg-neon-purple/10 hover:bg-neon-purple/15'
          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.06]'
      )}
    >
      {poll.viewerVoted ? (
        <CheckCircle2 className="text-neon-blue h-3.5 w-3.5 shrink-0" />
      ) : (
        <Circle
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            open ? 'text-neon-purple' : 'text-muted-foreground/50'
          )}
        />
      )}
      <span className="text-foreground/90 min-w-0 flex-1 truncate text-xs font-medium">
        {poll.title}
      </span>
      <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
        {poll.totalVotes}/{poll.memberCount}
      </span>
      <ChevronRight className="text-muted-foreground/50 h-3.5 w-3.5 shrink-0" />
    </Link>
  )
}
