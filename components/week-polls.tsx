'use client'

/**
 * ON THE BALLOT — a week's own questions, under its slate.
 *
 * The preseason is where most league business happens, but not all of it
 * waits for the preseason: someone welches in week 6, the punishment
 * needs deciding, and the place to decide it is the week that raised it.
 * So a week can carry questions, and they sit on the page under the games
 * rather than behind a rung — same section grammar as BETTING SLATE
 * above, same cards as the preseason ballot, same voting mechanics.
 *
 * Absent entirely when a week has no questions, which is most weeks. The
 * one thing always on offer for the people who run the league is the way
 * to ask one.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Hourglass, Lock, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { InlinePollVote } from '@/components/polls/poll-vote'
import { usePollVoting } from '@/components/polls/use-poll-voting'
import {
  getInitials,
  hasAnyAnswer,
  viewerVoteFor,
  type PollMember,
} from '@/components/polls/types'
import { AskTheLeague } from '@/components/polls/poll-composer'
import { closePoll, deletePoll } from '@/app/actions/polls'
import { getAblyClient } from '@/lib/ably/client'
import { channelName } from '@/lib/ably/channels'
import type { LeaguePoll } from '@/lib/data/mock-polls'
import { cn } from '@/lib/utils'

const TOPIC_LABEL: Record<LeaguePoll['topic'], string> = {
  punishment: 'Punishment',
  payout: 'Payout',
  rules: 'Rules',
  season: 'Season',
  fun: 'Fun',
  logistics: 'Logistics',
}

export function WeekPolls({
  leagueId,
  nflWeekId,
  polls,
  currentUserId,
  members,
  canAsk,
  onChanged,
}: {
  leagueId: string
  nflWeekId: string
  polls: LeaguePoll[]
  currentUserId: string
  members: PollMember[]
  /** Owners and admins open and settle questions; everyone votes. */
  canAsk: boolean
  /** A poll was created, closed or deleted — go and re-read the week. */
  onChanged: () => void
}) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const voting = usePollVoting(leagueId, currentUserId)

  const membersById = new Map(members.map((m) => [m.id, m]))

  // Someone else voted, or asked something. The vote overlay survives the
  // refresh, so the tally moves without the viewer's own pick flickering.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DATA_SOURCE !== 'neon') return
    let client: ReturnType<typeof getAblyClient> | null = null
    try {
      client = getAblyClient()
    } catch {
      return
    }
    const ch = client.channels.get(channelName.polls(leagueId))
    const onAny = () => {
      router.refresh()
      onChanged()
    }
    ch.subscribe(onAny)
    return () => ch.unsubscribe(onAny)
  }, [leagueId, router, onChanged])

  // Nothing to vote on and no right to ask — the section isn't a thing
  // that exists on this week.
  if (polls.length === 0 && !canAsk) return null

  const open = polls.filter((p) => p.status === 'open')
  const needsMe = open.filter(
    (p) => !hasAnyAnswer(viewerVoteFor(p, voting.sessionVotes, currentUserId))
  ).length

  return (
    <section className="mt-10">
      {/* The slate's heading rule, said again — this is another section of
          the same page, not another kind of page. */}
      <div className="mb-3 flex items-end justify-between gap-3 border-b border-white/[0.07] pb-2.5">
        <h2 className="font-display text-xl leading-none tracking-tight uppercase">
          <span className="text-neon-pink">On the</span>{' '}
          <span className="text-foreground/80">Ballot</span>
        </h2>
        <p className="text-muted-foreground shrink-0 text-[10px] font-bold tracking-[0.2em] uppercase tabular-nums">
          {open.length === 0
            ? 'Nothing open'
            : needsMe > 0
              ? `${needsMe} need you`
              : 'All in'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        {polls.map((poll) => {
          const myVote = viewerVoteFor(poll, voting.sessionVotes, currentUserId)
          const expanded = openId === poll.id
          return (
            <PollCard
              key={poll.id}
              poll={poll}
              expanded={expanded}
              voted={hasAnyAnswer(myVote)}
              membersById={membersById}
              onToggle={() => setOpenId(expanded ? null : poll.id)}
            >
              <InlinePollVote
                poll={poll}
                currentUserId={currentUserId}
                sessionVote={myVote}
                onVote={(v) => voting.recordVote(poll.id, v)}
                membersById={membersById}
                sessionOptionReactions={voting.sessionOptionReactions}
                onOptionReaction={(optionId, value) =>
                  voting.setOptionReaction(poll.id, optionId, value)
                }
                sessionAddedOptions={voting.sessionAddedOptions.get(poll.id) ?? []}
                onAddOption={(label) =>
                  voting.addOption(poll.id, label, poll.optionPolicy)
                }
                canManage={canAsk}
              />
              {canAsk && (
                <Settle
                  leagueId={leagueId}
                  poll={poll}
                  onDone={() => {
                    setOpenId(null)
                    onChanged()
                    router.refresh()
                  }}
                />
              )}
            </PollCard>
          )
        })}

        {canAsk && (
          <AskTheLeague
            leagueId={leagueId}
            nflWeekId={nflWeekId}
            onCreated={() => {
              onChanged()
              router.refresh()
            }}
          />
        )}
      </div>
    </section>
  )
}

/**
 * One question. Closed like the preseason's ballot cards — slab, topic,
 * the question, who's answered — and opening it drops the vote in
 * underneath rather than sending you to another surface. An open card
 * takes the full width, because two columns of half-width ballots is a
 * shape nothing votes well in.
 */
function PollCard({
  poll,
  expanded,
  voted,
  membersById,
  onToggle,
  children,
}: {
  poll: LeaguePoll
  expanded: boolean
  voted: boolean
  membersById: Map<string, PollMember>
  onToggle: () => void
  children: React.ReactNode
}) {
  const closed = poll.status !== 'open'
  const voterIds = [...new Set(poll.responses.map((r) => r.userId))]
  const needsYou = !voted && !closed

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border transition-colors',
        expanded && 'xl:col-span-2',
        needsYou
          ? 'border-neon-pink/35 bg-neon-pink/[0.06]'
          : 'border-white/10 bg-white/[0.02]'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="group flex w-full items-stretch text-left transition-colors hover:bg-white/[0.03]"
      >
        {/* The app's slab, carrying the one thing you want to know about a
            question before you read it: whether it's waiting on you. */}
        <div
          aria-hidden
          className="relative flex w-[3.5rem] shrink-0 items-center justify-center self-stretch"
          style={{
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 9px) 100%, 0 100%)',
            background: closed
              ? 'linear-gradient(150deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))'
              : voted
                ? 'linear-gradient(150deg, rgba(0,217,255,0.14), rgba(0,217,255,0.03))'
                : 'linear-gradient(150deg, rgba(255,105,180,0.22), rgba(255,105,180,0.04))',
          }}
        >
          {closed ? (
            <Lock className="text-muted-foreground/70 h-4 w-4" strokeWidth={2.25} />
          ) : voted ? (
            <Check className="text-neon-blue h-5 w-5" strokeWidth={2.5} />
          ) : (
            <Hourglass className="text-neon-pink h-5 w-5" strokeWidth={2.25} />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-2.5 pr-3 pl-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground/70 truncate text-[10px] font-bold tracking-[0.2em] uppercase">
              {TOPIC_LABEL[poll.topic]}
            </span>
            <span
              className={cn(
                'ml-auto shrink-0 text-[10px] font-bold tracking-[0.2em] uppercase',
                closed
                  ? 'text-muted-foreground/60'
                  : voted
                    ? 'text-muted-foreground/60'
                    : 'text-neon-pink'
              )}
            >
              {closed ? 'Settled' : voted ? 'Voted' : 'Needs you'}
            </span>
          </div>

          <p className="text-foreground/90 text-sm leading-snug font-semibold">
            {poll.title}
          </p>

          <div className="mt-auto flex items-center gap-2">
            {voterIds.length > 0 && (
              <div className="flex -space-x-1.5">
                {voterIds.slice(0, 6).map((id) => {
                  const m = membersById.get(id)
                  return (
                    <Avatar key={id} className="h-5 w-5 ring-2 ring-black/40">
                      <AvatarImage src={m?.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-primary/70 text-primary-foreground text-[7px] font-bold">
                        {getInitials(m?.fullName ?? null, m?.email ?? '')}
                      </AvatarFallback>
                    </Avatar>
                  )
                })}
              </div>
            )}
            <span className="text-muted-foreground/60 text-[10px] tabular-nums">
              {voterIds.length} in
            </span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-white/10 px-3 py-3">{children}</div>
      )}
    </div>
  )
}

/** Settling a question, for the people who run the league: shut it so it
 *  stands as the answer, or bin it if it was a bad question. */
function Settle({
  leagueId,
  poll,
  onDone,
}: {
  leagueId: string
  poll: LeaguePoll
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const run = async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true)
    await fn()
    setBusy(false)
    onDone()
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-white/10 pt-3">
      {poll.status === 'open' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => closePoll(leagueId, poll.id))}
          className="text-muted-foreground hover:text-neon-blue hover:border-neon-blue/30 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
        >
          <Lock className="h-3 w-3" />
          Close the vote
        </button>
      )}
      {/* Deleting takes the answers with it, so it asks first — and says
          so, rather than saying "are you sure". */}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          confirming ? run(() => deletePoll(leagueId, poll.id)) : setConfirming(true)
        }
        className="text-destructive/80 hover:text-destructive border-destructive/20 hover:border-destructive/50 ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" />
        {confirming ? 'Delete it and every vote' : 'Delete'}
      </button>
    </div>
  )
}
